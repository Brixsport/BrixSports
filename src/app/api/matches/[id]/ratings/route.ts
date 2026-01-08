import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { playerRatings, ratingHistory } from '@/db/schema-ratings';
import { matches, players, matchEvents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { RatingCalculator } from '@/lib/ratingCalculator';

/**
 * GET /api/matches/[id]/ratings
 * Get all player ratings for a match
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: matchId } = await params;

        // Get match details
        const match = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .limit(1);

        if (match.length === 0) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Get all ratings for this match
        const ratings = await db
            .select({
                rating: playerRatings,
                player: players
            })
            .from(playerRatings)
            .leftJoin(players, eq(playerRatings.playerId, players.id))
            .where(eq(playerRatings.matchId, matchId));

        return NextResponse.json({
            matchId,
            matchStatus: match[0].status,
            ratings: ratings.map(r => ({
                ...r.rating,
                player: r.player
            }))
        });

    } catch (error) {
        console.error('Error fetching ratings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch ratings' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/matches/[id]/ratings/calculate
 * Calculate/update auto-ratings based on current match events
 * Called by logger during match or automatically
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser(request);
        if (!user || (user.role !== 'admin' && user.role !== 'logger')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id: matchId } = await params;

        // Get match details
        const match = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .limit(1);

        if (match.length === 0) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Get all events for this match
        const events = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.matchId, matchId));

        // Get lineups to know which players are playing
        const lineups = match[0].lineups ? JSON.parse(match[0].lineups) : null;

        if (!lineups) {
            return NextResponse.json(
                { error: 'No lineups found for this match' },
                { status: 400 }
            );
        }

        const allPlayers = [
            ...(lineups.home?.starters || []),
            ...(lineups.away?.starters || [])
        ];

        // Calculate stats for each player
        const playerStats = new Map();

        for (const lineupEntry of allPlayers) {
            const playerId = lineupEntry.playerId;

            // Get player details
            const playerData = await db
                .select()
                .from(players)
                .where(eq(players.id, playerId))
                .limit(1);

            if (playerData.length === 0) continue;

            const player = playerData[0];

            // Count events for this player
            const playerEvents = events.filter(e => e.playerId === playerId);

            const stats = {
                playerId,
                position: lineupEntry.position || player.position,
                goals: playerEvents.filter(e => e.type === 'Goal').length,
                assists: playerEvents.filter(e => e.detail?.includes('assist')).length,
                eyePoints: playerEvents.filter(e => e.isEyePoint).length,
                yellowCards: playerEvents.filter(e => e.type === 'Yellow Card').length,
                redCards: playerEvents.filter(e => e.type === 'Red Card').length,
                shotsOnTarget: 0, // Would need to track this
                shotsOffTarget: 0,
                fouls: playerEvents.filter(e => e.type === 'Foul').length,
                isSubstituted: playerEvents.some(e => e.type === 'Substitution' && e.detail?.includes('out')),
                minutesPlayed: 90 // Simplified - would need actual tracking
            };

            playerStats.set(playerId, stats);
        }

        // Calculate ratings and update database
        const updatedRatings = [];

        for (const [playerId, stats] of playerStats.entries()) {
            const { rating, breakdown } = RatingCalculator.calculateAutoRating(stats);

            // Check if rating already exists
            const existingRating = await db
                .select()
                .from(playerRatings)
                .where(
                    and(
                        eq(playerRatings.matchId, matchId),
                        eq(playerRatings.playerId, playerId)
                    )
                )
                .limit(1);

            if (existingRating.length > 0) {
                // Update existing rating
                await db
                    .update(playerRatings)
                    .set({
                        autoRating: rating,
                        ratingBreakdown: breakdown,
                        updatedAt: new Date()
                    })
                    .where(eq(playerRatings.id, existingRating[0].id));

                updatedRatings.push({
                    playerId,
                    rating,
                    breakdown
                });
            } else {
                // Create new rating
                const ratingId = `rating-${matchId}-${playerId}-${Date.now()}`;

                await db.insert(playerRatings).values({
                    id: ratingId,
                    matchId,
                    playerId,
                    teamId: stats.position.includes('home') ? match[0].homeTeamId : match[0].awayTeamId,
                    autoRating: rating,
                    ratingBreakdown: breakdown
                });

                updatedRatings.push({
                    playerId,
                    rating,
                    breakdown
                });
            }
        }

        return NextResponse.json({
            message: 'Ratings calculated successfully',
            ratingsUpdated: updatedRatings.length,
            ratings: updatedRatings
        });

    } catch (error) {
        console.error('Error calculating ratings:', error);
        return NextResponse.json(
            { error: 'Failed to calculate ratings' },
            { status: 500 }
        );
    }
}
