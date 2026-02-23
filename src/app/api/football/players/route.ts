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
            conditions.push(inArray(playerTeamAffiliations.teamId, footballTeamIds));
        }

        query = query.where(and(...conditions)) as any;

        const footballPlayers = await query
            .orderBy(orderByClause)
            .all();

        const transformedPlayers = await Promise.all(
            footballPlayers.map(async ({ player, team }) => ({
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
        console.error('Error fetching football players:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch football players' },
            { status: 500 }
        );
    }
}
