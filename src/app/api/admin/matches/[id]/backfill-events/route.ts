/**
 * Admin backfill of key events onto a match that was never logged live.
 *
 *   POST   { events, score?, allowMismatch?, dryRun? }  add events (every event at minute -1)
 *   DELETE                                              "Reopen": remove this tool's / the GW1 script's events
 *
 * Never goes through the live events route: no push notifications, no broadcasts for a past game.
 * Events, the match row and player stats commit together in one transaction; standings, bracket
 * and ratings run after the commit and their outcome is reported in the response.
 */
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { nanoid } from 'nanoid';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { adminAuditLog, matches, matchEvents, playerTeamAffiliations, players } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import {
    BACKFILL_MARKERS,
    BACKFILL_MINUTE,
    backfillStatEffects,
    buildBackfillEventRows,
    checkFixtureState,
    scoreMismatch,
    validateBackfillEvents,
    type BackfillEventInput,
    type BackfillScore,
} from '@/lib/event-backfill';
import { incrementPlayerStats, decrementPlayerStats, resolveStatsKey } from '@/lib/playerStatsService';
import { recalculateStandingsForMatch } from '@/lib/standingsService';
import { advanceBracketForMatch } from '@/lib/bracketService';
import { calculateAndSaveRatings } from '@/lib/ratingsService';
import { isRatingsEnabled } from '@/lib/featureFlags';

type RouteContext = { params: Promise<{ id: string }> };

const FULL_TIME_PERIOD = 'FINISHED';
const ROSTER_CHECK_LIMIT = 500;

class RouteError extends Error {
    constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
        super(message);
    }
}

async function requireAdmin(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    return { user };
}

function parseScore(value: unknown): BackfillScore | null {
    if (!value || typeof value !== 'object') return null;
    const { home, away } = value as { home?: unknown; away?: unknown };
    const h = Number(home);
    const a = Number(away);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 99 || a > 99) return null;
    return { home: h, away: a };
}

