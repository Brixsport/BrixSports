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

        // Fetch all football teams first to identify ids
        const footballTeams = await db
            .select()
            .from(teams)
            .where(eq(teams.sport, 'Football'))
            .all();

        const footballTeamIds = footballTeams.map(t => t.id);

        if (footballTeamIds.length === 0) {
            return NextResponse.json({
                success: true,
                players: [],
                count: 0,
            });
        }

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
            conditions.push(inArray(players.teamId, footballTeamIds));
        }

        if (conditions.length > 0) {
            const { and } = require('drizzle-orm');
            query = query.where(and(...conditions)) as any;
        }

        const footballPlayers = await query
            .orderBy(orderByClause)
            .all();

        const transformedPlayers = await Promise.all(
            footballPlayers.map(async (player) => {
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
        console.error('Error fetching football players:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch football players' },
            { status: 500 }
        );
    }
}
