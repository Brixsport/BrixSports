/**
 * Pure rules for adding key events to a match that was never logged live (admin backfill).
 * No database access: the route loads the match and runs these checks, so the dry-run
 * preview and the commit go through exactly the same validation and mapping.
 *
 * Every event is stored at the unknown-minute marker (-1), which the public match page
 * already treats as "time not recorded".
 */
import { creditedGoal } from '@/lib/scorer-summary';
import { validateEventInput } from '@/lib/event-input';
import { getEventStatEffects, mergeStatEffects, type StatEffect } from '@/lib/player-stats-key';

export const BACKFILL_MINUTE = -1;
/** logger_name written by this tool. */
export const BACKFILL_LOGGER_NAME = 'admin-backfill';
/** logger_name values Reopen may remove: this tool's, and the earlier script-written GW1 backfill. */
export const BACKFILL_MARKERS = [BACKFILL_LOGGER_NAME, 'match-report-backfill'] as const;
export const MAX_BACKFILL_EVENTS = 60;

export const BACKFILL_EVENT_TYPES = ['Goal', 'Penalty', 'Own Goal', 'Assist', 'Yellow Card', 'Red Card'] as const;
export type BackfillEventType = (typeof BACKFILL_EVENT_TYPES)[number];

export interface BackfillEventInput {
    type: string;
    teamId: string;
    /** Scorer / assister / carded player. A Goal may omit it when the scorer is unknown. */
    playerId?: string | null;
    /** For an Assist: the scorer the pass led to. */
    relatedPlayerId?: string | null;
    detail?: string | null;
}

export interface BackfillMatch {
    homeTeamId: string;
    awayTeamId: string;
    sport: string;
}

export interface BackfillScore {
    home: number;
    away: number;
}

const TYPE_LOOKUP = new Map<string, BackfillEventType>(
    BACKFILL_EVENT_TYPES.map(t => [t.toUpperCase().replace(/\s+/g, '_'), t])
);

/** Canonical title-case type ("goal", "OWN_GOAL" -> "Goal", "Own Goal"), or null when not allowed. */
export function canonicalBackfillType(type: unknown): BackfillEventType | null {
    if (typeof type !== 'string') return null;
    return TYPE_LOOKUP.get(type.trim().toUpperCase().replace(/\s+/g, '_')) ?? null;
}

export interface BackfillValidation {
    errors: string[];
    /** Home/away score the entered events add up to (goals, penalties, own goals). */
    score: BackfillScore;
}

export function validateBackfillEvents(events: unknown, match: BackfillMatch): BackfillValidation {
    const errors: string[] = [];
    const score: BackfillScore = { home: 0, away: 0 };

    if (!Array.isArray(events) || events.length === 0) {
        return { errors: ['At least one event is required'], score };
    }
    if (events.length > MAX_BACKFILL_EVENTS) {
        return { errors: [`At most ${MAX_BACKFILL_EVENTS} events per backfill`], score };
    }
    if (match.sport !== 'Football') {
        return { errors: ['Only football matches can be backfilled'], score };
    }

    events.forEach((raw, index) => {
        const label = `Event ${index + 1}`;
        const e = (raw ?? {}) as BackfillEventInput;
        const type = canonicalBackfillType(e.type);
        if (!type) {
            errors.push(`${label}: type must be one of ${BACKFILL_EVENT_TYPES.join(', ')}`);
            return;
        }
        if (typeof e.teamId !== 'string' || e.teamId === '') {
            errors.push(`${label}: teamId is required`);
            return;
        }
        // Minute is the fixed marker here, so validate the other fields with a placeholder minute.
        const inputError = validateEventInput(
            { type, minute: 0, detail: e.detail, teamId: e.teamId },
            match
        );
        if (inputError) {
            errors.push(`${label}: ${inputError}`);
            return;
        }
        const hasPlayer = typeof e.playerId === 'string' && e.playerId !== '';
        const hasRelated = typeof e.relatedPlayerId === 'string' && e.relatedPlayerId !== '';
        if (type !== 'Goal' && type !== 'Penalty' && !hasPlayer) {
            errors.push(`${label}: a player is required for ${type}`);
            return;
        }
        if (type === 'Assist' && !hasRelated) {
            errors.push(`${label}: an Assist must link to the scorer`);
            return;
        }
        if (type === 'Assist' && e.relatedPlayerId === e.playerId) {
            errors.push(`${label}: a player cannot assist their own goal`);
            return;
        }

        const credit = creditedGoal({ type, detail: e.detail, teamId: e.teamId, minute: BACKFILL_MINUTE }, match.homeTeamId, match.awayTeamId);
        if (credit) {
            if (credit.teamId === match.homeTeamId) score.home += 1;
            else if (credit.teamId === match.awayTeamId) score.away += 1;
        }
    });

    return { errors, score };
}

