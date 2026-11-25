import { describe, it, expect } from 'vitest';
import {
    BACKFILL_LOGGER_NAME,
    BACKFILL_MARKERS,
    BACKFILL_MINUTE,
    backfillStatEffects,
    buildBackfillEventRows,
    canonicalBackfillType,
    checkFixtureState,
    scoreMismatch,
    validateBackfillEvents,
} from '@/lib/event-backfill';

const H = 'home';
const A = 'away';
const match = { homeTeamId: H, awayTeamId: A, sport: 'Football' };

describe('canonicalBackfillType', () => {
    it('accepts the allowed types in any case and rejects others', () => {
        expect(canonicalBackfillType('goal')).toBe('Goal');
        expect(canonicalBackfillType('OWN_GOAL')).toBe('Own Goal');
        expect(canonicalBackfillType('Red Card')).toBe('Red Card');
        expect(canonicalBackfillType('Substitution')).toBeNull();
        expect(canonicalBackfillType(5)).toBeNull();
    });
});

describe('validateBackfillEvents', () => {
    it('adds goals, penalties and own goals up to a score per side', () => {
        const { errors, score } = validateBackfillEvents(
            [
                { type: 'Goal', teamId: H, playerId: 'a' },
                { type: 'Assist', teamId: H, playerId: 'b', relatedPlayerId: 'a' },
                { type: 'Penalty', teamId: H, playerId: 'c' },
                { type: 'Own Goal', teamId: A, playerId: 'd' },
                { type: 'Goal', teamId: A, playerId: 'e' },
            ],
            match
        );
        expect(errors).toEqual([]);
        expect(score).toEqual({ home: 3, away: 1 });
    });

    it('allows a Goal with an unknown scorer', () => {
        const { errors, score } = validateBackfillEvents([{ type: 'Goal', teamId: A }], match);
        expect(errors).toEqual([]);
        expect(score).toEqual({ home: 0, away: 1 });
    });

    it('rejects bad input without crashing', () => {
        const { errors } = validateBackfillEvents(
            [
                { type: 'Substitution', teamId: H, playerId: 'a' },
                { type: 'Goal', teamId: 'other', playerId: 'a' },
                { type: 'Assist', teamId: H, playerId: 'a' },
                { type: 'Assist', teamId: H, playerId: 'a', relatedPlayerId: 'a' },
                { type: 'Yellow Card', teamId: H },
                null,
            ],
            match
        );
        expect(errors).toHaveLength(6);
    });

    it('rejects non-text player ids, over-long ids, and a scorer link on anything but an Assist', () => {
        const { errors } = validateBackfillEvents(
            [
                { type: 'Goal', teamId: H, playerId: { x: 1 } as never },
                { type: 'Goal', teamId: H, playerId: 'a'.repeat(65) },
                { type: 'Goal', teamId: H, playerId: 'a', relatedPlayerId: 'b' },
                { type: 'Assist', teamId: H, playerId: 'b', relatedPlayerId: ['a'] as never },
            ],
            match
        );
        expect(errors).toHaveLength(4);
    });

    it('refuses an empty list, too many events and a non-football match', () => {
        expect(validateBackfillEvents([], match).errors).toHaveLength(1);
        expect(validateBackfillEvents(Array(61).fill({ type: 'Goal', teamId: H }), match).errors).toHaveLength(1);
        expect(validateBackfillEvents([{ type: 'Goal', teamId: H }], { ...match, sport: 'Basketball' }).errors).toHaveLength(1);
    });
});

describe('checkFixtureState', () => {
    const base = { sport: 'Football', homeScore: 0, awayScore: 0 };
    it('accepts an untouched upcoming 0-0 and a finished match, with no events', () => {
        expect(checkFixtureState({ ...base, status: 'UPCOMING' }, 0)).toEqual({ ok: true, mode: 'from-upcoming' });
        expect(checkFixtureState({ ...base, status: 'FINISHED', homeScore: 7, awayScore: 1 }, 0)).toEqual({ ok: true, mode: 'finished-scored' });
    });
    it('refuses a match that has events, is live, or is an upcoming match with a score', () => {
        expect(checkFixtureState({ ...base, status: 'UPCOMING' }, 3).ok).toBe(false);
        expect(checkFixtureState({ ...base, status: 'LIVE' }, 0).ok).toBe(false);
        expect(checkFixtureState({ ...base, status: 'UPCOMING', homeScore: 1 }, 0).ok).toBe(false);
        expect(checkFixtureState({ ...base, sport: 'Basketball', status: 'UPCOMING' }, 0).ok).toBe(false);
    });
});

describe('scoreMismatch', () => {
    it('is null when equal and describes the gap otherwise', () => {
        expect(scoreMismatch({ home: 7, away: 1 }, { home: 7, away: 1 })).toBeNull();
        expect(scoreMismatch({ home: 6, away: 1 }, { home: 7, away: 1 })).toContain('6-1');
    });
});

describe('buildBackfillEventRows', () => {
    it('stamps every row at the unknown minute with the tool marker', () => {
        let n = 0;
        const rows = buildBackfillEventRows(
            'm1',
            [
                { type: 'goal', teamId: H, playerId: 'a' },
                { type: 'Assist', teamId: H, playerId: 'b', relatedPlayerId: 'a' },
            ],
            () => `id${++n}`,
            new Date(0)
        );
        expect(rows.map(r => r.type)).toEqual(['Goal', 'Assist']);
        expect(rows.every(r => r.minute === BACKFILL_MINUTE && r.loggerName === BACKFILL_LOGGER_NAME)).toBe(true);
        expect(rows[1].relatedPlayerId).toBe('a');
        expect(BACKFILL_MARKERS).toContain('match-report-backfill');
    });
});

describe('backfillStatEffects', () => {
    it('credits the same stats as the live logger and merges per player', () => {
        const effects = backfillStatEffects('Football', [
            { type: 'Goal', playerId: 'a' },
            { type: 'Goal', playerId: 'a' },
            { type: 'Assist', playerId: 'b', relatedPlayerId: 'a' },
            { type: 'Penalty', playerId: 'c' },
            { type: 'Red Card', playerId: 'd' },
            { type: 'Goal', playerId: null },
        ]);
        const byPlayer = Object.fromEntries(effects.map(e => [e.playerId, e.deltas]));
        expect(byPlayer.a).toEqual({ goals: 2, shotsOnTarget: 2 });
        expect(byPlayer.b).toEqual({ assists: 1 });
        expect(byPlayer.c).toEqual({ penaltiesScored: 1, shotsOnTarget: 1 });
        expect(byPlayer.d).toEqual({ redCards: 1 });
        expect(effects).toHaveLength(4);
    });
});
