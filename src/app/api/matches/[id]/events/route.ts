import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/db';
import { matchEvents, matches, matchLoggerAssignments, players, teams } from '@/db/schema';
import { eq, and, sql, gt, isNull, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';
import { broadcastMatchEvent, broadcastScoreUpdate, broadcastGlobalNotification } from '@/lib/socket';
import { SCORING_POINT_VALUES } from '@/lib/scoring';
import { sendMatchEventNotification } from '@/lib/notifications/match-notification-service';
import { getNotifiableEventType } from '@/lib/notifications/notification-rules';
import { isPushEligibleMatchType } from '@/lib/notifications/send-gate';
import { getEventStatEffects } from '@/lib/player-stats-key';
import { recordEventStats } from '@/lib/playerStatsService';
import { isValidClientEventId } from '@/lib/event-id';
import { validateEventInput } from '@/lib/event-input';
import { toPublicMatchEvent } from '@/lib/ws-public-payload';

// Notification-reliability fix: this trigger used to fire from the logger's own
// browser tab only (MatchStateManager.triggerNotification -> window CustomEvent ->
// EventDrivenNotifier), so a closed/crashed tab silently stopped all notifications
// for that match even though the event still saved fine -- same class of gap
// BUG-108/BUG-116 already fixed for the WS broadcast. Moved server-side, same
// after() pattern as the broadcast calls below. Includes the BUG-199 fix
// ('Yellow Card' was fully wired for delivery but missing from this allowlist).
//
// Which raw event types are notifiable, per sport, now lives in
// notification-rules.ts's NOTIFICATION_RULES table (roadmap thread 5/7) rather than
// a flat map here -- that table is what basketball's 'Technical Foul' entry and
// football's five entries both come from.

const EVENTS_PAGE_LIMIT = 500;

// GET /api/matches/[id]/events - Get the events for a match (newest EVENTS_PAGE_LIMIT, ascending)
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

        // The newest EVENTS_PAGE_LIMIT events: a long match must lose its oldest events, not
        // the latest ones, when it exceeds the cap. Fetched newest-first, then returned in
        // ascending order so the response order is what consumers have always received.
        const newestFirst = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.matchId, matchId))
            .orderBy(desc(matchEvents.minute), desc(matchEvents.second), desc(matchEvents.id))
            .limit(EVENTS_PAGE_LIMIT);
        const events = newestFirst.reverse();

        // Strip logger identity fields from unauthenticated (public) responses — NDPR compliance.
        // Only privileged callers (admin, or a logger seeding local state / multi-logger conflict
        // detection) receive full rows. Any other session -- including a self-registered fan --
        // gets the stripped shape, same as an anonymous viewer.
        const authUser = await getAuthUser(request).catch(() => null);
        const canSeeLoggerIdentity = authUser?.role === 'admin' || authUser?.role === 'logger';
        const responseEvents = canSeeLoggerIdentity
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

        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
        }
        const {
            id: clientEventIdRaw,
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

        // BACKLOG-466 item 1: optional client-generated event id used as an
        // idempotency key (match_events.id is the text PRIMARY KEY, so no schema
        // change). A replay (offline-queue drain after a lost response, double
        // submit) carrying an id that already exists for THIS match returns that
        // row with 200 -- no insert, no score change, no side effects -- and is
        // checked BEFORE the FINISHED lock so a replay of an already-saved event
        // is never reported as a failure. An id that exists for a DIFFERENT match
        // (or any invalid id) is ignored and the server generates its own.
        const clientEventId = isValidClientEventId(clientEventIdRaw) ? clientEventIdRaw : null;
        let adoptClientEventId = false;
        if (clientEventId) {
            const [existingById] = await db
                .select()
                .from(matchEvents)
                .where(eq(matchEvents.id, clientEventId))
                .limit(1);
            if (existingById && existingById.matchId === matchId) {
                return NextResponse.json({
                    success: true,
                    message: 'Duplicate submission ignored — event already recorded',
                    event: existingById,
                }, { status: 200 });
            }
            adoptClientEventId = !existingById;
        }

        // BACKLOG-153 item 3: no server-side write-lock existed on FINISHED matches --
        // an event POST against an already-finished match had nothing rejecting it,
        // silently corrupting post-match stats/score. Score corrections go through the
        // admin PATCH /api/matches/[id] route, not this one, so this is a hard block
        // with no legitimate write path bypassed.
        if (match.status === 'FINISHED') {
            return NextResponse.json(
                { error: 'Cannot log events against a finished match' },
                { status: 409 }
            );
        }

        // Events are accepted only while the match is LIVE (admins included: an admin sets the
        // match LIVE first). A queued event replayed after the match was reopened or before it
        // started is reported with a code so the client can keep it queued instead of dropping it.
        if (match.status !== 'LIVE') {
            return NextResponse.json(
                { error: 'Events can only be logged while the match is live', code: 'MATCH_NOT_LIVE' },
                { status: 409 }
            );
        }

        // Input validation (422): bad input is rejected, never stored or credited (src/lib/event-input.ts).
        const inputError = validateEventInput({ type, minute, second, detail, teamId, made }, match);
        if (inputError) {
            return NextResponse.json({ error: inputError }, { status: 422 });
        }

        // BUG-196 / dual-logger live test (2026-09-10): duplicate-submission guard.
        // Originally found live during session 48's football Tier 0 sweep -- two
        // concurrent identical POSTs (a double-tap, or a client retry after a slow/
        // lost ack) each created a genuine, separate match_events row and, for a
        // scoring type, each incremented the score independently. Player-attributed
        // events only (playerId required): a repeat of the identical (match, type,
        // minute, player) within a short window is treated as the same real-world
        // event and the original is returned instead of inserting a second row.
        // Player-less event types (corner, offside, etc.) are intentionally excluded
        // -- those can legitimately repeat with identical fields moments apart and a
        // false-positive dedup there would silently drop a real event.
        //
        // This check originally ran as a standalone SELECT *before* the
        // db.transaction() below that does the insert + score update -- which meant
        // it only protected against a double-tap from the SAME request path, not two
        // genuinely concurrent requests. Live-tested with two real logger accounts
        // firing the identical goal via Promise.all (true concurrency, not
        // sequential): both passed this check (neither had committed yet when the
        // other's SELECT ran) and both inserted, inflating the score by 2 instead of
        // 1 -- reproducing exactly BUG-196's original symptom, just from two loggers
        // instead of one double-tap. Fix: the dedup check now runs *inside* the same
        // transaction as the insert, the same pattern already proven for the
        // logger-assignment race (assign-logger/route.ts's check-then-insert,
        // BUG-008) -- the whole check+insert+score-update is now one atomic unit, so
        // a second concurrent request's check can no longer run against a
        // not-yet-committed state.
        let dedupHit: typeof matchEvents.$inferSelect | undefined;

        // Create event
        const eventId = adoptClientEventId && clientEventId ? clientEventId : nanoid();
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
            // A logger's display name comes from the verified session too: a client-supplied
            // loggerName in the body is ignored.
            loggerName: authUser.role === 'logger' ? (authUser.name || null) : authUser.id,
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
        let newShootoutHomeScore: number | undefined;
        let newShootoutAwayScore: number | undefined;

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
            if (playerId) {
                // BACKLOG-433: the previous version of this guard ran the
                // dedup SELECT and the INSERT as two separate statements
                // inside this same db.transaction(), on the assumption that
                // Turso's transaction gives the same read-blocks-on-
                // uncommitted-write isolation a local SQLite file connection
                // would. Live-tested 4x with two genuinely concurrent
                // requests (Promise.all): 3 of 4 runs reproduced BUG-196's
                // original symptom exactly -- both requests' SELECT ran
                // before either had committed, both saw "no existing row",
                // both inserted, score double-counted. Turso's remote/HTTP
                // transaction protocol does not appear to serialize
                // concurrent transactions' reads against each other's
                // uncommitted writes the way a single-process SQLite file
                // connection does.
                //
                // Fixed by collapsing the check and the insert into ONE
                // atomic statement (INSERT ... SELECT ... WHERE NOT EXISTS).
                // A single SQL statement is atomic at the SQLite engine
                // level regardless of the higher-level transaction/isolation
                // semantics for multi-statement transactions over HTTP --
                // there is no window between "check" and "act" left for a
                // second concurrent request to land in, because they are
                // the same database operation. created_at is stored as unix
                // seconds (confirmed directly against real rows in staging,
                // not assumed) -- matches.$inferInsert's own timestamp mode
                // for this column, replicated by hand here since a raw sql
                // fragment used as a literal SELECT source has no access to
                // Drizzle's column-level encode/decode mapping.
                //
                // BACKLOG-466 item 5: the key now also includes `value` via a
                // NULL-safe `IS` comparison (same statement structure, one extra
                // predicate). value = JSON of the points for a scoring/basketball
                // event (0 for a miss), so a miss followed by a make by one player
                // in the same minute within 10s is no longer collapsed into one.
                // Deliberately NOT keyed on `detail`: two loggers recording the same
                // real event can word it differently, and widening on it would
                // reopen the BACKLOG-151/433 dual-logger double count. Residual: two
                // makes of identical value by one player in the same minute within
                // 10s still collapse (the heuristic cannot tell them from a second
                // logger's copy of the same event).
                const dedupWindowStart = new Date(Date.now() - 10_000);
                const result: any = await tx.run(sql`
                    INSERT INTO match_events
                        (id, match_id, type, minute, second, period, team_id, player_id, related_player_id, detail, is_eye_point, value, logger_id, logger_name, created_at)
                    SELECT ${newEvent.id}, ${newEvent.matchId}, ${newEvent.type}, ${newEvent.minute}, ${newEvent.second}, ${newEvent.period}, ${newEvent.teamId}, ${newEvent.playerId}, ${newEvent.relatedPlayerId}, ${newEvent.detail}, ${newEvent.isEyePoint ? 1 : 0}, ${newEvent.value}, ${newEvent.loggerId}, ${newEvent.loggerName}, ${Math.floor(newEvent.createdAt.getTime() / 1000)}
                    WHERE NOT EXISTS (
                        SELECT 1 FROM match_events
                        WHERE match_id = ${matchId} AND type = ${type} AND minute = ${minute} AND player_id = ${playerId} AND value IS ${newEvent.value} AND created_at > ${Math.floor(dedupWindowStart.getTime() / 1000)}
                    )
                `);

                if ((result.rowsAffected ?? 0) === 0) {
                    // Deduped -- fetch whatever matching row already exists to
                    // return in the response (best-effort, same as before).
                    const [existingEvent] = await tx
                        .select()
                        .from(matchEvents)
                        .where(
                            and(
                                eq(matchEvents.matchId, matchId),
                                eq(matchEvents.type, type),
                                eq(matchEvents.minute, minute),
                                eq(matchEvents.playerId, playerId),
                                newEvent.value === null ? isNull(matchEvents.value) : eq(matchEvents.value, newEvent.value),
                                gt(matchEvents.createdAt, dedupWindowStart)
                            )
                        )
                        .orderBy(desc(matchEvents.createdAt))
                        .limit(1);
                    dedupHit = existingEvent;
                    return;
                }
            } else {
                await tx.insert(matchEvents).values(newEvent);
            }

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

            // BACKLOG-105: penalty shootout score, isolated from homeScore/awayScore.
            // Only PEN_SCORED increments; PEN_MISSED/PEN_SAVED are logged (for the
            // shootout sequence display) but never touch any score. No player-stat
            // write happens for any PEN_* type -- they simply have no case in
            // updatePlayerStats' switch below, so it's a no-op by construction, not a guard.
            if (upperType === 'PEN_SCORED' && isPenaltyShootout) {
                const isHomeTeam = teamId === match.homeTeamId;
                const [updated] = isHomeTeam
                    ? await tx.update(matches)
                        .set({ shootoutHomeScore: sql`COALESCE(${matches.shootoutHomeScore}, 0) + 1`, updatedAt: new Date() })
                        .where(eq(matches.id, matchId))
                        .returning({ shootoutHomeScore: matches.shootoutHomeScore, shootoutAwayScore: matches.shootoutAwayScore })
                    : await tx.update(matches)
                        .set({ shootoutAwayScore: sql`COALESCE(${matches.shootoutAwayScore}, 0) + 1`, updatedAt: new Date() })
                        .where(eq(matches.id, matchId))
                        .returning({ shootoutHomeScore: matches.shootoutHomeScore, shootoutAwayScore: matches.shootoutAwayScore });

                newShootoutHomeScore = updated.shootoutHomeScore ?? 0;
                newShootoutAwayScore = updated.shootoutAwayScore ?? 0;
            }
        }).catch(async (txError) => {
            // BACKLOG-466 item 1/6: two concurrent requests carrying the SAME client
            // id both passed the pre-check above; the loser hits the PRIMARY KEY
            // constraint, the whole transaction rolls back (no score change). If the
            // winner's row now exists for this match, that is an idempotent replay,
            // not a failure. Anything else is a real error and propagates.
            if (adoptClientEventId && clientEventId) {
                const [winner] = await db
                    .select()
                    .from(matchEvents)
                    .where(eq(matchEvents.id, clientEventId))
                    .limit(1);
                if (winner && winner.matchId === matchId) {
                    dedupHit = winner;
                    newHomeScore = undefined;
                    newAwayScore = undefined;
                    newShootoutHomeScore = undefined;
                    newShootoutAwayScore = undefined;
                    return;
                }
            }
            throw txError;
        });

        if (dedupHit) {
            return NextResponse.json({
                success: true,
                message: 'Duplicate submission ignored — event already recorded',
                event: dedupHit,
            }, { status: 200 });
        }

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
        // Public room: broadcast without logger identity (same rule as the REST GET; src/lib/ws-public-payload.ts).
        after(() => broadcastMatchEvent(matchId, toPublicMatchEvent(newEvent)));

        if (newHomeScore !== undefined && newAwayScore !== undefined) {
            after(() => broadcastScoreUpdate(matchId, newHomeScore!, newAwayScore!));
        }

        if (newShootoutHomeScore !== undefined && newShootoutAwayScore !== undefined) {
            after(() => broadcastScoreUpdate(matchId, match.homeScore ?? 0, match.awayScore ?? 0, newShootoutHomeScore, newShootoutAwayScore));
        }

        const notificationEventType = getNotifiableEventType(match.sport, type);
        if (notificationEventType && !isPenaltyShootout && isPushEligibleMatchType(match.matchType)) {
            after(async () => {
                try {
                    // Penalty Saved credits the keeper (relatedPlayerId), not the taker --
                    // same distinction the player-stats update above already makes.
                    const notifyPlayerId = notificationEventType === 'PENALTY_SAVED' ? relatedPlayerId : playerId;
                    const [player, team] = await Promise.all([
                        notifyPlayerId
                            ? db.select({ name: players.name }).from(players).where(eq(players.id, notifyPlayerId)).get()
                            : null,
                        teamId
                            ? db.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId)).get()
                            : null,
                    ]);
                    await sendMatchEventNotification({
                        matchId,
                        homeTeamId: match.homeTeamId,
                        awayTeamId: match.awayTeamId,
                        eventType: notificationEventType,
                        playerName: player?.name,
                        teamName: team?.name,
                        minute,
                        homeScore: newHomeScore ?? match.homeScore ?? undefined,
                        awayScore: newAwayScore ?? match.awayScore ?? undefined,
                        // BACKLOG-342: now used for targeting -- match-notification-service.ts's
                        // playerFavorites query joins on these to notify anyone who has
                        // starred this specific player (userFavorites, favoriteType: 'player').
                        playerId: notifyPlayerId || undefined,
                        relatedPlayerId: relatedPlayerId || undefined,
                        competitionId: match.competitionId,
                    });

                    // BUG-210: in-app toast, server-side, same trigger point as the push
                    // send above -- no longer dependent on the logger's tab staying open,
                    // and now fires for basketball too (previously never did, since
                    // BasketballLogger.tsx never emitted the client-side event:log this
                    // used to depend on). Only the toast-listener-recognized subset --
                    // PENALTY_SAVED/PENALTY_MISSED/TECHNICAL_FOUL aren't in
                    // GlobalNotificationListener.tsx's accepted type list, so skip
                    // broadcasting those rather than emitting a silent no-op.
                    if (notificationEventType === 'GOAL' || notificationEventType === 'RED_CARD' || notificationEventType === 'YELLOW_CARD') {
                        const toastMessage = notificationEventType === 'GOAL'
                            ? `GOAL! ${player?.name ? player.name + ' scores!' : 'Goal scored!'}`
                            : notificationEventType === 'RED_CARD'
                                ? `${player?.name || 'A player'} has been sent off!`
                                : `${player?.name || 'A player'} has been booked`;
                        await broadcastGlobalNotification({
                            type: notificationEventType,
                            message: toastMessage,
                            matchId,
                            teamId: teamId || undefined,
                            homeTeamId: match.homeTeamId,
                            awayTeamId: match.awayTeamId,
                            playerId: notifyPlayerId || undefined,
                        });
                    }
                } catch (error) {
                    console.error('Error sending match event notification:', error);
                }
            });
        }

        // Update player stats for competitive matches only — friendlies and shootout events do not count.
        // Runs AFTER the response (after()): the stats upsert is 2-3 sequential Turso round trips and used to
        // delay both the logger's ack and the viewers' broadcast, which also only starts once the response is
        // sent (BACKLOG-480 item 4). updatePlayerStats already swallows errors and reports them to Sentry.
        // The player on the event is credited, and for a saved penalty the keeper (relatedPlayerId, optional)
        // is credited a save: getEventStatEffects returns both, the same list the delete path reverts.
        if (match.matchType !== 'friendly' && !isPenaltyShootout) {
            const statEffects = getEventStatEffects(match.sport, {
                type,
                playerId: playerId || null,
                relatedPlayerId: relatedPlayerId || null,
                made: made === true,
            });
            if (statEffects.length > 0) {
                after(() => recordEventStats(match.sport, match.competitionId, statEffects));
            }
        }

        // BACKLOG-255: no longer auto-calculating ratings on every single live event.
        // This used to run calculateAndSaveRatings() (a sequential SELECT+UPDATE per
        // rated player) on every LIVE-status event -- a real, unmeasured contributor
        // to Flow B's ~9.9s latency (readiness checklist). Ratings now recalculate
        // once, on the match's FINISHED transition (src/app/api/matches/[id]/route.ts),
        // plus on-demand via the existing admin "Calculate Ratings" button
        // (POST /api/matches/[id]/ratings, admin/match-ratings/[id]/page.tsx) -- both
        // already call the same shared calculateAndSaveRatings(). Known, accepted
        // side effect (architect's Q2 recommendation, not an oversight): the match
        // detail page's Lineups tab reads playerRatings (finalRating ?? autoRating,
        // matches/[id]/route.ts:~483) without a status gate, so a LIVE match's
        // displayed ratings now stay at their last-computed value (initialize/route.ts's
        // 6.0 default, if never manually recalculated) for the rest of the match
        // instead of updating after every event -- only FINISHED or a manual admin
        // recalculation refreshes them. Traded deliberately for Flow B latency.

        return NextResponse.json({
            success: true,
            message: 'Event created successfully',
            event: newEvent,
            ...(newShootoutHomeScore !== undefined ? { shootoutHomeScore: newShootoutHomeScore } : {}),
            ...(newShootoutAwayScore !== undefined ? { shootoutAwayScore: newShootoutAwayScore } : {}),
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating match event:', error);
        return NextResponse.json(
            { error: 'Failed to create match event' },
            { status: 500 }
        );
    }
}
