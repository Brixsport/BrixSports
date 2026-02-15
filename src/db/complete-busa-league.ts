import * as dotenv from 'dotenv';
import { db } from './index';
import { competitions, teams } from './schema';
import { eq, and, like } from 'drizzle-orm';

dotenv.config();

/**
 * Complete BUSA League competitions with correct winners
 * Football: Kings FC
 * Basketball: TBK
 */

async function completeBusaCompetitions() {
    console.log('🏆 Completing BUSA League Competitions...\n');

    try {
        // ========== FOOTBALL - Kings FC ==========
        console.log('⚽ Processing Football Competition...');

        const footballComp = await db.query.competitions.findFirst({
            where: (competitions, { and, like, eq }) =>
                and(
                    like(competitions.name, '%BUSA%'),
                    eq(competitions.sport, 'Football')
                ),
        });

        if (footballComp) {
            console.log(`Found: ${footballComp.name}`);

            // Find Kings FC
            const kingsFC = await db.query.teams.findFirst({
                where: (teams, { like }) => like(teams.name, '%Kings%'),
            });

            if (kingsFC) {
                console.log(`Winner: ${kingsFC.name}`);

                // Get standings for runner-up and third place
                const footballStandings = await db.query.standings.findMany({
                    where: (standings, { eq }) => eq(standings.competition, footballComp.name),
                    with: { team: true },
                });

                const sortedStandings = footballStandings.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

                // Update competition
                await db.update(competitions)
                    .set({
                        status: 'completed',
                        winnerId: kingsFC.id,
                        runnerUpId: sortedStandings[1]?.teamId || null,
                        thirdPlaceId: sortedStandings[2]?.teamId || null,
                        completedAt: new Date(),
                        finalStandings: JSON.stringify(sortedStandings.map(s => ({
                            teamId: s.teamId,
                            teamName: s.team?.name,
                            played: s.played,
                            won: s.won,
                            drawn: s.drawn,
                            lost: s.lost,
                            goalsFor: s.goalsFor,
                            goalsAgainst: s.goalsAgainst,
                            goalDifference: s.goalDifference,
                            points: s.points,
                        }))),
                        highlights: `${kingsFC.name} crowned champions of BUSA League Football 2025/2026 season!`,
                        isArchived: false,
                        isFeatured: false,
                        displayOrder: 999,
                        updatedAt: new Date(),
                    })
                    .where(eq(competitions.id, footballComp.id));

                console.log('✅ Football Competition completed!');
                console.log(`   - Winner: ${kingsFC.name}`);
                console.log(`   - Runner-up: ${sortedStandings[1]?.team?.name || 'N/A'}`);
                console.log(`   - Third place: ${sortedStandings[2]?.team?.name || 'N/A'}\n`);
            } else {
                console.log('❌ Kings FC not found\n');
            }
        } else {
            console.log('❌ Football competition not found\n');
        }

        // ========== BASKETBALL - TBK ==========
        console.log('🏀 Processing Basketball Competition...');

        const basketballComp = await db.query.competitions.findFirst({
            where: (competitions, { and, like, eq }) =>
                and(
                    like(competitions.name, '%BUSA%'),
                    eq(competitions.sport, 'Basketball')
                ),
        });

        if (basketballComp) {
            console.log(`Found: ${basketballComp.name}`);

            // Find TBK
            const tbk = await db.query.teams.findFirst({
                where: (teams, { like }) => like(teams.name, '%TBK%'),
            });

            if (tbk) {
                console.log(`Winner: ${tbk.name}`);

                // Get standings for runner-up and third place
                const basketballStandings = await db.query.standings.findMany({
                    where: (standings, { eq }) => eq(standings.competition, basketballComp.name),
                    with: { team: true },
                });

                const sortedStandings = basketballStandings.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

                // Update competition
                await db.update(competitions)
                    .set({
                        status: 'completed',
                        winnerId: tbk.id,
                        runnerUpId: sortedStandings[1]?.teamId || null,
                        thirdPlaceId: sortedStandings[2]?.teamId || null,
                        completedAt: new Date(),
                        finalStandings: JSON.stringify(sortedStandings.map(s => ({
                            teamId: s.teamId,
                            teamName: s.team?.name,
                            played: s.played,
                            won: s.won,
                            drawn: s.drawn,
                            lost: s.lost,
                            goalsFor: s.goalsFor,
                            goalsAgainst: s.goalsAgainst,
                            goalDifference: s.goalDifference,
                            points: s.points,
                        }))),
                        highlights: `${tbk.name} crowned champions of BUSA League Basketball 2025/2026 season!`,
                        isArchived: false,
                        isFeatured: false,
                        displayOrder: 999,
                        updatedAt: new Date(),
                    })
                    .where(eq(competitions.id, basketballComp.id));

                console.log('✅ Basketball Competition completed!');
                console.log(`   - Winner: ${tbk.name}`);
                console.log(`   - Runner-up: ${sortedStandings[1]?.team?.name || 'N/A'}`);
                console.log(`   - Third place: ${sortedStandings[2]?.team?.name || 'N/A'}\n`);
            } else {
                console.log('❌ TBK not found\n');
            }
        } else {
            console.log('❌ Basketball competition not found\n');
        }

        console.log('🎉 All BUSA League competitions completed!');
        console.log('   - Status: completed');
        console.log('   - Archived: No (still visible in history)');
        console.log('   - Featured: No (removed from homepage)');

    } catch (error) {
        console.error('❌ Error completing BUSA competitions:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    completeBusaCompetitions()
        .then(() => {
            console.log('\n✅ All competitions completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Failed to complete competitions:', error);
            process.exit(1);
        });
}

export { completeBusaCompetitions };
