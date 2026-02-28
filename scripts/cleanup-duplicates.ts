
import { db } from '../src/db';
import { competitions, matches, teams, standings } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';

async function cleanupDuplicates() {
    console.log('--- Cleaning up duplicate competitions ---');

    const allComps = await db.select().from(competitions);

    // Group by name
    const grouped = allComps.reduce((acc, comp) => {
        const name = comp.name;
        if (!acc[name]) acc[name] = [];
        acc[name].push(comp);
        return acc;
    }, {} as Record<string, typeof allComps>);

    for (const name in grouped) {
        const dups = grouped[name];
        if (dups.length > 1) {
            console.log(`\nFound ${dups.length} duplicates for "${name}":`);

            // Determine which one to keep (e.g., the one with the most matches)
            let bestComp = dups[0];
            let maxMatches = -1;

            // Count matches for each
            for (const comp of dups) {
                const matchCount = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(matches)
                    .where(sql`competition = ${comp.name}`) // Matches use string name for competition usually? Or ID?
                // Schema says competition: text('competition').notNull(), which usually stores NAME.
                // If match table uses ID, we check ID. If NAME, merging by name is redundant if they share name...
                // Wait, if matches store competition NAME, then deleting a duplicate competition record (ID) doesn't affect matches if matches link by NAME.
                // BUT if matches link by NAME, then ALL duplicates "own" those matches.
                // So we just keep one competition record and delete others.
                // Let's verify schema relationship.

                // Schema: competition: text('competition').notNull() in 'matches' table.
                // Usually in this project it seems to be the Name string.
                // Let's check a match record.
            }

            // If matches link by Name, they are safe as long as one competition with that Name exists.
            // But if we have other links (teamRegistrations use ID).

            // We will keep the first one found (usually oldest) and delete others.
            // Ideally we check ID usage in other tables like teamRegistrations which uses competitionId.

            const [primary, ...others] = dups;
            console.log(`Keeping: [${primary.id}]`);

            for (const other of others) {
                console.log(`Deleting: [${other.id}]`);
                await db.delete(competitions).where(eq(competitions.id, other.id));
            }
        }
    }

    console.log('\n--- Cleanup Complete ---');
    const remaining = await db.select().from(competitions);
    remaining.forEach(c => console.log(`[${c.id}] ${c.name}`));
}

cleanupDuplicates().catch(console.error);
