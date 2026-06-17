import { config } from 'dotenv';
import { createClient } from '@libsql/client';

config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const COLLEGE_TEAM_MAP = {
  COLNAS: 'mhXc8I0hBxe5W6eCw3do9',
  COLENG: 'k6BgZFG_mtatQ11NZNQb9',
  COLMANS: 'ISzKeGGXuvW2h5QGmnWcp',
  COLENVS: 'U6R7aZSXNvA0iMsdVi3XV',
};

// 1 — Total Bells students
const total = await client.execute(`
  SELECT COUNT(*) as count FROM players
  WHERE university = 'Bells University of Technology'
`);
console.log(`\n=== TOTAL BELLS STUDENTS ===`);
console.log(`  ${total.rows[0].count}`);

// 2 — Bells students by college
const byCollege = await client.execute(`
  SELECT COALESCE(college, 'NULL (no college set)') as college, COUNT(*) as count
  FROM players
  WHERE university = 'Bells University of Technology'
  GROUP BY college
  ORDER BY count DESC
`);
console.log(`\n=== BELLS STUDENTS BY COLLEGE ===`);
byCollege.rows.forEach(r => console.log(`  ${r.college}: ${r.count}`));

// 3 — Non-Bells players
const nonBells = await client.execute(`
  SELECT COUNT(*) as count FROM players
  WHERE university != 'Bells University of Technology'
  OR university IS NULL
`);
console.log(`\n=== NON-BELLS PLAYERS ===`);
console.log(`  ${nonBells.rows[0].count}`);

// 4 — College affiliation mismatch:
//     Bells students with college set but NO active affiliation to the correct college team
const mismatch = await client.execute(`
  SELECT p.id, p.name, p.college,
         pta.team_id as current_college_team_id,
         pta.is_active
  FROM players p
  LEFT JOIN player_team_affiliations pta
    ON pta.player_id = p.id
    AND pta.affiliation_type = 'college'
    AND pta.is_active = 1
  WHERE p.university = 'Bells University of Technology'
  AND p.college IN ('COLNAS', 'COLENG', 'COLMANS', 'COLENVS')
  AND (
    pta.team_id IS NULL
    OR pta.team_id != CASE p.college
      WHEN 'COLNAS'  THEN 'mhXc8I0hBxe5W6eCw3do9'
      WHEN 'COLENG'  THEN 'k6BgZFG_mtatQ11NZNQb9'
      WHEN 'COLMANS' THEN 'ISzKeGGXuvW2h5QGmnWcp'
      WHEN 'COLENVS' THEN 'U6R7aZSXNvA0iMsdVi3XV'
    END
  )
  ORDER BY p.college, p.name
`);
console.log(`\n=== COLLEGE AFFILIATION MISMATCHES (college set but wrong/missing affiliation row) ===`);
console.log(`  Count: ${mismatch.rows.length}`);
mismatch.rows.forEach(r =>
  console.log(`  ${r.name} | college: ${r.college} | current_affiliation_team: ${r.current_college_team_id ?? 'NONE'}`)
);

// 5 — Summary
console.log(`\n=== SUMMARY ===`);
console.log(`  Total Bells students:         ${total.rows[0].count}`);
console.log(`  Non-Bells players:            ${nonBells.rows[0].count}`);
console.log(`  Affiliation mismatches:       ${mismatch.rows.length}`);
