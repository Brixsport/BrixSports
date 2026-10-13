import { describe, it, expect } from 'vitest';
import { evaluateReadiness, timedCheck } from '@/lib/health';

describe('evaluateReadiness', () => {
    it('is ok with 200 when the database answered', () => {
        const report = evaluateReadiness({ ok: true, latencyMs: 12 });
        expect(report.status).toBe('ok');
        expect(report.httpStatus).toBe(200);
    });

    it('is down with 503 when the database did not answer', () => {
        const report = evaluateReadiness({ ok: false, latencyMs: 4000 });
        expect(report.status).toBe('down');
        expect(report.httpStatus).toBe(503);
    });
});

describe('timedCheck', () => {
    it('reports ok for a check that resolves', async () => {
        const result = await timedCheck(async () => 'row', 500);
        expect(result.ok).toBe(true);
    });

    it('reports not ok, without throwing, for a check that rejects', async () => {
        const result = await timedCheck(async () => { throw new Error('connection refused'); }, 500);
        expect(result.ok).toBe(false);
    });

    it('reports not ok for a check that takes longer than the limit', async () => {
        const result = await timedCheck(() => new Promise((resolve) => setTimeout(resolve, 300)), 30);
        expect(result.ok).toBe(false);
        expect(result.latencyMs).toBeLessThan(250);
    });
});
