// BACKLOG-466 item 4: live-POST status handling for the loggers.
import { describe, it, expect } from 'vitest';
import { classifyEventPostStatus, describeEventRejection, scoresForFinalization } from '@/lib/event-post-outcome';

describe('scoresForFinalization', () => {
    it('sends the client tally when every event was accepted', () => {
        expect(scoresForFinalization(2, 1, { pending: 0, failed: 0, rejected: 0 })).toEqual({ homeScore: 2, awayScore: 1 });
    });

    it('omits the scores when anything is queued, refused on replay, or refused live', () => {
        expect(scoresForFinalization(2, 1, { pending: 1, failed: 0, rejected: 0 })).toEqual({});
        expect(scoresForFinalization(2, 1, { pending: 0, failed: 1, rejected: 0 })).toEqual({});
        expect(scoresForFinalization(2, 1, { pending: 0, failed: 0, rejected: 1 })).toEqual({});
    });

    it('still sends a 0-0 tally when everything was accepted', () => {
        expect(scoresForFinalization(0, 0, { pending: 0, failed: 0, rejected: 0 })).toEqual({ homeScore: 0, awayScore: 0 });
    });
});

describe('classifyEventPostStatus', () => {
    it('2xx is saved (including the idempotent replay 200)', () => {
        for (const s of [200, 201]) expect(classifyEventPostStatus(s)).toBe('saved');
    });

    it('401 triggers refresh-and-retry', () => {
        expect(classifyEventPostStatus(401)).toBe('refresh-auth');
    });

    it('408, 429 and 5xx are queued like a network failure', () => {
        for (const s of [408, 429, 500, 502, 503, 504]) expect(classifyEventPostStatus(s)).toBe('queue');
    });

    it('other 4xx are rejected, not queued', () => {
        for (const s of [400, 403, 404, 409, 422]) expect(classifyEventPostStatus(s)).toBe('rejected');
    });
});

describe('describeEventRejection', () => {
    it('always says the event was NOT saved and names the event', () => {
        for (const s of [401, 403, 409, 422, 400]) {
            const msg = describeEventRejection(s, 'Goal');
            expect(msg).toContain('Goal');
            expect(msg).toContain('NOT saved');
        }
    });
});
