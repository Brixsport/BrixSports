import { NextRequest, NextResponse, after } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/db';
import { matchEvents, matches, matchLoggerAssignments } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { broadcastEventDeleted, broadcastScoreUpdate } from '@/lib/socket';
import { SCORING_POINT_VALUES } from '@/lib/scoring';
import { safeParseEventValue } from '@/lib/eventValue';
import { getEventStatEffects } from '@/lib/player-stats-key';
import { recordEventStats, revertEventStats } from '@/lib/playerStatsService';
import { validateEventPatch } from '@/lib/event-patch';
import { recalculateStandingsForMatch } from '@/lib/standingsService';

// Standings count cards and goals from a FINISHED match's events, so any admin change to
// such an event has to refresh them. Own try/catch: it must never fail the request.
async function recalculateStandingsSafely(matchId: string) {
    try {
        await recalculateStandingsForMatch(matchId);
    } catch (error) {
        console.error('Error recalculating standings after event change:', error);
        Sentry.captureException(error, { tags: { area: 'standings-recalc' }, extra: { matchId } });
    }
}

// PATCH /api/matches/[id]/events/[eventId] - Update match event
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; eventId: string }> }
) {
    try {
        const { id: matchId, eventId } = await params;

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

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
        }
        const { type, minute, second, teamId, playerId, relatedPlayerId, detail, period } = body as Record<string, any>;

        // Verify event exists AND belongs to the match in the URL (the assignment check above is
        // against the URL match, so an event of another match must not be reachable through it).
        const event = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.id, eventId))
            .get();

        if (!event || event.matchId !== matchId) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            );
        }

        const match = await db.select().from(matches).where(eq(matches.id, matchId)).get();
        if (!match) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // Write-lock: a logger cannot edit events of a FINISHED match (admins can).
        if (authUser.role === 'logger' && match.status === 'FINISHED') {
            return NextResponse.json(
                { error: 'Match is finished and locked; only an admin can edit its events', code: 'MATCH_FINISHED_LOCKED' },
                { status: 409 }
            );
        }

        // Input validation (422), including the rule that a scoring event cannot be re-typed,
        // moved to the other team or have its made/value changed in place.
        const patchError = validateEventPatch(body, { type: event.type, teamId: event.teamId, value: event.value }, match);
        if (patchError) {
            return NextResponse.json({ error: patchError }, { status: 422 });
        }

        // Update event — explicit allowlist only. matchId, loggerId, createdAt, isEyePoint, id are immutable.
        await db
            .update(matchEvents)
            .set({
                ...(type !== undefined && { type }),
                ...(minute !== undefined && { minute: Number(minute) }),
                ...(second !== undefined && { second: second === null ? null : Number(second) }),
                ...(teamId !== undefined && { teamId: teamId || null }),
                ...(playerId !== undefined && { playerId: playerId || null }),
                ...(relatedPlayerId !== undefined && { relatedPlayerId: relatedPlayerId || null }),
                ...(detail !== undefined && { detail }),
                ...(period !== undefined && { period }),
            })
            .where(and(eq(matchEvents.id, eventId), eq(matchEvents.matchId, matchId)));

        // Get updated event
        const updatedEvent = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.id, eventId))
            .get();

        // Player stats follow the edit: when the type or the credited players changed, remove the
        // old contribution and add the new one (same shared effect list as create and delete).
        if (updatedEvent && match.matchType !== 'friendly' && match.currentPeriod !== 'PENALTY_SHOOTOUT') {
            const parsedValue = safeParseEventValue(event.value);
            const made = typeof parsedValue === 'number' && parsedValue > 0;
            const before = getEventStatEffects(match.sport, {
                type: event.type, playerId: event.playerId, relatedPlayerId: event.relatedPlayerId, made,
            });
            const afterEffects = getEventStatEffects(match.sport, {
                type: updatedEvent.type, playerId: updatedEvent.playerId, relatedPlayerId: updatedEvent.relatedPlayerId, made,
            });
            if (JSON.stringify(before) !== JSON.stringify(afterEffects)) {
                after(async () => {
                    await revertEventStats(match.sport, match.competitionId, before);
                    await recordEventStats(match.sport, match.competitionId, afterEffects);
                });
            }
        }

        // Cards feed the standings tie-breakers: refresh them when an admin re-types or moves
        // an event of a finished match.
        if (match.status === 'FINISHED' && updatedEvent &&
            (updatedEvent.type !== event.type || updatedEvent.teamId !== event.teamId)) {
            after(() => recalculateStandingsSafely(matchId));
        }

        return NextResponse.json({
            success: true,
            message: 'Event updated successfully',
            event: updatedEvent,
        });
    } catch (error) {
        console.error('Error updating match event:', error);
        return NextResponse.json(
            { error: 'Failed to update match event' },
            { status: 500 }
        );
    }
}

