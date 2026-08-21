import { createClient } from '@libsql/client';
import { config } from 'dotenv';

// Load both envs manually — dotenv only supports one at a time
import { readFileSync } from 'fs';

function loadEnv(path) {
  const vars = {};
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    vars[key] = val;
  }
  return vars;
}

const stagingEnv = loadEnv('.env.local');
const prodEnv = loadEnv('.env.production');

const staging = createClient({
  url: stagingEnv.TURSO_CONNECTION_URL,
  authToken: stagingEnv.TURSO_AUTH_TOKEN,
});

const prod = createClient({
  url: prodEnv.TURSO_CONNECTION_URL,
  authToken: prodEnv.TURSO_AUTH_TOKEN,
});

const COLLEGE_TEAM_IDS = {
  COLENG:  'k6BgZFG_mtatQ11NZNQb9',
  COLENVS: 'U6R7aZSXNvA0iMsdVi3XV',
  COLMANS: 'ISzKeGGXuvW2h5QGmnWcp',
  COLNAS:  'mhXc8I0hBxe5W6eCw3do9',
};

async function main() {
  // Step 1 — get staging ground truth (all players with college set)
  const stagingPlayers = await staging.execute(`
    SELECT id, name, college
    FROM players
    WHERE college IN ('COLENG','COLENVS','COLMANS','COLNAS')
  `);
  console.log(`=== STAGING: ${stagingPlayers.rows.length} players with college set ===`);

  // Step 2 — get prod current college values for those player IDs
  const ids = stagingPlayers.rows.map(r => `'${r.id}'`).join(',');
  const prodPlayers = await prod.execute(`
    SELECT id, name, college FROM players WHERE id IN (${ids})
  `);
  const prodMap = new Map(prodPlayers.rows.map(r => [r.id, r.college]));

  // Step 3 — diff: find players where staging has college set but prod differs
  const toUpdate = stagingPlayers.rows.filter(r => prodMap.get(r.id) !== r.college);
  console.log(`\n=== DELTA: ${toUpdate.length} players need college field update on prod ===`);
  for (const r of toUpdate) {
    console.log(`  ${r.name} | staging: ${r.college} | prod: ${prodMap.get(r.id) ?? 'NULL'}`);
  }

  if (toUpdate.length === 0) {
    console.log('  No college field updates needed on prod.');
  } else {
    // Step 4 — update prod college fields
    console.log('\n=== STEP 4: UPDATING PROD COLLEGE FIELDS ===');
    for (const r of toUpdate) {
      const res = await prod.execute({
        sql: `UPDATE players SET college = :college WHERE id = :id`,
        args: { college: r.college, id: r.id },
      });
      console.log(`  ${r.name} → ${r.college} (rowsAffected: ${res.rowsAffected})`);
    }
  }

  // Step 5 — fix any wrong affiliation rows on prod (safety net)
  console.log('\n=== STEP 5: DELETE WRONG AFFILIATION ROWS ON PROD ===');
  const deleteWrong = await prod.execute(`
    DELETE FROM player_team_affiliations
    WHERE affiliation_type = 'college'
    AND player_id IN (SELECT id FROM players WHERE college IN ('COLENG','COLENVS','COLMANS','COLNAS'))
    AND team_id != CASE (SELECT college FROM players WHERE id = player_id)
      WHEN 'COLENG'  THEN 'k6BgZFG_mtatQ11NZNQb9'
      WHEN 'COLENVS' THEN 'U6R7aZSXNvA0iMsdVi3XV'
      WHEN 'COLMANS' THEN 'ISzKeGGXuvW2h5QGmnWcp'
      WHEN 'COLNAS'  THEN 'mhXc8I0hBxe5W6eCw3do9'
    END
  `);
  console.log(`  Deleted wrong rows: ${deleteWrong.rowsAffected}`);

  // Step 6 — insert missing affiliation rows on prod
  console.log('\n=== STEP 6: INSERT MISSING AFFILIATION ROWS ON PROD ===');
  for (const [college, teamId] of Object.entries(COLLEGE_TEAM_IDS)) {
    const result = await prod.execute({
      sql: `
        INSERT INTO player_team_affiliations (id, player_id, team_id, affiliation_type, role, status, is_primary, is_active, start_date, nicknames, created_at)
        SELECT
          'pta-' || LOWER(:college) || '-' || CAST(p.rowid AS TEXT) || '-' || CAST(strftime('%s','now') AS TEXT),
          p.id,
          :teamId,
          'college', 'player', 'active', 0, 1,
          CAST(strftime('%s','now') AS INTEGER),
          '[]',
          CAST(strftime('%s','now') AS INTEGER)
        FROM players p
        WHERE p.college = :college
        AND p.id NOT IN (
          SELECT player_id FROM player_team_affiliations
          WHERE team_id = :teamId AND affiliation_type = 'college'
        )
      `,
      args: { college, teamId },
    });
    console.log(`  ${college}: inserted ${result.rowsAffected} rows`);
  }

  // Step 7 — verify prod: 0 remaining mismatches
  console.log('\n=== STEP 7: PROD VERIFY ===');
  const verify = await prod.execute(`
    SELECT p.name, p.college, pta.team_id
    FROM players p
    LEFT JOIN player_team_affiliations pta ON pta.player_id = p.id AND pta.affiliation_type = 'college'
    WHERE p.college IN ('COLENG','COLENVS','COLMANS','COLNAS')
    ORDER BY p.college, p.name
  `);
  console.log(`  Total players with college set: ${verify.rows.length}`);
  let misses = 0;
  for (const r of verify.rows) {
    if (!r.team_id) { console.log(`  ✗ MISSING  ${r.name} | ${r.college}`); misses++; }
  }
  if (misses === 0) console.log('  All ✓ — 0 missing affiliations');

  const remaining = await prod.execute(`
    SELECT COUNT(*) AS count
    FROM players p
    LEFT JOIN player_team_affiliations pta ON pta.player_id = p.id AND pta.affiliation_type = 'college'
    WHERE p.college IN ('COLENG','COLENVS','COLMANS','COLNAS')
    AND (
      pta.team_id IS NULL
      OR pta.team_id != CASE p.college
        WHEN 'COLENG'  THEN 'k6BgZFG_mtatQ11NZNQb9'
        WHEN 'COLENVS' THEN 'U6R7aZSXNvA0iMsdVi3XV'
        WHEN 'COLMANS' THEN 'ISzKeGGXuvW2h5QGmnWcp'
        WHEN 'COLNAS'  THEN 'mhXc8I0hBxe5W6eCw3do9'
      END
    )
  `);
  console.log(`  Remaining mismatches: ${remaining.rows[0].count}`);

  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
