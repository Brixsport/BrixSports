import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { playerRatings } from '@/db/schema-ratings';
import { matches, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { calculateAndSaveRatings } from '@/lib/ratingsService';

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

        // BACKLOG-124: this used to duplicate the entire calculation inline, which is
        // also what events/route.ts's internal self-fetch (fixed the same bug) used to
        // call over HTTP. Now a shared function (src/lib/ratingsService.ts) so both
        // the real caller (a logged-in admin/logger hitting this endpoint directly)
        // and the internal caller (events/route.ts, already-authenticated) share one
        // implementation instead of two.
        let result;
        try {
            result = await calculateAndSaveRatings(matchId);
        } catch (err) {
            console.error('[Calculate Ratings] Error:', err);
            const rawMessage = err instanceof Error ? err.message : '';
            // Only these two are deliberate, developer-authored validation messages
            // safe to show as-is (src/lib/ratingsService.ts). Anything else --
            // including a real DB failure -- must not reach the client verbatim.
            if (rawMessage === 'Match not found') {
                return NextResponse.json({ error: rawMessage }, { status: 404 });
            }
            if (rawMessage === 'No lineups found for this match') {
                return NextResponse.json({ error: rawMessage }, { status: 400 });
            }
            return NextResponse.json({ error: 'Failed to calculate ratings' }, { status: 500 });
        }

        return NextResponse.json({
            message: 'Ratings calculated successfully',
            ...result
        });

    } catch (error) {
        console.error('Error calculating ratings:', error);
        return NextResponse.json(
            { error: 'Failed to calculate ratings' },
            { status: 500 }
        );
    }
}
