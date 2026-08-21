import { NextRequest, NextResponse, after } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/db';
import { matchEvents, matches, matchLoggerAssignments, footballPlayerStats, basketballPlayerStats } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { broadcastEventDeleted, broadcastScoreUpdate } from '@/lib/socket';
import { SCORING_POINT_VALUES } from '@/lib/scoring';

// Reverts one stat increment for a player when an event is deleted.
// Mirrors updatePlayerStats in events/route.ts — same guards must apply at call site.
// Does NOT throw — event deletion already succeeded by the time this runs.
// `value` (already JSON.parsed by the caller) is only meaningful for basketball's
// shot types — same make/miss gate as updatePlayerStats' `made` boolean, since a
// missed shot must never decrement a made-count that was never incremented.
async function revertPlayerStat(sport: string, playerId: string, eventType: string, value?: unknown): Promise<void> {
    try {
        // BUG-130: basketball had zero revert coverage at all — a hard `if (sport !==
        // 'Football') return;` no-op'd every basketball stat revert, same shape as
        // football's already-fixed BUG-060, just never ported. Mirrors
        // updatePlayerStats' basketball branch (events/route.ts) exactly, decrementing
        // with a MAX(x-1, 0) floor instead of incrementing.
        if (sport === 'Basketball') {
            const stats = await db
                .select()
                .from(basketballPlayerStats)
                .where(eq(basketballPlayerStats.playerId, playerId))
                .get();

            if (!stats) return;

            const updates: Partial<typeof stats> = {};
            const wasMake = typeof value === 'number' && value > 0;

            switch (eventType) {
                // BUG-133: the write side (events/route.ts) increments the *Attempted
                // counter on every shot attempt regardless of make/miss -- the revert
                // must decrement it unconditionally too, or a deleted shot leaves the
                // attempt count permanently 1 too high (asymmetric with the write path,
                // the exact anti-pattern known-issues.md already documents for BUG-060).
                case 'Field Goal':
                    updates.fieldGoalsAttempted = Math.max(0, (stats.fieldGoalsAttempted || 0) - 1);
                    if (wasMake) {
                        updates.fieldGoalsMade = Math.max(0, (stats.fieldGoalsMade || 0) - 1);
                        updates.totalPoints = Math.max(0, (stats.totalPoints || 0) - 2);
                    }
                    break;
                case 'Three Pointer':
                    updates.threePointersAttempted = Math.max(0, (stats.threePointersAttempted || 0) - 1);
                    if (wasMake) {
                        updates.threePointersMade = Math.max(0, (stats.threePointersMade || 0) - 1);
                        updates.totalPoints = Math.max(0, (stats.totalPoints || 0) - 3);
                    }
                    break;
                case 'Free Throw':
                    updates.freeThrowsAttempted = Math.max(0, (stats.freeThrowsAttempted || 0) - 1);
                    if (wasMake) {
                        updates.freeThrowsMade = Math.max(0, (stats.freeThrowsMade || 0) - 1);
                        updates.totalPoints = Math.max(0, (stats.totalPoints || 0) - 1);
                    }
                    break;
                case 'Rebound':
                    updates.totalRebounds = Math.max(0, (stats.totalRebounds || 0) - 1);
                    break;
                case 'Assist':
                    updates.assists = Math.max(0, (stats.assists || 0) - 1);
                    break;
                case 'Steal':
                    updates.steals = Math.max(0, (stats.steals || 0) - 1);
                    break;
                case 'Block':
                    updates.blocks = Math.max(0, (stats.blocks || 0) - 1);
                    break;
                case 'Turnover':
                    updates.turnovers = Math.max(0, (stats.turnovers || 0) - 1);
                    break;
                case 'Foul':
                    updates.personalFouls = Math.max(0, (stats.personalFouls || 0) - 1);
                    break;
                case 'Technical Foul':
                    // BACKLOG-166: mirrors events/route.ts's write-side split -- must
                    // stay symmetric, per this project's own convention (any stat
                    // incremented on write must be decremented on delete).
                    updates.technicalFouls = Math.max(0, (stats.technicalFouls || 0) - 1);
                    break;
                default:
                    return;
            }

            if (Object.keys(updates).length > 0) {
                await db
                    .update(basketballPlayerStats)
                    .set(updates)
                    .where(eq(basketballPlayerStats.playerId, playerId));
            }
            return;
        }

        if (sport !== 'Football') return;

        const stats = await db
            .select()
            .from(footballPlayerStats)
            .where(eq(footballPlayerStats.playerId, playerId))
            .get();

        if (!stats) return;

        const updates: Partial<typeof stats> = {};

        switch (eventType.toUpperCase().replace(/\s+/g, '_')) {
            case 'GOAL':
                updates.goals = Math.max(0, (stats.goals || 0) - 1);
                updates.shotsOnTarget = Math.max(0, (stats.shotsOnTarget || 0) - 1);
                break;
            case 'ASSIST':
                updates.assists = Math.max(0, (stats.assists || 0) - 1);
                break;
            case 'OWN_GOAL':
                updates.ownGoals = Math.max(0, (stats.ownGoals || 0) - 1);
                break;
            case 'PENALTY':
                updates.penaltiesScored = Math.max(0, (stats.penaltiesScored || 0) - 1);
                updates.shotsOnTarget = Math.max(0, (stats.shotsOnTarget || 0) - 1);
                break;
            case 'PENALTY_MISSED':
                updates.shotsOffTarget = Math.max(0, (stats.shotsOffTarget || 0) - 1);
                break;
            case 'PENALTY_SAVED':
                updates.shotsOnTarget = Math.max(0, (stats.shotsOnTarget || 0) - 1);
                break;
            case 'FOUL':
                updates.foulsCommitted = Math.max(0, (stats.foulsCommitted || 0) - 1);
                break;
            case 'YELLOW_CARD':
                updates.yellowCards = Math.max(0, (stats.yellowCards || 0) - 1);
                break;
            case 'RED_CARD':
                updates.redCards = Math.max(0, (stats.redCards || 0) - 1);
                break;
            case 'SAVE':
                updates.saves = Math.max(0, (stats.saves || 0) - 1);
                break;
            default:
                return;
        }

        if (Object.keys(updates).length > 0) {
            await db
                .update(footballPlayerStats)
                .set(updates)
                .where(eq(footballPlayerStats.playerId, playerId));
        }
    } catch (error) {
        console.error('[revertPlayerStat] stat reversion failed — event already deleted:', error);
        Sentry.captureException(error, { extra: { playerId, eventType, sport } });
        // Do not rethrow. Event deletion succeeded. Stat drift is recoverable; a false 500 is not.
    }
}

