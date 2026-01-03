/**
 * Competition Teams API
 * Get teams participating in a competition
 * 
 * Note: Competitions are stored as text fields in the current schema.
 * This endpoint returns teams that have matches in the specified competition.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, matches } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * GET teams in a competition
 * GET /api/competitions/[id]/teams
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const competitionName = decodeURIComponent(params.id);

        // Get all matches for this competition
        const competitionMatches = await db
            .select()
            .from(matches)
            .where(eq(matches.competition, competitionName));

        if (competitionMatches.length === 0) {
            return NextResponse.json(
                { error: 'Competition not found' },
                { status: 404 }
            );
        }

        // Extract unique team IDs
        const teamIds = new Set<string>();
        competitionMatches.forEach(match => {
            teamIds.add(match.homeTeamId);
            teamIds.add(match.awayTeamId);
        });

        // Fetch team details
        const teamsData = await db
            .select()
            .from(teams)
            .where(sql`${teams.id} IN (${Array.from(teamIds).map(id => `'${id}'`).join(',')})`);

        return NextResponse.json({
            competition: {
                name: competitionName,
                sport: competitionMatches[0]?.sport || 'Football',
                teamCount: teamIds.size,
            },
            teams: teamsData,
        });
    } catch (error) {
        console.error('Error fetching competition teams:', error);
        return NextResponse.json(
            { error: 'Failed to fetch teams' },
            { status: 500 }
        );
    }
}

/**
 * POST and DELETE not supported
 * Team-competition relationships are managed through matches
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    return NextResponse.json(
        { error: 'Adding teams not supported. Teams are associated through matches.' },
        { status: 501 }
    );
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    return NextResponse.json(
        { error: 'Removing teams not supported. Teams are associated through matches.' },
        { status: 501 }
    );
}
