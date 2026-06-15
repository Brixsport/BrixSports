import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { squadPlayers } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';

// ─── PATCH /api/admin/teams/[teamId]/squad/[squadPlayerId] ────────────────────

export async function PATCH(
    request: NextRequest,
    { params }: { params: { teamId: string; squadPlayerId: string } },
) {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, squadPlayerId } = params;

    const existing = await db
        .select({ id: squadPlayers.id, teamId: squadPlayers.teamId })
        .from(squadPlayers)
        .where(eq(squadPlayers.id, squadPlayerId))
        .get();

    if (!existing) {
        return NextResponse.json({ error: 'Squad player not found' }, { status: 404 });
    }

    if (existing.teamId !== teamId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });
    }

    const allowedFields = ['squadNumber', 'role', 'status'] as const;
    const updateData: Partial<typeof squadPlayers.$inferInsert> = {};

    for (const field of allowedFields) {
        if (!(field in body)) continue;
        if (field === 'squadNumber') {
            updateData.squadNumber = body.squadNumber as number | null;
        } else if (field === 'role') {
            updateData.role = body.role as string;
        } else if (field === 'status') {
            updateData.status = body.status as string;
        }
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await db
        .update(squadPlayers)
        .set(updateData)
        .where(and(
            eq(squadPlayers.id, squadPlayerId),
            eq(squadPlayers.teamId, teamId),
        ))
        .returning()
        .get();

    return NextResponse.json({ squadPlayer: updated });
}

// ─── DELETE /api/admin/teams/[teamId]/squad/[squadPlayerId] ───────────────────

export async function DELETE(
    request: NextRequest,
    { params }: { params: { teamId: string; squadPlayerId: string } },
) {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, squadPlayerId } = params;

    const row = await db
        .select({ id: squadPlayers.id, teamId: squadPlayers.teamId })
        .from(squadPlayers)
        .where(eq(squadPlayers.id, squadPlayerId))
        .get();

    if (!row) {
        return NextResponse.json({ error: 'Squad player not found' }, { status: 404 });
    }

    if (row.teamId !== teamId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db
        .delete(squadPlayers)
        .where(and(eq(squadPlayers.id, squadPlayerId), eq(squadPlayers.teamId, teamId)));

    return new NextResponse(null, { status: 204 });
}
