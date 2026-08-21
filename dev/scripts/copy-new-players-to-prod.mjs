import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

function loadEnv(path) {
  const vars = {};
  readFileSync(path, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const idx = t.indexOf('=');
    if (idx === -1) return;
    vars[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  });
  return vars;
}

const stagingEnv = loadEnv('.env.local');
const prodEnv = loadEnv('.env.production');

const staging = createClient({ url: stagingEnv.TURSO_CONNECTION_URL, authToken: stagingEnv.TURSO_AUTH_TOKEN });
const prod    = createClient({ url: prodEnv.TURSO_CONNECTION_URL,    authToken: prodEnv.TURSO_AUTH_TOKEN });

// The 30 player IDs that exist on staging but not prod
// (10 already-profiled + 20 new BUSALYMPICS profiles, all created_at > 1781690000 with college set)
const TARGET_IDS = [
  // 10 already-profiled (Chris, Effiong, Enoch, LUCKY, Lekan, Shaphan, Small, Alex, Bruno, Smart)
  'player-1781698667931-d2a26otet', // Chris
  'player-1781698195362-6cgc989di', // Effiong
  'player-1781698547988-isbphrz0z', // Enoch
  'player-1781703316692-efmzlndp0', // LUCKY
  'player-1781703436157-whw3b76dr', // Lekan
  'player-1781703573455-1wh2wb8qi', // Shaphan
  'player-1781702989770-ppkxglg8n', // Small
  'player-1781698817968-h5y5e0pdr', // Alex
  'player-1781698762598-o88hdtv23', // Bruno
  'player-1781698904643-n9xrxznce', // Smart
  // 20 new BUSALYMPICS profiles
  'player-1781705577346-1g2ogxofh', // Lyta
  'player-1781705586460-mtdphjv1d', // AWAL
  'player-1781705588544-5c2xa4e3q', // KELE
  'player-1781705590470-83wn1byyq', // SOMI
  'player-1781705594575-qo7pp5wcx', // Jomi
  'player-1781705596425-i3gt2kden', // TOJU (+ Wolves FC)
  'player-1781705599480-4ljpepf6n', // edidem
  'player-1781705601661-z31vpj2jh', // kelly
  'player-1781705603736-4mzcodfhq', // andrew
  'player-1781705605543-5c2zdbrnj', // marvelous
  'player-1781705607685-vzdmkz63t', // nash
  'player-1781705609511-4rvutvgwi', // Segun
  'player-1781705611545-n96k7pjkh', // Ebube
  'player-1781705613196-n2cokp958', // Justin
  'player-1781705615163-urui55vxo', // Tisco Jr
  'player-1781705617137-9y4gbnhb3', // Tariq
  'player-1781705619042-k93cjn6os', // Abdulkabir
  'player-1781705621005-lr5d7l0lx', // Otis
  'player-1781705623045-4l2nixjf7', // Dami
  'player-1781705624835-qanjjuxwk', // Jilani
];

