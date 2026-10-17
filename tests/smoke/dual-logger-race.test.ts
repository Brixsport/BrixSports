/**
 * Phase 1 (TESTING_STRATEGY_2026-09-18.md): the dual-logger concurrent-write
 * race, codified as a real, repeatable, checked-in script -- CLAUDE.md's own
 * Live Event Readiness Checklist has carried "Two simultaneous loggers do not
 * conflict or overwrite" as an OPEN, never-run item since it was written
 * (BACKLOG-151). This is that test, run for the first time.
 *
 * Correction on this doc's own history, found while building this: the doc
 * describes porting logic from dev/dual-logger-setup.mjs / -race-test.mjs /
 * -cleanup.mjs "per BUILD_JOURNAL.md" -- those three files do not exist
 * anywhere in this repo's git history, and BUILD_JOURNAL.md/BACKLOG.md never
 * mention them by name. What BUILD_JOURNAL.md/BACKLOG.md actually document:
 * BACKLOG-151 itself is still OPEN (broadcastEvent/resolveConflict are
 * no-ops -- a separate, harder feature-work item, not a test-coverage gap),
 * and the concurrent-*write* race this test targets was found and fixed as
 * two related but distinct bugs, neither of which was ever live-fire tested
 * with real concurrent requests before now:
 *   - BUG-196: two concurrent identical event POSTs each inserted a separate
 *     row and each independently incremented the score. Fixed with a 10s
 *     dedup check now run *inside* the same transaction as the insert
 *     (events/route.ts).
 *   - BUG-235: two concurrent *different* events for the same
 *     player/season/competition could both SELECT a null stats row, both
 *     INSERT, and the second throw a unique-constraint violation --
 *     caught and silently swallowed, permanently dropping that player's
 *     stat increment. Fixed with a real atomic DB-level upsert
 *     (onConflictDoUpdate) instead of select-then-insert-or-update.
 * Both fixes' own code comments explicitly note they were never confirmed
 * under genuine concurrency by an automated test. This script is that
 * confirmation, and a regression guard against either fix regressing.
 *
 * Per this project's own convention (see feedback memory: local dev isn't
 * used here), run this against the real staging deployment, not localhost:
 *   BASE_URL=https://staging.brixsports.com npx tsx tests/smoke/dual-logger-race.test.ts
 * Defaults to http://localhost:3000 only for parity with tests/smoke/critical-flows.ts.
 *
 * Requires (.env.local): TURSO_CONNECTION_URL, TURSO_AUTH_TOKEN, JWT_SECRET.
 * Exit code 0 on pass, 1 on any failure.
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { createClient } from '@libsql/client';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

if (!process.env.TURSO_CONNECTION_URL || !process.env.TURSO_AUTH_TOKEN || !JWT_SECRET) {
    console.error('FAIL: missing TURSO_CONNECTION_URL / TURSO_AUTH_TOKEN / JWT_SECRET in env or .env.local');
    process.exit(1);
}

const db = createClient({
    url: process.env.TURSO_CONNECTION_URL!.trim(),
    authToken: process.env.TURSO_AUTH_TOKEN,
});

function authHeaders(token: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    if (BYPASS) headers['x-vercel-protection-bypass'] = BYPASS;
    return headers;
}

let failures = 0;
function reportFail(message: string) {
    failures++;
    console.error(`  FAIL: ${message}`);
}
function reportPass(message: string) {
    console.log(`  PASS: ${message}`);
}

async function main() {
    console.log(`=== Dual-logger concurrent-write race test -- target: ${BASE_URL} ===\n`);

    const adminRow = await db.execute(`SELECT id, email FROM users WHERE role = 'admin' LIMIT 1`);
    if (adminRow.rows.length === 0) throw new Error('no admin user found in DB');
    const admin = adminRow.rows[0] as unknown as { id: string; email: string };

    // Two real loggers if available; a real match day needs at least this
    // many for BACKLOG-151's own scenario to be tested with real distinct
    // accounts. Falls back to one account firing twice if staging only
    // seeded one -- BUG-196/BUG-235's dedup and upsert logic key on
    // (matchId,type,minute,playerId) and (playerId,season,competitionId)
    // respectively, neither of which cares which logger sent the request,
    // so the race itself is still genuinely exercised either way.
    const loggerRows = await db.execute(`SELECT id, email, name FROM loggers LIMIT 2`);
    if (loggerRows.rows.length === 0) throw new Error('no logger account found in DB');
    const loggers = loggerRows.rows as unknown as { id: string; email: string; name: string }[];
    const loggerA = loggers[0];
    const loggerB = loggers[1] ?? loggers[0];
    if (loggers.length < 2) {
        console.warn('  WARN: only one logger account exists in the DB -- simulating dual-logger concurrency with one account firing twice, not two distinct human accounts.');
    }

    // BACKLOG incident, 2026-09-27: this used to SELECT the first 2 real
    // Football teams -- a real, currently-deployed sendMatchEventNotification()
    // fires on every scoring event this test posts, and those two teams had
    // real followers with real registered push subscriptions. Real staging
    // users almost certainly received real "GOAL!" notifications for fake
    // test goals across this session's runs. Fresh synthetic teams/player,
    // created here and deleted in cleanup(), cannot have any followers by
    // construction -- closes this for good.
    const runId = nanoid(6);
    const home = { id: `synthetic-home-${runId}`, name: `Synthetic Home ${runId}` };
    const away = { id: `synthetic-away-${runId}`, name: `Synthetic Away ${runId}` };
    for (const [team, shortName] of [[home, 'SYH'], [away, 'SYA']] as const) {
        await db.execute({
            sql: `INSERT INTO teams (id, name, short_name, logo, university, color, sport) VALUES (?, ?, ?, ?, ?, ?, 'Football')`,
            args: [team.id, team.name, shortName, 'https://placeholder.test/logo.png', 'Synthetic Test University', '#374151'],
        });
    }
    const scorer = { id: `synthetic-player-${runId}`, name: `Synthetic Player ${runId}` };
    await db.execute({
        sql: `INSERT INTO players (id, name, jersey_name, number, team_id, position, university) VALUES (?, ?, ?, 9, ?, 'Forward', 'Synthetic Test University')`,
        args: [scorer.id, scorer.name, scorer.name, home.id],
    });

    // A real, non-friendly competitionId is required for BUG-235's assertion:
    // updatePlayerStats() is skipped entirely for matchType 'friendly'
    // (events/route.ts), and a null competitionId exercises a narrower,
    // separately-documented fallback path (insert-then-recover-on-conflict),
    // not the onConflictDoUpdate atomic path BUG-235 actually fixed.
    const competitionRow = await db.execute(`SELECT id, season FROM competitions LIMIT 1`);
    if (competitionRow.rows.length === 0) throw new Error('no competition found in DB -- cannot exercise the real onConflictDoUpdate stats path');
    const competition = competitionRow.rows[0] as unknown as { id: string; season: string };

    const adminToken = jwt.sign({ userId: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET!, { expiresIn: '1h' });
    const loggerAToken = jwt.sign({ userId: loggerA.id, email: loggerA.email, role: 'logger' }, JWT_SECRET!, { expiresIn: '1h' });
    const loggerBToken = jwt.sign({ userId: loggerB.id, email: loggerB.email, role: 'logger' }, JWT_SECRET!, { expiresIn: '1h' });

    const matchId = `dual-logger-race-${nanoid(8)}`;
    let statsRowId: string | null = null;

    async function cleanup() {
        try {
            await db.execute({ sql: `DELETE FROM football_player_stats WHERE player_id = ? AND season = ? AND competition_id = ?`, args: [scorer.id, competition.season, competition.id] });
            await db.execute({ sql: `DELETE FROM match_events WHERE match_id = ?`, args: [matchId] });
            await db.execute({ sql: `DELETE FROM match_logger_assignments WHERE match_id = ?`, args: [matchId] });
            await db.execute({ sql: `DELETE FROM matches WHERE id = ?`, args: [matchId] });
            await db.execute({ sql: `DELETE FROM players WHERE id = ?`, args: [scorer.id] });
            await db.execute({ sql: `DELETE FROM teams WHERE id = ?`, args: [home.id] });
            await db.execute({ sql: `DELETE FROM teams WHERE id = ?`, args: [away.id] });
            console.log(`\ncleanup: removed throwaway match ${matchId}, synthetic teams/player, and stats row`);
        } catch (err) {
            console.error(`cleanup warning: may need manual cleanup for ${matchId}:`, err);
        }
    }

    try {
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
                venue: 'Dual-Logger Race Test Venue',
                competition: 'Dual-Logger Race Test',
                competitionId: competition.id,
                matchType: 'league', // must NOT be 'friendly' -- see comment above
            }),
        });
        if (createRes.status !== 201) throw new Error(`POST /api/matches expected 201, got ${createRes.status}: ${await createRes.text()}`);
        console.log(`match created: ${matchId}\n`);

        for (const [loggerId, token] of [[loggerA.id, loggerAToken], [loggerB.id, loggerBToken]] as const) {
            const assignRes = await fetch(`${BASE_URL}/api/matches/${matchId}/assign-logger`, {
                method: 'POST',
                headers: authHeaders(adminToken),
                body: JSON.stringify({ loggerId, role: loggerId === loggerA.id ? 'primary' : 'secondary' }),
            });
            // A duplicate assignment (loggerA === loggerB fallback case) correctly 409s -- not a failure.
            if (!assignRes.ok && assignRes.status !== 409) {
                throw new Error(`assign-logger for ${loggerId} expected 2xx/409, got ${assignRes.status}: ${await assignRes.text()}`);
            }
        }
        console.log('both loggers assigned\n');

        // ---- Scenario A: two concurrent IDENTICAL events (BUG-196) ----
        console.log('--- Scenario A: identical concurrent duplicate submissions ---');
        const duplicateBody = JSON.stringify({
            type: 'Goal',
            minute: 15,
            second: 0,
            teamId: home.id,
            playerId: scorer.id,
            detail: `${scorer.name} scores (dual-logger race test, scenario A)`,
        });
        const [respA1, respA2] = await Promise.all([
            fetch(`${BASE_URL}/api/matches/${matchId}/events`, { method: 'POST', headers: authHeaders(loggerAToken), body: duplicateBody }),
            fetch(`${BASE_URL}/api/matches/${matchId}/events`, { method: 'POST', headers: authHeaders(loggerBToken), body: duplicateBody }),
        ]);
        if (!respA1.ok || !respA2.ok) {
            throw new Error(`Scenario A: both concurrent POSTs should succeed (one as a fresh insert, one as a dedup-hit) -- got ${respA1.status} and ${respA2.status}`);
        }
        const bodyA1 = await respA1.json();
        const bodyA2 = await respA2.json();
        const oneWasDedupHit = bodyA1.message?.includes('Duplicate submission ignored') || bodyA2.message?.includes('Duplicate submission ignored');
        if (oneWasDedupHit) {
            reportPass('exactly one of the two concurrent identical POSTs was recognized as a duplicate at the HTTP layer');
        } else {
            console.warn('  WARN: neither response reported a dedup hit -- checking DB row count directly (the dedup check runs inside the transaction, both requests may have raced the same not-yet-committed window either way)');
        }

        const eventCountA = await db.execute({
            sql: `SELECT COUNT(*) as c FROM match_events WHERE match_id = ? AND type = 'Goal' AND minute = 15 AND player_id = ?`,
            args: [matchId, scorer.id],
        });
        const rowCountA = Number((eventCountA.rows[0] as any).c);
        if (rowCountA === 1) {
            reportPass(`exactly 1 match_events row exists for the duplicate submission (not 2) -- DB-confirmed`);
        } else {
            reportFail(`expected exactly 1 match_events row for the duplicate goal, found ${rowCountA} -- BUG-196 regression`);
        }

        const matchAfterA = await db.execute({ sql: `SELECT home_score FROM matches WHERE id = ?`, args: [matchId] });
        const homeScoreAfterA = Number((matchAfterA.rows[0] as any).home_score);
        if (homeScoreAfterA === 1) {
            reportPass(`home score incremented by exactly 1 (not 2) after the duplicate submission -- DB-confirmed`);
        } else {
            reportFail(`expected home_score = 1 after one real goal (duplicate should not double-count), got ${homeScoreAfterA} -- BUG-196 regression`);
        }

        // ---- Scenario B: two concurrent DIFFERENT events, same player (BUG-235) ----
        console.log('\n--- Scenario B: concurrent different-event stat race ---');
        const [respB1, respB2] = await Promise.all([
            fetch(`${BASE_URL}/api/matches/${matchId}/events`, {
                method: 'POST',
                headers: authHeaders(loggerAToken),
                body: JSON.stringify({ type: 'Goal', minute: 30, second: 0, teamId: home.id, playerId: scorer.id, detail: 'scenario B goal 1' }),
            }),
            fetch(`${BASE_URL}/api/matches/${matchId}/events`, {
                method: 'POST',
                headers: authHeaders(loggerBToken),
                body: JSON.stringify({ type: 'Goal', minute: 35, second: 0, teamId: home.id, playerId: scorer.id, detail: 'scenario B goal 2' }),
            }),
        ]);
        if (!respB1.ok || !respB2.ok) {
            throw new Error(`Scenario B: both concurrent POSTs (different minutes) should succeed as two distinct events -- got ${respB1.status} and ${respB2.status}`);
        }

        // Player-stats writes happen after the HTTP response is sent for some
        // paths in this route -- give the DB a brief moment before reading it
        // back, same pattern critical-flows.ts uses for the broadcast side.
        await new Promise((r) => setTimeout(r, 1500));

        const statsRow = await db.execute({
            sql: `SELECT id, goals FROM football_player_stats WHERE player_id = ? AND season = ? AND competition_id = ?`,
            args: [scorer.id, competition.season, competition.id],
        });
        if (statsRow.rows.length === 0) {
            reportFail(`expected a football_player_stats row for ${scorer.id}/${competition.season}/${competition.id} after 2 concurrent goals, found none`);
        } else {
            statsRowId = (statsRow.rows[0] as any).id as string;
            const goals = Number((statsRow.rows[0] as any).goals);
            // 3, not 2: Scenario A's own (deduped-to-one) goal already incremented
            // this same player/season/competition's stats row before Scenario B
            // ran, since both scenarios deliberately reuse the same scorer so
            // Scenario B's race targets the exact row Scenario A already touched.
            if (goals === 3) {
                reportPass(`player_stats.goals = 3 (1 from Scenario A + 2 from Scenario B, neither increment lost) -- DB-confirmed, BUG-235 fix holds`);
            } else {
                reportFail(`expected player_stats.goals = 3 (1 from Scenario A + 2 concurrent from Scenario B), got ${goals} -- BUG-235 regression (a concurrent write was silently dropped)`);
            }
        }

        const eventCountB = await db.execute({ sql: `SELECT COUNT(*) as c FROM match_events WHERE match_id = ? AND type = 'Goal' AND player_id = ?`, args: [matchId, scorer.id] });
        const totalGoalEvents = Number((eventCountB.rows[0] as any).c);
        if (totalGoalEvents === 3) { // 1 from Scenario A + 2 from Scenario B
            reportPass(`3 total distinct Goal events recorded across both scenarios -- DB-confirmed`);
        } else {
            reportFail(`expected 3 total Goal event rows (1 from Scenario A + 2 from Scenario B), found ${totalGoalEvents}`);
        }

        await cleanup();

        console.log(`\n=== ${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} assertion(s) failed ===`);
        process.exit(failures === 0 ? 0 : 1);
    } catch (err) {
        console.error('\nFAIL: unexpected error:', err);
        await cleanup();
        process.exit(1);
    }
}

main();
