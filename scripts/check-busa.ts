
import { db } from '../src/db';
import { competitions } from '../src/db/schema';
import { eq, or, like } from 'drizzle-orm';

async function checkBusa() {
    console.log('--- Checking BUSA Competitions ---');

    const busaComps = await db.select().from(competitions)
        .where(or(
            like(competitions.name, '%BUSA%'),
            like(competitions.name, '%Bells%')
        ));

    console.log('Found the following BUSA-related competitions:');
    busaComps.forEach(c => {
        console.log(`\nID: ${c.id}`);
        console.log(`Name: ${c.name}`);
        console.log(`Sport: ${c.sport}`);
        console.log(`Status: ${c.status}`);
    });

    // Action Plan based on typical cleanup:
    // 1. Rename ALL-CAPS "BUSA LEAGUE BASKETBALL" -> "BUSA League" (Sport: Basketball)
    // 2. Rename ALL-CAPS "BUSA LEAGUE FOOTBALL" -> "BUSA League" (Sport: Football)
    // 3. Delete "Bells University League" (it was a duplicate/misname)
}

checkBusa().catch(console.error);
