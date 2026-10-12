import { describe, it, expect } from 'vitest';
import { isFailureLimited, recordFailure, clearFailures, emailSubject } from '@/lib/rate-limit';

// Redis is not configured in unit tests, so these exercise the in-memory path.
const opts = { max: 3, windowMs: 60_000 };

describe('failure-only limiter', () => {
    it('does not limit until max failures have been recorded', async () => {
        const subject = 'ip:test-1';
        for (let i = 0; i < 2; i++) await recordFailure('t', subject, opts);
        expect((await isFailureLimited('t', subject, opts)).limited).toBe(false);
        await recordFailure('t', subject, opts);
        const res = await isFailureLimited('t', subject, opts);
        expect(res.limited).toBe(true);
        expect(res.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('checking never consumes budget, so successful attempts are free', async () => {
        const subject = 'ip:test-2';
        for (let i = 0; i < 50; i++) await isFailureLimited('t', subject, opts);
        expect((await isFailureLimited('t', subject, opts)).limited).toBe(false);
    });

    it('clearFailures resets the counter', async () => {
        const subject = 'ip:test-3';
        for (let i = 0; i < 3; i++) await recordFailure('t', subject, opts);
        expect((await isFailureLimited('t', subject, opts)).limited).toBe(true);
        await clearFailures('t', subject, opts);
        expect((await isFailureLimited('t', subject, opts)).limited).toBe(false);
    });

    it('keeps scopes and subjects independent', async () => {
        for (let i = 0; i < 3; i++) await recordFailure('a', 'ip:test-4', opts);
        expect((await isFailureLimited('a', 'ip:test-4', opts)).limited).toBe(true);
        expect((await isFailureLimited('b', 'ip:test-4', opts)).limited).toBe(false);
        expect((await isFailureLimited('a', 'ip:test-5', opts)).limited).toBe(false);
    });

    it('normalises the email subject', () => {
        expect(emailSubject('  User@Example.COM ')).toBe('email:user@example.com');
    });
});
