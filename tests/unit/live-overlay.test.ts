import { describe, it, expect } from 'vitest';
import { mergeLiveScores } from '@/lib/live-overlay';

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
