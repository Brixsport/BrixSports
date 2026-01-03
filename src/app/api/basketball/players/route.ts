import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, teams } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

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
            .select()
            .from(players);

        // Apply filters
        const conditions = [];

        if (search) {
            conditions.push(eq(players.name, search));
        }

        if (teamId) {
            conditions.push(eq(players.teamId, teamId));
        } else if (!search) {
            conditions.push(inArray(players.teamId, basketballTeamIds));
        }

        if (conditions.length > 0) {
            const { and } = require('drizzle-orm');
            query = query.where(and(...conditions)) as any;
        }

        const basketballPlayers = await query
            .orderBy(orderByClause)
            .all();

        const transformedPlayers = await Promise.all(
            basketballPlayers.map(async (player) => {
                const team = await db
                    .select()
                    .from(teams)
                    .where(eq(teams.id, player.teamId))
                    .get();

                return {
                    ...player,
                    team,
                };
            })
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
