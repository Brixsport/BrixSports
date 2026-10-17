import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { playerRatings } from '@/db/schema-ratings';
import { matches, players, matchEvents } from '@/db/schema';
import { eq, and, or, inArray, ne } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { isLoggerAssigned } from '@/lib/match-logger-helpers';
import { RatingCalculator } from '@/lib/ratingCalculator';
import { getRatingConfig } from '@/lib/ratingConfig';
import { getEnteredPlayerIds } from '@/lib/ratings/participation';
import { isUnchangedAdjustment, normalizeAdjustmentNotes } from '@/lib/ratings/adjustments';
import { toRatingsMatchDto } from '@/lib/public-ratings';

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
        if (user.role === 'logger' && !(await isLoggerAssigned(matchId, user.id))) {
            return NextResponse.json(
                {
                    error: 'Forbidden',
                    message: 'You are not assigned to this match',
                    code: 'NOT_ASSIGNED'
                },
                { status: 403 }
            );
        }
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
            .where(eq(playerRatings.matchId, matchId))
            .limit(200); // a single match's roster, generous cap per CLAUDE.md's list-query rule

        console.log('[Ratings Adjust] Found ratings:', ratings.length);

        // Check if ratings exist. A GET never writes: ratings are calculated when the match is
        // finished or on demand through POST /api/matches/[id]/ratings.
        if (ratings.length === 0) {
            return NextResponse.json(
                {
                    error: 'No ratings found',
                    message: 'No player ratings have been calculated for this match yet. Calculate ratings first, and make sure match lineups are set.',
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
        // BACKLOG-249 follow-on finding: real match_events always store this as
        // 'Substitution' (title case), never 'SUBSTITUTION' -- confirmed via a
        // direct DB scan, zero rows anywhere ever matched the all-caps string.
        // wasSubbedOn was therefore always false, silently excluding every real
        // played-substitute from ratings regardless of the starters/bench fix.
        // Same rule the rating calculation uses to decide who played: a
        // substitution's relatedPlayerId is the player who came ON, and a
        // substitute with events of their own also counts as having played.
        const subbedOnPlayerIds = getEnteredPlayerIds(events);

        console.log('[Ratings Adjust] Players who were subbed on:', Array.from(subbedOnPlayerIds));

        // Helper function to check if player is a starter or substitute based on lineup
        const getPlayerLineupStatus = (playerId: string, teamId: string): 'starter' | 'substitute' | 'unknown' => {
            if (!lineups) return 'unknown';
            
            const teamKey = match.homeTeamId === teamId ? 'home' : 'away';
            const teamLineup = lineups[teamKey];
            
            if (!teamLineup) return 'unknown';
            
            const startingXI = teamLineup.starters || [];
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
            const playerTeamId = r.rating.teamId || '';
            // BACKLOG-321: was computed once, globally -- an away defender who
            // conceded 3 was shown "Clean sheet -- consider 7.5-8.0" whenever
            // HOME happened to keep one, and vice versa. Scoped per-player.
            const isHome = playerTeamId === match.homeTeamId;
            const ownScore = isHome ? homeScore : awayScore;
            const oppScore = isHome ? awayScore : homeScore;
            const teamCleanSheet = oppScore === 0;
            const teamWon = ownScore > oppScore;

            const suggestion = RatingCalculator.getSuggestedRange(position, teamCleanSheet, teamWon);
            const description = RatingCalculator.getRatingDescription(r.rating.autoRating);
            const lineupStatus = getPlayerLineupStatus(r.rating.playerId, playerTeamId);
            const wasSubbedOn = subbedOnPlayerIds.has(r.rating.playerId);

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
            match: toRatingsMatchDto(match),
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
        if (user.role === 'logger' && !(await isLoggerAssigned(matchId, user.id))) {
            return NextResponse.json({ error: 'Forbidden — not assigned to this match' }, { status: 403 });
        }
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

        // BACKLOG-318: min/max now come from /admin/settings' Algorithm
        // Configuration instead of the hardcoded 1.0/10.0.
        const ratingConfig = await getRatingConfig();

        // BACKLOG-321: this loop used to do one SELECT + one UPDATE per submitted
        // rating, sequentially (up to ~2x roster-size DB round trips), with no
        // transaction -- a mid-loop failure left a partially-adjusted rating set
        // with no rollback. Batch-fetch every existing row up front, then do all
        // writes inside a single transaction.
        const playerIds = adjustedRatings
            .map((a: any) => a?.playerId)
            .filter((id: unknown): id is string => typeof id === 'string');
        const existingRows = playerIds.length > 0
            ? await db
                .select()
                .from(playerRatings)
                .where(and(eq(playerRatings.matchId, matchId), inArray(playerRatings.playerId, playerIds)))
            : [];
        const existingByPlayerId = new Map(existingRows.map(r => [r.playerId, r]));

        const updated: { playerId: string; autoRating: number; finalRating: number; isMotM: boolean }[] = [];
        const errors: { playerId: string; error: string }[] = [];

        // Rows the admin page sent back untouched. They are skipped so that
        // publishing does not freeze every rating or credit the admin with reviews
        // they did not do.
        let unchanged = 0;

        // MotM is a single-winner-per-match award. The winner is the first
        // submitted player whose update is actually applied; every other flag for
        // the match is cleared only after that, inside the same transaction, so a
        // rejected MotM row can never wipe the previous winner.
        let motmWinnerPlayerId: string | null = null;

        await db.transaction(async (tx) => {
            for (const adjustment of adjustedRatings) {
                const { playerId, finalRating, notes, isMotM } = adjustment;

                // BACKLOG-321: validateRating() only range-checks -- a numeric-
                // looking string ("7.5") passes the >=/<= comparison via JS's
                // loose coercion and would get written to a column every other
                // reader (e.g. playerRatingSummary.ts's AVG(...)) assumes is a
                // real number.
                if (typeof finalRating !== 'number' || !Number.isFinite(finalRating) || !RatingCalculator.validateRating(finalRating, ratingConfig)) {
                    errors.push({
                        playerId,
                        error: `Invalid rating: ${finalRating}. Must be a number between ${ratingConfig.minRating} and ${ratingConfig.maxRating}`
                    });
                    continue;
                }

                const existing = existingByPlayerId.get(playerId);
                if (!existing) {
                    errors.push({
                        playerId,
                        error: 'Rating not found'
                    });
                    continue;
                }

                const normalizedNotes = normalizeAdjustmentNotes(notes);
                if (!normalizedNotes.ok) {
                    errors.push({ playerId, error: normalizedNotes.error });
                    continue;
                }

                if (isUnchangedAdjustment(existing, { playerId, finalRating, notes: normalizedNotes.value, isMotM })) {
                    unchanged++;
                    continue;
                }

                try {
                    await tx
                        .update(playerRatings)
                        .set({
                            finalRating,
                            adjustmentNotes: normalizedNotes.value,
                            adjustedBy: user.id,
                            adjustmentTime: new Date(),
                            isMotM: isMotM === true,
                            updatedAt: new Date()
                        })
                        .where(eq(playerRatings.id, existing.id));

                    updated.push({
                        playerId,
                        autoRating: existing.autoRating,
                        finalRating,
                        isMotM: isMotM === true
                    });
                    if (isMotM === true && motmWinnerPlayerId === null) {
                        motmWinnerPlayerId = playerId;
                    }
                } catch (error) {
                    errors.push({
                        playerId,
                        error: 'Failed to update rating'
                    });
                }
            }

            if (motmWinnerPlayerId !== null) {
                await tx
                    .update(playerRatings)
                    .set({ isMotM: false })
                    .where(and(
                        eq(playerRatings.matchId, matchId),
                        eq(playerRatings.isMotM, true),
                        ne(playerRatings.playerId, motmWinnerPlayerId)
                    ));
            }
        });

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
            unchanged,
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
