import * as dotenv from 'dotenv';
import { db } from './index';
import { competitions, matches, standings, playerStats, bracketNodes, teamForm, headToHead, basketballPlayerStats, footballPlayerStats } from './schema';
import { eq, and, like, or, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';

dotenv.config();

async function migrate() {
    console.log('🔄 Starting competition migration...');

    try {
        // 1. Get all existing competitions
        const allComps = await db.select().from(competitions);
        console.log(`Found ${allComps.length} competitions.`);

        // 2. Map competition names to IDs
        const compMap = new Map<string, string>();
        allComps.forEach(c => compMap.set(c.name, c.id));

        // 3. Identify potential merges (e.g. "NPUGA Football" and "NPUGA Basketball")
        const mergeGroups = new Map<string, string[]>();
        allComps.forEach(c => {
            const baseName = c.name.replace(/\s+(Football|Basketball|Track|Championship|League)$/i, '').trim();
            if (baseName !== c.name) {
                if (!mergeGroups.has(baseName)) mergeGroups.set(baseName, []);
                mergeGroups.get(baseName)!.push(c.id);
            }
        });

        console.log('Potential merges identified:', Array.from(mergeGroups.entries()));

        // 4. Update records for each competition
        for (const comp of allComps) {
            console.log(`Processing competition: ${comp.name} (${comp.id})`);

            // Update matches
            const updatedMatches = await db.update(matches)
                .set({ competitionId: comp.id })
                .where(eq(matches.competition, comp.name));
            console.log(`   - Updated matches for ${comp.name}`);

            // Update standings
            const updatedStandings = await db.update(standings)
                .set({ competitionId: comp.id })
                .where(eq(standings.competition, comp.name));
            console.log(`   - Updated standings for ${comp.name}`);

            // Update player stats
            const updatedPlayerStats = await db.update(playerStats)
                .set({ competitionId: comp.id })
                .where(eq(playerStats.competition, comp.name));
            console.log(`   - Updated player stats for ${comp.name}`);

            // Update bracket nodes
            const updatedBrackets = await db.update(bracketNodes)
                .set({ competitionId: comp.id })
                .where(eq(bracketNodes.competition, comp.name));
            console.log(`   - Updated bracket nodes for ${comp.name}`);

            // Update team form
            const updatedTeamForm = await db.update(teamForm)
                .set({ competitionId: comp.id })
                .where(eq(teamForm.competition, comp.name));
            console.log(`   - Updated team form for ${comp.name}`);

            // Update head to head
            const updatedH2H = await db.update(headToHead)
                .set({ competitionId: comp.id })
                .where(eq(headToHead.competition, comp.name));
            console.log(`   - Updated head to head for ${comp.name}`);
        }

        // 5. Perform merges if requested or obvious
        for (const [baseName, compIds] of mergeGroups.entries()) {
            if (compIds.length > 1) {
                console.log(`Merging ${compIds.length} competitions into unified "${baseName}"`);

                // Check if a base competition already exists
                let baseComp = allComps.find(c => c.name.toLowerCase() === baseName.toLowerCase());

                if (!baseComp) {
                    console.log(`Creating new multi-sport competition: ${baseName}`);
                    const newId = nanoid();
                    const firstComp = allComps.find(c => c.id === compIds[0])!;

                    await db.insert(competitions).values({
                        id: newId,
                        name: baseName,
                        sport: null, // Multi-sport
                        isMultiSport: true,
                        format: firstComp.format,
                        season: firstComp.season,
                        level: firstComp.level,
                        scope: firstComp.scope,
                        status: 'ongoing',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });

                    baseComp = { id: newId } as any;
                } else {
                    await db.update(competitions)
                        .set({ isMultiSport: true, sport: null })
                        .where(eq(competitions.id, baseComp.id));
                }

                // Update all records from sub-competitions to point to the base competition
                for (const subId of compIds) {
                    if (subId === baseComp!.id) continue;

                    await db.update(matches)
                        .set({ competitionId: baseComp!.id })
                        .where(eq(matches.competitionId, subId));

                    await db.update(standings)
                        .set({ competitionId: baseComp!.id })
                        .where(eq(standings.competitionId, subId));

                    await db.update(playerStats)
                        .set({ competitionId: baseComp!.id })
                        .where(eq(playerStats.competitionId, subId));

                    await db.update(bracketNodes)
                        .set({ competitionId: baseComp!.id })
                        .where(eq(bracketNodes.competitionId, subId));

                    await db.update(teamForm)
                        .set({ competitionId: baseComp!.id })
                        .where(eq(teamForm.competitionId, subId));

                    await db.update(headToHead)
                        .set({ competitionId: baseComp!.id })
                        .where(eq(headToHead.competitionId, subId));

                    // Optionally delete the sub-competition
                    // await db.delete(competitions).where(eq(competitions.id, subId));
                    console.log(`   - Linked records from ${subId} to ${baseComp!.id}`);
                }
            }
        }

        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
