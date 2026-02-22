/**
 * Competition Standings API
 * GET /api/competitions/[id]/standings
 * 
 * Returns the standings table for a specific competition
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { standings, teams, competitions } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

interface RouteParams {
    params: {
        id: string;
    };
}

/**
 * GET competition standings
 */
export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const competitionId = params.id;

        // Check if competition exists
        const [competition] = await db
            .select()
            .from(competitions)
            .where(eq(competitions.id, competitionId));

        if (!competition) {
            return NextResponse.json(
                { error: 'Competition not found' },
                { status: 404 }
            );
        }

        // Get standings for this competition with team details
        const competitionStandings = await db
            .select({
                standing: standings,
                team: teams,
            })
            .from(standings)
            .leftJoin(teams, eq(standings.teamId, teams.id))
            .where(eq(standings.competition, competition.name))
            .orderBy(
                standings.groupName,
                desc(standings.points),
                desc(standings.goalDifference),
                desc(standings.goalsFor)
            );

        // Format the response
        const standingsTable = competitionStandings.map((row, index) => ({
            position: index + 1,
            ...row.standing,
            team: row.team,
        }));

        return NextResponse.json({
            competition: {
                id: competition.id,
                name: competition.name,
                sport: competition.sport,
                format: competition.format,
                season: competition.season,
            },
            standings: standingsTable,
            total: standingsTable.length,
        });
    } catch (error) {
        console.error('Error fetching competition standings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch competition standings' },
            { status: 500 }
        );
    }
}
