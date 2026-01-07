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

        console.log('[Ratings Adjust] User:', user?.email, 'Role:', user?.role);

        if (!user) {
            return NextResponse.json(
                {
                    error: 'Authentication required',
                    message: 'Please log in to access match ratings',
                    code: 'AUTH_REQUIRED'
                },
                { status: 401 }
            );
        }

        if (user.role !== 'admin' && user.role !== 'logger') {
            return NextResponse.json(
                {
                    error: 'Insufficient permissions',
                    message: 'Only loggers and admins can adjust ratings',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    userRole: user.role
                },
                { status: 403 }
            );
        }

        const matchId = params.id;
        console.log('[Ratings Adjust] Fetching match:', matchId);

        // Get match details
        const match = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .limit(1);

        if (match.length === 0) {
            console.error('[Ratings Adjust] Match not found:', matchId);
            return NextResponse.json(
                {
                    error: 'Match not found',
                    message: `No match found with ID: ${matchId}`,
                    code: 'MATCH_NOT_FOUND'
                },
                { status: 404 }
            );
        }

        console.log('[Ratings Adjust] Match status:', match[0].status);

        // Only allow adjustment for finished matches
        if (match[0].status !== 'FINISHED') {
            return NextResponse.json(
                {
                    error: 'Invalid match status',
                    message: `Can only adjust ratings for finished matches. Current status: ${match[0].status}`,
                    code: 'INVALID_MATCH_STATUS',
                    currentStatus: match[0].status
                },
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

        console.log('[Ratings Adjust] Found ratings:', ratings.length);

        // Check if ratings exist
        if (ratings.length === 0) {
            return NextResponse.json(
                {
                    error: 'No ratings found',
                    message: 'No player ratings have been calculated for this match yet. Please ensure ratings are initialized first.',
                    code: 'NO_RATINGS',
                    matchId,
                    suggestion: 'Try calculating ratings first using the logger interface or POST /api/matches/' + matchId + '/ratings'
                },
                { status: 404 }
            );
        }

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

        console.log('[Ratings Adjust] Returning', ratingsWithSuggestions.length, 'ratings with suggestions');

        return NextResponse.json({
            matchId,
            match: match[0],
            ratings: ratingsWithSuggestions,
            lineups
        });

    } catch (error) {
        console.error('[Ratings Adjust] Error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Failed to fetch ratings',
                code: 'INTERNAL_ERROR'
            },
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
