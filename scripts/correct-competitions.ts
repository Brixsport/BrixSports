
import { db } from '../src/db';
import { competitions } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function correctCompetitions() {
    console.log('--- Correcting Competitions ---');

    // 1. Rename "Bells University League" to "BUSA League"
    // BUSA = Bells University Students Association
    const bellsLeague = await db.select().from(competitions)
        .where(eq(competitions.name, 'Bells University League'))
        .get();

    if (bellsLeague) {
        console.log('Renaming "Bells University League" to "BUSA League"...');
        await db.update(competitions)
            .set({
                name: 'BUSA League',
                description: 'Bells University Students Association League',
                level: 'busa-league',
                season: '2026'
            })
            .where(eq(competitions.id, bellsLeague.id));
    } else {
        // If it doesn't exist (maybe already renamed or not created), check if BUSA League exists for 2026
        const busa = await db.select().from(competitions)
            .where(and(eq(competitions.name, 'BUSA League'), eq(competitions.season, '2026')))
            .get();

        if (!busa) {
            console.log('Creating "BUSA League" (Football)...');
            await db.insert(competitions).values({
                id: nanoid(),
                name: 'BUSA League',
                sport: 'Football',
                format: 'league',
                season: '2026',
                status: 'upcoming',
                description: 'Bells University Students Association League',
                level: 'busa-league',
                scope: 'internal',
                isFeatured: true,
                displayOrder: 2
            });
        }
    }

    // 2. Ensure "Normal" NPUGA exists (separate from Special Edition)
    // We have NPUGA Special Edition (ongoing/upcoming)
    // We need NPUGA Games (or similar) for the main event later
    const normalNpuga = await db.select().from(competitions)
        .where(eq(competitions.name, 'NPUGA Games'))
        .get();

    if (!normalNpuga) {
        console.log('Creating "NPUGA Games" (Normal Edition)...');

        // Football
        await db.insert(competitions).values({
            id: nanoid(),
            name: 'NPUGA Games',
            sport: 'Football',
            format: 'league', // or knockout/group
            season: '2026',
            status: 'upcoming',
            description: 'Nigerian Private University Games Association',
            level: 'inter-university',
            scope: 'external',
            isFeatured: true, // Maybe not featured yet if it's main later
            displayOrder: 10
        });

        // Basketball
        await db.insert(competitions).values({
            id: nanoid(),
            name: 'NPUGA Games',
            sport: 'Basketball',
            format: 'league', // or knockout/group
            season: '2026',
            status: 'upcoming',
            description: 'Nigerian Private University Games Association',
            level: 'inter-university',
            scope: 'external',
            isFeatured: true,
            displayOrder: 11
        });
    } else {
        console.log('"NPUGA Games" already exists.');
    }

    console.log('\n--- Final list ---');
    const all = await db.select().from(competitions);
    const seen = new Set();
    all.forEach(c => {
        // Determine uniqueness for display
        const label = `${c.name} (${c.sport}) [${c.season}]`;
        console.log(`[${c.id}] ${label} - ${c.status}`);
    });
}

correctCompetitions().catch(console.error);
