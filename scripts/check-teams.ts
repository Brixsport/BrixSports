import { db } from '../src/db';
import { teams } from '../src/db/schema';
import { like, or } from 'drizzle-orm';

async function listTeams() {
    try {
        const matchingTeams = await db.select()
            .from(teams)
            .where(or(
                like(teams.name, '%Bells%'),
                like(teams.name, '%Kings%')
            ))
            .all();

        console.log(JSON.stringify(matchingTeams, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

listTeams();
