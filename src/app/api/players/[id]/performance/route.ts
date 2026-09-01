/**
 * Player Performance API
 * Fetch player performance data across matches
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchEvents, matches, players } from '@/db/schema';
import { and, eq, desc, inArray } from 'drizzle-orm';
import { playerRatings } from '@/db/schema-ratings';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const playerId = params.id;
        const { searchParams } = new URL(request.url);
        const timeframe = parseInt(searchParams.get('timeframe') || '30');

        // Calculate date threshold
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - timeframe);

        // Get player info
        const [player] = await db
            .select()
            .from(players)
            .where(eq(players.id, playerId))
            .limit(1);

        if (!player) {
            return NextResponse.json(
                { error: 'Player not found' },
                { status: 404 }
            );
        }

        // Get all matches where player participated. BACKLOG-315: was missing
        // a .limit() (CLAUDE.md-mandatory on every list query).
        const playerEvents = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.playerId, playerId))
            .orderBy(desc(matchEvents.createdAt))
            .limit(1000);

        // Group events by match
        const matchIds = [...new Set(playerEvents.map(e => e.matchId))];

        // BACKLOG-315: was N+1 (one query per match inside Promise.all) -- one
        // batched query instead.
        const matchDetails = matchIds.length > 0
            ? await db.select().from(matches).where(inArray(matches.id, matchIds))
            : [];

        // Filter by timeframe
        const recentMatches = matchDetails.filter(m => new Date(m.startTime) >= thresholdDate);

        // BACKLOG-315: real per-match ratings from playerRatings, batched --
        // this route used to run every match through calculatePlayerRating(),
        // a hardcoded formula (base 5.0 +/- made-up weights per event type)
        // with zero relationship to the real ratings pipeline shown everywhere
        // else on the platform. Never fabricate a plausible-looking number:
        // null means genuinely not yet rated, same rule as BACKLOG-250/254.
        const recentMatchIds = recentMatches.map(m => m.id);
        const ratingRows = recentMatchIds.length > 0
            ? await db
                .select({
                    matchId: playerRatings.matchId,
                    finalRating: playerRatings.finalRating,
                    autoRating: playerRatings.autoRating,
                })
                .from(playerRatings)
                .where(and(inArray(playerRatings.matchId, recentMatchIds), eq(playerRatings.playerId, playerId)))
            : [];
        const ratingByMatchId = new Map(
            ratingRows.map(r => [r.matchId, r.finalRating ?? r.autoRating])
        );

        // Calculate performance for each match
        const performance = recentMatches.map(match => {
            const matchPlayerEvents = playerEvents.filter(e => e.matchId === match.id);

            // Calculate statistics based on sport
            const goals = matchPlayerEvents.filter(e =>
                e.type === 'Goal' || e.type === 'Field Goal' || e.type === 'Three Pointer'
            ).length;

            const assists = matchPlayerEvents.filter(e =>
                e.type === 'Assist' || e.relatedPlayerId === playerId
            ).length;

            const fouls = matchPlayerEvents.filter(e => e.type === 'Foul').length;

            // Calculate points for basketball
            const points = matchPlayerEvents.reduce((sum, e) => {
                if (e.type === 'Field Goal') return sum + 2;
                if (e.type === 'Three Pointer') return sum + 3;
                if (e.type === 'Free Throw') return sum + 1;
                return sum;
            }, 0);

            const rating = ratingByMatchId.get(match.id) ?? null;

            // Estimate minutes played (simplified)
            const minutesPlayed = matchPlayerEvents.length > 0 ? 90 : 0; // Placeholder

            return {
                match: `${match.homeTeamId} vs ${match.awayTeamId}`,
                matchId: match.id,
                date: match.startTime,
                goals,
                points,
                assists,
                fouls,
                rating,
                minutesPlayed,
                sport: match.sport,
            };
        });

        // Sort by date
        performance.sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        return NextResponse.json(performance);
    } catch (error) {
        console.error('Error fetching player performance:', error);
        return NextResponse.json(
            { error: 'Failed to fetch player performance' },
            { status: 500 }
        );
    }
}
