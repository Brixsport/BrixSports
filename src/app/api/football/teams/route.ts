import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, players, playerTeamAffiliations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET() {
    try {
        // Fetch all football teams
        const footballTeams = await db
            .select()
            .from(teams)
            .where(eq(teams.sport, 'Football'))
            .all();

        // Fetch players for each team via affiliations
        const teamsWithPlayers = await Promise.all(
            footballTeams.map(async (team) => {
                const teamPlayerRows = await db
                    .select({ player: players })
                    .from(playerTeamAffiliations)
                    .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
                    .where(
                        and(
                            eq(playerTeamAffiliations.teamId, team.id),
                            eq(playerTeamAffiliations.isActive, true)
                        )
                    )
                    .all();

                const teamPlayers = teamPlayerRows.map(row => row.player);

                return {
                    ...team,
                    players: teamPlayers,
                    playerCount: teamPlayers.length,
                };
            })
        );

        return NextResponse.json({
            success: true,
            teams: teamsWithPlayers,
            count: teamsWithPlayers.length,
        });
    } catch (error) {
        console.error('Error fetching football teams:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch football teams' },
            { status: 500 }
        );
    }
}
