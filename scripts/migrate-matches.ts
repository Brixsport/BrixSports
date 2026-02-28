
import { db } from '../src/db';
import { matches, competitions } from '../src/db/schema';
import { eq, like, sql } from 'drizzle-orm';

async function migrateMatches() {
    console.log('--- Migrating Matches Competition Names ---');

    // Search for matches with "NPUGA 5-Aside" or "5-Aside" in competition field
    // And update them to "NPUGA Special Edition"

    // Also check if any matches are linked to the deleted duplicate ID... wait matches don't link via ID usually in this schema for competition column.

    // We look for matches where competition string is "NPUGA 5-Aside Football Championship" (or similar)
    // and set it to "NPUGA Special Edition".

    const oldName = "NPUGA 5-Aside Football Championship";
    const newName = "NPUGA Special Edition";

    const result = await db.update(matches)
        .set({ competition: newName })
        .where(like(matches.competition, '%NPUGA 5-Aside%'))
        .returning({ id: matches.id, competition: matches.competition });

    console.log(`Updated ${result.length} matches to use competition name "${newName}".`);

    // Also check for "Nigerian Universities Female 5-Aside Championship" if that needs update?
    // User said "current npuga 5-asoide".

    console.log('--- Migration Complete ---');
}

migrateMatches().catch(console.error);
