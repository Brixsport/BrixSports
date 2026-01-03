import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, players } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
    try {
        // Fetch all football teams
        const footballTeams = await db
            .select()
            .from(teams)
            .where(eq(teams.sport, 'Football'))
            .all();

        // Fetch players for each team
        const teamsWithPlayers = await Promise.all(
            footballTeams.map(async (team) => {
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
        console.error('Error fetching football teams:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch football teams' },
            { status: 500 }
        );
    }
}
