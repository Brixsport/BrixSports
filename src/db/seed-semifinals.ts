import * as dotenv from 'dotenv';
import { db } from './index';
import { matches } from './schema';

dotenv.config();

/**
 * Add Semi-Final matches to BUSA League Football
 */
async function seedSemiFinals() {
    console.log('⚽ Adding BUSA League Football Semi-Finals...');

    try {
        const semiFinalMatches = [
            {
                id: 'busa-match-sf1',
                sport: 'Football' as const,
                homeTeamId: 'busa-joga',
                awayTeamId: 'busa-hammers',
                homeScore: 0,
                awayScore: 0,
                status: 'UPCOMING' as const,
                startTime: new Date('2026-01-10T15:00:00').toISOString(),
                venue: 'BELLS UNIVERSITY FOOTBALL PITCH',
                competition: 'BUSA League Football - Semi Finals',
                stats: JSON.stringify({
                    possession: [50, 50],
                    shots: [0, 0],
                    shotsOnTarget: [0, 0],
                    corners: [0, 0],
                    fouls: [0, 0],
                    yellowCards: [0, 0],
                    redCards: [0, 0],
                }),
            },
            {
                id: 'busa-match-sf2',
                sport: 'Football' as const,
                homeTeamId: 'busa-kings',
                awayTeamId: 'busa-pirates',
                homeScore: 0,
                awayScore: 0,
                status: 'UPCOMING' as const,
                startTime: new Date('2026-01-08T15:00:00').toISOString(),
                venue: 'BELLS UNIVERSITY FOOTBALL PITCH',
                competition: 'BUSA League Football - Semi Finals',
                stats: JSON.stringify({
                    possession: [50, 50],
                    shots: [0, 0],
                    shotsOnTarget: [0, 0],
                    corners: [0, 0],
                    fouls: [0, 0],
                    yellowCards: [0, 0],
                    redCards: [0, 0],
                }),
            },
        ];

        for (const match of semiFinalMatches) {
            await db.insert(matches).values(match);
            console.log(`✅ Added: ${match.homeTeamId} vs ${match.awayTeamId}`);
        }

        console.log('✅ Semi-Finals seeded successfully!');
        console.log('   - Semi-Final 1: Joga-Bonito vs Hammers (Jan 10, 2026)');
        console.log('   - Semi-Final 2: Kings FC vs Pirates FC (Jan 8, 2026)');
    } catch (error) {
        console.error('❌ Error seeding semi-finals:', error);
        throw error;
    }
}

// Run seed if this file is executed directly
if (require.main === module) {
    seedSemiFinals()
        .then(() => {
            console.log('Seed completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Seed failed:', error);
            process.exit(1);
        });
}

export { seedSemiFinals };
