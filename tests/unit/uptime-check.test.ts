import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { runCheck, evaluate, formatSummary, CHECKS } from '../../scripts/ci/uptime-check.mjs';

let server: Server;
let base = '';
let flakyHits = 0;

beforeAll(async () => {
    server = createServer((req, res) => {
        const path = (req.url || '').split('?')[0];
        if (path === '/ok') { res.writeHead(200); res.end('fine'); return; }
        if (path === '/ready-ok') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"status":"ok"}'); return; }
        if (path === '/ready-down') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"status":"down"}'); return; }
        if (path === '/broken') { res.writeHead(503); res.end('no'); return; }
        if (path === '/flaky') { flakyHits += 1; res.writeHead(flakyHits < 2 ? 503 : 200); res.end('x'); return; }
        if (path === '/hang') return; // never answers
        res.writeHead(404); res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => { server.closeAllConnections?.(); server.close(); });

const fast = { attempts: 2, delayMs: 0, timeoutMs: 400 };

describe('runCheck', () => {
    it('passes a healthy endpoint on the first attempt', async () => {
        const r = await runCheck(base, { path: '/ok', expectStatus: 200 }, fast);
        expect(r.ok).toBe(true);
        expect(r.attempts).toBe(1);
    });

    it('fails an endpoint that keeps answering 503, after using all attempts', async () => {
        const r = await runCheck(base, { path: '/broken', expectStatus: 200 }, fast);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('status 503');
        expect(r.attempts).toBe(2);
    });

    it('does not report an outage for a single failed attempt', async () => {
        flakyHits = 0;
        const r = await runCheck(base, { path: '/flaky', expectStatus: 200 }, fast);
        expect(r.ok).toBe(true);
        expect(r.attempts).toBe(2);
    });

    it('fails a readiness body that says the service is down even with status 200', async () => {
        const down = await runCheck(base, { path: '/ready-down', expectStatus: 200, expectJson: { status: 'ok' } }, fast);
        expect(down.ok).toBe(false);
        expect(down.reason).toBe('unexpected body');
        const up = await runCheck(base, { path: '/ready-ok', expectStatus: 200, expectJson: { status: 'ok' } }, fast);
        expect(up.ok).toBe(true);
    });

    it('treats an endpoint that never answers as a timeout', async () => {
        const r = await runCheck(base, { path: '/hang', expectStatus: 200 }, { attempts: 1, delayMs: 0, timeoutMs: 150 });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('timeout');
    });

    it('treats an unreachable host as no response', async () => {
        const r = await runCheck('http://127.0.0.1:1', { path: '/ok', expectStatus: 200 }, { attempts: 1, delayMs: 0, timeoutMs: 400 });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('no response');
    });
});

describe('evaluate and formatSummary', () => {
    const good = { path: '/a', ok: true, status: 200, ms: 120, attempts: 1, reason: '' };
    const bad = { path: '/b', ok: false, status: 503, ms: 300, attempts: 3, reason: 'status 503' };
    const slow = { path: '/c', ok: true, status: 200, ms: 9000, attempts: 1, reason: '' };

    it('is ok only when every check passed', () => {
        expect(evaluate([good, slow]).ok).toBe(true);
        expect(evaluate([good, bad]).ok).toBe(false);
    });

    it('lists failures and slow endpoints in the summary without any address', () => {
        const text = formatSummary([good, bad, slow]);
        expect(text).toContain('1 of 3 checks failed.');
        expect(text).toContain('/b: FAILED (status 503)');
        expect(text).toContain('Slow');
        expect(text).not.toMatch(/https?:\/\//);
    });

    it('probes the readiness endpoint first', () => {
        expect(CHECKS[0].path).toBe('/api/health/ready');
    });
});
