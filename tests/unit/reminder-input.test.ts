import { describe, it, expect } from 'vitest';
import { validateReminderRequest } from '@/lib/notifications/reminder-input';

const NOW = new Date('2026-10-12T12:00:00.000Z');
const FUTURE = '2026-10-12T18:00:00.000Z';
const PAST = '2026-10-12T10:00:00.000Z';

const base = { matchStatus: 'UPCOMING', matchStartTime: FUTURE, now: NOW };

describe('validateReminderRequest', () => {
    it('accepts a valid request', () => {
        expect(validateReminderRequest({ ...base, minutesBefore: 15 })).toEqual({ ok: true, minutesBefore: 15 });
        expect(validateReminderRequest({ ...base, minutesBefore: 1 }).ok).toBe(true);
        expect(validateReminderRequest({ ...base, minutesBefore: 1440 }).ok).toBe(true);
    });

    it('rejects out-of-range, fractional and non-numeric minutes', () => {
        for (const m of [0, -5, 1441, 15.5, NaN, Infinity, '15', null, undefined, {}]) {
            expect(validateReminderRequest({ ...base, minutesBefore: m }).ok).toBe(false);
        }
    });

    it('rejects a match that is not UPCOMING', () => {
        for (const s of ['LIVE', 'FINISHED', 'CANCELLED', 'PENDING', null, undefined]) {
            expect(validateReminderRequest({ ...base, minutesBefore: 15, matchStatus: s }).ok).toBe(false);
        }
    });

    it('rejects a match whose start time has passed or cannot be parsed', () => {
        expect(validateReminderRequest({ ...base, minutesBefore: 15, matchStartTime: PAST }).ok).toBe(false);
        expect(validateReminderRequest({ ...base, minutesBefore: 15, matchStartTime: 'garbage' }).ok).toBe(false);
    });
});
