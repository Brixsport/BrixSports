import * as dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function runAudit() {
    console.log('\n=== DB AUDIT QUERY RESULTS ===\n');

    // 1. Table list
    console.log('--- 1. TABLE LIST ---');
    const tables = await db.run(sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
    const tableNames = (tables.rows as any[]).map((r: any) => r[0] || r.name);
    console.log('Tables:', tableNames.join(', '));

    // 2. Row counts per table
    console.log('\n--- 2. ROW COUNTS ---');
    for (const tbl of tableNames) {
        try {
            const cnt = await db.run(sql.raw(`SELECT COUNT(*) as c FROM "${tbl}"`));
            const row = cnt.rows[0] as any;
            const count = row[0] ?? row.c;
            console.log(`  ${tbl}: ${count}`);
        } catch (e: any) {
            console.log(`  ${tbl}: ERROR - ${e.message}`);
        }
    }

    // 3. Teams
    console.log('\n--- 3. TEAMS (last 30) ---');
    const teams = await db.run(sql`SELECT id, name, short_name, sport, owner_organization_id FROM teams ORDER BY created_at DESC LIMIT 30`);
    console.table(teams.rows);

    // 4. Orgs (colleges)
    console.log('\n--- 4. ORGANIZATIONS (colleges) ---');
    const orgs = await db.run(sql`SELECT id, name, short_name, type, parent_organization_id FROM organizations WHERE type = 'college' LIMIT 50`);
    console.table(orgs.rows);

    // 5. Players
    console.log('\n--- 5. PLAYERS (last 30) ---');
    const players = await db.run(sql`SELECT id, name, team_id, position, university, college FROM players ORDER BY created_at DESC LIMIT 30`);
    console.table(players.rows);

    // 6. Competitions
    console.log('\n--- 6. COMPETITIONS ---');
    const comps = await db.run(sql`SELECT id, name, sport, status, level, is_multi_sport FROM competitions ORDER BY created_at DESC`);
    console.table(comps.rows);

    // 7. Recent matches
    console.log('\n--- 7. RECENT MATCHES (last 20) ---');
    const matchRows = await db.run(sql`SELECT id, home_team_id, away_team_id, status, approval_status, competition, sport FROM matches ORDER BY created_at DESC LIMIT 20`);
    console.table(matchRows.rows);

    // 8. Event types
    console.log('\n--- 8. EVENT TYPES ---');
    const events = await db.run(sql`SELECT DISTINCT type, COUNT(*) as count FROM match_events GROUP BY type ORDER BY count DESC`);
    console.table(events.rows);

    // 9. Intercollege team check
    console.log('\n--- 9. INTERCOLLEGE TEAMS ---');
    const intercol = await db.run(sql`SELECT id, name, short_name, sport, owner_organization_id FROM teams WHERE short_name IN ('CNAS','CENG','CMANS','CENVS','COLNAS','COLENG','COLMANS','COLENVS')`);
    console.table(intercol.rows);

    // 10. PlayerStats summary
    console.log('\n--- 10. PLAYER STATS SUMMARY ---');
    const ps = await db.run(sql`SELECT COUNT(*) as total, SUM(goals) as totalGoals, SUM(appearances) as totalAppearances FROM player_stats`);
    console.table(ps.rows);

    // 11. Users
    console.log('\n--- 11. USERS (last 20) ---');
    const users = await db.run(sql`SELECT id, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 20`);
    console.table(users.rows);

    console.log('\n=== AUDIT COMPLETE ===\n');
}

runAudit().catch(console.error);