/** Every player on an event must be on the roster side (affiliation or home team) of the event's team. */
async function checkRosters(events: BackfillEventInput[]): Promise<string[]> {
    const errors: string[] = [];
    const playerIds = Array.from(
        new Set(events.flatMap(e => [e.playerId, e.relatedPlayerId]).filter((id): id is string => !!id))
    );
    if (playerIds.length === 0) return errors;

    const found = await db
        .select({ id: players.id, teamId: players.teamId })
        .from(players)
        .where(inArray(players.id, playerIds))
        .limit(ROSTER_CHECK_LIMIT);
    const byId = new Map(found.map(p => [p.id, p]));

    const affiliations = await db
        .select({ playerId: playerTeamAffiliations.playerId, teamId: playerTeamAffiliations.teamId })
        .from(playerTeamAffiliations)
        .where(inArray(playerTeamAffiliations.playerId, playerIds))
        .limit(ROSTER_CHECK_LIMIT);
    const teamsOf = new Map<string, Set<string>>();
    for (const a of affiliations) {
        if (!teamsOf.has(a.playerId)) teamsOf.set(a.playerId, new Set());
        teamsOf.get(a.playerId)!.add(a.teamId);
    }

    events.forEach((e, index) => {
        for (const id of [e.playerId, e.relatedPlayerId]) {
            if (!id) continue;
            const player = byId.get(id);
            if (!player) {
                errors.push(`Event ${index + 1}: player ${id} does not exist`);
                continue;
            }
            const onTeam = player.teamId === e.teamId || teamsOf.get(id)?.has(e.teamId);
            if (!onTeam) errors.push(`Event ${index + 1}: player ${id} is not on that team's roster`);
        }
    });
    return errors;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
    try {
        const auth = await requireAdmin(request);
        if (auth.error) return auth.error;
        const { id: matchId } = await params;

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }
        const dryRun = body.dryRun === true;
        const allowMismatch = body.allowMismatch === true;
        const events = (Array.isArray(body.events) ? body.events : []) as BackfillEventInput[];

        const match = await db.select().from(matches).where(eq(matches.id, matchId)).get();
        if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

        const validation = validateBackfillEvents(events, {
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            sport: match.sport,
        });
        if (validation.errors.length > 0) {
            return NextResponse.json({ error: 'Invalid events', details: validation.errors }, { status: 422 });
        }
        const rosterErrors = await checkRosters(events);
        if (rosterErrors.length > 0) {
            return NextResponse.json({ error: 'Invalid players', details: rosterErrors }, { status: 422 });
        }

        const eventCount = await db
            .select({ n: sql<number>`count(*)` })
            .from(matchEvents)
            .where(eq(matchEvents.matchId, matchId))
            .get();
        const fixture = checkFixtureState(match, Number(eventCount?.n ?? 0));
        if (!fixture.ok) return NextResponse.json({ error: fixture.reason }, { status: 409 });

        const entered = parseScore(body.score);
        if (body.score !== undefined && body.score !== null && !entered) {
            return NextResponse.json({ error: 'score must be whole numbers from 0 to 99 for home and away' }, { status: 422 });
        }
        const target: BackfillScore =
            fixture.mode === 'finished-scored'
                ? { home: match.homeScore ?? 0, away: match.awayScore ?? 0 }
                : entered ?? validation.score;
        const mismatch = scoreMismatch(validation.score, target);
        if (mismatch && !allowMismatch) {
            return NextResponse.json({ error: mismatch, code: 'SCORE_MISMATCH', eventsScore: validation.score, score: target }, { status: 422 });
        }

        const statsApply = match.matchType !== 'friendly';
        const effects = statsApply ? backfillStatEffects(match.sport, events) : [];

        if (dryRun) {
            // Show current counters next to the change so the admin sees before/after.
            return NextResponse.json({
                dryRun: true,
                mode: fixture.mode,
                score: target,
                eventsScore: validation.score,
                scoreWarning: mismatch,
                eventCount: events.length,
                statsApplied: statsApply,
                statEffects: effects,
            });
        }

        const rows = buildBackfillEventRows(matchId, events, () => `bf_${nanoid()}`, new Date());

        await db.transaction(async tx => {
            // Re-check inside the transaction: two concurrent submits must not both pass preflight.
            const current = await tx.select().from(matches).where(eq(matches.id, matchId)).get();
            const count = await tx
                .select({ n: sql<number>`count(*)` })
                .from(matchEvents)
                .where(eq(matchEvents.matchId, matchId))
                .get();
            const again = current ? checkFixtureState(current, Number(count?.n ?? 0)) : { ok: false, reason: 'Match not found' };
            if (!again.ok || again.mode !== fixture.mode) {
                throw new RouteError(409, again.reason ?? 'Match changed while saving; reload and try again');
            }

            await tx.insert(matchEvents).values(rows);

            if (fixture.mode === 'from-upcoming') {
                await tx
                    .update(matches)
                    .set({
                        homeScore: target.home,
                        awayScore: target.away,
                        status: 'FINISHED',
                        currentPeriod: FULL_TIME_PERIOD,
                        stats: null,
                        updatedAt: new Date(),
                    })
                    .where(and(eq(matches.id, matchId), eq(matches.status, 'UPCOMING')));
            }

            if (effects.length > 0) {
                const key = await resolveStatsKey(match.competitionId, tx);
                for (const effect of effects) {
                    await incrementPlayerStats(match.sport, effect.playerId, key, effect.deltas, tx);
                }
            }

            // Who did this: committed with the events, so it exists exactly when the change does.
            await tx.insert(adminAuditLog).values({
                id: `aud_${nanoid()}`,
                adminUserId: auth.user.id,
                action: 'backfill_events',
                entityType: 'match',
                entityId: matchId,
                details: JSON.stringify({ mode: fixture.mode, eventCount: rows.length, score: target, scoreMismatchAllowed: !!mismatch, statsApplied: statsApply }),
            });
        });

        // After the commit: the match became FINISHED only when it was upcoming. Each step is isolated
        // and reported, never silently dropped.
        const followUps: Record<string, 'ok' | 'skipped' | 'failed'> = {};
        if (fixture.mode === 'from-upcoming') {
            followUps.standings = await runStep('standings-recalc', matchId, () => recalculateStandingsForMatch(matchId));
            followUps.bracket = await runStep('bracket-advance', matchId, () => advanceBracketForMatch(matchId));
            followUps.ratings = (await isRatingsEnabled())
                ? await runStep('ratings-calc', matchId, () => calculateAndSaveRatings(matchId))
                : 'skipped';
        }

        return NextResponse.json({
            success: true,
            mode: fixture.mode,
            score: target,
            eventsInserted: rows.length,
            statsApplied: statsApply,
            followUps,
        });
    } catch (error) {
        return errorResponse(error, 'backfill-events-post');
    }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
    try {
        const auth = await requireAdmin(request);
        if (auth.error) return auth.error;
        const { id: matchId } = await params;

        const match = await db.select().from(matches).where(eq(matches.id, matchId)).get();
        if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

        const statsApply = match.matchType !== 'friendly';
        let removed = 0;

        await db.transaction(async tx => {
            // Delete first and revert stats only for the rows this call actually removed: two simultaneous
            // Reopens can then never both revert the same events. Only unknown-minute events carrying one of
            // the two backfill markers are touched; live-logged events never match.
            const doomed = await tx
                .delete(matchEvents)
                .where(
                    and(
                        eq(matchEvents.matchId, matchId),
                        eq(matchEvents.minute, BACKFILL_MINUTE),
                        inArray(matchEvents.loggerName, [...BACKFILL_MARKERS])
                    )
                )
                .returning({
                    id: matchEvents.id,
                    type: matchEvents.type,
                    playerId: matchEvents.playerId,
                    relatedPlayerId: matchEvents.relatedPlayerId,
                });
            if (doomed.length === 0) throw new RouteError(404, 'No backfilled events to reopen on this match');

            if (statsApply) {
                const effects = backfillStatEffects(match.sport, doomed);
                if (effects.length > 0) {
                    const key = await resolveStatsKey(match.competitionId, tx);
                    for (const effect of effects) {
                        await decrementPlayerStats(match.sport, effect.playerId, key, effect.deltas, tx);
                    }
                }
            }
            removed = doomed.length;

            await tx.insert(adminAuditLog).values({
                id: `aud_${nanoid()}`,
                adminUserId: auth.user.id,
                action: 'backfill_reopen',
                entityType: 'match',
                entityId: matchId,
                details: JSON.stringify({ eventsRemoved: removed, statsReverted: statsApply }),
            });
        });

        // Status and score are left as they are: a finished match with a score and no events is a valid
        // starting point for entering the events again.
        return NextResponse.json({ success: true, eventsRemoved: removed, statsReverted: statsApply });
    } catch (error) {
        return errorResponse(error, 'backfill-events-delete');
    }
}

async function runStep(area: string, matchId: string, step: () => Promise<unknown>): Promise<'ok' | 'skipped' | 'failed'> {
    try {
        await step();
        return 'ok';
    } catch (error) {
        // Same expected outcomes the finish path ignores: no published lineup, or no rating model for the sport.
        const message = error instanceof Error ? error.message : '';
        if (message === 'No lineups found for this match' || message.startsWith('calculateAndSaveRatings: no rating model exists for sport')) {
            return 'skipped';
        }
        console.error(`backfill-events ${area} failed`, error instanceof Error ? error.message : 'unknown error');
        Sentry.captureException(error, { tags: { area }, extra: { matchId } });
        return 'failed';
    }
}

function errorResponse(error: unknown, area: string) {
    if (error instanceof RouteError) {
        return NextResponse.json({ error: error.message, ...(error.extra ?? {}) }, { status: error.status });
    }
    console.error(`${area} failed`, error instanceof Error ? error.message : 'unknown error');
    Sentry.captureException(error, { tags: { area } });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
