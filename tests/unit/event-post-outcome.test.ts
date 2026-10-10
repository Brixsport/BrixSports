// BACKLOG-466 item 4: live-POST status handling for the loggers.
import { describe, it, expect } from 'vitest';
import { classifyEventPostStatus, describeEventRejection } from '@/lib/event-post-outcome';

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
