import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/db';
import { matchEvents, matches, matchLoggerAssignments } from '@/db/schema';
import { eq, asc, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';
import { broadcastMatchEvent, broadcastScoreUpdate } from '@/lib/socket';
import { SCORING_POINT_VALUES } from '@/lib/scoring';

// GET /api/matches/[id]/events - Get all events for a match
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: matchId } = await params;

        // Verify match exists
        const match = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .get();

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Get all events for the match
        const events = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.matchId, matchId))
            .orderBy(asc(matchEvents.minute), asc(matchEvents.second))
            .limit(200);

        // Strip logger identity fields from unauthenticated (public) responses — NDPR compliance.
        // Authenticated callers (logger seeding local state, multi-logger conflict detection) receive full rows.
        const authUser = await getAuthUser(request).catch(() => null);
        const responseEvents = authUser
            ? events
            : events.map(({ loggerId, loggerName, ...rest }) => rest);

        return NextResponse.json({
            matchId,
            events: responseEvents,
            total: responseEvents.length,
        });
    } catch (error) {
        console.error('Error fetching match events:', error);
        return NextResponse.json(
            { error: 'Failed to fetch match events' },
            { status: 500 }
        );
    }
}

// POST /api/matches/[id]/events - Create new match event
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: matchId } = await params;

        // Auth: admin or assigned logger only
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin' && authUser.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (authUser.role === 'logger') {
            const [assignment] = await db
                .select({ id: matchLoggerAssignments.id })
                .from(matchLoggerAssignments)
                .where(
                    and(
                        eq(matchLoggerAssignments.matchId, matchId),
                        eq(matchLoggerAssignments.loggerId, authUser.id),
                        eq(matchLoggerAssignments.status, 'active')
                    )
                )
                .limit(1);
            if (!assignment) {
                return NextResponse.json({ error: 'Forbidden — not assigned to this match' }, { status: 403 });
            }
        }

        const body = await request.json();
        const {
            type,
            minute,
            second,
            teamId,
            playerId,
            relatedPlayerId,
            detail,
            isEyePoint = false,
            value,
            made,
            loggerName,
            period,
        } = body;

        // Validate required fields
        if (!type || minute === undefined) {
            return NextResponse.json(
                { error: 'Event type and minute are required' },
                { status: 400 }
            );
        }

        // Verify match exists
        const match = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .get();

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Create event
        const eventId = nanoid();
        const newEvent = {
            id: eventId,
            matchId,
            type,
            minute,
            // second || null collapsed a legitimate 0 (event logged in the first second
            // of a period) to null -- same falsy-zero bug class as the missed-shot fix
            // (value: points || null), just never applied to this field. Found via a
            // basketball timestamp-ordering test on the PR preview.
            second: second ?? null,
            teamId: teamId || null,
            playerId: playerId || null,
            relatedPlayerId: relatedPlayerId || null,
            detail: detail || null,
            isEyePoint,
            // BUG-132: `value ? ... : null` collapsed a legitimate 0 (basketball's own
            // miss sentinel, `points ?? 0` for a "2PT Missed" etc. button) to null,
            // discarding the make/miss distinction right after the client computed it
            // via the explicit `made` boolean. Same falsy-zero class as the
            // second/points fixes above and BUG-126 -- checked explicitly for
            // undefined/null instead of truthiness.
            value: value !== undefined && value !== null ? JSON.stringify(value) : null,
            // BUG-124: this used to be `authUser.id` unconditionally -- for an
            // admin-authenticated POST (bypassing the normal logger flow), authUser.id
            // is a users.id, but match_events.logger_id FKs to loggers.id specifically.
            // An admin's id essentially never satisfies that FK, so admin-posted events
            // 500'd with SQLITE_CONSTRAINT: FOREIGN KEY constraint failed. The column is
            // nullable -- there's no real logger session to attribute an admin-posted
            // event to, so null is the correct, honest value for this FK'd column
            // specifically, not a guessed/borrowed id.
            loggerId: authUser.role === 'logger' ? authUser.id : null,
            // Losing loggerId to null must not also lose the audit trail entirely --
            // loggerName has no FK, so it's free to carry an identity even when
            // loggerId can't. Sourced from the verified authUser (server session),
            // never the client-passed loggerName field, when the actor is an admin --
            // audit fields must always come from the verified session per this
            // project's own rule, not from request-body input. Stores the admin's
            // real users.id (not a formatted display string) so the actor can still be
            // looked up exactly, the same way loggerId itself would if the FK allowed it.
            loggerName: authUser.role === 'logger' ? (loggerName || null) : authUser.id,
            period: period || null,
            createdAt: new Date(),
        };

        // Penalty shootout events must NOT write to match score or player stats —
        // shootout score is tracked separately (BACKLOG-105). Skip all writes during this period.
        const isPenaltyShootout = match.currentPeriod === 'PENALTY_SHOOTOUT';

        const upperType = type.toUpperCase().replace(/\s+/g, '_');
        const isOwnGoal = upperType === 'OWN_GOAL';
        // Basketball's Field Goal/Three Pointer/Free Throw events never updated
        // matches.homeScore/awayScore at all -- the only place basketball score was
        // ever written was finalizeMatch()'s PATCH, which silently drops homeScore/
        // awayScore for a non-admin logger (those fields are admin-only gated,
        // BUG-052). A logger finalizing a match got a false "finalized successfully"
        // while the score never saved. Root-caused here instead of loosening BUG-052's
        // admin gate (that would be a trust-boundary change needing its own review) --
        // basketball scores now update live through this same atomic transaction
        // football already uses, so finalize-time score writes become redundant
        // rather than load-bearing. `made` (not `value` truthiness) gates this, same
        // discipline as the missed-shot fix -- a miss must never touch the score.
        const isBasketballScore =
            match.sport === 'Basketball' &&
            made === true &&
            typeof value === 'number' && value > 0 &&
            (upperType === 'FIELD_GOAL' || upperType === 'THREE_POINTER' || upperType === 'FREE_THROW');
        const isScoringEvent = upperType === 'GOAL' || upperType === 'PENALTY' || isOwnGoal || isBasketballScore;

        // BUG-121: event insert + score update used to be two separate, independently
        // committed statements with no enclosing transaction — a failure after the
        // insert left a saved event with no score reflection, and a client retry on
        // that failure would insert a second, duplicate event row. The score update
        // itself also used to read the score into a JS variable, compute +points, and
        // write that computed value back — a classic read-modify-write race: two
        // scoring events for the same match in overlapping requests could both read
        // the same starting score and the second write would silently clobber the
        // first's intent. Both fixed together: the insert and the score update now
        // share one transaction, and the score update is a single atomic SQL
        // increment (`col = col + points`), not a JS-computed value — closes the race
        // regardless of how many concurrent writers there are, not just the common case.
        let newHomeScore: number | undefined;
        let newAwayScore: number | undefined;

        // BUG-131: `points = typeof value === 'number' ? value : 1` trusted the
        // client-supplied `value` verbatim for the atomic score increment — a POST
        // with `{ type: 'Field Goal', value: 500, made: true }` added 500 to the
        // score in a single request, bypassing BUG-052's admin-only score-write gate
        // through this separate endpoint. Football's GOAL/PENALTY/OWN_GOAL path had
        // the identical gap (never sends `value` at all, so it always fell through
        // to the `: 1` default — but nothing stopped a crafted request from sending
        // one). The authoritative point value for a scoring event is a fixed fact of
        // its type, never something the client should supply — derive it from an
        // explicit allowlist instead of trusting `value`, regardless of what was sent.
        // Shared with events/[eventId]/route.ts's DELETE revert (src/lib/scoring.ts) —
        // the two must always agree on what a scoring event is worth, or a delete
        // reverts a different amount than an insert credited.

        await db.transaction(async (tx) => {
            await tx.insert(matchEvents).values(newEvent);

            if (isScoringEvent && !isPenaltyShootout) {
                const points = SCORING_POINT_VALUES[upperType] ?? 1;
                // Own goal: teamId is the player's team (who conceded) — credit the opposing team
                const isHomeTeam = isOwnGoal
                    ? teamId !== match.homeTeamId
                    : teamId === match.homeTeamId;

                const [updated] = isHomeTeam
                    ? await tx.update(matches)
                        .set({ homeScore: sql`${matches.homeScore} + ${points}`, updatedAt: new Date() })
                        .where(eq(matches.id, matchId))
                        .returning({ homeScore: matches.homeScore, awayScore: matches.awayScore })
                    : await tx.update(matches)
                        .set({ awayScore: sql`${matches.awayScore} + ${points}`, updatedAt: new Date() })
                        .where(eq(matches.id, matchId))
                        .returning({ homeScore: matches.homeScore, awayScore: matches.awayScore });

                newHomeScore = updated.homeScore ?? 0;
                newAwayScore = updated.awayScore ?? 0;
            }
        });

        // BUG-108/BUG-116: broadcast to live viewers now that the DB write has actually
        // succeeded — previously nothing here ever broadcast at all; the only push a
        // viewer got was client-side, from the logger's own open tab emitting over its
        // own socket, which any write path with no live socket (offline-queue sync, or
        // any future write path) could never trigger. broadcastMatchEvent (src/lib/socket.ts)
        // already existed, fully built and already exercised by the chat feature — it was
        // just never called from here.
        // after() (not a bare fire-and-forget call): a plain unawaited promise has no
        // guaranteed completion once this function returns its response on Vercel's
        // serverless runtime -- traced as the root cause of BUG-108/116's observed
        // multi-second (up to 42s) broadcast latency. after() keeps the invocation
        // alive until the broadcast settles, without delaying the response itself.
        // broadcast()'s own try/catch already swallows failures, so this can't fail
        // event creation.
        after(() => broadcastMatchEvent(matchId, newEvent));

        if (newHomeScore !== undefined && newAwayScore !== undefined) {
            after(() => broadcastScoreUpdate(matchId, newHomeScore!, newAwayScore!));
        }

        // Update player stats for competitive matches only — friendlies and shootout events do not count
        if (playerId && match.matchType !== 'friendly' && !isPenaltyShootout) {
            await updatePlayerStats(match.sport, playerId, type, value, made);
        }

        // Penalty Saved: credit the keeper's saves stat via relatedPlayerId (null-check — keeper is optional)
        if (upperType === 'PENALTY_SAVED' && relatedPlayerId && match.matchType !== 'friendly' && !isPenaltyShootout) {
            await updatePlayerStats(match.sport, relatedPlayerId, 'Save', value);
        }

        // Auto-calculate ratings after event (for live matches). Wrapped in after(),
        // same reasoning as the broadcast calls above: this used to be a synchronous
        // await sitting between the DB write and the response, so it delayed not just
        // the response to the logger but also when the after()-scheduled broadcast
        // above could even start (after() callbacks don't run until this handler's
        // own promise resolves). Real contributor to BUG-119's remaining latency —
        // see BACKLOG-124 for a separate, still-open bug: this self-fetch forwards no
        // auth (no cookie/Authorization header), so it 401s and is silently swallowed
        // every time; auto-ratings has never actually run live because of that.
        if (match.status === 'LIVE') {
            after(async () => {
                try {
                    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/matches/${matchId}/ratings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                } catch (error) {
                    console.error('Error auto-calculating ratings:', error);
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Event created successfully',
            event: newEvent,
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating match event:', error);
        return NextResponse.json(
            { error: 'Failed to create match event' },
            { status: 500 }
        );
    }
}

// Helper function to update player stats
async function updatePlayerStats(
    sport: string,
    playerId: string,
    eventType: string,
    value?: any,
    made?: boolean
) {
    try {
        const { basketballPlayerStats, footballPlayerStats, players } = await import('@/db/schema');

        if (sport === 'Basketball') {
            const stats = await db
                .select()
                .from(basketballPlayerStats)
                .where(eq(basketballPlayerStats.playerId, playerId))
                .get();

            const updates: any = {};

            // BUG (missed-shot-counted-as-made): these three cases used to increment
            // made-counts and totalPoints unconditionally on event type alone, with no
            // make/miss distinction — a "2PT Missed"/"3PT Missed"/"FT Missed" log entry
            // silently wrote a make + its points to the DB, since `value` truthiness
            // (0 is falsy) was the only signal available and it collapsed to the same
            // "absent" case as a real make with no value sent. `made` is an explicit
            // boolean sent by the client for these three types specifically — a miss
            // must increment zero counters, never inferred from value.
            // BUG-133: *Attempted columns (fieldGoalsAttempted/threePointersAttempted/
            // freeThrowsAttempted) were never incremented on make OR miss -- with no
            // denominator, fieldGoalPercentage/threePointPercentage/freeThrowPercentage
            // could never be computed for any player, ever. Every shot attempt (make or
            // miss) increments its Attempted counter; only a make also increments the
            // Made counter and totalPoints -- made/miss discipline from the fix above
            // is unchanged, this is additive.
            switch (eventType) {
                case 'Field Goal':
                    updates.fieldGoalsAttempted = (stats?.fieldGoalsAttempted || 0) + 1;
                    if (made) {
                        updates.fieldGoalsMade = (stats?.fieldGoalsMade || 0) + 1;
                        updates.totalPoints = (stats?.totalPoints || 0) + 2;
                    }
                    break;
                case 'Three Pointer':
                    updates.threePointersAttempted = (stats?.threePointersAttempted || 0) + 1;
                    if (made) {
                        updates.threePointersMade = (stats?.threePointersMade || 0) + 1;
                        updates.totalPoints = (stats?.totalPoints || 0) + 3;
                    }
                    break;
                case 'Free Throw':
                    updates.freeThrowsAttempted = (stats?.freeThrowsAttempted || 0) + 1;
                    if (made) {
                        updates.freeThrowsMade = (stats?.freeThrowsMade || 0) + 1;
                        updates.totalPoints = (stats?.totalPoints || 0) + 1;
                    }
                    break;
                case 'Rebound':
                    updates.totalRebounds = (stats?.totalRebounds || 0) + 1;
                    break;
                case 'Assist':
                    updates.assists = (stats?.assists || 0) + 1;
                    break;
                case 'Steal':
                    updates.steals = (stats?.steals || 0) + 1;
                    break;
                case 'Block':
                    updates.blocks = (stats?.blocks || 0) + 1;
                    break;
                case 'Turnover':
                    updates.turnovers = (stats?.turnovers || 0) + 1;
                    break;
                case 'Foul':
                    updates.personalFouls = (stats?.personalFouls || 0) + 1;
                    break;
            }

            if (Object.keys(updates).length > 0) {
                if (stats) {
                    await db
                        .update(basketballPlayerStats)
                        .set(updates)
                        .where(eq(basketballPlayerStats.playerId, playerId));
                } else {
                    await db.insert(basketballPlayerStats).values({
                        id: `bstats_${nanoid()}`,
                        playerId,
                        season: '2024',
                        ...updates,
                    });
                }
            }
        } else if (sport === 'Football') {
            const stats = await db
                .select()
                .from(footballPlayerStats)
                .where(eq(footballPlayerStats.playerId, playerId))
                .get();

            const updates: any = {};

            switch (eventType.toUpperCase().replace(/\s+/g, '_')) {
                case 'GOAL':
                    updates.goals = (stats?.goals || 0) + 1;
                    updates.shotsOnTarget = (stats?.shotsOnTarget || 0) + 1;
                    break;
                case 'ASSIST':
                    updates.assists = (stats?.assists || 0) + 1;
                    break;
                case 'OWN_GOAL':
                    updates.ownGoals = (stats?.ownGoals || 0) + 1;
                    break;
                case 'PENALTY':
                    updates.penaltiesScored = (stats?.penaltiesScored || 0) + 1;
                    updates.shotsOnTarget = (stats?.shotsOnTarget || 0) + 1;
                    break;
                case 'PENALTY_MISSED':
                    updates.shotsOffTarget = (stats?.shotsOffTarget || 0) + 1;
                    break;
                case 'PENALTY_SAVED':
                    updates.shotsOnTarget = (stats?.shotsOnTarget || 0) + 1;
                    break;
                case 'FOUL':
                    updates.foulsCommitted = (stats?.foulsCommitted || 0) + 1;
                    break;
                case 'YELLOW_CARD':
                    updates.yellowCards = (stats?.yellowCards || 0) + 1;
                    break;
                case 'RED_CARD':
                    updates.redCards = (stats?.redCards || 0) + 1;
                    break;
                case 'SAVE':
                    updates.saves = (stats?.saves || 0) + 1;
                    break;
            }

            if (Object.keys(updates).length > 0) {
                if (stats) {
                    await db
                        .update(footballPlayerStats)
                        .set(updates)
                        .where(eq(footballPlayerStats.playerId, playerId));
                } else {
                    await db.insert(footballPlayerStats).values({
                        id: `fstats_${nanoid()}`,
                        playerId,
                        season: '2024',
                        ...updates,
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error updating player stats:', error);
        // Don't throw - event should still be logged
    }
}
