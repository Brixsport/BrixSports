/**
 * Cache contract smoke test (read-only, no writes).
 *
 * Asserts that the routes the CDN is relied on for stay cacheable, so a change
 * that silently turns one back into a per-request function call fails loudly.
 * Each route is requested twice; the second response must be served by the CDN.
 *
 * Usage:  BASE_URL=https://<preview-or-prod-host> npx tsx tests/smoke/cache-contract.ts
 * Env:    VERCEL_AUTOMATION_BYPASS_SECRET (optional) for protected previews.
 *
 * Detail pages need real ids; they are discovered from the public list APIs.
 * A route whose id cannot be discovered is reported as SKIP, not as a pass.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

const headers: Record<string, string> = BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {};

type Check = { name: string; path: string; kind: 'api' | 'page' };

// A protected Vercel preview answers 200 with its HTML login page when the bypass
// header is missing, and that page can itself be served from the CDN. Every check
// below therefore also verifies it got the real content type, never just "200 + HIT".
const LOGIN_WALL = /vercel\.com\/(sso-api|login)|Authentication Required|_vercel\/sso/i;

async function getJson(path: string): Promise<any> {
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    if (!res.ok) throw new Error(`${path} -> ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) throw new Error(`${path} -> not JSON (content-type "${ct}"); protected preview without a bypass secret?`);
    return res.json();
}

function firstId(payload: any, keys: string[]): string | null {
    const list = Array.isArray(payload) ? payload : keys.map((k) => payload?.[k]).find(Array.isArray);
    const item = list?.[0];
    return item?.id ?? item?.slug ?? null;
}

async function main() {
    const checks: Check[] = [
        { name: 'feature flags', path: '/api/feature-flags', kind: 'api' },
        { name: 'football match list', path: '/api/football/matches?limit=20', kind: 'api' },
        { name: 'basketball match list', path: '/api/basketball/matches?limit=20', kind: 'api' },
        { name: 'other match list', path: '/api/other/matches?limit=20', kind: 'api' },
        { name: 'competitions list', path: '/api/competitions', kind: 'api' },
        { name: 'active livestreams', path: '/api/livestreams/active', kind: 'api' },
    ];
    const skipped: string[] = [];

    const discover = async (label: string, listPath: string, keys: string[], pageBase: string) => {
        try {
            const id = firstId(await getJson(listPath), keys);
            if (id) checks.push({ name: label, path: `${pageBase}/${encodeURIComponent(id)}`, kind: 'page' });
            else skipped.push(`${label} (no id found)`);
        } catch (e) {
            skipped.push(`${label} (${(e as Error).message})`);
        }
    };
    await discover('match page', '/api/football/matches?limit=1', ['matches'], '/matches');
    await discover('competition page', '/api/competitions', ['competitions', 'groups', 'data'], '/competitions');
    await discover('team page', '/api/teams?limit=1', ['teams', 'data'], '/teams');
    await discover('player page', '/api/players?limit=1', ['players', 'data'], '/players');
    await discover('news page', '/api/news?limit=1', ['articles', 'news', 'data'], '/news');

    console.log(`=== Cache contract -- target: ${BASE_URL} ===\n`);
    let failed = 0;
    for (const c of checks) {
        await fetch(`${BASE_URL}${c.path}`, { headers }); // prime
        await new Promise((r) => setTimeout(r, 700));
        const res = await fetch(`${BASE_URL}${c.path}`, { headers });
        const vc = res.headers.get('x-vercel-cache') || '(none)';
        const cc = res.headers.get('cache-control') || '(none)';
        const prerender = res.headers.get('x-nextjs-prerender');
        const ct = res.headers.get('content-type') || '';
        const body = await res.text();
        const cdnHit = vc === 'HIT' || vc === 'STALE' || vc === 'PRERENDER';
        const privateCache = /no-store|private/i.test(cc) && c.kind === 'page';
        const rightType = c.kind === 'api' ? ct.includes('json') : ct.includes('html');
        const behindWall = LOGIN_WALL.test(body.slice(0, 4000));
        const ok = res.ok && cdnHit && !privateCache && rightType && !behindWall;
        if (!ok) failed++;
        const why = !rightType ? ` (content-type "${ct}")` : behindWall ? ' (login wall, not the real page)' : '';
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(24)} ${c.path}  x-vercel-cache=${vc}${prerender ? ' prerender' : ''}${why}`);
    }
    for (const s of skipped) console.log(`SKIP  ${s}`);
    // A check that could not run proves nothing: treat it as a failure unless the
    // caller explicitly allows skips (for example a database with no news yet).
    if (skipped.length > 0 && !process.env.ALLOW_SKIP) failed += skipped.length;

    if (failed > 0) {
        console.error(`\n=== FAIL: ${failed} check(s) failed or could not run (set ALLOW_SKIP=1 to allow skips) ===`);
        process.exit(1);
    }
    console.log('\n=== PASS: every checked route is served from the CDN on the second request ===');
}

main().catch((e) => {
    console.error('FAIL:', e);
    process.exit(1);
});
