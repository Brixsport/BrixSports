import { describe, it, expect } from 'vitest';
import {
    mergeLiveScores,
    shouldRunFullRefresh,
    applyLiveSnapshot,
    FULL_REFRESH_COOLDOWN_MS,
    LIVE_SNAPSHOT_MAX_AGE_MS,
} from '@/lib/live-overlay';

const m = (over: Record<string, any> = {}) => ({
    id: 'm1', status: 'LIVE', homeScore: 0, awayScore: 0, currentPeriod: 'FIRST_HALF',
    shootoutHomeScore: undefined as number | undefined, shootoutAwayScore: undefined as number | undefined,
    venue: 'Main Bowl', homeTeam: { name: 'A' }, ...over,
});

describe('mergeLiveScores', () => {
    it('patches a changed score and leaves every other field alone', () => {
        const current = [m(), m({ id: 'm2', status: 'FINISHED', homeScore: 2, awayScore: 1 })];
        const res = mergeLiveScores(current, [{ id: 'm1', status: 'LIVE', homeScore: 1, awayScore: 0, currentPeriod: 'FIRST_HALF' }]);
        expect(res.changed).toBe(true);
        expect(res.needsFullRefresh).toBe(false);
        expect(res.next[0]).toMatchObject({ id: 'm1', homeScore: 1, awayScore: 0, venue: 'Main Bowl', homeTeam: { name: 'A' } });
        expect(res.next[1]).toBe(current[1]);
    });

    it('returns the same array and changed=false when nothing differs', () => {
        const current = [m({ homeScore: 1, awayScore: 1 })];
        const res = mergeLiveScores(current, [{ id: 'm1', status: 'LIVE', homeScore: 1, awayScore: 1, currentPeriod: 'FIRST_HALF' }]);
        expect(res.changed).toBe(false);
        expect(res.next).toBe(current);
        expect(res.needsFullRefresh).toBe(false);
    });

    it('applies the same defaults as the page transform (null score is 0, shootout undefined, period null)', () => {
        const current = [m({ homeScore: 3, currentPeriod: 'SECOND_HALF' })];
        const res = mergeLiveScores(current, [{ id: 'm1', status: 'LIVE', homeScore: null, awayScore: null, currentPeriod: null }]);
        expect(res.next[0]).toMatchObject({ homeScore: 0, awayScore: 0, currentPeriod: null, shootoutHomeScore: undefined });
    });

    it('patches penalty shootout scores and period', () => {
        const current = [m()];
        const res = mergeLiveScores(current, [{ id: 'm1', status: 'LIVE', homeScore: 1, awayScore: 1, currentPeriod: 'PENALTY_SHOOTOUT', shootoutHomeScore: 3, shootoutAwayScore: 2 }]);
        expect(res.next[0]).toMatchObject({ currentPeriod: 'PENALTY_SHOOTOUT', shootoutHomeScore: 3, shootoutAwayScore: 2 });
    });

    it('asks for a full refresh when a match shown as LIVE is no longer live (it finished)', () => {
        const res = mergeLiveScores([m()], []);
        expect(res.needsFullRefresh).toBe(true);
        expect(res.changed).toBe(false);
    });

    it('asks for a full refresh when a live match appears that is not shown as LIVE', () => {
        const res = mergeLiveScores([m({ id: 'other', status: 'UPCOMING' })], [{ id: 'other', status: 'LIVE', homeScore: 0, awayScore: 0 }]);
        expect(res.needsFullRefresh).toBe(true);
        const res2 = mergeLiveScores([], [{ id: 'new', status: 'LIVE', homeScore: 0, awayScore: 0 }]);
        expect(res2.needsFullRefresh).toBe(true);
    });

    it('does not touch matches that are not live', () => {
        const finished = m({ id: 'f', status: 'FINISHED', homeScore: 4, awayScore: 4 });
        const res = mergeLiveScores([finished], []);
        expect(res.next[0]).toBe(finished);
        expect(res.needsFullRefresh).toBe(false);
    });
});

describe('shouldRunFullRefresh', () => {
    const base = { needsFullRefresh: true, inFlight: false, lastRunAt: null as number | null, now: 100000 };

    it('runs when needed, idle and never run before', () => {
        expect(shouldRunFullRefresh(base)).toBe(true);
    });

    it('does not run when no refresh is needed', () => {
        expect(shouldRunFullRefresh({ ...base, needsFullRefresh: false })).toBe(false);
    });

    it('does not run while a load is already in flight', () => {
        expect(shouldRunFullRefresh({ ...base, inFlight: true })).toBe(false);
    });

    it('holds off during the cooldown and runs once it has elapsed', () => {
        expect(shouldRunFullRefresh({ ...base, lastRunAt: 100000 - (FULL_REFRESH_COOLDOWN_MS - 1) })).toBe(false);
        expect(shouldRunFullRefresh({ ...base, lastRunAt: 100000 - FULL_REFRESH_COOLDOWN_MS })).toBe(true);
    });

    it('honours a custom cooldown', () => {
        expect(shouldRunFullRefresh({ ...base, lastRunAt: 99000, cooldownMs: 500 })).toBe(true);
    });

    it('a finished match that stays LIVE in the cached list triggers at most one reload per cooldown window', () => {
        let lastRunAt: number | null = null;
        let runs = 0;
        for (let t = 0; t < 30000; t += 3000) {
            const { needsFullRefresh } = mergeLiveScores([m()], []);
            if (shouldRunFullRefresh({ needsFullRefresh, inFlight: false, lastRunAt, now: t })) {
                runs++;
                lastRunAt = t;
            }
        }
        expect(runs).toBe(3);
    });
});

describe('applyLiveSnapshot', () => {
    const snap = (at: number) => ({ live: [{ id: 'm1', status: 'LIVE', homeScore: 2, awayScore: 0, currentPeriod: 'FIRST_HALF' }], at });

    it('re-applies a fresh snapshot so a lagging list cannot flip the score back', () => {
        const stale = [m({ homeScore: 1 })];
        const out = applyLiveSnapshot(stale, snap(1000), 3000);
        expect(out[0]).toMatchObject({ homeScore: 2, awayScore: 0 });
    });

    it('returns the list untouched when there is no snapshot', () => {
        const list = [m()];
        expect(applyLiveSnapshot(list, null, 3000)).toBe(list);
    });

    it('ignores a snapshot older than the max age', () => {
        const list = [m({ homeScore: 1 })];
        expect(applyLiveSnapshot(list, snap(0), LIVE_SNAPSHOT_MAX_AGE_MS + 1)).toBe(list);
    });

    it('leaves matches missing from the snapshot alone', () => {
        const list = [m({ id: 'other', homeScore: 5 })];
        expect(applyLiveSnapshot(list, snap(1000), 2000)[0]).toMatchObject({ id: 'other', homeScore: 5 });
    });
});
