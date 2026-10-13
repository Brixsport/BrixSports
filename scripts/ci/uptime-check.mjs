// Uptime probe for the scheduled monitor workflow.
//
// Calls a few public endpoints of the live site, retries before declaring a failure (a single
// dropped request from a CI runner is not an outage), and writes a short plain-text summary.
// The site address comes from APP_URL and is never printed: output names paths and status
// codes only, because the summary is posted to a public issue.
//
// Environment: APP_URL (required, https), SUMMARY_FILE (optional path for the summary),
// GITHUB_OUTPUT (optional; receives ok=true|false).
import { appendFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const CHECKS = [
    { path: '/api/health/ready', expectStatus: 200, expectJson: { status: 'ok' } },
    { path: '/api/live-matches', expectStatus: 200 },
    { path: '/', expectStatus: 200 },
];

export const SLOW_MS = 6000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One endpoint, retried. Never throws. */
export async function runCheck(baseUrl, check, { attempts = 3, delayMs = 10_000, timeoutMs = 15_000, fetchImpl = fetch } = {}) {
    let last = { path: check.path, ok: false, status: 0, ms: 0, attempts: 0, reason: 'not run' };
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const startedAt = Date.now();
        try {
            const res = await fetchImpl(`${baseUrl}${check.path}`, {
                headers: { 'User-Agent': 'brixsports-uptime-monitor', 'Cache-Control': 'no-cache' },
                signal: AbortSignal.timeout(timeoutMs),
                redirect: 'follow',
            });
            const ms = Date.now() - startedAt;
            let reason = '';
            if (res.status !== check.expectStatus) reason = `status ${res.status}`;
            else if (check.expectJson) {
                const body = await res.json().catch(() => null);
                const matches = body && Object.entries(check.expectJson).every(([k, v]) => body[k] === v);
                if (!matches) reason = 'unexpected body';
            } else {
                await res.arrayBuffer().catch(() => null);
            }
            last = { path: check.path, ok: reason === '', status: res.status, ms, attempts: attempt, reason };
        } catch (error) {
            const timedOut = error && (error.name === 'TimeoutError' || error.name === 'AbortError');
            last = { path: check.path, ok: false, status: 0, ms: Date.now() - startedAt, attempts: attempt, reason: timedOut ? 'timeout' : 'no response' };
        }
        if (last.ok) return last;
        if (attempt < attempts) await sleep(delayMs);
    }
    return last;
}

/** Summary of a full pass. */
export function evaluate(results) {
    const failed = results.filter((r) => !r.ok);
    const slow = results.filter((r) => r.ok && r.ms > SLOW_MS);
    return { ok: failed.length === 0, failed, slow };
}

export function formatSummary(results) {
    const { ok, failed, slow } = evaluate(results);
    const lines = [ok ? 'All checks passed.' : `${failed.length} of ${results.length} checks failed.`];
    for (const r of results) {
        lines.push(`- ${r.path}: ${r.ok ? 'ok' : `FAILED (${r.reason})`}, ${r.ms} ms, ${r.attempts} attempt(s)`);
    }
    if (slow.length > 0) lines.push(`Slow (over ${SLOW_MS} ms): ${slow.map((r) => r.path).join(', ')}`);
    return lines.join('\n');
}

async function main() {
    const raw = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
    if (!/^https:\/\/[^/]+$/.test(raw)) {
        console.error('APP_URL must be an https origin');
        process.exit(2);
    }
    const results = [];
    for (const check of CHECKS) results.push(await runCheck(raw, check));
    const summary = formatSummary(results);
    console.log(summary);
    if (process.env.SUMMARY_FILE) writeFileSync(process.env.SUMMARY_FILE, `${summary}\n`);
    const { ok } = evaluate(results);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ok=${ok}\n`);
    process.exit(ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
