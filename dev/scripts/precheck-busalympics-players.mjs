import { createClient } from '@libsql/client';
import { config } from 'dotenv';
config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const CANDIDATES = [
  // 10 already profiled but missing affiliation (from diagnostic)
  { name: 'Chris',   college: 'COLENG',  note: 'already profiled' },
  { name: 'Effiong', college: 'COLENG',  note: 'already profiled' },
  { name: 'Enoch',   college: 'COLENG',  note: 'already profiled' },
  { name: 'LUCKY',   college: 'COLENVS', note: 'already profiled' },
  { name: 'Lekan',   college: 'COLENVS', note: 'already profiled' },
  { name: 'Shaphan', college: 'COLENVS', note: 'already profiled' },
  { name: 'Small',   college: 'COLENVS', note: 'already profiled' },
  { name: 'Alex',    college: 'COLNAS',  note: 'already profiled' },
  { name: 'Bruno',   college: 'COLNAS',  note: 'already profiled' },
  { name: 'Smart',   college: 'COLNAS',  note: 'already profiled' },

  // COLENVS new batch
  { name: 'Lyta',      college: 'COLENVS', note: '' },
  { name: 'AWAL',      college: 'COLENVS', note: '' },
  { name: 'KELE',      college: 'COLENVS', note: '' },
  { name: 'SOMI',      college: 'COLENVS', note: '' },
  { name: 'Jomi',      college: 'COLENVS', note: '' },
  { name: 'TOJU',      college: 'COLENVS', note: 'wolves busa player — likely exists' },
  { name: 'edidem',    college: 'COLENVS', note: '' },
  { name: 'kelly',     college: 'COLENVS', note: '' },
  { name: 'andrew',    college: 'COLENVS', note: '' },
  { name: 'marvelous', college: 'COLENVS', note: '' },
  { name: 'nash',      college: 'COLENVS', note: '' },

  // COLMANS new batch
  { name: 'Segun',       college: 'COLMANS', note: '' },
  { name: 'Ebube',       college: 'COLMANS', note: '' },
  { name: 'Justin',      college: 'COLMANS', note: '' },
  { name: 'Tisco Jr',    college: 'COLMANS', note: '' },
  { name: 'Tariq',       college: 'COLMANS', note: '' },
  { name: 'Abdulkabir',  college: 'COLMANS', note: '' },
  { name: 'Otis',        college: 'COLMANS', note: '' },
  { name: 'Dami',        college: 'COLMANS', note: '' },
  { name: 'Jilani',      college: 'COLMANS', note: '' },
];

console.log('=== BUSALYMPICS PLAYER PRE-CHECK ===\n');
console.log('Legend: ✓ FOUND | ✗ NOT FOUND | ⚠ COLLEGE MISMATCH\n');

const results = { found: [], notFound: [], mismatch: [] };

for (const candidate of CANDIDATES) {
  const rows = await client.execute({
    sql: `
      SELECT p.id, p.name, p.college, p.university, p.number,
             GROUP_CONCAT(t.name, ' / ') as teams
      FROM players p
      LEFT JOIN player_team_affiliations pta ON pta.player_id = p.id AND pta.affiliation_type = 'team'
      LEFT JOIN teams t ON t.id = pta.team_id
      WHERE LOWER(TRIM(p.name)) LIKE LOWER(TRIM(:name))
         OR LOWER(TRIM(p.jersey_name)) LIKE LOWER(TRIM(:name))
      GROUP BY p.id
    `,
    args: { name: `%${candidate.name.trim()}%` },
  });

  if (rows.rows.length === 0) {
    console.log(`  ✗ NOT FOUND   ${candidate.name.padEnd(14)} → needs new profile  [${candidate.college}]${candidate.note ? '  (' + candidate.note + ')' : ''}`);
    results.notFound.push(candidate);
  } else {
    for (const r of rows.rows) {
      const collegeMismatch = r.college && r.college !== candidate.college;
      const icon = collegeMismatch ? '⚠ MISMATCH   ' : '✓ FOUND      ';
      console.log(`  ${icon}${candidate.name.padEnd(14)} → id: ${r.id}`);
      console.log(`               name: ${r.name} | college: ${r.college ?? 'NULL'} | teams: ${r.teams ?? 'none'}`);
      if (collegeMismatch) {
        console.log(`               ⚠  DB has college=${r.college}, you said ${candidate.college} — verify!`);
        results.mismatch.push({ candidate, found: r });
      } else {
        results.found.push({ candidate, found: r });
      }
    }
  }
}

console.log('\n=== SUMMARY ===');
console.log(`  Already in DB (college matches): ${results.found.length}`);
console.log(`  Already in DB (college mismatch — verify!): ${results.mismatch.length}`);
console.log(`  Not found — need new profile: ${results.notFound.length}`);

if (results.notFound.length > 0) {
  console.log('\n=== PLAYERS NEEDING NEW PROFILE ===');
  for (const p of results.notFound) {
    console.log(`  ${p.college.padEnd(8)} ${p.name}`);
  }
}

process.exit(0);
