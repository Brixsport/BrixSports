import { describe, it, expect } from 'vitest';
import { pickAdvancedClock } from '@/lib/match-state-manager';

describe('pickAdvancedClock', () => {
    it('keeps the saved clock when the server seed is behind it (re-entering a live match)', () => {
        const saved = { period: 'SECOND_HALF' as const, absoluteMinute: 61, second: 12, isRunning: true };
        const seed = { period: 'NOT_STARTED' as const, isRunning: false };
        expect(pickAdvancedClock(saved, seed)).toEqual(saved);
    });

    it('uses the server seed when it is ahead of the saved clock', () => {
        const saved = { period: 'FIRST_HALF' as const, absoluteMinute: 30, second: 0, isRunning: true };
        const seed = { period: 'HALF_TIME' as const, absoluteMinute: 35, isRunning: false };
        const picked = pickAdvancedClock(saved, seed);
        expect(picked.period).toBe('HALF_TIME');
        expect(picked.absoluteMinute).toBe(35);
        expect(picked.isRunning).toBe(false);
    });

    it('within the same period takes the later minute', () => {
        const saved = { period: 'FIRST_HALF' as const, absoluteMinute: 22, displayMinute: 22, second: 40, isRunning: true };
        const seed = { period: 'FIRST_HALF' as const, absoluteMinute: 15, isRunning: true };
        const picked = pickAdvancedClock(saved, seed);
        expect(picked.absoluteMinute).toBe(22);
        expect(picked.second).toBe(40);
        expect(picked.isRunning).toBe(true);
    });

    it('within the same period keeps the seed when it is the later one', () => {
        const saved = { period: 'FIRST_HALF' as const, absoluteMinute: 10, second: 5 };
        const seed = { period: 'FIRST_HALF' as const, absoluteMinute: 15, isRunning: true };
        const picked = pickAdvancedClock(saved, seed);
        expect(picked.absoluteMinute).toBe(15);
    });

    it('returns whichever side exists when only one does', () => {
        expect(pickAdvancedClock(null, { period: 'FIRST_HALF' })).toEqual({ period: 'FIRST_HALF' });
        expect(pickAdvancedClock({ period: 'HALF_TIME' }, undefined)).toEqual({ period: 'HALF_TIME' });
        expect(pickAdvancedClock(undefined, undefined)).toEqual({});
    });

    it('falls back to the seed-wins merge for periods it cannot rank', () => {
        const picked = pickAdvancedClock({ period: 'SUSPENDED' as const, absoluteMinute: 50 }, { period: 'FIRST_HALF' as const });
        expect(picked.period).toBe('FIRST_HALF');
    });
});
