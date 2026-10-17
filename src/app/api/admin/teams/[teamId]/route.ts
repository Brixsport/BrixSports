import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { teamId: string } },
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { teamId } = params;

        const existing = await db
            .select({ id: teams.id })
            .from(teams)
            .where(eq(teams.id, teamId))
            .get();

        if (!existing) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });
        }

        const allowedFields = ['logo', 'shortName', 'color'] as const;
        const updateData: Partial<typeof teams.$inferInsert> = {};

        for (const field of allowedFields) {
            if (!(field in body)) continue;
            const val = body[field];
            if (typeof val !== 'string') {
                return NextResponse.json({ error: `${field} must be a string` }, { status: 422 });
            }
            updateData[field] = val;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const updated = await db
            .update(teams)
            .set(updateData)
            .where(eq(teams.id, teamId))
            .returning()
            .get();

        return NextResponse.json({ team: updated });
    } catch (error) {
        console.error('Error updating team:', error);
        return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
    } finally {
        // no resources to release -- Turso's HTTP client is stateless
    }
}
