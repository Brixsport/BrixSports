
import { db } from '../src/db';
import { competitions } from '../src/db/schema';
import { eq, like } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function manageCompetitions() {
    console.log('--- Current Competitions ---');
    const allComps = await db.select().from(competitions);
    allComps.forEach(c => console.log(`[${c.id}] ${c.name} (${c.status})`));

    // 1. Transform "NPUGA 5-aside" to "NPUGA Special Edition"
    // Search for anything resembling NPUGA
    const npugaCandidates = allComps.filter(c => c.name.toLowerCase().includes('npuga'));

    if (npugaCandidates.length > 0) {
        for (const comp of npugaCandidates) {
            if (comp.name.toLowerCase().includes('5-aside') || comp.name.toLowerCase().includes('5 aside')) {
                console.log(`\nFound target for update: ${comp.name}`);

                await db.update(competitions)
                    .set({
                        name: 'NPUGA Special Edition',
                        description: 'Special Mini-Edition for 2026',
                        status: 'ongoing', // Ensure it's active
                        isFeatured: true,
                        displayOrder: 1
                    })
                    .where(eq(competitions.id, comp.id));

                console.log(`Updated '${comp.name}' to 'NPUGA Special Edition'`);
            } else if (comp.name === 'NPUGA Special Edition') {
                console.log(`\n'NPUGA Special Edition' already exists.`);
            }
        }
    } else {
        // If nupga doesn't exist at all, create it?
        // User implies "current npuga 5-aside" exists.
        console.log('\nNo NPUGA competitions found to update. (Is the DB seeded?)');
    }

    // 2. Ensure "Bells University League" exists
    const bellsLeague = allComps.find(c => c.name === 'Bells University League');
    if (!bellsLeague) {
        console.log(`\nCreating 'Bells University League' (Upcoming)...`);
        await db.insert(competitions).values({
            id: nanoid(),
            name: 'Bells University League',
            sport: 'Football',
            format: 'league',
            season: '2026',
            status: 'upcoming',
            description: 'Official University League - Coming Soon',
            level: 'busa-league',
            isFeatured: true,
            displayOrder: 10 // Show lower down or upcoming
        });
        console.log('Created Bells University League.');
    } else {
        console.log(`\n'Bells University League' already exists.`);
    }

    console.log('\n--- Verify Updates ---');
    const updatedComps = await db.select().from(competitions);
    updatedComps.forEach(c => console.log(`[${c.id}] ${c.name} (${c.status})`));
}

manageCompetitions().catch(console.error);
