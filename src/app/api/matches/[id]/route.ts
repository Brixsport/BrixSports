/**
 * Match Details API Route
 * Fetch detailed match information with events, lineups, stats, and more
 */

import { NextRequest, NextResponse, after } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/db';
import { matches, teams, bracketNodes, teamForm, headToHead } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { loadMatchDetail } from '@/lib/match-detail';
import { isLoggerAssigned } from '@/lib/match-logger-helpers';
import { broadcastToMatch, broadcastGlobalNotification } from '@/lib/socket';
import { toPublicMatchUpdate } from '@/lib/ws-public-payload';
import { sendMatchEventNotification } from '@/lib/notifications/match-notification-service';
import { getNotifiablePeriodType } from '@/lib/notifications/notification-rules';
import { shouldSendPeriodNotification } from '@/lib/notifications/send-gate';
import { recalculateStandingsForMatch } from '@/lib/standingsService';
import { advanceBracketForMatch } from '@/lib/bracketService';
import { calculateAndSaveRatings } from '@/lib/ratingsService';
import { requiresDecisiveResult } from '@/lib/matchRules';
import { checkRateLimit } from '@/lib/rate-limit';
import { isFinishedLockViolation } from '@/lib/match-finished-lock';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Raised well above the default 120/min (see rate-limit.ts) -- this route backs
        // the live match page's WS-fallback poll (every 10s while the socket is down,
        // src/app/matches/[id]/page.tsx). Per-IP bucketing means every viewer on a shared
        // NAT (campus WiFi -- this is a college sports app) counts against the same
        // bucket: at the default ceiling, ~20 concurrent same-IP viewers polling during a
        // real WS outage would already be at the limit. 600/min covers roughly 100
        // concurrent same-IP fallback-polling viewers while still catching anything
        // polling faster than the fallback's own 10s interval, which no real viewer does.
        const rl = await checkRateLimit(request, { max: 600 });
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

        const { id: matchId } = await params;

        // Logger identity (loggerName on events) and draft lineups are visible to admin/logger
        // sessions only. Resolved alongside the database reads rather than before them; with no
        // token getAuthUser returns null without a lookup, so anonymous polling stays cheap.
        const isStaff = getAuthUser(request)
            .then((viewer) => viewer?.role === 'admin' || viewer?.role === 'logger')
            .catch(() => false);

        const detail = await loadMatchDetail(matchId, isStaff);
        if (!detail) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(detail);
    } catch (error) {
        console.error('Error fetching match details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch match details' },
            { status: 500 }
        );
    }
}

