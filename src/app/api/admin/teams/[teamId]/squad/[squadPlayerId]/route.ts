import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { squadPlayers } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';

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