// DELETE /api/matches/[id]/events/[eventId] - Delete match event
//
// Idempotent: the row is removed with DELETE ... RETURNING inside the transaction, and the score
// revert, stats revert and broadcasts run only for the request that actually removed it. A
// concurrent or repeated delete of the same event gets the same 404 as any delete of a missing
// event and changes nothing.
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; eventId: string }> }
) {
    try {
        const { id: matchId, eventId } = await params;

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

        // Verify event exists and belongs to this match
        const event = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.id, eventId))
            .get();

        if (!event || event.matchId !== matchId) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            );
        }

        const upperType = event.type.toUpperCase().replace(/\s+/g, '_');
        const isOwnGoal = upperType === 'OWN_GOAL';

        // Fetch match — needed for score revert, stat guards, sport, and (new) the
        // basketball-aware isScoringEvent check below.
        const match = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .get();

        // Write-lock: a logger cannot delete events of a FINISHED match (a delete reverts the score
        // and player stats, which would defeat the lock the events POST route enforces). Admins can.
        if (authUser.role === 'logger' && match?.status === 'FINISHED') {
            return NextResponse.json(
                { error: 'Match is finished and locked; only an admin can delete its events', code: 'MATCH_FINISHED_LOCKED' },
                { status: 409 }
            );
        }

        // BUG-130: this check only ever recognized football's GOAL/PENALTY/OWN_GOAL —
        // deleting a basketball Field Goal/Three Pointer/Free Throw event removed the
        // event row but never touched matches.homeScore/awayScore, leaving a ghost
        // score the event log no longer justified. `event.value` is TEXT-column
        // JSON (BUG-126/BUG-132) — parse it the same way the POST route's own
        // isBasketballScore gate does, so a deleted *miss* (value 0/absent) correctly
        // never triggers a revert, mirroring the credit-time gate exactly.
        const parsedValue = safeParseEventValue(event.value);
        const isBasketballScore =
            match?.sport === 'Basketball' &&
            typeof parsedValue === 'number' && parsedValue > 0 &&
            (upperType === 'FIELD_GOAL' || upperType === 'THREE_POINTER' || upperType === 'FREE_THROW');
        const isScoringEvent = upperType === 'GOAL' || upperType === 'PENALTY' || isOwnGoal || isBasketballScore;

        // BUG-121: delete + score revert used to be two separate, independently
        // committed statements with no enclosing transaction, and the revert itself
        // read the score into a JS variable and wrote back a computed value — the
        // same read-modify-write race as the POST route's score update, mirrored
        // here for deletes. Both fixed together: delete + revert now share one
        // transaction, and the revert is an atomic SQL decrement (MAX(col - 1, 0),
        // same floor-at-zero clamp as before, now enforced by SQLite's MAX()
        // instead of Math.max() in application code) rather than a JS-computed value.
        // BUG-130: the decrement amount is now the same shared, type-keyed
        // SCORING_POINT_VALUES allowlist the POST route credits with (src/lib/scoring.ts)
        // instead of a hardcoded `- 1` — a Field Goal must revert by 2, not 1, or the
        // score ends up permanently 1 point short of correct after any basketball undo.
        let newHomeScore: number | undefined;
        let newAwayScore: number | undefined;
        let newShootoutHomeScore: number | undefined;
        let newShootoutAwayScore: number | undefined;
        let deleted = false as boolean;

        await db.transaction(async (tx) => {
            const removed = await tx
                .delete(matchEvents)
                .where(and(eq(matchEvents.id, eventId), eq(matchEvents.matchId, matchId)))
                .returning({ id: matchEvents.id });
            // Another request removed it first: nothing to revert.
            if (removed.length === 0) return;
            deleted = true;

            if (isScoringEvent && match) {
                const points = SCORING_POINT_VALUES[upperType] ?? 1;
                // Own goal: teamId is the conceding team — the opponent was credited. Revert opponent.
                const isHomeTeam = isOwnGoal
                    ? event.teamId !== match.homeTeamId
                    : event.teamId === match.homeTeamId;

                const [updated] = isHomeTeam
                    ? await tx.update(matches)
                        .set({ homeScore: sql`MAX(${matches.homeScore} - ${points}, 0)`, updatedAt: new Date() })
                        .where(eq(matches.id, matchId))
                        .returning({ homeScore: matches.homeScore, awayScore: matches.awayScore })
                    : await tx.update(matches)
                        .set({ awayScore: sql`MAX(${matches.awayScore} - ${points}, 0)`, updatedAt: new Date() })
                        .where(eq(matches.id, matchId))
                        .returning({ homeScore: matches.homeScore, awayScore: matches.awayScore });

                newHomeScore = updated.homeScore ?? 0;
                newAwayScore = updated.awayScore ?? 0;
            }

            // BACKLOG-105: undoing a PEN_SCORED must decrement the isolated shootout
            // score — mirrors the POST route's credit exactly, same team-attribution
            // (shootout kicks always credit the shooter's own team, no own-goal flip).
            if (upperType === 'PEN_SCORED' && match) {
                const isHomeTeam = event.teamId === match.homeTeamId;
                const [updated] = isHomeTeam
                    ? await tx.update(matches)
                        .set({ shootoutHomeScore: sql`MAX(COALESCE(${matches.shootoutHomeScore}, 0) - 1, 0)`, updatedAt: new Date() })
                        .where(eq(matches.id, matchId))
                        .returning({ shootoutHomeScore: matches.shootoutHomeScore, shootoutAwayScore: matches.shootoutAwayScore })
                    : await tx.update(matches)
                        .set({ shootoutAwayScore: sql`MAX(COALESCE(${matches.shootoutAwayScore}, 0) - 1, 0)`, updatedAt: new Date() })
                        .where(eq(matches.id, matchId))
                        .returning({ shootoutHomeScore: matches.shootoutHomeScore, shootoutAwayScore: matches.shootoutAwayScore });

                newShootoutHomeScore = updated.shootoutHomeScore ?? 0;
                newShootoutAwayScore = updated.shootoutAwayScore ?? 0;
            }
        });

        if (!deleted) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            );
        }

        // BUG-108/BUG-116: broadcast the deletion now that it's actually committed — same
        // gap as the POST route, same pre-built fix (src/lib/socket.ts). Wrapped in
        // after() rather than a bare fire-and-forget call — see events/route.ts's POST
        // handler for why (traced root cause of the observed multi-second broadcast delay).
        after(() => broadcastEventDeleted(matchId, eventId));

        if (newHomeScore !== undefined && newAwayScore !== undefined) {
            after(() => broadcastScoreUpdate(matchId, newHomeScore!, newAwayScore!));
        }

        if (newShootoutHomeScore !== undefined && newShootoutAwayScore !== undefined && match) {
            after(() => broadcastScoreUpdate(matchId, match.homeScore ?? 0, match.awayScore ?? 0, newShootoutHomeScore, newShootoutAwayScore));
        }

        // Revert player stats — same guards as POST: skip friendlies and shootout events.
        // The revert removes exactly the effects the write path adds for this event (the player,
        // and the keeper's save for a saved penalty), from the row of this match's own
        // season and competition only.
        if (match) {
            const isPenaltyShootout = match.currentPeriod === 'PENALTY_SHOOTOUT';
            const isCompetitive = match.matchType !== 'friendly' && !isPenaltyShootout;

            if (isCompetitive) {
                const effects = getEventStatEffects(match.sport, {
                    type: event.type,
                    playerId: event.playerId,
                    relatedPlayerId: event.relatedPlayerId,
                    made: typeof parsedValue === 'number' && parsedValue > 0,
                });
                await revertEventStats(match.sport, match.competitionId, effects);
            }

            // An admin deleting a goal or card of a finished match changes the standings.
            if (match.status === 'FINISHED') {
                after(() => recalculateStandingsSafely(matchId));
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Event deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting match event:', error);
        return NextResponse.json(
            { error: 'Failed to delete match event' },
            { status: 500 }
        );
    }
}
