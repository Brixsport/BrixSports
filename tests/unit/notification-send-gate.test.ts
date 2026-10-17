import { describe, it, expect } from 'vitest';
import { shouldSendPeriodNotification, isPushEligibleMatchType } from '@/lib/notifications/send-gate';

describe('shouldSendPeriodNotification', () => {
    it('sends when the period changes', () => {
        expect(shouldSendPeriodNotification({ previousPeriod: 'NOT_STARTED', newPeriod: 'FIRST_HALF', matchType: 'competition' })).toBe(true);
        expect(shouldSendPeriodNotification({ previousPeriod: 'FIRST_HALF', newPeriod: 'HALF_TIME', matchType: 'competition' })).toBe(true);
    });

    it('does not send when the period is unchanged (retry / double tap)', () => {
        expect(shouldSendPeriodNotification({ previousPeriod: 'FIRST_HALF', newPeriod: 'FIRST_HALF', matchType: 'competition' })).toBe(false);
    });

    it('does not re-send full time on a retried finish', () => {
        expect(shouldSendPeriodNotification({ previousPeriod: 'FINISHED', newPeriod: 'FINISHED', matchType: 'competition' })).toBe(false);
    });

    it('never sends for a friendly match, even when the period changed', () => {
        expect(shouldSendPeriodNotification({ previousPeriod: 'NOT_STARTED', newPeriod: 'FIRST_HALF', matchType: 'friendly' })).toBe(false);
    });

    it('treats a null stored period as NOT_STARTED', () => {
        expect(shouldSendPeriodNotification({ previousPeriod: null, newPeriod: 'FIRST_HALF', matchType: 'competition' })).toBe(true);
        expect(shouldSendPeriodNotification({ previousPeriod: undefined, newPeriod: 'NOT_STARTED', matchType: 'competition' })).toBe(false);
    });

    it('treats a missing match type as a normal match', () => {
        expect(shouldSendPeriodNotification({ previousPeriod: 'NOT_STARTED', newPeriod: 'FIRST_HALF', matchType: null })).toBe(true);
    });
});

describe('isPushEligibleMatchType', () => {
    it('excludes only friendlies', () => {
        expect(isPushEligibleMatchType('friendly')).toBe(false);
        expect(isPushEligibleMatchType('competition')).toBe(true);
        expect(isPushEligibleMatchType(null)).toBe(true);
        expect(isPushEligibleMatchType(undefined)).toBe(true);
    });
});