// PATCH /api/matches/[id]/events/[eventId] - Update match event
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string; eventId: string } }
) {
    try {
        const { id: matchId, eventId } = params;

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
        const { type, minute, second, teamId, playerId, relatedPlayerId, detail, period } = body;

        // Verify event exists
        const event = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.id, eventId))
            .get();

        if (!event) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            );
        }

        // Update event — explicit allowlist only. matchId, loggerId, createdAt, isEyePoint, id are immutable.
        await db
            .update(matchEvents)
            .set({
                ...(type !== undefined && { type }),
                ...(minute !== undefined && { minute }),
                ...(second !== undefined && { second }),
                ...(teamId !== undefined && { teamId }),
                ...(playerId !== undefined && { playerId }),
                ...(relatedPlayerId !== undefined && { relatedPlayerId }),
                ...(detail !== undefined && { detail }),
                ...(period !== undefined && { period }),
            })
            .where(eq(matchEvents.id, eventId));

        // Get updated event
        const updatedEvent = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.id, eventId))
            .get();

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
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string; eventId: string } }
) {
    try {
        const { id: matchId, eventId } = params;

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

        // BUG-130: this check only ever recognized football's GOAL/PENALTY/OWN_GOAL —
        // deleting a basketball Field Goal/Three Pointer/Free Throw event removed the
        // event row but never touched matches.homeScore/awayScore, leaving a ghost
        // score the event log no longer justified. `event.value` is TEXT-column
        // JSON (BUG-126/BUG-132) — parse it the same way the POST route's own
        // isBasketballScore gate does, so a deleted *miss* (value 0/absent) correctly
        // never triggers a revert, mirroring the credit-time gate exactly.
        const parsedValue = event.value != null ? JSON.parse(event.value) : null;
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

        await db.transaction(async (tx) => {
            await tx.delete(matchEvents).where(eq(matchEvents.id, eventId));

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

        // Revert player stats — same guards as POST: skip friendlies and shootout events
        if (match) {
            const isPenaltyShootout = match.currentPeriod === 'PENALTY_SHOOTOUT';
            const isCompetitive = match.matchType !== 'friendly' && !isPenaltyShootout;

            if (event.playerId && isCompetitive) {
                await revertPlayerStat(match.sport, event.playerId, event.type, parsedValue);
            }

            // Penalty Saved: also revert the keeper's saves stat (relatedPlayerId = keeper, may be null)
            if (upperType === 'PENALTY_SAVED' && event.relatedPlayerId && isCompetitive) {
                await revertPlayerStat(match.sport, event.relatedPlayerId, 'Save', parsedValue);
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
