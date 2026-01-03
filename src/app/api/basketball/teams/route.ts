import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, players } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

export async function GET() {
    try {
        // Fetch all teams
        const allTeams = await db.select().from(teams).all();

        // Filter basketball teams (the ones we just created)
        const basketballTeamNames = ['TBK', 'Titans', 'Storm', 'Rim Reapers', 'Vikings', 'Siberia'];
        const basketballTeams = allTeams.filter(team =>
            basketballTeamNames.includes(team.name)
        );

        // Fetch players for each team
        const teamsWithPlayers = await Promise.all(
            basketballTeams.map(async (team) => {
                const teamPlayers = await db
                    .select()
                    .from(players)
                    .where(eq(players.teamId, team.id))
                    .all();

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
        console.error('Error fetching basketball teams:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch basketball teams' },
            { status: 500 }
        );
    }
}
