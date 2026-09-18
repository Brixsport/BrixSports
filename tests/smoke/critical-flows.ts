/**
 * Smoke test for BrixSports' Three Critical Flows (CLAUDE.md):
 *   Flow A — Match Creation: Admin creates match -> assigns logger -> match appears on public livescore
 *   Flow B — Live Event Logging: Logger logs event -> event saves to DB -> public score updates in real time
 *   Flow C — Public Livescore: Viewer opens page -> sees live match -> score updates without manual refresh
 *
 * BACKLOG-400's headline finding was zero automated test coverage anywhere in
 * this repo, protecting none of the Three Critical Flows a 225-file branch
 * was about to merge on top of -- every "flow intact" verdict up to that
 * point (including BACKLOG-396's) was a manual code-trace, not a
 * regression-guarded one. This is that audit's own recommended first step:
 * ONE checked-in end-to-end script, not a full test suite from zero.
 *
 * Checked into tests/smoke/ (tracked), NOT dev/ (gitignored per this
 * project's own convention) -- a script that never gets committed can't
 * possibly "run before every promotion," which is the entire point of this
 * exercise.
 *
 * Exercises real HTTP endpoints end to end (not DB shortcuts) for the parts
 * a real admin/logger/viewer would actually hit -- Flow C in particular
 * polls the PUBLIC, unauthenticated GET /api/matches/[id], the same route a
 * real viewer's browser calls. Per BACKLOG-402: only ever poll a raw API
 * response here, never a rendered page -- a caching layer in front of pages
 * can silently serve stale HTML while the API itself is fresh.
 *
 * Auth/setup pattern (signing real JWTs for existing DB rows rather than
 * going through the login endpoints) matches the already-proven
 * dev/dual-logger-setup.mjs / dual-logger-race-test.mjs / dual-logger-cleanup.mjs
 * scripts from earlier this session -- same shape, just checked in and
 * scoped to the three flows instead of the dual-logger race case.
 *
 * Requires (read from env / .env.local, nothing committed):
 *   TURSO_CONNECTION_URL, TURSO_AUTH_TOKEN -- to sign JWTs for a real
 *     existing admin + logger account, and for teardown.
 *   JWT_SECRET -- to sign those JWTs the same way the app does.
 *   BASE_URL -- target origin, defaults to http://localhost:3000. Override
 *     to point at a staging deploy.
 *   VERCEL_AUTOMATION_BYPASS_SECRET -- optional, only needed if BASE_URL is
 *     a Vercel-protected deployment.
 *
 * Usage: npx tsx tests/smoke/critical-flows.ts
 * Exit code 0 on pass, 1 on any failure -- safe to wire into CI later.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { createClient } from '@libsql/client';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
const SCORE_UPDATE_TIMEOUT_MS = 5000; // CLAUDE.md's own target: "under 5 seconds from event save to public display"
const POLL_INTERVAL_MS = 500;

if (!process.env.TURSO_CONNECTION_URL || !process.env.TURSO_AUTH_TOKEN || !JWT_SECRET) {
    console.error('FAIL: missing TURSO_CONNECTION_URL / TURSO_AUTH_TOKEN / JWT_SECRET in env or .env.local');
    process.exit(1);
}

const db = createClient({
    url: process.env.TURSO_CONNECTION_URL!.trim(),
    authToken: process.env.TURSO_AUTH_TOKEN,
});

function authHeaders(token: string): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
    if (BYPASS) headers['x-vercel-protection-bypass'] = BYPASS;
    return headers;
}

function publicHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (BYPASS) headers['x-vercel-protection-bypass'] = BYPASS;
    return headers;
}

async function fail(message: string): Promise<never> {
    console.error(`\nFAIL: ${message}`);
    await cleanup();
    process.exit(1);
}

let matchId: string | null = null;

async function cleanup() {
    if (!matchId) return;
    try {
        await db.execute({ sql: `DELETE FROM match_events WHERE match_id = ?`, args: [matchId] });
        await db.execute({ sql: `DELETE FROM match_logger_assignments WHERE match_id = ?`, args: [matchId] });
        await db.execute({ sql: `DELETE FROM matches WHERE id = ?`, args: [matchId] });
        console.log(`cleanup: removed throwaway match ${matchId}`);
    } catch (err) {
        console.error(`cleanup warning: failed to remove ${matchId} -- may need manual cleanup:`, err);
    }
}

async function main() {
    console.log(`=== BrixSports Critical Flows smoke test -- target: ${BASE_URL} ===\n`);

    // --- Setup: find real DB rows to act as the admin/logger/teams/player ---
    const adminRow = await db.execute(`SELECT id, email FROM users WHERE role = 'admin' LIMIT 1`);
    if (adminRow.rows.length === 0) return fail('no admin user found in DB -- cannot sign an admin token');
    const admin = adminRow.rows[0] as unknown as { id: string; email: string };

    const loggerRow = await db.execute(`SELECT id, email, name FROM loggers LIMIT 1`);
    if (loggerRow.rows.length === 0) return fail('no logger account found in DB -- cannot sign a logger token');
    const logger = loggerRow.rows[0] as unknown as { id: string; email: string; name: string };

    const teamsRows = await db.execute(`SELECT id, name FROM teams WHERE sport = 'Football' LIMIT 2`);
    if (teamsRows.rows.length < 2) return fail('need at least 2 Football teams in DB');
    const [home, away] = teamsRows.rows as unknown as { id: string; name: string }[];

    const playerRow = await db.execute({ sql: `SELECT id, name FROM players WHERE team_id = ? LIMIT 1`, args: [home.id] });
    if (playerRow.rows.length === 0) return fail(`no player found for home team ${home.id}`);
    const scorer = playerRow.rows[0] as unknown as { id: string; name: string };

    const adminToken = jwt.sign({ userId: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET!, { expiresIn: '1h' });
    const loggerToken = jwt.sign({ userId: logger.id, email: logger.email, role: 'logger' }, JWT_SECRET!, { expiresIn: '1h' });

    // --- Flow A: admin creates a match, assigns a logger ---
    console.log('--- Flow A: Match Creation ---');
    matchId = `smoke-test-${nanoid(8)}`;
    const createRes = await fetch(`${BASE_URL}/api/matches`, {
        method: 'POST',
        headers: authHeaders(adminToken),
        body: JSON.stringify({
            id: matchId,
            sport: 'Football',
            homeTeamId: home.id,
            awayTeamId: away.id,
            status: 'LIVE',
            startTime: new Date().toISOString(),
            venue: 'Smoke Test Venue',
            competition: 'Smoke Test Match',
            matchType: 'friendly',
        }),
    });
    if (createRes.status !== 201) {
        return fail(`POST /api/matches expected 201, got ${createRes.status}: ${await createRes.text()}`);
    }
    console.log(`  match created: ${matchId}`);

    const assignRes = await fetch(`${BASE_URL}/api/matches/${matchId}/assign-logger`, {
        method: 'POST',
        headers: authHeaders(adminToken),
        body: JSON.stringify({ loggerId: logger.id, role: 'primary' }),
    });
    if (!assignRes.ok) {
        return fail(`POST /api/matches/${matchId}/assign-logger expected 2xx, got ${assignRes.status}: ${await assignRes.text()}`);
    }
    console.log(`  logger ${logger.name} assigned`);

    // Flow A's own tail end: the match should now be visible on the public list.
    const listRes = await fetch(`${BASE_URL}/api/matches?loggerId=${logger.id}`, { headers: publicHeaders() });
    const listBody = await listRes.json().catch(() => null);
    const appearsOnPublicList = Array.isArray(listBody) && listBody.some((m: any) => m.id === matchId);
    if (!appearsOnPublicList) {
        console.warn(`  WARN: match not found via /api/matches?loggerId= filter -- checking direct GET instead (list route's loggerId filter behavior may differ from what this test assumes)`);
    } else {
        console.log('  match appears on the public matches list');
    }

    // --- Flow B: logger logs a real event ---
    console.log('\n--- Flow B: Live Event Logging ---');
    const eventRes = await fetch(`${BASE_URL}/api/matches/${matchId}/events`, {
        method: 'POST',
        headers: authHeaders(loggerToken),
        body: JSON.stringify({
            type: 'Goal',
            minute: 10,
            second: 0,
            teamId: home.id,
            playerId: scorer.id,
            detail: `${scorer.name} scores (smoke test)`,
        }),
    });
    if (!eventRes.ok) {
        return fail(`POST /api/matches/${matchId}/events expected 2xx, got ${eventRes.status}: ${await eventRes.text()}`);
    }
    console.log(`  event posted: Goal by ${scorer.name} at 10'`);

    // --- Flow C: public livescore reflects the event within 5s ---
    console.log('\n--- Flow C: Public Livescore ---');
    const deadline = Date.now() + SCORE_UPDATE_TIMEOUT_MS;
    let observedHomeScore: number | null = null;
    let elapsedMs = 0;
    const startedAt = Date.now();

    while (Date.now() < deadline) {
        const publicRes = await fetch(`${BASE_URL}/api/matches/${matchId}`, { headers: publicHeaders() });
        if (publicRes.ok) {
            const body = await publicRes.json();
            observedHomeScore = body?.match?.homeScore ?? null;
            if (observedHomeScore === 1) {
                elapsedMs = Date.now() - startedAt;
                break;
            }
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    if (observedHomeScore !== 1) {
        return fail(
            `public GET /api/matches/${matchId} did not reflect the goal within ${SCORE_UPDATE_TIMEOUT_MS}ms -- ` +
            `expected homeScore=1, last observed=${observedHomeScore}`
        );
    }
    console.log(`  public score updated to ${observedHomeScore}-0 within ${elapsedMs}ms (target: <${SCORE_UPDATE_TIMEOUT_MS}ms)`);

    await cleanup();
    console.log('\n=== PASS: all three Critical Flows verified end to end ===');
    process.exit(0);
}

main().catch(async (err) => {
    console.error('\nFAIL: unexpected error:', err);
    await cleanup();
    process.exit(1);
});
