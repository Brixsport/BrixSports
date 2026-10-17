import { describe, it, expect } from 'vitest';
import { parseSafeDate, safeFormat, safeToLocale } from '@/lib/safe-date';

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
