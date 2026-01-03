import { db } from './index';
import { eq, or, inArray } from 'drizzle-orm';
import {
    teams,
    players,
    matches,
    loggers,
    standings,
    bracketNodes,
    matchEvents,
} from './schema';

/**
 * Remove ONLY mock/test data from seed.ts
 * Keeps real BUSA Football League data
 */

// Mock team IDs from seed.ts (fake universities)
const MOCK_TEAM_IDS = [
    'unilag',
    'uniben',
    'ui',
    'oau',
    'futa',
    'lasu',
    'uniport',
    'unilorin',
    'covenant',
    'babcock',
    'bells-engineering',
    'bells-sciences',
    'bells-law',
    'bells-arts',
    'bells-business',
    'bells-medical',
    'bells-agriculture',
    'bells-university'
];

// Mock player IDs from seed.ts
const MOCK_PLAYER_IDS = [
    'p1', 'p2', 'p3', 'p4', 'p5', 'p6',
    'bells-p1', 'bells-p2', 'bells-p3', 'bells-p4', 'bells-p5',
    'bells-p6', 'bells-p7', 'bells-p8', 'bells-p9', 'bells-p10',
    'bells-p11', 'bells-p12', 'bells-p13'
];

// Mock match IDs from seed.ts
const MOCK_MATCH_IDS = [
    'm1', 'm2', 'm3',
    'bells-m1', 'bells-m2', 'bells-m3', 'bells-m4', 'bells-m5',
    'bells-ext-m1', 'bells-ext-m2'
];

// Mock logger IDs from seed.ts
const MOCK_LOGGER_IDS = ['l1', 'l2'];

// Mock standing IDs from seed.ts
const MOCK_STANDING_IDS = ['s1', 's2', 's3', 's4'];

// Mock bracket node IDs from seed.ts
const MOCK_BRACKET_IDS = ['f1', 'sf1', 'sf2', 'qf1', 'qf2', 'qf3', 'qf4'];

async function removeMockData() {
    console.log('🗑️  Removing ONLY mock data (keeping real BUSA data)...\n');

    try {
        let deletedCount = 0;

        // 1. Delete mock match events
        console.log('Deleting mock match events...');
        const eventsResult = await db.delete(matchEvents)
            .where(inArray(matchEvents.matchId, MOCK_MATCH_IDS));
        console.log(`✓ Deleted mock match events`);

        // 2. Delete mock bracket nodes
        console.log('Deleting mock bracket nodes...');
        const bracketsResult = await db.delete(bracketNodes)
            .where(inArray(bracketNodes.id, MOCK_BRACKET_IDS));
        console.log(`✓ Deleted mock bracket nodes`);

        // 3. Delete mock standings
        console.log('Deleting mock standings...');
        const standingsResult = await db.delete(standings)
            .where(inArray(standings.id, MOCK_STANDING_IDS));
        console.log(`✓ Deleted mock standings`);

        // 4. Delete mock matches
        console.log('Deleting mock matches...');
        const matchesResult = await db.delete(matches)
            .where(inArray(matches.id, MOCK_MATCH_IDS));
        console.log(`✓ Deleted mock matches`);

        // 5. Delete mock players
        console.log('Deleting mock players...');
        const playersResult = await db.delete(players)
            .where(inArray(players.id, MOCK_PLAYER_IDS));
        console.log(`✓ Deleted mock players`);

        // 6. Delete mock teams
        console.log('Deleting mock teams...');
        const teamsResult = await db.delete(teams)
            .where(inArray(teams.id, MOCK_TEAM_IDS));
        console.log(`✓ Deleted mock teams`);

        // 7. Delete mock loggers
        console.log('Deleting mock loggers...');
        const loggersResult = await db.delete(loggers)
            .where(inArray(loggers.id, MOCK_LOGGER_IDS));
        console.log(`✓ Deleted mock loggers`);

        console.log('\n✅ Mock data removed successfully!');
        console.log('📝 Your BUSA Football League data is preserved.');
        console.log('\nRemaining data:');
        console.log('  - BUSA League teams (Joga-Bonito, Kings FC, Hammers, Pirates FC, etc.)');
        console.log('  - BUSA League matches and standings');
        console.log('  - Real player rosters');

    } catch (error) {
        console.error('❌ Error removing mock data:', error);
        throw error;
    }
}

// Run if executed directly
if (require.main === module) {
    removeMockData()
        .then(() => {
            console.log('\nMock data removal completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Mock data removal failed:', error);
            process.exit(1);
        });
}

export { removeMockData };
