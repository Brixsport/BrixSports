import * as dotenv from 'dotenv';
import { db } from './index';
import { competitions, teams } from './schema';
import { eq } from 'drizzle-orm';

dotenv.config();

/**
 * List all teams and competitions to help identify correct IDs
 */

async function listTeamsAndCompetitions() {
    console.log('📋 Listing all teams and competitions...\n');

    try {
        // List all teams
        const allTeams = await db.query.teams.findMany({
            orderBy: (teams, { asc }) => [asc(teams.name)],
        });

        console.log('🏃 TEAMS:');
        console.log('─'.repeat(50));
        allTeams.forEach(team => {
            console.log(`ID: ${team.id}`);
            console.log(`Name: ${team.name}`);
            console.log(`Short: ${team.shortName}`);
            console.log('─'.repeat(50));
        });

        // List all competitions
        const allCompetitions = await db.query.competitions.findMany({
            orderBy: (competitions, { asc }) => [asc(competitions.name)],
        });

        console.log('\n🏆 COMPETITIONS:');
        console.log('─'.repeat(50));
        allCompetitions.forEach(comp => {
            console.log(`ID: ${comp.id}`);
            console.log(`Name: ${comp.name}`);
            console.log(`Sport: ${comp.sport}`);
            console.log(`Status: ${comp.status}`);
            console.log(`Winner ID: ${comp.winnerId || 'None'}`);
            console.log('─'.repeat(50));
        });

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    listTeamsAndCompetitions()
        .then(() => {
            console.log('\n✅ Listing complete');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

export { listTeamsAndCompetitions };
