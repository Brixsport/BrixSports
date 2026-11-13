import { describe, it, expect } from 'vitest';
import { normalizeStartTime, parseSafeDate, safeFormat, safeToLocale, toLagosInputValue } from '@/lib/safe-date';

const EPOCH_MS = 1788963960000;

describe('safeFormat', () => {
    it('formats an ISO string', () => {
        expect(safeFormat('2026-09-09T14:06:00Z', 'yyyy', 'TBD')).toBe('2026');
    });

    it('formats a ms-epoch number', () => {
        expect(safeFormat(EPOCH_MS, 'yyyy', 'TBD')).toBe(
            String(new Date(EPOCH_MS).getFullYear())
        );
    });

    it('parses the malformed float string "1788963960000.0" as epoch ms', () => {
        expect(safeFormat('1788963960000.0', 'yyyy-MM-dd', 'TBD')).toBe(
            safeFormat(EPOCH_MS, 'yyyy-MM-dd', 'TBD')
        );
        expect(safeFormat('1788963960000.0', 'yyyy', 'TBD')).not.toBe('TBD');
    });

    it('parses an all-digit epoch string without a fraction', () => {
        expect(parseSafeDate('1788963960000')?.getTime()).toBe(EPOCH_MS);
    });

    it('returns the fallback for null, undefined, empty and garbage', () => {
        expect(safeFormat(null, 'HH:mm', '--:--')).toBe('--:--');
        expect(safeFormat(undefined, 'HH:mm', '--:--')).toBe('--:--');
        expect(safeFormat('', 'HH:mm', '--:--')).toBe('--:--');
        expect(safeFormat('not a date', 'HH:mm', '--:--')).toBe('--:--');
        expect(safeFormat(NaN, 'HH:mm', '--:--')).toBe('--:--');
        expect(safeFormat(new Date('nope'), 'HH:mm', '--:--')).toBe('--:--');
    });

    it('defaults the fallback to TBD', () => {
        expect(safeFormat('garbage', 'HH:mm')).toBe('TBD');
    });
});

describe('safeToLocale', () => {
    it('renders a valid date for each kind', () => {
        const iso = '2026-09-09T14:06:00Z';
        expect(safeToLocale(iso, 'date', { year: 'numeric' }, 'TBD', 'en-US')).toMatch(/2026/);
        expect(safeToLocale(iso, 'time', { hour: '2-digit', minute: '2-digit' }, '--:--', 'en-US')).not.toBe('--:--');
        expect(safeToLocale(iso, 'datetime', undefined, 'TBD', 'en-US')).toMatch(/2026/);
    });

    it('handles the float-string epoch', () => {
        expect(safeToLocale('1788963960000.0', 'date', { year: 'numeric' }, 'TBD', 'en-US')).not.toBe('TBD');
    });

    it('never renders "Invalid Date"', () => {
        expect(safeToLocale('garbage', 'date', undefined, 'TBD')).toBe('TBD');
        expect(safeToLocale(null, 'time', undefined, '--:--')).toBe('--:--');
        expect(safeToLocale(undefined, 'datetime', undefined, 'TBD')).toBe('TBD');
    });
});

describe('normalizeStartTime', () => {
    it('reads a zone-less datetime-local value as Lagos time', () => {
        expect(normalizeStartTime('2026-11-11T15:50')).toBe('2026-11-11T14:50:00.000Z');
    });

    it('accepts seconds and a space separator', () => {
        expect(normalizeStartTime('2026-11-11 15:50:30')).toBe('2026-11-11T14:50:30.000Z');
    });

    it('treats a date-only value as Lagos midnight', () => {
        expect(normalizeStartTime('2026-11-11')).toBe('2026-11-10T23:00:00.000Z');
    });

    it('converts a zoned ISO string to UTC Z form', () => {
        expect(normalizeStartTime('2026-11-11T15:50:00+01:00')).toBe('2026-11-11T14:50:00.000Z');
        expect(normalizeStartTime('2026-11-11T14:50:00Z')).toBe('2026-11-11T14:50:00.000Z');
    });

    it('converts the stringified-epoch form that libsql stores for a bound Date', () => {
        expect(normalizeStartTime('1793804400000.0')).toBe('2026-11-04T15:00:00.000Z');
    });

    it('converts epoch numbers and Date objects', () => {
        expect(normalizeStartTime(1793804400000)).toBe('2026-11-04T15:00:00.000Z');
        expect(normalizeStartTime(new Date('2026-11-04T15:00:00Z'))).toBe('2026-11-04T15:00:00.000Z');
    });

    it('returns null for empty or unparseable input', () => {
        expect(normalizeStartTime('')).toBeNull();
        expect(normalizeStartTime(null)).toBeNull();
        expect(normalizeStartTime(undefined)).toBeNull();
        expect(normalizeStartTime('not a date')).toBeNull();
        expect(normalizeStartTime('2026-13-45T99:99')).toBeNull();
    });

    it('is idempotent', () => {
        const once = normalizeStartTime('2026-11-11T15:50');
        expect(normalizeStartTime(once)).toBe(once);
    });
});

describe('toLagosInputValue', () => {
    it('renders a UTC instant as Lagos wall time for datetime-local', () => {
        expect(toLagosInputValue('2026-11-11T14:50:00.000Z')).toBe('2026-11-11T15:50');
    });

    it('round-trips with normalizeStartTime', () => {
        expect(normalizeStartTime(toLagosInputValue('2026-11-11T14:50:00.000Z'))).toBe('2026-11-11T14:50:00.000Z');
    });

    it('returns an empty string for unusable input', () => {
        expect(toLagosInputValue('garbage')).toBe('');
        expect(toLagosInputValue(null)).toBe('');
    });
});