export type FixtureMode = 'from-upcoming' | 'finished-scored';

export interface FixtureCheck {
    ok: boolean;
    mode?: FixtureMode;
    reason?: string;
}

/**
 * A fixture can take backfilled events only when it has none yet and is either an untouched
 * upcoming 0-0, or already finished with a score (the score is then the reference, never overwritten).
 */
export function checkFixtureState(
    match: { status: string | null; homeScore: number | null; awayScore: number | null; sport: string },
    existingEventCount: number
): FixtureCheck {
    if (match.sport !== 'Football') return { ok: false, reason: 'Only football matches can be backfilled' };
    if (existingEventCount > 0) {
        return { ok: false, reason: 'This match already has events. Reopen the backfill first, or edit them from the logger.' };
    }
    const home = match.homeScore ?? 0;
    const away = match.awayScore ?? 0;
    if (match.status === 'UPCOMING' && home === 0 && away === 0) return { ok: true, mode: 'from-upcoming' };
    if (match.status === 'FINISHED') return { ok: true, mode: 'finished-scored' };
    return { ok: false, reason: `Match is ${match.status ?? 'in an unknown state'}; only an upcoming 0-0 or a finished match can be backfilled` };
}

/** Warning text when the entered events do not add up to the score, or null when they do. */
export function scoreMismatch(computed: BackfillScore, target: BackfillScore): string | null {
    if (computed.home === target.home && computed.away === target.away) return null;
    return `Events add up to ${computed.home}-${computed.away} but the score is ${target.home}-${target.away}`;
}

export interface BackfillEventRow {
    id: string;
    matchId: string;
    type: BackfillEventType;
    minute: number;
    second: null;
    period: null;
    teamId: string;
    playerId: string | null;
    relatedPlayerId: string | null;
    detail: string | null;
    isEyePoint: false;
    value: null;
    loggerId: null;
    loggerName: string;
    createdAt: Date;
}

export function buildBackfillEventRows(
    matchId: string,
    events: BackfillEventInput[],
    makeId: () => string,
    now: Date
): BackfillEventRow[] {
    return events.map(e => ({
        id: makeId(),
        matchId,
        type: canonicalBackfillType(e.type) as BackfillEventType,
        minute: BACKFILL_MINUTE,
        second: null,
        period: null,
        teamId: e.teamId,
        playerId: e.playerId || null,
        relatedPlayerId: e.relatedPlayerId || null,
        detail: e.detail || null,
        isEyePoint: false,
        value: null,
        loggerId: null,
        loggerName: BACKFILL_LOGGER_NAME,
        createdAt: now,
    }));
}

/** Per-player stat effects of a set of events, merged: the same mapping the live logger credits. */
export function backfillStatEffects(
    sport: string,
    events: Array<{ type: string; playerId?: string | null; relatedPlayerId?: string | null }>
): StatEffect[] {
    return mergeStatEffects(
        events.flatMap(e =>
            getEventStatEffects(sport, { type: e.type, playerId: e.playerId ?? null, relatedPlayerId: e.relatedPlayerId ?? null })
        )
    );
}
