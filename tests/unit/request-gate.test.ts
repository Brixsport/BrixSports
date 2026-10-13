import { describe, it, expect } from 'vitest';
import { shouldSkipPollTick, DEFAULT_MAX_IN_FLIGHT_MS } from '@/lib/request-gate';

describe('shouldSkipPollTick', () => {
    it('does not skip when nothing is in flight', () => {
        expect(shouldSkipPollTick(null, 5000)).toBe(false);
    });

    it('skips while a recent request is still running', () => {
        expect(shouldSkipPollTick(1000, 4000)).toBe(true);
    });

    it('stops blocking once a request has been running past the limit (hung request)', () => {
        expect(shouldSkipPollTick(0, DEFAULT_MAX_IN_FLIGHT_MS - 1)).toBe(true);
        expect(shouldSkipPollTick(0, DEFAULT_MAX_IN_FLIGHT_MS)).toBe(false);
    });

    it('honours a custom limit', () => {
        expect(shouldSkipPollTick(0, 2000, 1000)).toBe(false);
        expect(shouldSkipPollTick(0, 500, 1000)).toBe(true);
    });
});
