import { createClient } from '@libsql/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Team IDs for each college
const COLLEGE_TEAM_IDS = {
  COLENG:  'k6BgZFG_mtatQ11NZNQb9',
  COLENVS: 'U6R7aZSXNvA0iMsdVi3XV',
  COLMANS: 'ISzKeGGXuvW2h5QGmnWcp',
  COLNAS:  'mhXc8I0hBxe5W6eCw3do9',
};

async function main() {
  console.log('=== PRE-FLIGHT: CURRENT MISMATCHES ===');
  const preflight = await client.execute(`
    SELECT p.name, p.college, pta.team_id AS current_affiliation_team
    FROM players p
    LEFT JOIN player_team_affiliations pta
      ON pta.player_id = p.id AND pta.affiliation_type = 'college'
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
    ORDER BY p.college, p.name
  `);
  console.log(`  Mismatches: ${preflight.rows.length}`);
  for (const r of preflight.rows) {
    console.log(`  ${r.name} | ${r.college} | affiliation: ${r.current_affiliation_team ?? 'NONE'}`);
  }

  // Step 1 — delete wrong affiliation rows (where college and affiliation_team don't match)
  console.log('\n=== STEP 1: DELETE WRONG AFFILIATION ROWS ===');
  const deleteWrong = await client.execute(`
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

  // Step 2 — insert missing COLENG affiliations
  console.log('\n=== STEP 2: INSERT MISSING AFFILIATIONS ===');

  for (const [college, teamId] of Object.entries(COLLEGE_TEAM_IDS)) {
    const result = await client.execute({
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
          WHERE team_id = :teamId
          AND affiliation_type = 'college'
        )
      `,
      args: { college, teamId },
    });
    console.log(`  ${college}: inserted ${result.rowsAffected} rows`);
  }

  // Step 3 — verify: all players with college set should now have matching affiliation
  console.log('\n=== VERIFY: PLAYERS WITH COLLEGE SET ===');
  const verify = await client.execute(`
    SELECT p.name, p.college, pta.team_id, pta.affiliation_type
    FROM players p
    LEFT JOIN player_team_affiliations pta
      ON pta.player_id = p.id AND pta.affiliation_type = 'college'
    WHERE p.college IN ('COLENG','COLENVS','COLMANS','COLNAS')
    ORDER BY p.college, p.name
  `);
  console.log(`  Total rows: ${verify.rows.length}`);
  for (const r of verify.rows) {
    const ok = r.team_id ? '✓' : '✗ MISSING';
    console.log(`  ${ok}  ${r.name} | ${r.college} | team: ${r.team_id ?? 'NONE'}`);
  }

  // Step 4 — check for any remaining mismatches
  console.log('\n=== REMAINING MISMATCHES (should be 0) ===');
  const remaining = await client.execute(`
    SELECT COUNT(*) AS count
    FROM players p
    LEFT JOIN player_team_affiliations pta
      ON pta.player_id = p.id AND pta.affiliation_type = 'college'
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
