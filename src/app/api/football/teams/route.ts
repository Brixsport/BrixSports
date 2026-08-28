import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, playerTeamAffiliations } from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

export async function GET() {
    try {
        // Fetch all football teams
        const footballTeams = await db
            .select()
            .from(teams)
            .where(eq(teams.sport, 'Football'))
            .all();

        const teamIds = footballTeams.map(t => t.id);

        // BACKLOG-260: single batched count instead of one players query per
        // team (was a real N+1). No consumer reads the nested players array
        // (grep-confirmed: football/page.tsx's TEAMS tab renders only
        // id/logo/name/shortName; TeamProfileOverlay.tsx does its own
        // independent /api/football/players?teamId= fetch rather than reading
        // this route's payload) -- dropped entirely, playerCount kept.
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

        const teamsWithPlayerCount = footballTeams.map(team => ({
            ...team,
            playerCount: countMap.get(team.id) ?? 0,
        }));

        return NextResponse.json({
            success: true,
            teams: teamsWithPlayerCount,
            count: teamsWithPlayerCount.length,
        });
    } catch (error) {
        console.error('Error fetching football teams:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch football teams' },
            { status: 500 }
        );
    }
}
