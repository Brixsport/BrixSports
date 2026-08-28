import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, playerTeamAffiliations } from '@/db/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';

export async function GET() {
    try {
        // Fetch all teams
        const allTeams = await db.select().from(teams).all();

        // Filter basketball teams (the ones we just created)
        // BACKLOG-262 item 3: hardcoded name list, not touched here -- separate,
        // already-filed issue, out of this pass's scope.
        const basketballTeamNames = ['TBK', 'Titans', 'Storm', 'Rim Reapers', 'Vikings', 'Siberia'];
        const basketballTeams = allTeams.filter(team =>
            basketballTeamNames.includes(team.name)
        );

        const teamIds = basketballTeams.map(t => t.id);

        // BACKLOG-260: single batched count instead of one players query per
        // team (was a real N+1). No consumer reads the nested players array
        // (same pattern as football/teams/route.ts -- dropped entirely,
        // playerCount kept).
        const counts = teamIds.length > 0
            ? await db
                .select({
                    teamId: playerTeamAffiliations.teamId,
                    count: sql<number>`count(*)`,
                })
                .from(playerTeamAffiliations)
                .where(and(
                    inArray(playerTeamAffiliations.teamId, teamIds),
                    eq(playerTeamAffiliations.isActive, true)
                ))
                .groupBy(playerTeamAffiliations.teamId)
                .all()
            : [];

        const countMap = new Map(counts.map(c => [c.teamId, c.count]));

        const teamsWithPlayerCount = basketballTeams.map(team => ({
            ...team,
            playerCount: countMap.get(team.id) ?? 0,
        }));

        return NextResponse.json({
            success: true,
            teams: teamsWithPlayerCount,
            count: teamsWithPlayerCount.length,
        });
    } catch (error) {
        console.error('Error fetching basketball teams:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch basketball teams' },
            { status: 500 }
        );
    }
}
