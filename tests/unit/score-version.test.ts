import { describe, it, expect } from 'vitest';
import { acceptScoreVersion, createScoreVersionClock } from '@/lib/score-version';

describe('acceptScoreVersion', () => {
    it('applies the first versioned update and records its version', () => {
        expect(acceptScoreVersion(undefined, 100)).toEqual({ accept: true, next: 100 });
    });

    it('applies a newer version', () => {
        expect(acceptScoreVersion(100, 200)).toEqual({ accept: true, next: 200 });
    });

    it('drops an older version (1-0 arriving after 2-0) and keeps the recorded one', () => {
        expect(acceptScoreVersion(200, 100)).toEqual({ accept: false, next: 200 });
    });

    it('applies an update with the same version again', () => {
        expect(acceptScoreVersion(200, 200)).toEqual({ accept: true, next: 200 });
    });

    it('applies an update with no usable version, leaving the recorded one alone', () => {
        for (const v of [undefined, null, 'x', NaN, Infinity, {}]) {
            expect(acceptScoreVersion(200, v)).toEqual({ accept: true, next: 200 });
        }
        expect(acceptScoreVersion(undefined, undefined)).toEqual({ accept: true, next: undefined });
    });
});

describe('createScoreVersionClock', () => {
    it('returns the current time when it moves forward', () => {
        let t = 1000;
        const next = createScoreVersionClock(() => t);
        expect(next()).toBe(1000);
        t = 1500;
        expect(next()).toBe(1500);
    });

    it('never repeats within the same millisecond', () => {
        const next = createScoreVersionClock(() => 1000);
        expect([next(), next(), next()]).toEqual([1000, 1001, 1002]);
    });

    it('never goes backwards if the clock does', () => {
        let t = 2000;
        const next = createScoreVersionClock(() => t);
        const a = next();
        t = 1990;
        expect(next()).toBeGreaterThan(a);
    });
});
