/**
 * Competition Fixtures API
 * GET /api/competitions/[id]/fixtures
 * 
 * Returns all fixtures (matches) for a specific competition
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams, competitions } from '@/db/schema';
import { eq, asc, desc, and, or } from 'drizzle-orm';

interface RouteParams {
    params: {
        id: string;
    };
}

/**
 * GET competition fixtures
 */
export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const competitionId = params.id;
        const { searchParams } = new URL(request.url);

        // Query parameters
        const status = searchParams.get('status'); // UPCOMING, LIVE, FINISHED
        const teamId = searchParams.get('teamId'); // Filter by team
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100), 100);
        const offset = parseInt(searchParams.get('offset') || '0');
        const sortBy = searchParams.get('sortBy') || 'date'; // 'date' | 'date_desc'

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

        // Build filters
        const filters = [eq(matches.competition, competition.name)];

        if (status) {
            filters.push(eq(matches.status, status));
        }

        if (teamId) {
            filters.push(
                or(
                    eq(matches.homeTeamId, teamId),
                    eq(matches.awayTeamId, teamId)
                )!
            );
        }

        // Determine sort order
        const orderBy = sortBy === 'date_desc'
            ? desc(matches.startTime)
            : asc(matches.startTime);

        // Fetch matches with team details
        const fixturesData = await db
            .select({
                match: matches,
                homeTeam: teams,
            })
            .from(matches)
            .leftJoin(teams, eq(matches.homeTeamId, teams.id))
            .where(and(...filters))
            .orderBy(orderBy)
            .limit(limit)
            .offset(offset);

        // Process results to include away team
        const fixtures = await Promise.all(
            fixturesData.map(async (row) => {
                // Get away team
                const [awayTeam] = await db
                    .select()
                    .from(teams)
                    .where(eq(teams.id, row.match.awayTeamId));

                return {
                    ...row.match,
                    homeTeam: row.homeTeam,
                    awayTeam,
                };
            })
        );

        // Group fixtures by status
        const fixturesByStatus = {
            upcoming: fixtures.filter(f => f.status === 'UPCOMING'),
            live: fixtures.filter(f => f.status === 'LIVE' || f.status === 'HALF_TIME'),
            finished: fixtures.filter(f => f.status === 'FINISHED'),
        };

        // Group fixtures by date
        const fixturesByDate: Record<string, any[]> = {};
        fixtures.forEach((fixture) => {
            const dateKey = new Date(fixture.startTime).toISOString().split('T')[0];
            if (!fixturesByDate[dateKey]) {
                fixturesByDate[dateKey] = [];
            }
            fixturesByDate[dateKey].push(fixture);
        });

        return NextResponse.json({
            competition: {
                id: competition.id,
                name: competition.name,
                sport: competition.sport,
                format: competition.format,
                season: competition.season,
            },
            fixtures,
            fixturesByStatus,
            fixturesByDate,
            pagination: {
                limit,
                offset,
                total: fixtures.length,
            },
            filters: {
                status,
                teamId,
                sortBy,
            },
        });
    } catch (error) {
        console.error('Error fetching competition fixtures:', error);
        return NextResponse.json(
            { error: 'Failed to fetch competition fixtures' },
            { status: 500 }
        );
    }
}
