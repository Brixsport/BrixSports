import { describe, it, expect } from 'vitest';
import { hasKnownMinute, formatEventMinute, knownMinutes, formatScorerLine } from '@/lib/eventMinute';

describe('formatEventMinute', () => {
    it('prints a known minute with an apostrophe', () => {
        expect(formatEventMinute(45)).toBe("45'");
        expect(formatEventMinute(1)).toBe("1'");
    });

    it('keeps minute 0 as a real minute', () => {
        expect(formatEventMinute(0)).toBe("0'");
    });

    it('prints nothing for the -1 backfill marker, never "-1\'" and never a clamped 0 or 1', () => {
        expect(formatEventMinute(-1)).toBe('');
        expect(formatEventMinute(-30)).toBe('');
    });

    it('prints nothing for null, undefined, NaN and non-numbers', () => {
        expect(formatEventMinute(null)).toBe('');
        expect(formatEventMinute(undefined)).toBe('');
        expect(formatEventMinute(NaN)).toBe('');
        expect(formatEventMinute('12')).toBe('');
    });
});

describe('hasKnownMinute / knownMinutes', () => {
    it('distinguishes known from unknown', () => {
        expect(hasKnownMinute(10)).toBe(true);
        expect(hasKnownMinute(-1)).toBe(false);
        expect(hasKnownMinute(null)).toBe(false);
    });

    it('drops unknown minutes and sorts the rest ascending', () => {
        expect(knownMinutes([71, -1, null, 33, undefined])).toEqual([33, 71]);
    });
});

describe('formatScorerLine', () => {
    it('lists every known minute', () => {
        expect(formatScorerLine('Lazzy', [71, 33])).toBe("Lazzy 33', 71'");
    });

    it('shows the name only when no minute is known', () => {
        expect(formatScorerLine('Wareez', [-1])).toBe('Wareez');
        expect(formatScorerLine('Wareez', [null, undefined])).toBe('Wareez');
    });

    it('drops only the unknown minute when some are known', () => {
        expect(formatScorerLine('Surefunmi', [-1, 75])).toBe("Surefunmi 75'");
    });
});
