import * as dotenv from 'dotenv';
import { db } from './index';
import { teams } from './schema';
import { sql } from 'drizzle-orm';

dotenv.config();

/**
 * Check and fix duplicate team IDs for Bells University
 */

async function checkBellsTeams() {
    console.log('🔍 Checking Bells University teams...\n');

    try {
        // Get all teams with "Bells" in their name or university
        const bellsTeams = await db
            .select({
                id: teams.id,
                name: teams.name,
                shortName: teams.shortName,
                university: teams.university,
                sport: teams.sport,
            })
            .from(teams)
            .where(
                sql`LOWER(${teams.name}) LIKE '%bells%' OR LOWER(${teams.university}) LIKE '%bells%'`
            );

        console.log(`Found ${bellsTeams.length} Bells teams:\n`);
        
        // Group by ID to find duplicates
        const idGroups = new Map<string, typeof bellsTeams>();
        
        for (const team of bellsTeams) {
            if (!idGroups.has(team.id)) {
                idGroups.set(team.id, []);
            }
            idGroups.get(team.id)!.push(team);
        }

        let hasDuplicates = false;
        
        for (const [id, teamList] of idGroups) {
            if (teamList.length > 1) {
                hasDuplicates = true;
                console.log(`⚠️  DUPLICATE ID: ${id}`);
                console.log(`   Found ${teamList.length} teams with this ID:`);
                for (const team of teamList) {
                    console.log(`     - ${team.name} (${team.sport}) - shortName: ${team.shortName}`);
                }
                console.log();
            }
        }

        if (!hasDuplicates) {
            console.log('✅ No duplicate IDs found!\n');
            console.log('All Bells teams:');
            for (const team of bellsTeams) {
                console.log(`  ID: ${team.id}`);
                console.log(`  Name: ${team.name}`);
                console.log(`  Short: ${team.shortName}`);
                console.log(`  Sport: ${team.sport}`);
                console.log(`  University: ${team.university}`);
                console.log('---');
            }
        }

        console.log('\n✅ Check complete!');
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

checkBellsTeams().then(() => process.exit(0));
