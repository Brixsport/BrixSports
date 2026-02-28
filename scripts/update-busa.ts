
import { db } from '../src/db';
import { competitions } from '../src/db/schema';
import { eq, or, like } from 'drizzle-orm';

async function updateBusa() {
    console.log('--- Updating BUSA Competitions ---');

    // 1. Delete redundant "Bells University League"
    const bellsLeague = await db.select().from(competitions)
        .where(eq(competitions.name, 'Bells University League')).get();

    if (bellsLeague) {
        console.log(`Deleting redundant: ${bellsLeague.name} (${bellsLeague.id})`);
        await db.delete(competitions).where(eq(competitions.id, bellsLeague.id));
    } else {
        console.log('No redundant "Bells University League" found.');
    }

    // 2. Identify and Update existing Football League to "Upcoming" for 2026?
    // The existing "BUSA LEAGUE FOOTBALL" is marked "completed".
    // Should we update it or create a new "2026 Season" entry?
    // Usually new season = new competition entry OR update status + season.
    // Given User request: "Upcoming we have... BUSA League"
    // Let's create a NEW entry for the 2026 season named "BUSA League" for Football.
    // And also one for Basketball.
    // The old "completed" ones can stay as historical records or archived.

    // Actually, checking if "BUSA League" (Upcoming 2026) exists first.
    const existing2026Football = await db.select().from(competitions)
        .where(and(
            eq(competitions.name, 'BUSA League'),
            eq(competitions.sport, 'Football'),
            eq(competitions.season, '2026')
        )).get();

    if (existing2026Football) {
        console.log('BUSA League (Football, 2026) already exists.');
    } else {
        console.log('Creating "BUSA League" (Football, 2026)...');
        await db.insert(competitions).values({
            id: require('nanoid').nanoid(),
            name: 'BUSA League',
            sport: 'Football',
            format: 'league',
            season: '2026',
            status: 'upcoming',
            description: 'Bells University Students Association League 2026',
            level: 'busa-league',
            scope: 'internal',
            isFeatured: true,
            displayOrder: 2
        });
    }

    const existing2026Basketball = await db.select().from(competitions)
        .where(and(
            eq(competitions.name, 'BUSA League'),
            eq(competitions.sport, 'Basketball'),
            eq(competitions.season, '2026')
        )).get();

    if (existing2026Basketball) {
        console.log('BUSA League (Basketball, 2026) already exists.');
    } else {
        console.log('Creating "BUSA League" (Basketball, 2026)...');
        await db.insert(competitions).values({
            id: require('nanoid').nanoid(),
            name: 'BUSA League',
            sport: 'Basketball',
            format: 'league',
            season: '2026',
            status: 'upcoming',
            description: 'Bells University Students Association League 2026',
            level: 'busa-league',
            scope: 'internal',
            isFeatured: true,
            displayOrder: 3
        });
    }

    // 3. Ensure Normal NPUGA Games (2026)
    const npugaGames = await db.select().from(competitions)
        .where(eq(competitions.name, 'NPUGA Games')).get();

    if (!npugaGames) {
        console.log('Creating "NPUGA Games" (Normal Edition)...');
        await db.insert(competitions).values({
            id: require('nanoid').nanoid(),
            name: 'NPUGA Games',
            sport: 'Football', // Main sport usually; can add Basketball too if needed
            format: 'tournament',
            season: '2026',
            status: 'upcoming',
            description: 'Nigerian Private University Games Association 2026',
            level: 'inter-university',
            scope: 'external',
            isFeatured: true,
            displayOrder: 10
        });
        // Add Basketball version too?
        await db.insert(competitions).values({
            id: require('nanoid').nanoid(),
            name: 'NPUGA Games',
            sport: 'Basketball',
            format: 'tournament',
            season: '2026',
            status: 'upcoming',
            description: 'NPUGA Games Basketball 2026',
            level: 'inter-university',
            scope: 'external',
            isFeatured: true,
            displayOrder: 11
        });

    } else {
        console.log('"NPUGA Games" already exists.');
    }

    console.log('\n--- Final Competition List ---');
    const all = await db.select().from(competitions);
    all.forEach(c => console.log(`[${c.id}] ${c.name} (${c.sport}) - ${c.status} [${c.season}]`));
}

// Helper needed because `and` import might be missing if I just pasted.
import { and } from 'drizzle-orm';

updateBusa().catch(console.error);
