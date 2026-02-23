import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, teams, playerTeamAffiliations } from '@/db/schema';
import { eq, inArray, or, like } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const ids = searchParams.get('ids');
        const search = searchParams.get('search');
        const department = searchParams.get('department');
        const college = searchParams.get('college');
        const university = searchParams.get('university');

        // Fetch by multiple IDs
        if (ids) {
            const playerIds = ids.split(',').map(id => id.trim()).filter(Boolean);
            if (playerIds.length === 0) {
                return NextResponse.json({ success: true, players: [] });
            }
            const foundPlayers = await db.select().from(players).where(inArray(players.id, playerIds));
            return NextResponse.json({ success: true, players: foundPlayers });
        }

        // Hierarchy filters (Department, College, University)
        if (department || college || university) {
            if (university && !department && !college) {
                // Match players by university on either the player row, the primary team, or any affiliation team
                const primaryRows = await db
                    .select({ player: players })
                    .from(players)
                    .leftJoin(teams, eq(players.teamId, teams.id))
                    .where(
                        or(
                            eq(players.university, university),
                            eq(teams.university, university)
                        )
                    );

                const affiliationRows = await db
                    .select({ player: players })
                    .from(playerTeamAffiliations)
                    .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
                    .innerJoin(teams, eq(playerTeamAffiliations.teamId, teams.id))
                    .where(eq(teams.university, university));

                const combinedMap = new Map<string, typeof players.$inferSelect>();
                for (const row of primaryRows) {
                    combinedMap.set(row.player.id, row.player);
                }
                for (const row of affiliationRows) {
                    combinedMap.set(row.player.id, row.player);
                }

                return NextResponse.json({
                    success: true,
                    players: Array.from(combinedMap.values()),
                });
            }

            let query = db.select().from(players);
            const conditions = [];

            if (department) conditions.push(eq(players.department, department));
            if (college) conditions.push(eq(players.college, college));
            if (university) conditions.push(eq(players.university, university));

            const results = await query.where(conditions.length > 1 ? or(...conditions) : conditions[0]);
            return NextResponse.json({ success: true, players: results });
        }

        // Fetch by team ID via active affiliations
        if (teamId) {
            const affiliatedRows = await db
                .select({ player: players })
                .from(playerTeamAffiliations)
                .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
                .where(
                    and(
                        eq(playerTeamAffiliations.teamId, teamId),
                        eq(playerTeamAffiliations.isActive, true)
                    )
                );

            return NextResponse.json({
                success: true,
                players: affiliatedRows.map(row => row.player),
            });
        }

        // Search across player profile and all affiliations
        if (search) {
            const pattern = `%${search}%`;

            // Players matching by their own fields
            const profileRows = await db
                .select({ player: players })
                .from(players)
                .where(
                    or(
                        like(players.name, pattern),
                        like(players.jerseyName, pattern),
                        like(players.college, pattern),
                        like(players.department, pattern),
                        like(players.university, pattern),
                        like(players.email, pattern),
                    )
                );

            // Teams that match the search text
            const matchingTeams = await db
                .select({ id: teams.id })
                .from(teams)
                .where(
                    or(
                        like(teams.name, pattern),
                        like(teams.shortName, pattern),
                        like(teams.university, pattern),
                    )
                );

            const teamIds = matchingTeams.map(t => t.id);

            // Players affiliated to matching teams
            const affiliationRows = teamIds.length
                ? await db
                    .select({ player: players })
                    .from(playerTeamAffiliations)
                    .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
                    .where(inArray(playerTeamAffiliations.teamId, teamIds))
                : [];

            const combinedMap = new Map<string, typeof players.$inferSelect>();
            for (const row of profileRows) {
                combinedMap.set(row.player.id, row.player);
            }
            for (const row of affiliationRows) {
                combinedMap.set(row.player.id, row.player);
            }

            return NextResponse.json({
                success: true,
                players: Array.from(combinedMap.values()),
            });
        }

        // Fetch all players
        const allPlayers = await db.select().from(players);
        return NextResponse.json({ success: true, players: allPlayers });
    } catch (error) {
        console.error('Error fetching players:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch players' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getAuthUser(request as any);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Basic validation - only name and position are required
        // teamId is optional (player can exist without a team but must have institutional data)
        if (!body.name || !body.position) {
            return NextResponse.json({ error: 'Name and Position are required' }, { status: 400 });
        }

        // Validate that player has either a team OR institutional affiliation
        if (!body.teamId && !body.university && !body.college && !body.department) {
            return NextResponse.json({
                error: 'Player must have either a Team ID or institutional affiliation (university, college, or department)',
            }, { status: 400 });
        }

        const playerId = body.id || `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newPlayer = await db.insert(players).values({
            ...body,
            id: playerId,
        }).returning();

        return NextResponse.json(newPlayer[0], { status: 201 });
    } catch (error) {
        console.error('Error creating player:', error);
        return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
    }
}
