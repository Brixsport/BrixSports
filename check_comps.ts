
import { db } from './src/db/index';
import { competitions } from './src/db/schema';

async function check() {
    try {
        const comps = await db.select().from(competitions).all();
        console.log('Competitions in DB:', JSON.stringify(comps, null, 2));
    } catch (e) {
        console.error(e);
    }
}

check();
