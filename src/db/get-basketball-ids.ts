import { db } from './index';
import { teams } from './schema';
import { eq } from 'drizzle-orm';

async function getBasketballTeamIds() {
    console.log('🔍 Getting Basketball Team IDs...\n');

    try {
        const allTeams = await db.select().from(teams);
        const basketballTeams = allTeams.filter(team => team.sport === 'Basketball');

        console.log('Basketball Teams:');
        basketballTeams.forEach(team => {
            console.log(`  ${team.name} (${team.shortName}): ${team.id}`);
        });

        console.log('\n✅ Done!');
    } catch (error) {
        console.error('Error:', error);
    }
}

getBasketballTeamIds().then(() => process.exit(0));
