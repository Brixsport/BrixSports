
import { db } from '../src/db';
import { competitions } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function listCompetitions() {
    const allCompetitions = await db.select().from(competitions);
    console.log('Current Competitions:');
    allCompetitions.forEach(c => {
        console.log(`- ${c.name} (${c.sport}) [${c.id}]`);
    });
}

listCompetitions().catch(console.error);
