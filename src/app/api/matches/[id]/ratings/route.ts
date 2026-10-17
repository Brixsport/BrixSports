import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { playerRatings } from '@/db/schema-ratings';
import { matches, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { isLoggerAssigned } from '@/lib/match-logger-helpers';
import { calculateAndSaveRatings } from '@/lib/ratingsService';
import { toPublicMatchRating } from '@/lib/public-ratings';

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

        // Get all ratings for this match. Ratings are calculated when the match is set
        // FINISHED, so an empty list is the correct answer when none exist yet.
        const ratings = await db
            .select({
                playerId: playerRatings.playerId,
                teamId: playerRatings.teamId,
                autoRating: playerRatings.autoRating,
                finalRating: playerRatings.finalRating,
                isMotM: playerRatings.isMotM,
                name: players.name,
                jerseyName: players.jerseyName,
                number: players.number,
                position: players.position,
                image: players.image
            })
            .from(playerRatings)
            .leftJoin(players, eq(playerRatings.playerId, players.id))
            .where(eq(playerRatings.matchId, matchId))
            .limit(200);

        return NextResponse.json({
            matchId,
            matchStatus: match[0].status,
            ratings: ratings.map(toPublicMatchRating)
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
        if (user.role === 'logger' && !(await isLoggerAssigned(matchId, user.id))) {
            return NextResponse.json({ error: 'Forbidden — not assigned to this match' }, { status: 403 });
        }

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
            // Deliberate, developer-authored validation messages (src/lib/ratingsService.ts)
            // safe to show as-is. Anything else -- including a real DB failure -- must not
            // reach the client verbatim.
            if (rawMessage === 'Match not found') {
                return NextResponse.json({ error: rawMessage }, { status: 404 });
            }
            if (rawMessage === 'No lineups found for this match') {
                return NextResponse.json({ error: rawMessage }, { status: 400 });
            }
            // BACKLOG-255: this allow-list had gone stale relative to
            // ratingsService.ts's actual thrown-error surface -- the sport
            // dispatcher's unsupported-sport error fell through to a generic,
            // unexplained 500 instead of the clear message the code already
            // authors. An admin clicking "Calculate Ratings" on a Track & Field
            // match deserves the real reason, not a 500.
            if (rawMessage.startsWith('calculateAndSaveRatings: no rating model exists for sport')) {
                return NextResponse.json({ error: rawMessage }, { status: 422 });
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
