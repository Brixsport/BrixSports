import * as dotenv from 'dotenv';
import { db } from './index';
import { teams, playerTeamAffiliations, matches, standings, competitionTeamEntries, squadPlayers } from './schema';
import { sql, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

dotenv.config();

/**
 * Fix duplicate team IDs for Bells University
 * This script identifies teams with duplicate IDs and assigns unique IDs
 */

async function fixBellsTeamIds() {
    console.log('🔧 Fixing Bells University team IDs...\n');

    try {
        // Get all teams with "Bells" in their name or university
        const bellsTeams = await db
            .select({
                id: teams.id,
                name: teams.name,
                shortName: teams.shortName,
                university: teams.university,
                sport: teams.sport,
                gender: teams.gender,
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

        let fixedCount = 0;

        for (const [id, teamList] of idGroups) {
            if (teamList.length > 1) {
                console.log(`⚠️  Found ${teamList.length} teams with duplicate ID: ${id}`);

                // Keep the first team with this ID, fix the rest
                for (let i = 1; i < teamList.length; i++) {
                    const team = teamList[i];
                    const newId = nanoid();

                    console.log(`   Fixing: "${team.name}" (${team.sport})`);
                    console.log(`   Old ID: ${id}`);
                    console.log(`   New ID: ${newId}`);

                    // Create new team with unique ID
                    await db.insert(teams).values({
                        ...team,
                        id: newId,
                        createdAt: new Date(),
                    });

                    // Delete old team
                    await db.delete(teams).where(eq(teams.id, id));

                    // Update references in other tables
                    await db.update(playerTeamAffiliations)
                        .set({ teamId: newId })
                        .where(eq(playerTeamAffiliations.teamId, id));

                    await db.update(matches)
                        .set({ homeTeamId: newId })
                        .where(eq(matches.homeTeamId, id));

                    await db.update(matches)
                        .set({ awayTeamId: newId })
                        .where(eq(matches.awayTeamId, id));

                    await db.update(standings)
                        .set({ teamId: newId })
                        .where(eq(standings.teamId, id));

                    await db.update(competitionTeamEntries)
                        .set({ teamId: newId })
                        .where(eq(competitionTeamEntries.teamId, id));

                    await db.update(squadPlayers)
                        .set({ teamId: newId })
                        .where(eq(squadPlayers.teamId, id));

                    fixedCount++;
                    console.log(`   ✅ Fixed!\n`);
                }
            }
        }

        if (fixedCount === 0) {
            console.log('✅ No duplicate IDs found - all teams have unique IDs!\n');
        } else {
            console.log(`✅ Fixed ${fixedCount} duplicate team(s)!\n`);
        }

        // Show final state
        console.log('Final Bells teams:');
        const finalTeams = await db
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

        for (const team of finalTeams) {
            console.log(`  ID: ${team.id}`);
            console.log(`  Name: ${team.name}`);
            console.log(`  Sport: ${team.sport}`);
            console.log('---');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

fixBellsTeamIds().then(() => process.exit(0));
