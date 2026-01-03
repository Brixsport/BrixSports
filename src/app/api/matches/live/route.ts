/**
 * Live Matches API
 * GET /api/matches/live
 * Returns all currently live matches with real-time data
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams, matchEvents } from '@/db/schema';
import { eq, or, and, desc, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Query parameters
        const sport = searchParams.get('sport');
        const competitionId = searchParams.get('competitionId');
        const status = searchParams.get('status') || 'LIVE'; // LIVE, UPCOMING, FINISHED
        const includeEvents = searchParams.get('includeEvents') === 'true';

        // Build query for matches
        const filters = [];

        // Status filter - for live matches, include LIVE and HALF_TIME
        if (status === 'LIVE') {
            filters.push(or(
                eq(matches.status, 'LIVE'),
                eq(matches.status, 'HALF_TIME')
            ));
        } else {
            filters.push(eq(matches.status, status));
        }

        if (sport) {
            filters.push(eq(matches.sport, sport));
        }

        if (competitionId) {
            filters.push(eq(matches.competition, competitionId));
        }

        // Fetch matches with teams data
        const liveMatches = await db
            .select({
                match: matches,
                homeTeam: teams,
                awayTeam: teams,
            })
            .from(matches)
            .leftJoin(teams, eq(matches.homeTeamId, teams.id))
            .leftJoin(teams, eq(matches.awayTeamId, teams.id))
            .where(and(...filters))
            .orderBy(desc(matches.startTime));

        // Group results properly
        const matchesWithDetails = [];
        const seenMatches = new Set();

        for (const row of liveMatches) {
            if (seenMatches.has(row.match.id)) continue;
            seenMatches.add(row.match.id);

            // Get both teams
            const homeTeam = liveMatches.find(
                r => r.match.id === row.match.id && r.homeTeam?.id === row.match.homeTeamId
            )?.homeTeam;

            const awayTeam = liveMatches.find(
                r => r.match.id === row.match.id && r.awayTeam?.id === row.match.awayTeamId
            )?.awayTeam;

            let events = null;
            if (includeEvents) {
                // Get recent events (last 10)
                events = await db
                    .select()
                    .from(matchEvents)
                    .where(eq(matchEvents.matchId, row.match.id))
                    .orderBy(desc(matchEvents.minute), desc(matchEvents.second))
                    .limit(10);
            }

            matchesWithDetails.push({
                ...row.match,
                homeTeam,
                awayTeam,
                events,
                stats: row.match.stats ? JSON.parse(row.match.stats) : null,
            });
        }

        return NextResponse.json({
            matches: matchesWithDetails,
            count: matchesWithDetails.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error fetching live matches:', error);
        return NextResponse.json(
            { error: 'Failed to fetch live matches' },
            { status: 500 }
        );
    }
}
