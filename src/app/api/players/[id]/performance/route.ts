/**
 * Player Performance API
 * Fetch player performance data across matches
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchEvents, matches, players } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

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

        // Get all matches where player participated
        const playerEvents = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.playerId, playerId))
            .orderBy(desc(matchEvents.createdAt));

        // Group events by match
        const matchIds = [...new Set(playerEvents.map(e => e.matchId))];

        // Fetch match details
        const matchDetails = await Promise.all(
            matchIds.map(async (matchId) => {
                const [match] = await db
                    .select()
                    .from(matches)
                    .where(eq(matches.id, matchId))
                    .limit(1);
                return match;
            })
        );

        // Filter by timeframe
        const recentMatches = matchDetails.filter(m =>
            m && new Date(m.startTime) >= thresholdDate
        );

        // Calculate performance for each match
        const performance = recentMatches.map(match => {
            if (!match) return null;

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

            // Calculate rating (0-10 scale)
            const rating = calculatePlayerRating({
                goals,
                assists,
                fouls,
                points,
                sport: match.sport || 'Football',
            });

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
        }).filter(p => p !== null);

        // Sort by date
        performance.sort((a, b) =>
            new Date(a!.date).getTime() - new Date(b!.date).getTime()
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

/**
 * Calculate player rating based on performance
 */
function calculatePlayerRating({
    goals,
    assists,
    fouls,
    points,
    sport,
}: {
    goals: number;
    assists: number;
    fouls: number;
    points: number;
    sport: string;
}): number {
    let rating = 5.0; // Base rating

    if (sport === 'Basketball') {
        // Basketball rating
        rating += points * 0.1; // +0.1 per point
        rating += assists * 0.3; // +0.3 per assist
        rating -= fouls * 0.2; // -0.2 per foul
    } else {
        // Football rating
        rating += goals * 1.5; // +1.5 per goal
        rating += assists * 1.0; // +1.0 per assist
        rating -= fouls * 0.1; // -0.1 per foul
    }

    // Clamp between 0 and 10
    return Math.max(0, Math.min(10, rating));
}