async function main() {
  // Step 1 — fetch full player rows from staging
  const idList = TARGET_IDS.map(id => `'${id}'`).join(',');
  const stagingPlayers = await staging.execute(`
    SELECT id, name, jersey_name, number, team_id, position, rating, eye_points,
           age, height, weight, nationality, college, department, university,
           is_external, image, market_value, profile_id, email, attributes, created_at
    FROM players WHERE id IN (${idList})
  `);
  console.log(`=== FETCHED ${stagingPlayers.rows.length} PLAYERS FROM STAGING ===\n`);

  // Step 2 — check which IDs already exist on prod (skip to avoid constraint errors)
  const prodExisting = await prod.execute(`SELECT id FROM players WHERE id IN (${idList})`);
  const existingIds = new Set(prodExisting.rows.map(r => r.id));
  console.log(`Already on prod: ${existingIds.size} (will skip)`);

  // Step 3 — insert missing players into prod
  console.log('\n=== INSERTING PLAYERS INTO PROD ===');
  let inserted = 0;
  for (const p of stagingPlayers.rows) {
    if (existingIds.has(p.id)) {
      console.log(`  SKIP  ${p.name} (already on prod)`);
      continue;
    }
    await prod.execute({
      sql: `INSERT INTO players (id, name, jersey_name, number, team_id, position, rating, eye_points,
              age, height, weight, nationality, college, department, university,
              is_external, image, market_value, profile_id, email, attributes, created_at)
            VALUES (:id,:name,:jerseyName,:number,:teamId,:position,:rating,:eyePoints,
              :age,:height,:weight,:nationality,:college,:department,:university,
              :isExternal,:image,:marketValue,:profileId,:email,:attributes,:createdAt)`,
      args: {
        id: p.id, name: p.name, jerseyName: p.jersey_name, number: p.number,
        teamId: p.team_id ?? null, position: p.position ?? '',
        rating: p.rating ?? 7, eyePoints: p.eye_points ?? 0,
        age: p.age ?? null, height: p.height ?? null, weight: p.weight ?? null,
        nationality: p.nationality ?? null, college: p.college ?? null,
        department: p.department ?? null, university: p.university ?? null,
        isExternal: p.is_external ?? 0, image: p.image ?? null,
        marketValue: p.market_value ?? null, profileId: p.profile_id ?? null,
        email: p.email ?? null, attributes: p.attributes ?? null,
        createdAt: p.created_at,
      },
    });
    console.log(`  ✓  ${p.name.padEnd(14)} [${p.college ?? 'NULL'}]`);
    inserted++;
  }
  console.log(`\n  Inserted: ${inserted} players`);

  // Step 4 — fetch all affiliation rows for these players from staging
  const stagingAff = await staging.execute(`
    SELECT id, player_id, team_id, affiliation_type, role, status,
           is_primary, is_active, start_date, nicknames, created_at
    FROM player_team_affiliations
    WHERE player_id IN (${idList})
  `);
  console.log(`\n=== INSERTING ${stagingAff.rows.length} AFFILIATION ROWS INTO PROD ===`);

  // Check which affiliation IDs already exist on prod
  const affIds = stagingAff.rows.map(r => `'${r.id}'`).join(',');
  let existingAffIds = new Set();
  if (affIds.length > 0) {
    const prodAff = await prod.execute(`SELECT id FROM player_team_affiliations WHERE id IN (${affIds})`);
    existingAffIds = new Set(prodAff.rows.map(r => r.id));
  }

  let affInserted = 0;
  for (const a of stagingAff.rows) {
    if (existingAffIds.has(a.id)) { console.log(`  SKIP  ${a.id} (exists)`); continue; }
    await prod.execute({
      sql: `INSERT INTO player_team_affiliations (id, player_id, team_id, affiliation_type, role, status,
              is_primary, is_active, start_date, nicknames, created_at)
            VALUES (:id,:playerId,:teamId,:affiliationType,:role,:status,
              :isPrimary,:isActive,:startDate,:nicknames,:createdAt)`,
      args: {
        id: a.id, playerId: a.player_id, teamId: a.team_id,
        affiliationType: a.affiliation_type, role: a.role, status: a.status,
        isPrimary: a.is_primary, isActive: a.is_active,
        startDate: a.start_date, nicknames: a.nicknames ?? '[]',
        createdAt: a.created_at,
      },
    });
    console.log(`  ✓  ${a.player_id.slice(0, 30).padEnd(30)} → ${a.team_id} [${a.affiliation_type}]`);
    affInserted++;
  }
  console.log(`\n  Inserted: ${affInserted} affiliation rows`);

  // Step 5 — verify prod
  console.log('\n=== PROD VERIFY ===');
  const verify = await prod.execute(`
    SELECT p.name, p.college, pta.team_id, pta.affiliation_type
    FROM players p
    LEFT JOIN player_team_affiliations pta ON pta.player_id = p.id AND pta.affiliation_type = 'college'
    WHERE p.id IN (${idList})
    ORDER BY p.college, p.name
  `);
  let misses = 0;
  for (const r of verify.rows) {
    const ok = r.team_id ? '✓' : '✗';
    if (!r.team_id) misses++;
    console.log(`  ${ok}  ${r.name.padEnd(14)} [${r.college ?? 'NULL'}] → ${r.team_id ?? 'NONE'}`);
  }
  console.log(`\n  Total: ${verify.rows.length} | Missing affiliation: ${misses}`);

  process.exit(0);
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