/**
 * UPDATE match (Logger/Admin only)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: matchId } = await params;

        if (authUser.role === 'logger') {
            const assigned = await isLoggerAssigned(matchId, authUser.id);
            if (!assigned) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        } else if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();

        // BUG-051: validate status against allowed enum; restrict loggers to safe transitions only
        const VALID_STATUSES = ['PENDING', 'UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED'] as const;
        const LOGGER_ALLOWED_STATUSES: string[] = ['LIVE', 'FINISHED'];
        if (body.status !== undefined) {
            if (!VALID_STATUSES.includes(body.status)) {
                return NextResponse.json({ error: 'Invalid status value' }, { status: 422 });
            }
            if (authUser.role === 'logger' && !LOGGER_ALLOWED_STATUSES.includes(body.status)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // A logger cannot re-open a finished match (write-lock): only an admin can move a
        // FINISHED match back to LIVE or change its period/clock. Re-sending FINISHED (a
        // retried finish) stays allowed. See isFinishedLockViolation for the exact rules.
        if (
            authUser.role === 'logger' &&
            (body.status !== undefined || body.currentPeriod !== undefined ||
                body.minute !== undefined || body.extraTime !== undefined)
        ) {
            const [current] = await db.select({ status: matches.status }).from(matches).where(eq(matches.id, matchId)).limit(1);
            if (isFinishedLockViolation({ role: authUser.role, currentStatus: current?.status, body })) {
                return NextResponse.json(
                    { error: 'Match is finished and locked; only an admin can re-open it', code: 'MATCH_FINISHED_LOCKED' },
                    { status: 409 }
                );
            }
        }

        // If assigning a logger, validate that the match isn't already assigned to another logger
        if (body.loggerId !== undefined && body.loggerId !== null) {
            const [existingMatch] = await db
                .select()
                .from(matches)
                .where(eq(matches.id, matchId));

            if (!existingMatch) {
                return NextResponse.json(
                    { error: 'Match not found' },
                    { status: 404 }
                );
            }

            // Check if match is already assigned to a different logger
            if (existingMatch.loggerId && existingMatch.loggerId !== body.loggerId) {
                return NextResponse.json(
                    {
                        error: 'Match is already assigned to another logger',
                        code: 'MATCH_ALREADY_ASSIGNED',
                    },
                    { status: 409 }
                );
            }
        }

        const updateData: any = {
            updatedAt: new Date(),
        };

        // Update allowed fields
        // BUG-052: score writes restricted to admin only; integer guard prevents corruption
        if (authUser.role === 'admin') {
            if (body.homeScore !== undefined) {
                const s = Number(body.homeScore);
                if (!Number.isInteger(s) || s < 0) {
                    return NextResponse.json({ error: 'Invalid homeScore' }, { status: 422 });
                }
                updateData.homeScore = s;
            }
            if (body.awayScore !== undefined) {
                const s = Number(body.awayScore);
                if (!Number.isInteger(s) || s < 0) {
                    return NextResponse.json({ error: 'Invalid awayScore' }, { status: 422 });
                }
                updateData.awayScore = s;
            }
        }
        if (body.status !== undefined) updateData.status = body.status;
        // currentPeriod had no enum validation at all, unlike status just above --
        // reachable only by an authenticated, assigned logger/admin so low exploitability,
        // but cheap to close. No DB-level constraint either (schema.ts:340, plain text
        // column), so this is the only gate.
        // BUG-191: the flat 'OT' entry was stale the moment this list was written --
        // BUG-135 (session 47E) already changed basketball's OT label to numbered
        // OT1/OT2/etc, but this allowlist was added later without picking that up.
        // Confirmed live, session 47F: every real OT transition since BUG-135 shipped
        // has 422'd here, visibly failing to persist (BasketballLogger.tsx only ever
        // sends `OT${n}`, never the flat string). Matched via regex instead of a fixed
        // list since the OT number is unbounded (a match can theoretically reach OT3+).
        const VALID_PERIODS = [
            'NOT_STARTED', 'FIRST_HALF', 'HALF_TIME', 'SECOND_HALF',
            'EXTRA_TIME_1', 'EXTRA_TIME_BREAK', 'EXTRA_TIME_2', 'PENALTY_SHOOTOUT',
            'FINISHED', 'SUSPENDED',
            'Q1', 'Q2', 'Q3', 'Q4',
        ] as const;
        if (body.currentPeriod !== undefined) {
            const isNumberedOT = /^OT\d+$/.test(body.currentPeriod);
            if (!VALID_PERIODS.includes(body.currentPeriod) && !isNumberedOT) {
                return NextResponse.json({ error: 'Invalid currentPeriod value' }, { status: 422 });
            }
            updateData.currentPeriod = body.currentPeriod;
        }
        // BUG-109: periodic DB checkpoint of the live clock — assigned logger or admin only
        // (already gated above), same integer-guard pattern as score. null clears the value
        // (e.g. on FINISHED) without requiring a separate code path.
        if (body.minute !== undefined) {
            if (body.minute !== null) {
                const m = Number(body.minute);
                if (!Number.isInteger(m) || m < 0 || m > 200) {
                    return NextResponse.json({ error: 'Invalid minute' }, { status: 422 });
                }
                updateData.minute = m;
            } else {
                updateData.minute = null;
            }
        }
        if (body.extraTime !== undefined) {
            if (body.extraTime !== null) {
                const e = Number(body.extraTime);
                if (!Number.isInteger(e) || e < 0 || e > 60) {
                    return NextResponse.json({ error: 'Invalid extraTime' }, { status: 422 });
                }
                updateData.extraTime = e;
            } else {
                updateData.extraTime = null;
            }
        }
        // BACKLOG-398 medium: was writable by any assigned logger, unlike the
        // neighboring homeScore/awayScore/approvalStatus fields on this same
        // route which are correctly admin-gated -- not a privilege-escalation
        // path (real logging authorization runs through matchLoggerAssignments,
        // untouched by this field) but a silent data-integrity gap on an
        // admin-attribution field.
        if (body.loggerId !== undefined && authUser.role === 'admin') updateData.loggerId = body.loggerId;
        if (body.stats) updateData.stats = JSON.stringify(body.stats);

        // Structural match fields (teams, sport, competition, match type, lineups, start time,
        // venue) are admin-only. An assigned logger's PATCH is limited to live state
        // (status, currentPeriod, minute, extraTime) and `stats` (sent with the FINISH action);
        // the loggers never send the fields below.
        if (authUser.role === 'admin') {
            if (body.lineups) updateData.lineups = JSON.stringify(body.lineups);
            if (body.sport) updateData.sport = body.sport;
            if (body.homeTeamId) updateData.homeTeamId = body.homeTeamId;
            if (body.awayTeamId) updateData.awayTeamId = body.awayTeamId;
            if (body.startTime) updateData.startTime = new Date(body.startTime);
            if (body.venue) updateData.venue = body.venue;
            if (body.competition) updateData.competition = body.competition;
            if (body.competitionId) updateData.competitionId = body.competitionId;
            if (body.competitionLevel) updateData.competitionLevel = body.competitionLevel;
            if (body.matchType) updateData.matchType = body.matchType;
            if (body.friendlyType) updateData.friendlyType = body.friendlyType;
            if (body.friendlyDescription !== undefined) updateData.friendlyDescription = body.friendlyDescription;
        }
        // Approval fields are admin-only — loggers must not write these
        if (authUser.role === 'admin') {
            if (body.approvalStatus) {
                updateData.approvalStatus = body.approvalStatus;
                // BACKLOG-397: audit field must always come from the verified session, never the client.
                updateData.approvedBy = authUser.id;
            }
            if (body.managerNotes !== undefined) updateData.managerNotes = body.managerNotes;
            if (body.approvedAt) updateData.approvedAt = new Date(body.approvedAt);
        }

        // BACKLOG-281: knockout-round matches must produce a decisive result,
        // regardless of the competition's stored allowDraws setting -- checked
        // here, after status-enum validation, before the write. Reads the
        // CURRENT DB row for round/scores rather than trusting the body: a
        // logger's FINISH action only ever sends { status: 'FINISHED' } (scores
        // arrive earlier via the event-driven path, BUG-052), and shootout
        // scores are written exclusively by events/route.ts's PEN_SCORED
        // handler, never this route -- so by the time this PATCH runs, the DB
        // row already holds the authoritative values. An admin-supplied
        // homeScore/awayScore in THIS same request (already validated above)
        // takes precedence as the effective final score if present.
        if (body.status === 'FINISHED') {
            const [current] = await db
                .select({
                    round: matches.round,
                    homeScore: matches.homeScore,
                    awayScore: matches.awayScore,
                    shootoutHomeScore: matches.shootoutHomeScore,
                    shootoutAwayScore: matches.shootoutAwayScore,
                })
                .from(matches)
                .where(eq(matches.id, matchId));

            if (current && requiresDecisiveResult(current.round)) {
                const effectiveHome = updateData.homeScore ?? current.homeScore ?? 0;
                const effectiveAway = updateData.awayScore ?? current.awayScore ?? 0;
                if (effectiveHome === effectiveAway) {
                    const shootoutHome = current.shootoutHomeScore ?? 0;
                    const shootoutAway = current.shootoutAwayScore ?? 0;
                    if (shootoutHome === shootoutAway) {
                        return NextResponse.json({
                            error: 'This is a knockout-round match and cannot finish level -- use Extra Time or Penalties to reach a decisive result.',
                            code: 'KNOCKOUT_DRAW_NOT_ALLOWED',
                        }, { status: 422 });
                    }
                }
            }
        }

        // Stored period before this write: the period push below fires only on a real change.
        const previousRow = body.currentPeriod !== undefined
            ? await db.select({ currentPeriod: matches.currentPeriod, matchType: matches.matchType })
                .from(matches).where(eq(matches.id, matchId)).get()
            : undefined;

        await db
            .update(matches)
            .set(updateData)
            .where(eq(matches.id, matchId));

        // Broadcast update via Socket.IO — was a raw `global.io` check, only ever true
        // when running the local custom server.js; dead code on Vercel's serverless
        // deployment, same class of gap as BUG-108. broadcastToMatch (src/lib/socket.ts)
        // handles both cases correctly (local global.io, or HTTP /broadcast on Railway).
        // after() rather than a bare fire-and-forget call — see events/route.ts's POST
        // handler for why (traced root cause of BUG-108/116's multi-second broadcast delay).
        // Allow-list, not a spread: updateData can carry admin-only fields (approvedBy, managerNotes, loggerId, ...).
        after(() => broadcastToMatch(matchId, 'match:updated', toPublicMatchUpdate(matchId, updateData)));

        // BACKLOG-097: standings/team-record recalculation, wired into the FINISHED
        // transition — see standingsService.ts for why this is safe to call more than
        // once (fully recomputed from FINISHED matches each time, not incremental).
        if (body.status === 'FINISHED') {
            after(async () => {
                try {
                    await recalculateStandingsForMatch(matchId);
                } catch (error) {
                    console.error('Error recalculating standings:', error);
                    Sentry.captureException(error, { tags: { area: 'standings-recalc' }, extra: { matchId } });
                }
            });

            // BACKLOG-280: knockout bracket advancement -- own try/catch, own
            // after() call, deliberately isolated from the standings recalc
            // above so a bracket failure can never block or break it. No-ops
            // silently for the overwhelming majority of matches (not part of
            // any bracket).
            after(async () => {
                try {
                    await advanceBracketForMatch(matchId);
                } catch (error) {
                    console.error('Error advancing bracket:', error);
                    Sentry.captureException(error, { tags: { area: 'bracket-advance' }, extra: { matchId } });
                }
            });

            // BACKLOG-255: ratings now recalculate once, here, on the FINISHED
            // transition -- own try/catch, own after() call, same isolation
            // pattern as standings/bracket above so a ratings failure can never
            // block or break either of those. Replaces the old per-live-event
            // trigger (events/route.ts), which ran calculateAndSaveRatings on
            // every single event and was a real, unmeasured contributor to Flow
            // B's ~9.9s latency. No-ops (throws, caught here) for a match with
            // no published lineups or an unsupported sport (still just
            // football/basketball -- see ratingsService.ts) -- both pre-existing,
            // expected conditions, not new failure modes introduced here.
            after(async () => {
                try {
                    await calculateAndSaveRatings(matchId);
                } catch (error) {
                    console.error('Error calculating ratings on FINISHED transition:', error);
                    // BACKLOG-321: "No lineups found"/"no rating model exists for
                    // sport" are deliberate, developer-authored, EXPECTED outcomes
                    // for a real fraction of matches (no published lineup, or a
                    // sport with no rating model yet) -- not exceptional failures.
                    // Reporting those to Sentry on every occurrence would just be
                    // alert noise; only genuinely unexpected errors (DB failures,
                    // etc.) are captured.
                    const message = error instanceof Error ? error.message : '';
                    const isExpected = message === 'No lineups found for this match'
                        || message.startsWith('calculateAndSaveRatings: no rating model exists for sport');
                    if (!isExpected) {
                        Sentry.captureException(error, { tags: { area: 'ratings-calc' }, extra: { matchId } });
                    }
                }
            });
        }

        // Notification-reliability fix (same as events/route.ts's POST handler,
        // see that file's comment for the full BUG-108/116-class rationale): period
        // transitions used to notify only via MatchStateManager.triggerPeriodNotification()
        // dispatching a window CustomEvent from the logger's own tab. Moved server-side.
        //
        // Which currentPeriod values are notifiable, per sport, now lives in
        // notification-rules.ts's NOTIFICATION_RULES table (roadmap thread 5/7) --
        // basketball's 'FINISHED' -> MATCH_END entry there is now an explicit,
        // consciously-kept table row rather than an accidental match on a
        // football-shaped if-chain (it was firing unintentionally before Phase 2
        // formalized it — NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md thread 3).
        if (previousRow && shouldSendPeriodNotification({
            previousPeriod: previousRow.currentPeriod,
            newPeriod: body.currentPeriod,
            matchType: previousRow.matchType,
        })) {
            after(async () => {
                try {
                    const [current] = await db
                        .select({
                            sport: matches.sport,
                            homeTeamId: matches.homeTeamId,
                            awayTeamId: matches.awayTeamId,
                            homeScore: matches.homeScore,
                            awayScore: matches.awayScore,
                            competitionId: matches.competitionId,
                        })
                        .from(matches)
                        .where(eq(matches.id, matchId));
                    if (!current) return;

                    // Sport-keyed lookup (notification-rules.ts) -- resolved here, not
                    // synchronously before scheduling after(), since it needs the match's
                    // sport and this avoids an extra query on the hot PATCH request path.
                    const periodEventType = getNotifiablePeriodType(current.sport, body.currentPeriod);
                    if (!periodEventType) return;

                    const [homeTeam, awayTeam] = await Promise.all([
                        db.select({ name: teams.name }).from(teams).where(eq(teams.id, current.homeTeamId)).get(),
                        db.select({ name: teams.name }).from(teams).where(eq(teams.id, current.awayTeamId)).get(),
                    ]);
                    await sendMatchEventNotification({
                        matchId,
                        homeTeamId: current.homeTeamId,
                        awayTeamId: current.awayTeamId,
                        eventType: periodEventType,
                        teamName: homeTeam && awayTeam ? `${homeTeam.name} vs ${awayTeam.name}` : undefined,
                        homeScore: current.homeScore ?? undefined,
                        awayScore: current.awayScore ?? undefined,
                        competitionId: current.competitionId,
                    });

                    // BUG-210: same in-app toast fix as events/route.ts's POST handler --
                    // server-side, no logger-tab dependency, works for basketball too.
                    // HALF_TIME maps to GlobalNotificationListener.tsx's 'PERIOD_CHANGE'
                    // type (its accepted-type list predates this sport-keyed HALF_TIME
                    // notion and was never updated -- mapped here rather than touching
                    // the listener's own vocabulary).
                    // periodEventType is narrowed to MATCH_START/HALF_TIME/MATCH_END at
                    // runtime (the only three values NOTIFICATION_RULES' periods maps
                    // produce for either sport) but typed as the full NotificationKey
                    // union, so TS can't see that -- explicit cast, not a real widening risk.
                    const toastType: 'MATCH_START' | 'MATCH_END' | 'PERIOD_CHANGE' =
                        periodEventType === 'HALF_TIME' ? 'PERIOD_CHANGE' : periodEventType as 'MATCH_START' | 'MATCH_END';
                    const toastMessage = periodEventType === 'MATCH_START'
                        ? `Match started: ${homeTeam?.name || 'Home'} vs ${awayTeam?.name || 'Away'}`
                        : periodEventType === 'HALF_TIME'
                            ? `Half time: ${current.homeScore ?? 0}-${current.awayScore ?? 0}`
                            : `Full time: ${current.homeScore ?? 0}-${current.awayScore ?? 0}`;
                    await broadcastGlobalNotification({
                        type: toastType,
                        message: toastMessage,
                        matchId,
                        homeTeamId: current.homeTeamId,
                        awayTeamId: current.awayTeamId,
                    });
                } catch (error) {
                    console.error('Error sending period notification:', error);
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Match updated successfully',
        });
    } catch (error) {
        console.error('Error updating match:', error);
        return NextResponse.json(
            { error: 'Failed to update match' },
            { status: 500 }
        );
    }
}

/**
 * DELETE match (Admin only)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: matchId } = await params;

        // Check if match exists
        const [existing] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId));

        if (!existing) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Handle constraint: bracketNodes - clear foreign key
        await db
            .update(bracketNodes)
            .set({ matchId: null })
            .where(eq(bracketNodes.matchId, matchId));

        // Handle constraint: headToHead - clear foreign key
        await db
            .update(headToHead)
            .set({ lastMatchId: null })
            .where(eq(headToHead.lastMatchId, matchId));

        // Handle constraint: teamForm - delete related records
        await db
            .delete(teamForm)
            .where(eq(teamForm.matchId, matchId));

        // Delete match (events, reminders, ratings, poll_votes, etc. will be cascade deleted)
        await db
            .delete(matches)
            .where(eq(matches.id, matchId));

        return NextResponse.json({
            success: true,
            message: 'Match deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting match:', error);
        return NextResponse.json(
            { error: 'Failed to delete match' },
            { status: 500 }
        );
    }
}
