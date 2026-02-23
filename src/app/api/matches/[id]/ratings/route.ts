import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { playerRatings, ratingHistory } from '@/db/schema-ratings';
import { matches, players, matchEvents } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
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

        // Check if ratings exist
        if (ratings.length === 0 && match[0].status === 'FINISHED') {
            console.log(`[Public Ratings] No ratings for finished match ${matchId}, attempting auto-calc...`);

            try {
                const protocol = request.headers.get('x-forwarded-proto') || 'http';
                const host = request.headers.get('host');
                const baseUrl = `${protocol}://${host}`;

                // Trigger calculation (which also initializes if needed)
                // Note: We use a POST to ourselves. This requires no specific auth if we allow it, 
                // but usually ratings calculation requires logger/admin.
                // For public safety, we might just return empty, but let's try to be helpful.

                const calcRes = await fetch(`${baseUrl}/api/matches/${matchId}/ratings`, {
                    method: 'POST',
                    headers: { 'Cookie': request.headers.get('cookie') || '' }
                });

                if (calcRes.ok) {
                    // Re-fetch
                    const newRatings = await db
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
                        ratings: newRatings.map(r => ({
                            ...r.rating,
                            player: r.player
                        })),
                        autoCalculated: true
                    });
                }
            } catch (e) {
                console.error('[Public Ratings] Auto-calc trigger failed:', e);
            }
        }

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

        // Helper to extract players from lineup structure (handling both array and object formats)
        const getPlayersFromTeam = (teamLineup: any) => {
            if (!teamLineup) return [];

            // If it's a flat array (standard football format)
            if (Array.isArray(teamLineup)) {
                return teamLineup;
            }

            // If it's structured (basketball/generated format)
            if (teamLineup.starters || teamLineup.bench) {
                return [
                    ...(teamLineup.starters || []),
                    ...(teamLineup.bench || [])
                ];
            }

            return [];
        };

        // Initialize players with team info
        const homePlayers = getPlayersFromTeam(lineups.home).map(p => ({ ...p, team: 'home' }));
        const awayPlayers = getPlayersFromTeam(lineups.away).map(p => ({ ...p, team: 'away' }));
        const allPlayers = [...homePlayers, ...awayPlayers];

        // Fetch all relevant players in one query
        const playerIds = allPlayers.map(p => p.playerId).filter(Boolean);
        const playersList = await db
            .select()
            .from(players)
            .where(sql`${players.id} IN (${sql.join(playerIds.map(id => sql`${id}`), sql`, `)})`);

        const playersMap = new Map(playersList.map(p => [p.id, p]));

        // Calculate stats for each player
        const playerStats = new Map();

        for (const lineupEntry of allPlayers) {
            const playerId = lineupEntry.playerId;
            if (!playerId) continue;

            const player = playersMap.get(playerId);
            if (!player) continue;

            // Count events for this player
            const playerEvents = events.filter(e => e.playerId === playerId);

            const stats = {
                playerId,
                teamId: lineupEntry.team === 'home' ? match[0].homeTeamId : match[0].awayTeamId,
                position: lineupEntry.position || player.position || 'CM', // Fallback to CM if unknown
                goals: playerEvents.filter(e => e.type === 'Goal').length,
                assists: playerEvents.filter(e => e.detail?.includes('assist')).length,
                eyePoints: playerEvents.filter(e => e.isEyePoint).length,
                yellowCards: playerEvents.filter(e => e.type === 'Yellow Card').length,
                redCards: playerEvents.filter(e => e.type === 'Red Card').length,
                shotsOnTarget: 0,
                shotsOffTarget: 0,
                fouls: playerEvents.filter(e => e.type === 'Foul').length,
                isSubstituted: playerEvents.some(e => e.type === 'Substitution' && e.detail?.includes('out')),
                minutesPlayed: 90
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
                    teamId: stats.teamId,
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
