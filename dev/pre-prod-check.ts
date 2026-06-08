/**
 * dev/pre-prod-check.ts
 * ─────────────────────────────────────────────────────────────────
 * BrixSports — Automated Pre-Prod Clearance Script
 *
 * Run before EVERY PR merge to main:
 *   npx tsx dev/pre-prod-check.ts
 *
 * Reads TURSO_CONNECTION_URL and NEXT_PUBLIC_APP_URL from .env.local.
 * No hardcoded URLs, tokens, or secrets — see security.md.
 *
 * Exit 0 → CLEAR TO MERGE
 * Exit 1 → BLOCKED — fix failures before merging
 * ─────────────────────────────────────────────────────────────────
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@libsql/client';

// ── Config ────────────────────────────────────────────────────────

const DB_URL  = process.env.TURSO_CONNECTION_URL;
const DB_AUTH = process.env.TURSO_AUTH_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

if (!DB_URL || !DB_AUTH) {
  console.error('TURSO_CONNECTION_URL or TURSO_AUTH_TOKEN missing from .env.local');
  process.exit(1);
}
if (!APP_URL) {
  console.error('NEXT_PUBLIC_APP_URL missing from .env.local — needed for HTTP checks');
  process.exit(1);
}

const db = createClient({ url: DB_URL, authToken: DB_AUTH });

// Hostname only — no token in output
const dbHost = new URL(DB_URL).hostname;

// ── Types / helpers ───────────────────────────────────────────────

type CheckResult = { label: string; pass: boolean; detail: string };
const results: CheckResult[] = [];

function pass(label: string, detail: string) {
  results.push({ label, pass: true, detail });
  console.log(`  [PASS] ${label}${detail ? ' — ' + detail : ''}`);
}

function fail(label: string, detail: string) {
  results.push({ label, pass: false, detail });
  console.log(`  [FAIL] ${label} — ${detail}`);
}

async function dbCount(sql: string): Promise<number> {
  const r = await db.execute(sql);
  return Number(Object.values(r.rows[0] ?? {})[0] ?? -1);
}

// ── BLOCK 1 — Auth Gates (unauthenticated HTTP) ───────────────────

async function block1() {
  console.log('\nBLOCK 1 — Auth Gates\n');

  // Need a real match ID for the PATCH check
  const matchRow = await db.execute(`SELECT id FROM matches LIMIT 1`);
  const matchId = (matchRow.rows[0] as any)?.id ?? 'unknown';

  const endpoints: { label: string; method: string; path: string }[] = [
    { label: 'POST /api/competitions',             method: 'POST',  path: '/api/competitions' },
    { label: `PATCH /api/matches/${matchId}`,      method: 'PATCH', path: `/api/matches/${matchId}` },
    { label: 'POST /api/notifications/subscribe',  method: 'POST',  path: '/api/notifications/subscribe' },
    { label: 'GET /api/analytics/loggers',         method: 'GET',   path: '/api/analytics/loggers' },
    { label: 'GET /api/admin/infrastructure',      method: 'GET',   path: '/api/admin/infrastructure' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${APP_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
      });
      if (res.status === 401) {
        pass(ep.label, `→ 401`);
      } else {
        fail(ep.label, `got ${res.status} (expected 401)`);
      }
    } catch (e: any) {
      fail(ep.label, `fetch error: ${e.message}`);
    }
  }
}

// ── BLOCK 2 — Response Shape (GET /api/matches) ───────────────────

async function block2() {
  console.log('\nBLOCK 2 — Response Shape\n');

  try {
    const res = await fetch(`${APP_URL}/api/matches`, { redirect: 'follow' });
    if (res.status !== 200) {
      fail('GET /api/matches', `unexpected status ${res.status}`);
      return;
    }

    const body = await res.json() as any;
    const matches: any[] = Array.isArray(body)
      ? body
      : body?.matches ?? body?.data ?? [];

    if (matches.length === 0) {
      fail('GET /api/matches', 'empty response — no matches returned');
      return;
    }

    const m = matches[0];

    // round key must exist (value may be null — that's fine)
    if ('round' in m) {
      pass('round field present', `value="${m.round}"`);
    } else {
      fail('round field present', 'key missing from response');
    }

    // Banned fields must not be present on ANY match
    const banned = ['loggerId', 'assignedLoggers', 'approvalStatus', 'managerNotes', 'approvedBy', 'approvedAt'];
    for (const field of banned) {
      const leaking = matches.filter(x => field in x);
      if (leaking.length === 0) {
        pass(`${field} absent`, `checked ${matches.length} matches`);
      } else {
        fail(`${field} absent`, `found on ${leaking.length} match(es) — e.g. id=${leaking[0].id}`);
      }
    }
  } catch (e: any) {
    fail('GET /api/matches', `error: ${e.message}`);
  }
}

// ── BLOCK 3 — DB Integrity ────────────────────────────────────────

async function block3() {
  console.log('\nBLOCK 3 — DB Integrity\n');

  const checks: { label: string; sql: string; expected: string; test: (n: number) => boolean }[] = [
    {
      label: 'matches without competitionId',
      sql: `SELECT COUNT(*) FROM matches WHERE competition_id IS NULL`,
      expected: '0',
      test: n => n === 0,
    },
    {
      label: 'matches with dirty " - " competition string',
      sql: `SELECT COUNT(*) FROM matches WHERE competition LIKE '% - %'`,
      expected: '0',
      test: n => n === 0,
    },
    {
      label: 'competition_team_entries rows',
      sql: `SELECT COUNT(*) FROM competition_team_entries`,
      expected: '>= 4',
      test: n => n >= 4,
    },
    {
      label: 'competitions total',
      sql: `SELECT COUNT(*) FROM competitions`,
      expected: '>= 5',
      test: n => n >= 5,
    },
  ];

  for (const c of checks) {
    try {
      const n = await dbCount(c.sql);
      if (c.test(n)) {
        pass(c.label, `${n} (expected ${c.expected})`);
      } else {
        fail(c.label, `${n} (expected ${c.expected})`);
      }
    } catch (e: any) {
      fail(c.label, `query error: ${e.message}`);
    }
  }
}

// ── BLOCK 4 — Round Distribution ─────────────────────────────────

async function block4() {
  console.log('\nBLOCK 4 — Round Distribution\n');

  try {
    const r = await db.execute(`
      SELECT round, COUNT(*) as count
      FROM matches
      WHERE round IS NOT NULL
      GROUP BY round
      ORDER BY count DESC
    `);

    if (r.rows.length === 0) {
      fail('round distribution', 'no matches have round set — normalisation may not have run');
      return;
    }

    console.log('  Round values in DB:');
    let hasRawDash = false;
    for (const row of r.rows) {
      const roundVal = String(row.round ?? '');
      const cnt = row.count ?? row['COUNT(*)'];
      console.log(`    ${roundVal}: ${cnt}`);
      if (roundVal.includes(' - ')) hasRawDash = true;
    }

    const nullCount = await dbCount(`SELECT COUNT(*) FROM matches WHERE round IS NULL`);
    if (nullCount > 0) {
      fail('no null rounds', `${nullCount} matches still have NULL round`);
    } else {
      pass('no null rounds', 'all matches have round set');
    }

    if (hasRawDash) {
      fail('no raw " - " in round values', 'one or more round strings contain " - " — normalisation incomplete');
    } else {
      pass('no raw " - " in round values', 'round strings are clean');
    }
  } catch (e: any) {
    fail('round distribution', `query error: ${e.message}`);
  }
}

// ── BLOCK 5 — New Competitions Present ───────────────────────────

async function block5() {
  console.log('\nBLOCK 5 — New Competitions Present\n');

  const expected = ['NPUGA (FOOTBALL)', 'BUSALYMPICS (BASKETBALL)'];
  try {
    const r = await db.execute(`
      SELECT name, sport FROM competitions
      WHERE name IN ('NPUGA (FOOTBALL)', 'BUSALYMPICS (BASKETBALL)')
    `);
    const found = r.rows.map((row: any) => row.name as string);
    for (const name of expected) {
      if (found.includes(name)) {
        pass(name, 'present');
      } else {
        fail(name, 'NOT FOUND in competitions table');
      }
    }
  } catch (e: any) {
    for (const name of expected) fail(name, `query error: ${e.message}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('=== PRE-PROD CLEARANCE CHECK ===');
  console.log(`DB:  ${dbHost}`);
  console.log(`App: ${APP_URL}`);

  await block1();
  await block2();
  await block3();
  await block4();
  await block5();

  const total  = results.length;
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass);

  console.log(`\n=== RESULT: ${passed}/${total} CHECKS PASSED ===\n`);

  if (failed.length === 0) {
    console.log('[CLEAR TO MERGE]');
    process.exit(0);
  } else {
    console.log('[BLOCKED — fix before merging]\n');
    console.log('Failures:');
    failed.forEach(f => console.log(`  ✗ ${f.label}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
