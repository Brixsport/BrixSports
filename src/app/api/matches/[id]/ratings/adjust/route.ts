import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { playerRatings } from '@/db/schema-ratings';
import { matches, players, matchEvents } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { RatingCalculator } from '@/lib/ratingCalculator';

/**
 * GET /api/matches/[id]/ratings/adjust
 * Get all ratings for post-match adjustment
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
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

        const { id: matchId } = await params;
        console.log('[Ratings Adjust] Fetching match:', matchId);

        // Get match details with teams
        const match = await db.query.matches.findFirst({
            where: eq(matches.id, matchId),
            with: {
                homeTeam: true,
                awayTeam: true
            }
        });

        if (!match) {
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

        console.log('[Ratings Adjust] Match status:', match.status);

        // Only allow adjustment for finished matches
        if (match.status !== 'FINISHED') {
            return NextResponse.json(
                {
                    error: 'Invalid match status',
                    message: `Can only adjust ratings for finished matches. Current status: ${match.status}`,
                    code: 'INVALID_MATCH_STATUS',
                    currentStatus: match.status
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
            console.log('[Ratings Adjust] No ratings found, attempting auto-calculation...');

            // Call the ratings' POST handler logic internally (by making a request to itself)
            // or better, just tell the client how to fix it via a more helpful 404
            // but even better: Let's actually trigger the calculation here.

            try {
                const protocol = request.headers.get('x-forwarded-proto') || 'http';
                const host = request.headers.get('host');
                const baseUrl = `${protocol}://${host}`;

                // Initialize first
                await fetch(`${baseUrl}/api/matches/${matchId}/ratings/initialize`, {
                    method: 'POST',
                    headers: { 'Cookie': request.headers.get('cookie') || '' }
                });

                // Then calculate
                const calcRes = await fetch(`${baseUrl}/api/matches/${matchId}/ratings`, {
                    method: 'POST',
                    headers: { 'Cookie': request.headers.get('cookie') || '' }
                });

                if (calcRes.ok) {
                    // Re-fetch ratings
                    const newRatings = await db
                        .select({
                            rating: playerRatings,
                            player: players
                        })
                        .from(playerRatings)
                        .leftJoin(players, eq(playerRatings.playerId, players.id))
                        .where(eq(playerRatings.matchId, matchId));

                    if (newRatings.length > 0) {
                        return NextResponse.json({
                            matchId,
                            match: match,
                            ratings: newRatings.map(r => {
                                const position = r.player?.position || '';
                                const homeScore = match.homeScore ?? 0;
                                const awayScore = match.awayScore ?? 0;

                                // Simplified logic consistent with the rest of the route
                                const teamCleanSheet = homeScore === 0 || awayScore === 0;
                                const teamWon = homeScore > awayScore || awayScore > homeScore;

                                return {
                                    ...r.rating,
                                    playerName: r.player?.name,
                                    playerNumber: r.player?.number,
                                    playerPosition: position,
                                    suggestions: RatingCalculator.getSuggestedRange(position, teamCleanSheet, teamWon)
                                };
                            }),
                            lineups: match.lineups ? JSON.parse(match.lineups) : null,
                            autoCalculated: true
                        });
                    }
                }
            } catch (e) {
                console.error('[Ratings Adjust] Auto-calc failed:', e);
            }

            return NextResponse.json(
                {
                    error: 'No ratings found',
                    message: 'No player ratings have been calculated for this match yet. We tried to auto-calculate them but failed. Please ensure match lineups are set.',
                    code: 'NO_RATINGS',
                    matchId
                },
                { status: 404 }
            );
        }

        // Get lineups for team context
        const lineups = match.lineups ? JSON.parse(match.lineups) : null;

        // Get match events to find which substitutes actually played
        const events = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.matchId, matchId));

        // Find all players who were subbed ON (entered the game)
        const subbedOnPlayerIds = new Set<string>();
        events.forEach(event => {
            if (event.type === 'SUBSTITUTION' && event.relatedPlayerId) {
                // relatedPlayerId is the player who came ON in a substitution
                subbedOnPlayerIds.add(event.relatedPlayerId);
            }
        });

        console.log('[Ratings Adjust] Players who were subbed on:', Array.from(subbedOnPlayerIds));

        // Helper function to check if player is a starter or substitute based on lineup
        const getPlayerLineupStatus = (playerId: string, teamId: string): 'starter' | 'substitute' | 'unknown' => {
            if (!lineups) return 'unknown';
            
            const teamKey = match.homeTeamId === teamId ? 'home' : 'away';
            const teamLineup = lineups[teamKey];
            
            if (!teamLineup) return 'unknown';
            
            const startingXI = teamLineup.startingXI || [];
            const substitutes = teamLineup.substitutes || [];
            
            const isStarter = startingXI.some((p: any) => p.playerId === playerId);
            const isSubstitute = substitutes.some((p: any) => p.playerId === playerId);
            
            if (isStarter) return 'starter';
            if (isSubstitute) return 'substitute';
            return 'unknown';
        };

        // Add suggestions for each player and determine if they should be rated
        const ratingsWithSuggestions = ratings.map(r => {
            const position = r.player?.position || '';
            const homeScore = match.homeScore ?? 0;
            const awayScore = match.awayScore ?? 0;
            const teamCleanSheet = homeScore === 0 || awayScore === 0;
            const teamWon = homeScore > awayScore || awayScore > homeScore;
            const playerTeamId = r.player?.teamId || '';

            const suggestion = RatingCalculator.getSuggestedRange(position, teamCleanSheet, teamWon);
            const description = RatingCalculator.getRatingDescription(r.rating.autoRating);
            const lineupStatus = getPlayerLineupStatus(r.playerId, playerTeamId);
            const wasSubbedOn = subbedOnPlayerIds.has(r.playerId);

            // A player should be rated if:
            // 1. They were in the starting XI, OR
            // 2. They were a substitute who was subbed ON (played)
            // UNUSED substitutes (never entered) should be excluded
            const shouldBeRated = lineupStatus === 'starter' || wasSubbedOn;

            return {
                ...r.rating,
                player: r.player,
                suggestion,
                description,
                lineupStatus, // 'starter', 'substitute', or 'unknown'
                isStarter: lineupStatus === 'starter',
                isSubstitute: lineupStatus === 'substitute',
                wasSubbedOn,
                shouldBeRated,
                needsReview: r.rating.autoRating < 6.5 && (position.includes('CDM') || position.includes('CM') || position.includes('DEF'))
            };
        });

        // Filter to only include players who should be rated
        // (starters + substitutes who played, exclude unused substitutes)
        const playableRatings = ratingsWithSuggestions.filter(r => r.shouldBeRated);

        const unusedSubstitutes = ratingsWithSuggestions.filter(r => r.isSubstitute && !r.wasSubbedOn);

        console.log('[Ratings Adjust] Returning', playableRatings.length, 'ratings (', unusedSubstitutes.length, 'unused substitutes excluded)');

        return NextResponse.json({
            matchId,
            match: match,
            ratings: playableRatings,
            unusedSubstitutes: unusedSubstitutes.map(r => ({
                playerId: r.playerId,
                playerName: r.player?.name,
                reason: 'Did not enter the match'
            })),
            allPlayers: ratingsWithSuggestions, // Include all for reference
            lineups
        });

    } catch (error) {
        console.error('[Ratings Adjust] Error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: 'Failed to fetch ratings',
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

        // Emit WebSocket event for real-time updates
        if (typeof global !== 'undefined' && (global as any).io) {
            (global as any).io.to(`match:${matchId}`).emit('ratings:published', {
                matchId,
                updated: updated.length,
                timestamp: new Date().toISOString()
            });
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
