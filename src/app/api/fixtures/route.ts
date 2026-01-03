/**
 * Fixtures API
 * GET /api/fixtures - Get upcoming and recent matches
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { eq, and, gte, lte, or, desc, asc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Query parameters
        const sport = searchParams.get('sport');
        const competitionId = searchParams.get('competitionId');
        const teamId = searchParams.get('teamId');
        const date = searchParams.get('date'); // YYYY-MM-DD
        const dateFrom = searchParams.get('dateFrom'); // YYYY-MM-DD
        const dateTo = searchParams.get('dateTo'); // YYYY-MM-DD
        const status = searchParams.get('status'); // UPCOMING, LIVE, FINISHED
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const view = searchParams.get('view') || 'upcoming'; // 'upcoming', 'today', 'week', 'month', 'all'

        // Build date filters based on view
        const now = new Date();
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        switch (view) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                endDate = new Date(now.setHours(23, 59, 59, 999));
                break;
            case 'week':
                startDate = new Date();
                endDate = new Date();
                endDate.setDate(endDate.getDate() + 7);
                break;
            case 'month':
                startDate = new Date();
                endDate = new Date();
                endDate.setMonth(endDate.getMonth() + 1);
                break;
            case 'upcoming':
                startDate = new Date();
                endDate = new Date();
                endDate.setMonth(endDate.getMonth() + 3); // Next 3 months
                break;
        }

        // Override with custom date range if provided
        if (dateFrom) startDate = new Date(dateFrom);
        if (dateTo) endDate = new Date(dateTo);
        if (date) {
            startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
        }

        // Build filters
        const filters = [];

        if (sport) filters.push(eq(matches.sport, sport));
        if (competitionId) filters.push(eq(matches.competition, competitionId));
        if (status) filters.push(eq(matches.status, status));

        // Team filter (home or away)
        if (teamId) {
            filters.push(
                or(
                    eq(matches.homeTeamId, teamId),
                    eq(matches.awayTeamId, teamId)
                )
            );
        }

        // Date range filter
        if (startDate && endDate) {
            filters.push(
                and(
                    gte(matches.startTime, startDate.toISOString()),
                    lte(matches.startTime, endDate.toISOString())
                )
            );
        } else if (startDate) {
            filters.push(gte(matches.startTime, startDate.toISOString()));
        } else if (endDate) {
            filters.push(lte(matches.startTime, endDate.toISOString()));
        }

        // Fetch matches with teams
        const fixturesData = await db
            .select({
                match: matches,
                homeTeam: teams,
            })
            .from(matches)
            .leftJoin(teams, eq(matches.homeTeamId, teams.id))
            .where(filters.length > 0 ? and(...filters) : undefined)
            .orderBy(asc(matches.startTime))
            .limit(limit)
            .offset(offset);

        // Process results to include both teams
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
            fixtures,
            fixturesByDate,
            pagination: {
                limit,
                offset,
                total: fixtures.length,
            },
            filters: {
                sport,
                competitionId,
                teamId,
                date,
                dateFrom,
                dateTo,
                status,
                view,
            },
        });
    } catch (error) {
        console.error('Error fetching fixtures:', error);
        return NextResponse.json(
            { error: 'Failed to fetch fixtures' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/fixtures - Create a new fixture/match
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            sport,
            homeTeamId,
            awayTeamId,
            startTime,
            venue,
            competition,
            status = 'UPCOMING',
        } = body;

        // Validation
        if (!sport || !homeTeamId || !awayTeamId || !startTime || !venue || !competition) {
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    required: ['sport', 'homeTeamId', 'awayTeamId', 'startTime', 'venue', 'competition']
                },
                { status: 400 }
            );
        }

        // Validate teams exist
        const [homeTeam] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, homeTeamId));

        const [awayTeam] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, awayTeamId));

        if (!homeTeam || !awayTeam) {
            return NextResponse.json(
                { error: 'One or both teams not found' },
                { status: 404 }
            );
        }

        // Validate teams are different
        if (homeTeamId === awayTeamId) {
            return NextResponse.json(
                { error: 'Home and away teams must be different' },
                { status: 400 }
            );
        }

        // Generate match ID
        const matchId = `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create the match
        await db.insert(matches).values({
            id: matchId,
            sport,
            homeTeamId,
            awayTeamId,
            homeScore: 0,
            awayScore: 0,
            status,
            startTime: new Date(startTime).toISOString(),
            venue,
            competition,
            stats: null,
            lineups: null,
        });

        // Fetch the created match with team details
        const [createdMatch] = await db
            .select({
                match: matches,
                homeTeam: teams,
            })
            .from(matches)
            .leftJoin(teams, eq(matches.homeTeamId, teams.id))
            .where(eq(matches.id, matchId));

        // Get away team
        const [awayTeamData] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, awayTeamId));

        return NextResponse.json(
            {
                success: true,
                matchId,
                match: {
                    ...createdMatch.match,
                    homeTeam: createdMatch.homeTeam,
                    awayTeam: awayTeamData,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error creating fixture:', error);
        return NextResponse.json(
            { error: 'Failed to create fixture' },
            { status: 500 }
        );
    }
}
