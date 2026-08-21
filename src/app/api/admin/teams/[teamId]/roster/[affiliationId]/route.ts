import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { playerTeamAffiliations } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { teamId: string; affiliationId: string } },
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { teamId, affiliationId } = params;

        const existing = await db
            .select({
                id: playerTeamAffiliations.id,
                teamId: playerTeamAffiliations.teamId,
            })
            .from(playerTeamAffiliations)
            .where(eq(playerTeamAffiliations.id, affiliationId))
            .get();

        if (!existing || existing.teamId !== teamId) {
            return NextResponse.json({ error: 'Affiliation not found' }, { status: 404 });
        }

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });
        }

        const allowedFields = ['jerseyNumber', 'position', 'nicknames', 'isActive'] as const;
        const updateData: Partial<typeof playerTeamAffiliations.$inferInsert> = {};

        for (const field of allowedFields) {
            if (!(field in body)) continue;
            if (field === 'nicknames') {
                const val = body.nicknames;
                updateData.nicknames = Array.isArray(val) ? JSON.stringify(val) : null;
            } else if (field === 'jerseyNumber') {
                updateData.jerseyNumber = body.jerseyNumber as number | null;
            } else if (field === 'position') {
                updateData.position = body.position as string | null;
            } else if (field === 'isActive') {
                updateData.isActive = body.isActive as boolean;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const updated = await db
            .update(playerTeamAffiliations)
            .set(updateData)
            .where(and(
                eq(playerTeamAffiliations.id, affiliationId),
                eq(playerTeamAffiliations.teamId, teamId),
            ))
            .returning()
            .get();

        return NextResponse.json({ affiliation: updated });
    } catch (error) {
        console.error('Error updating roster affiliation:', error);
        return NextResponse.json({ error: 'Failed to update affiliation' }, { status: 500 });
    } finally {
        // no resources to release
    }
}
