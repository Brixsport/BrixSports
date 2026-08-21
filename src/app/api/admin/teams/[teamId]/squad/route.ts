import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { playerTeamAffiliations, players, squadPlayers, teams } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';

// ─── GET /api/admin/teams/[teamId]/squad?competitionId=xxx ────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: { teamId: string } },
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { teamId } = params;
        const { searchParams } = new URL(request.url);
        const competitionId = searchParams.get('competitionId');

        if (!competitionId) {
            return NextResponse.json({ error: 'competitionId query param is required' }, { status: 400 });
        }

        const teamExists = await db.query.teams.findFirst({
            where: eq(teams.id, teamId),
            columns: { id: true },
        });
        if (!teamExists) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        const rows = await db
            .select({
                squadPlayerId: squadPlayers.id,
                playerId: squadPlayers.playerId,
                name: players.name,
                jerseyName: players.jerseyName,
                position: players.position,
                role: squadPlayers.role,
                status: squadPlayers.status,
                squadNumber: squadPlayers.squadNumber,
            })
            .from(squadPlayers)
            .innerJoin(players, eq(squadPlayers.playerId, players.id))
            .where(
                and(
                    eq(squadPlayers.teamId, teamId),
                    eq(squadPlayers.competitionId, competitionId),
                ),
            )
            .orderBy(players.name)
            .all();

        return NextResponse.json({ squad: rows });
    } catch (error) {
        console.error('Error fetching team squad:', error);
        return NextResponse.json({ error: 'Failed to fetch squad' }, { status: 500 });
    } finally {
        // no resources to release
    }
}

// ─── POST /api/admin/teams/[teamId]/squad ─────────────────────────────────────

export async function POST(
    request: NextRequest,
    { params }: { params: { teamId: string } },
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { teamId } = params;

        const teamExists = await db.query.teams.findFirst({
            where: eq(teams.id, teamId),
            columns: { id: true },
        });
        if (!teamExists) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        let body: { competitionId: string; playerIds: string[] };
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 });
        }

        if (!body.competitionId || !Array.isArray(body.playerIds) || body.playerIds.length === 0) {
            return NextResponse.json(
                { error: 'competitionId and a non-empty playerIds array are required' },
                { status: 422 },
            );
        }

        const { competitionId, playerIds } = body;

        const results: { playerId: string; status: 'inserted' | 'skipped' | 'error'; reason?: string }[] = [];

        for (const playerId of playerIds) {
            // 1. Player must be on this team's roster
            const affiliation = await db
                .select({ id: playerTeamAffiliations.id })
                .from(playerTeamAffiliations)
                .where(
                    and(
                        eq(playerTeamAffiliations.playerId, playerId),
                        eq(playerTeamAffiliations.teamId, teamId),
                    ),
                )
                .get();

            if (!affiliation) {
                results.push({ playerId, status: 'error', reason: 'player_not_on_roster' });
                continue;
            }

            // 2. Application-level dedup before hitting the DB constraint
            const existing = await db
                .select({ id: squadPlayers.id })
                .from(squadPlayers)
                .where(
                    and(
                        eq(squadPlayers.teamId, teamId),
                        eq(squadPlayers.competitionId, competitionId),
                        eq(squadPlayers.playerId, playerId),
                    ),
                )
                .get();

            if (existing) {
                results.push({ playerId, status: 'skipped', reason: 'already_in_squad' });
                continue;
            }

            // 3. Insert
            try {
                await db.insert(squadPlayers).values({
                    id: nanoid(),
                    teamId,
                    competitionId,
                    playerId,
                    role: 'player',
                    status: 'active',
                    selectedBy: authUser.id,
                    selectedAt: new Date(),
                    createdAt: new Date(),
                });
                results.push({ playerId, status: 'inserted' });
            } catch (err) {
                // Catch unique constraint violation if app-level dedup raced
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes('UNIQUE constraint failed')) {
                    results.push({ playerId, status: 'skipped', reason: 'already_in_squad' });
                } else {
                    results.push({ playerId, status: 'error', reason: 'insert_failed' });
                }
            }
        }

        return NextResponse.json({
            inserted: results.filter((r) => r.status === 'inserted').length,
            skipped: results.filter((r) => r.status === 'skipped').length,
            results,
        });
    } catch (error) {
        console.error('Error adding squad players:', error);
        return NextResponse.json({ error: 'Failed to add squad players' }, { status: 500 });
    } finally {
        // no resources to release
    }
}
