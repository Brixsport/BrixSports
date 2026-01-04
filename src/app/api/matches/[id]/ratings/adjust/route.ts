import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { playerRatings } from '@/db/schema-ratings';
import { matches, players } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { RatingCalculator } from '@/lib/ratingCalculator';

/**
 * GET /api/matches/[id]/ratings/adjust
 * Get all ratings for post-match adjustment
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getAuthUser(request);
        if (!user || (user.role !== 'admin' && user.role !== 'logger')) {
            return NextResponse.json(
                { error: 'Unauthorized - Only loggers and admins can adjust ratings' },
                { status: 401 }
            );
        }

        const matchId = params.id;

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

        // Only allow adjustment for finished matches
        if (match[0].status !== 'FINISHED') {
            return NextResponse.json(
                { error: 'Can only adjust ratings for finished matches' },
                { status: 400 }
            );
        }

        // Get all ratings with player details
        const ratings = await db
            .select({
                rating: playerRatings,
                player: players
            })
            .from(playerRatings)
            .leftJoin(players, eq(playerRatings.playerId, players.id))
            .where(eq(playerRatings.matchId, matchId));

        // Get lineups for team context
        const lineups = match[0].lineups ? JSON.parse(match[0].lineups) : null;

        // Add suggestions for each player
        const ratingsWithSuggestions = ratings.map(r => {
            const position = r.player?.position || '';
            const homeScore = match[0].homeScore ?? 0;
            const awayScore = match[0].awayScore ?? 0;
            const teamCleanSheet = homeScore === 0 || awayScore === 0;
            const teamWon = homeScore > awayScore || awayScore > homeScore;

            const suggestion = RatingCalculator.getSuggestedRange(position, teamCleanSheet, teamWon);
            const description = RatingCalculator.getRatingDescription(r.rating.autoRating);

            return {
                ...r.rating,
                player: r.player,
                suggestion,
                description,
                needsReview: r.rating.autoRating < 6.5 && (position.includes('CDM') || position.includes('CM') || position.includes('DEF'))
            };
        });

        return NextResponse.json({
            matchId,
            match: match[0],
            ratings: ratingsWithSuggestions,
            lineups
        });

    } catch (error) {
        console.error('Error fetching ratings for adjustment:', error);
        return NextResponse.json(
            { error: 'Failed to fetch ratings' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/matches/[id]/ratings/adjust
 * Submit final adjusted ratings
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getAuthUser(request);
        if (!user || (user.role !== 'admin' && user.role !== 'logger')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const matchId = params.id;
        const body = await request.json();
        const { ratings: adjustedRatings } = body;

        if (!Array.isArray(adjustedRatings)) {
            return NextResponse.json(
                { error: 'Invalid ratings data' },
                { status: 400 }
            );
        }

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

        // Only allow adjustment for finished matches
        if (match[0].status !== 'FINISHED') {
            return NextResponse.json(
                { error: 'Can only adjust ratings for finished matches' },
                { status: 400 }
            );
        }

        // Validate and update each rating
        const updated = [];
        const errors = [];

        for (const adjustment of adjustedRatings) {
            const { playerId, finalRating, notes, isMotM } = adjustment;

            // Validate rating
            if (!RatingCalculator.validateRating(finalRating)) {
                errors.push({
                    playerId,
                    error: `Invalid rating: ${finalRating}. Must be between 1.0 and 10.0`
                });
                continue;
            }

            try {
                // Find existing rating
                const existing = await db
                    .select()
                    .from(playerRatings)
                    .where(
                        and(
                            eq(playerRatings.matchId, matchId),
                            eq(playerRatings.playerId, playerId)
                        )
                    )
                    .limit(1);

                if (existing.length === 0) {
                    errors.push({
                        playerId,
                        error: 'Rating not found'
                    });
                    continue;
                }

                // Update rating
                await db
                    .update(playerRatings)
                    .set({
                        finalRating,
                        adjustmentNotes: notes || null,
                        adjustedBy: user.id,
                        adjustmentTime: new Date(),
                        isMotM: isMotM || false,
                        updatedAt: new Date()
                    })
                    .where(eq(playerRatings.id, existing[0].id));

                updated.push({
                    playerId,
                    autoRating: existing[0].autoRating,
                    finalRating,
                    isMotM
                });

            } catch (error) {
                errors.push({
                    playerId,
                    error: 'Failed to update rating'
                });
            }
        }

        return NextResponse.json({
            message: 'Ratings adjusted successfully',
            updated: updated.length,
            errors: errors.length,
            details: {
                updated,
                errors
            }
        });

    } catch (error) {
        console.error('Error adjusting ratings:', error);
        return NextResponse.json(
            { error: 'Failed to adjust ratings' },
            { status: 500 }
        );
    }
}
