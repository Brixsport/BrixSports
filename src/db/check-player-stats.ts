import { db } from './index';
import { footballPlayerStats, basketballPlayerStats } from './schema';

async function checkPlayerStats() {
    console.log('🔍 Checking Player Stats in Database...\n');

    try {
        // Check football player stats
        const footballStats = await db.select().from(footballPlayerStats);
        console.log(`⚽ Football Player Stats: ${footballStats.length} records`);

        if (footballStats.length > 0) {
            console.log('\nSample Football Stats (Season Aggregates):');
            footballStats.slice(0, 5).forEach(stat => {
                console.log(`  Player ID: ${stat.playerId}, Season: ${stat.season}`);
                console.log(`    Goals: ${stat.goals ?? 0}, Assists: ${stat.assists ?? 0}, Appearances: ${stat.appearances ?? 0}`);
            });
        }

        // Check basketball player stats
        const basketballStats = await db.select().from(basketballPlayerStats);
        console.log(`\n🏀 Basketball Player Stats: ${basketballStats.length} records`);

        if (basketballStats.length > 0) {
            console.log('\nSample Basketball Stats (Season Aggregates):');
            basketballStats.slice(0, 5).forEach(stat => {
                console.log(`  Player ID: ${stat.playerId}, Season: ${stat.season}`);
                console.log(`    Total Points: ${stat.totalPoints ?? 0}, Total Rebounds: ${stat.totalRebounds ?? 0}, Assists: ${stat.assists ?? 0}`);
            });
        }

        console.log('\n' + '='.repeat(80));
        if (footballStats.length === 0 && basketballStats.length === 0) {
            console.log('⚠️  NO PLAYER STATS FOUND IN DATABASE');
            console.log('\n📝 Note: Player stats are season-based aggregates, not per-match.');
            console.log('   They need to be calculated from match events or imported separately.');
            console.log('\n💡 To populate stats:');
            console.log('   1. Use the logger system to record match events');
            console.log('   2. Run aggregation scripts to calculate season stats');
            console.log('   3. Or import pre-calculated stats from external sources');
        } else {
            console.log('✅ Player stats found in database');
        }

    } catch (error) {
        console.error('❌ Error checking player stats:', error);
    }
}

checkPlayerStats().then(() => process.exit(0));
