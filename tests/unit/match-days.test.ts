import { describe, it, expect } from 'vitest';
import {
    toDayKey,
    getMatchDays,
    withToday,
    pickDefaultDay,
    nearestMatchDay,
    stepMatchDay,
    formatDayLabel,
} from '@/lib/match-days';

// Local-time constructors so the tests hold in any timezone.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe('toDayKey / getMatchDays', () => {
    it('keys by local day and skips unparseable dates', () => {
        expect(toDayKey(at(2026, 11, 13, 16))).toBe('2026-11-13');
        expect(toDayKey('garbage')).toBeNull();
        expect(toDayKey(null)).toBeNull();
    });

    it('returns sorted unique days', () => {
        const days = getMatchDays([
            { startTime: at(2026, 11, 18) },
            { startTime: at(2026, 11, 13, 9) },
            { startTime: at(2026, 11, 13, 18) },
            { startTime: 'not a date' },
        ]);
        expect(days).toEqual(['2026-11-13', '2026-11-18']);
    });
});

describe('pickDefaultDay', () => {
    const days = ['2026-11-13', '2026-11-14', '2026-11-18', '2026-12-06'];

    it('opens on today when it has fixtures', () => {
        expect(pickDefaultDay(days, '2026-11-14')).toBe('2026-11-14');
    });
    it('opens on the next match day when today is empty', () => {
        expect(pickDefaultDay(days, '2026-11-16')).toBe('2026-11-18');
    });
    it('opens on the most recent match day when the season is over', () => {
        expect(pickDefaultDay(days, '2027-01-10')).toBe('2026-12-06');
    });
    it('prefers a day with a live match', () => {
        expect(pickDefaultDay(days, '2026-11-14', '2026-11-13')).toBe('2026-11-13');
    });
    it('falls back to today with no matches at all', () => {
        expect(pickDefaultDay([], '2026-11-14')).toBe('2026-11-14');
    });
});

describe('stepMatchDay', () => {
    const days = ['2026-11-14', '2026-11-15', '2026-11-18'];
    it('jumps over empty days', () => {
        expect(stepMatchDay(days, '2026-11-15', 1)).toBe('2026-11-18');
        expect(stepMatchDay(days, '2026-11-18', -1)).toBe('2026-11-15');
    });
    it('works from a key that is not a match day', () => {
        expect(stepMatchDay(days, '2026-11-16', 1)).toBe('2026-11-18');
        expect(stepMatchDay(days, '2026-11-16', -1)).toBe('2026-11-15');
    });
    it('returns null at the ends', () => {
        expect(stepMatchDay(days, '2026-11-18', 1)).toBeNull();
        expect(stepMatchDay(days, '2026-11-14', -1)).toBeNull();
    });
});

describe('nearestMatchDay / withToday', () => {
    it('snaps forward first, then back', () => {
        expect(nearestMatchDay(['2026-11-14', '2026-11-18'], '2026-11-16')).toBe('2026-11-18');
        expect(nearestMatchDay(['2026-11-14', '2026-11-18'], '2026-12-01')).toBe('2026-11-18');
        expect(nearestMatchDay([], '2026-11-16')).toBeNull();
    });
    it('adds today once, in order', () => {
        expect(withToday(['2026-11-14', '2026-11-18'], '2026-11-16')).toEqual(['2026-11-14', '2026-11-16', '2026-11-18']);
        expect(withToday(['2026-11-16'], '2026-11-16')).toEqual(['2026-11-16']);
    });
});

describe('formatDayLabel', () => {
    it('uses relative names near today and a weekday otherwise', () => {
        expect(formatDayLabel('2026-11-13', '2026-11-13').primary).toBe('Today');
        expect(formatDayLabel('2026-11-14', '2026-11-13').primary).toBe('Tomorrow');
        expect(formatDayLabel('2026-11-12', '2026-11-13').primary).toBe('Yesterday');
        expect(formatDayLabel('2026-11-18', '2026-11-13')).toEqual({ primary: 'Wed', secondary: '18 Nov' });
    });
    it('adds the year only when it differs from the current one', () => {
        expect(formatDayLabel('2027-01-09', '2026-11-13').secondary).toBe('9 Jan 2027');
    });
});
