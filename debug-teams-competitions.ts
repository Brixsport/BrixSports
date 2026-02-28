
import { db } from './src/db';
import { teams, competitions, standings } from './src/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function debugTeamsAndCompetitions() {
    try {
        console.log('Fetching competitions...');
        const allCompetitions = await db.select().from(competitions);
        console.log('Competitions:', allCompetitions.length);
        allCompetitions.forEach(c => {
            console.log(`- ${c.name} (Level: ${c.level}, Scope: ${c.scope})`);
        });

        console.log('\nFetching standings to see team-competition links...');
        const allStandings = await db.select().from(standings);

        console.log('\nFetching teams...');
        const allTeams = await db.select().from(teams);

        const internalTeams = new Set();
        const universityTeams = new Set();

        for (const team of allTeams) {
            // Find which competitions this team is in via standings
            const teamStandings = allStandings.filter(s => s.teamId === team.id);
            const competitionNames = teamStandings.map(s => s.competition);

            // Or look for a direct link if any (registration?)

            console.log(`Team: ${team.name} (${team.shortName})`);
            console.log(`  Competitions: ${competitionNames.join(', ')}`);
        }

    } catch (e) {
        console.error(e);
    }
}

debugTeamsAndCompetitions();
