/**
 * Phase 4 (TESTING_STRATEGY_2026-09-18.md): extends Phase 1's real-concurrent-
 * request pattern with one more assertion -- that the WS broadcast side
 * (event:new / match:score:updated on the match:{matchId} room, per
 * src/lib/socket.ts) actually reaches a real connected client, not just that
 * the DB write succeeded (which tests/smoke/critical-flows.ts's Flow C
 * already proves via the polled public REST endpoint, deliberately not the
 * WS path -- see BACKLOG-402 in that file's own comments). Per the strategy
 * doc's own reasoning: this project's real-time bugs (BUG-108/116's up-to-42s
 * broadcast latency, BUG-153's silently-dead event names) have only ever been
 * caught by live concurrent testing against a real deployed environment, so
 * this is a real socket.io-client connection, not a mocked WebSocket.
 *
 * Requires NEXT_PUBLIC_WS_URL (or WS_SERVER_URL) pointing at the real
 * standalone WS server (Railway) for whichever environment BASE_URL targets
 * -- both must agree on the same environment or the room will never receive
 * anything (see src/lib/socket.ts's wsEnv staging/prod split).
 *
 * Usage: BASE_URL=https://staging.brixsports.com npx tsx tests/smoke/realtime-broadcast.test.ts
 * Exit code 0 on pass, 1 on any failure.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { createClient } from '@libsql/client';
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || process.env.WS_SERVER_URL;
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
const BROADCAST_TIMEOUT_MS = 5000; // CLAUDE.md's own target: "under 5 seconds from event save to public display"

if (!process.env.TURSO_CONNECTION_URL || !process.env.TURSO_AUTH_TOKEN || !JWT_SECRET) {
    console.error('FAIL: missing TURSO_CONNECTION_URL / TURSO_AUTH_TOKEN / JWT_SECRET in env or .env.local');
    process.exit(1);
}
if (!WS_URL) {
    console.error('FAIL: missing NEXT_PUBLIC_WS_URL (or WS_SERVER_URL) -- cannot connect a real socket.io-client without it');
    process.exit(1);
}

const db = createClient({ url: process.env.TURSO_CONNECTION_URL!.trim(), authToken: process.env.TURSO_AUTH_TOKEN });

function authHeaders(token: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    if (BYPASS) headers['x-vercel-protection-bypass'] = BYPASS;
    return headers;
}

let matchId: string | null = null;
async function cleanup() {
    if (!matchId) return;
    try {
        await db.execute({ sql: `DELETE FROM match_events WHERE match_id = ?`, args: [matchId] });
        await db.execute({ sql: `DELETE FROM match_logger_assignments WHERE match_id = ?`, args: [matchId] });
        await db.execute({ sql: `DELETE FROM matches WHERE id = ?`, args: [matchId] });
        console.log(`\ncleanup: removed throwaway match ${matchId}`);
    } catch (err) {
        console.error(`cleanup warning: may need manual cleanup for ${matchId}:`, err);
    }
}

async function main() {
    console.log(`=== Real-time WS broadcast test -- API: ${BASE_URL}, WS: ${WS_URL} ===\n`);

    const adminRow = await db.execute(`SELECT id, email FROM users WHERE role = 'admin' LIMIT 1`);
    if (adminRow.rows.length === 0) throw new Error('no admin user found in DB');
    const admin = adminRow.rows[0] as unknown as { id: string; email: string };

    const loggerRow = await db.execute(`SELECT id, email, name FROM loggers LIMIT 1`);
    if (loggerRow.rows.length === 0) throw new Error('no logger account found in DB');
    const logger = loggerRow.rows[0] as unknown as { id: string; email: string; name: string };

    const teamsRows = await db.execute(`SELECT id, name FROM teams WHERE sport = 'Football' LIMIT 2`);
    if (teamsRows.rows.length < 2) throw new Error('need at least 2 Football teams in DB');
    const [home, away] = teamsRows.rows as unknown as { id: string; name: string }[];

    const playerRow = await db.execute({ sql: `SELECT id, name FROM players WHERE team_id = ? LIMIT 1`, args: [home.id] });
    if (playerRow.rows.length === 0) throw new Error(`no player found for home team ${home.id}`);
    const scorer = playerRow.rows[0] as unknown as { id: string; name: string };

    const adminToken = jwt.sign({ userId: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET!, { expiresIn: '1h' });
    const loggerToken = jwt.sign({ userId: logger.id, email: logger.email, role: 'logger' }, JWT_SECRET!, { expiresIn: '1h' });

    matchId = `realtime-broadcast-${nanoid(8)}`;

    const createRes = await fetch(`${BASE_URL}/api/matches`, {
        method: 'POST', headers: authHeaders(adminToken),
        body: JSON.stringify({
            id: matchId, sport: 'Football', homeTeamId: home.id, awayTeamId: away.id, status: 'LIVE',
            startTime: new Date().toISOString(), venue: 'Realtime Broadcast Test', competition: 'Realtime Broadcast Test',
            matchType: 'friendly',
        }),
    });
    if (createRes.status !== 201) throw new Error(`POST /api/matches expected 201, got ${createRes.status}: ${await createRes.text()}`);
    console.log(`match created: ${matchId}`);

    const assignRes = await fetch(`${BASE_URL}/api/matches/${matchId}/assign-logger`, {
        method: 'POST', headers: authHeaders(adminToken), body: JSON.stringify({ loggerId: logger.id }),
    });
    if (!assignRes.ok) throw new Error(`assign-logger failed: ${assignRes.status} ${await assignRes.text()}`);

    // Connect as a real viewer would -- no auth token needed, this is a public
    // subscription (Flow C is unauthenticated by design).
    const socket = ioClient(WS_URL, { transports: ['websocket'], reconnection: false });

    const eventNewReceived = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`'event:new' not received within ${BROADCAST_TIMEOUT_MS}ms`)), BROADCAST_TIMEOUT_MS);
        socket.on('event:new', (payload: any) => {
            clearTimeout(timer);
            resolve(payload);
        });
    });
    const scoreUpdateReceived = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`'match:score:updated' not received within ${BROADCAST_TIMEOUT_MS}ms`)), BROADCAST_TIMEOUT_MS);
        socket.on('match:score:updated', (payload: any) => {
            clearTimeout(timer);
            resolve(payload);
        });
    });

    await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', (err) => reject(new Error(`socket connect_error: ${err.message}`)));
        setTimeout(() => reject(new Error('socket did not connect within 5s')), 5000);
    });
    console.log('socket connected, subscribing to match room');
    socket.emit('match:subscribe', { matchId });
    // Give the server a moment to process the room join before we trigger the broadcast.
    await new Promise((r) => setTimeout(r, 300));

    const postedAt = Date.now();
    const eventRes = await fetch(`${BASE_URL}/api/matches/${matchId}/events`, {
        method: 'POST', headers: authHeaders(loggerToken),
        body: JSON.stringify({ type: 'Goal', minute: 12, second: 0, teamId: home.id, playerId: scorer.id, detail: `${scorer.name} scores (realtime broadcast test)` }),
    });
    if (!eventRes.ok) throw new Error(`POST event failed: ${eventRes.status} ${await eventRes.text()}`);

    let failures = 0;
    try {
        const eventPayload = await eventNewReceived;
        const elapsedEvent = Date.now() - postedAt;
        if (eventPayload?.matchId === matchId) {
            console.log(`  PASS: 'event:new' received for the correct match within ${elapsedEvent}ms (target: <${BROADCAST_TIMEOUT_MS}ms)`);
        } else {
            failures++;
            console.error(`  FAIL: 'event:new' received but matchId mismatch (got ${eventPayload?.matchId})`);
        }
    } catch (err) {
        failures++;
        console.error(`  FAIL: ${(err as Error).message}`);
    }

    try {
        const scorePayload = await scoreUpdateReceived;
        const elapsedScore = Date.now() - postedAt;
        if (scorePayload?.matchId === matchId && scorePayload?.homeScore === 1) {
            console.log(`  PASS: 'match:score:updated' received (homeScore=1) within ${elapsedScore}ms (target: <${BROADCAST_TIMEOUT_MS}ms)`);
        } else {
            failures++;
            console.error(`  FAIL: 'match:score:updated' payload unexpected: ${JSON.stringify(scorePayload)}`);
        }
    } catch (err) {
        failures++;
        console.error(`  FAIL: ${(err as Error).message}`);
    }

    socket.disconnect();
    await cleanup();

    console.log(`\n=== ${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} assertion(s) failed ===`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
    console.error('\nFAIL: unexpected error:', err);
    await cleanup();
    process.exit(1);
});
