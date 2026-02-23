import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, teams, playerTeamAffiliations } from '@/db/schema';
import { eq, desc, inArray, and } from 'drizzle-orm';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sortBy = searchParams.get('sortBy') || 'rating';
        const teamId = searchParams.get('teamId');
        const search = searchParams.get('search');

        // Fetch all teams first to identify basketball teams
        const allTeams = await db.select().from(teams).all();
        const basketballTeamNames = ['TBK', 'Titans', 'Storm', 'Rim Reapers', 'Vikings', 'Siberia'];
        const basketballTeams = allTeams.filter(team =>
            basketballTeamNames.includes(team.name)
        );
        const basketballTeamIds = basketballTeams.map(t => t.id);

        // Build query with conditional sorting
        const orderByClause = sortBy === 'rating' ? desc(players.rating) :
            sortBy === 'eyePoints' ? desc(players.eyePoints) :
                desc(players.rating);

        let query = db
            .select({ player: players, team: teams })
            .from(playerTeamAffiliations)
            .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
            .innerJoin(teams, eq(playerTeamAffiliations.teamId, teams.id));

        // Apply filters
        const conditions = [eq(playerTeamAffiliations.isActive, true)];

        if (search) {
            conditions.push(eq(players.name, search));
        }

        if (teamId) {
            conditions.push(eq(playerTeamAffiliations.teamId, teamId));
        } else {
            conditions.push(inArray(playerTeamAffiliations.teamId, basketballTeamIds));
        }

        query = query.where(and(...conditions)) as any;

        const basketballPlayers = await query
            .orderBy(orderByClause)
            .all();

        const transformedPlayers = await Promise.all(
            basketballPlayers.map(async ({ player, team }) => ({
                ...player,
                team,
            }))
        );

        return NextResponse.json({
            success: true,
            players: transformedPlayers,
            count: transformedPlayers.length,
        });
    } catch (error) {
        console.error('Error fetching basketball players:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch basketball players' },
            { status: 500 }
        );
    }
}
