import { describe, it, expect } from 'vitest';
import {
    shouldApplyMatchResponse,
    matchPollIntervalMs,
    DISCONNECTED_POLL_MS,
    CONNECTED_RECONCILE_POLL_MS,
    selectUnseenLiveEvents,
    prependNewEvents,
    resolveDisplayPeriod,
    applyTimerToMatch,
} from '@/lib/match-detail-sync';

const base = { requestSeq: 5, lastAppliedSeq: 0, startedAt: 1000, lastWsMutationAt: 0, silent: true, matchChanged: false };

describe('shouldApplyMatchResponse', () => {
    it('applies a normal poll response', () => {
        expect(shouldApplyMatchResponse(base)).toBe(true);
    });

    it('drops a response once the match has changed', () => {
        expect(shouldApplyMatchResponse({ ...base, matchChanged: true })).toBe(false);
        expect(shouldApplyMatchResponse({ ...base, matchChanged: true, silent: false })).toBe(false);
    });

    it('drops a response older than one that was already applied', () => {
        expect(shouldApplyMatchResponse({ ...base, requestSeq: 4, lastAppliedSeq: 5 })).toBe(false);
        expect(shouldApplyMatchResponse({ ...base, requestSeq: 5, lastAppliedSeq: 5 })).toBe(true);
    });

    it('drops a silent poll that started before a WebSocket mutation', () => {
        expect(shouldApplyMatchResponse({ ...base, startedAt: 1000, lastWsMutationAt: 1500 })).toBe(false);
    });

    it('applies a silent poll that started after the WebSocket mutation', () => {
        expect(shouldApplyMatchResponse({ ...base, startedAt: 2000, lastWsMutationAt: 1500 })).toBe(true);
    });

    it('does not apply the WebSocket rule to a first load or retry', () => {
        expect(shouldApplyMatchResponse({ ...base, silent: false, startedAt: 1000, lastWsMutationAt: 1500 })).toBe(true);
    });
});

describe('matchPollIntervalMs', () => {
    it('polls fast when the socket is down and slowly when it is connected', () => {
        expect(matchPollIntervalMs(false)).toBe(DISCONNECTED_POLL_MS);
        expect(matchPollIntervalMs(true)).toBe(CONNECTED_RECONCILE_POLL_MS);
        expect(DISCONNECTED_POLL_MS).toBeLessThan(CONNECTED_RECONCILE_POLL_MS);
    });
});

describe('selectUnseenLiveEvents', () => {
    it('returns every unseen event when two arrive in the same render, oldest first', () => {
        const { fresh, seen } = selectUnseenLiveEvents([{ id: 'a' }, { id: 'b' }], new Set());
        expect(fresh.map((e) => e.id)).toEqual(['a', 'b']);
        expect([...seen]).toEqual(['a', 'b']);
    });

    it('skips events already handled', () => {
        const { fresh } = selectUnseenLiveEvents([{ id: 'a' }, { id: 'b' }], new Set(['a']));
        expect(fresh.map((e) => e.id)).toEqual(['b']);
    });

    it('skips events without an id and does not mutate the input set', () => {
        const input = new Set<string>();
        const { fresh } = selectUnseenLiveEvents([{ id: undefined }, { id: null }, { id: 'x' }], input);
        expect(fresh.map((e) => e.id)).toEqual(['x']);
        expect(input.size).toBe(0);
    });
});

describe('prependNewEvents', () => {
    it('puts new events first, newest at the very top', () => {
        const out = prependNewEvents([{ id: 'old' }], [{ id: 'a' }, { id: 'b' }]);
        expect(out.map((e) => e.id)).toEqual(['b', 'a', 'old']);
    });

    it('keeps a legitimate repeat (same type, minute, player, team) because ids differ', () => {
        const goal = { type: 'Goal', minute: 10, playerId: 'p', teamId: 't' };
        const out = prependNewEvents([{ id: 'e1', ...goal }], [{ id: 'e2', ...goal }]);
        expect(out.map((e) => e.id)).toEqual(['e2', 'e1']);
    });

    it('drops an event whose id is already present and returns the same array when nothing is new', () => {
        const existing = [{ id: 'a' }];
        expect(prependNewEvents(existing, [{ id: 'a' }])).toBe(existing);
        expect(prependNewEvents(existing, [])).toBe(existing);
    });
});

describe('resolveDisplayPeriod', () => {
    const live = { status: 'LIVE', currentPeriod: 'FIRST_HALF', timerPeriod: 'SECOND_HALF', timerIsStale: false };

    it('prefers a fresh timer period on a live match', () => {
        expect(resolveDisplayPeriod(live)).toBe('SECOND_HALF');
    });

    it('a finished match is FINISHED even when the timer still reports a live period', () => {
        expect(resolveDisplayPeriod({ ...live, status: 'FINISHED' })).toBe('FINISHED');
    });

    it('falls back to the stored period, then the status, when the timer is stale or absent', () => {
        expect(resolveDisplayPeriod({ ...live, timerIsStale: true })).toBe('FIRST_HALF');
        expect(resolveDisplayPeriod({ ...live, timerPeriod: undefined, currentPeriod: null })).toBe('LIVE');
    });
});

describe('applyTimerToMatch', () => {
    it('writes the tick into a live match', () => {
        const out = applyTimerToMatch({ status: 'LIVE', homeScore: 1 }, { minute: 30, extraTime: 0, period: 'FIRST_HALF' });
        expect(out).toMatchObject({ status: 'FIRST_HALF', minute: 30, extraTime: 0, homeScore: 1 });
    });

    it('keeps the status when the tick carries no period', () => {
        expect(applyTimerToMatch({ status: 'LIVE' }, { minute: 5, extraTime: 0 }).status).toBe('LIVE');
    });

    it('leaves a finished match untouched', () => {
        const finished = { status: 'FINISHED', minute: 90 };
        expect(applyTimerToMatch(finished, { minute: 91, extraTime: 1, period: 'SECOND_HALF' })).toBe(finished);
    });
});
