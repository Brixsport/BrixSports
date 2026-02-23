
import { db } from '../src/db';
import { competitions } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function updateNpugaDetails() {
    console.log('--- Updating NPUGA Competitions Details ---');

    // 1. NPUGA Special Edition (Football)
    // Check if exists
    const specialFootball = await db.select().from(competitions)
        .where(and(eq(competitions.name, 'NPUGA Special Edition'), eq(competitions.sport, 'Football')))
        .get();

    const specialDetails = {
        season: '2026',
        startDate: new Date('2026-02-24'),
        endDate: new Date('2026-02-28'),
        hostOrganization: 'Bells University',
        description: 'Special Mini-Edition hosted at Bells University. Featuring 5-Aside Football, Half Court Basketball, Table Tennis, Scrabble, and Chess.',
        status: 'upcoming', // Or ongoing depending on detailed status logic (it's Feb 24-28, current date is Feb 18, so 'upcoming')
        isFeatured: true,
        displayOrder: 1
    };

    if (specialFootball) {
        console.log('Updating NPUGA Special Edition (Football)...');
        await db.update(competitions)
            .set({
                ...specialDetails,
                format: '5-aside', // Custom format if useful, or just 'knockout'/'league'
                // We can put details in rules or description
                rules: JSON.stringify({ format: '5-aside', notes: 'Hosted at Bells University' })
            })
            .where(eq(competitions.id, specialFootball.id));
    } else {
        console.log('Creating NPUGA Special Edition (Football)...');
        await db.insert(competitions).values({
            id: nanoid(),
            name: 'NPUGA Special Edition',
            sport: 'Football',
            format: '5-aside',
            level: 'inter-university',
            scope: 'external',
            ...specialDetails
        });
    }

    // 2. NPUGA Special Edition (Basketball)
    // "Half Court Basketball" -> 3x3?
    const specialBasketball = await db.select().from(competitions)
        .where(and(eq(competitions.name, 'NPUGA Special Edition'), eq(competitions.sport, 'Basketball')))
        .get();

    if (specialBasketball) {
        console.log('Updating NPUGA Special Edition (Basketball)...');
        await db.update(competitions)
            .set({
                ...specialDetails,
                format: '3x3', // Half court usually implies 3x3
                rules: JSON.stringify({ format: 'Half Court (3x3)', notes: 'Hosted at Bells University' })
            })
            .where(eq(competitions.id, specialBasketball.id));
    } else {
        console.log('Creating NPUGA Special Edition (Basketball)...');
        await db.insert(competitions).values({
            id: nanoid(),
            name: 'NPUGA Special Edition',
            sport: 'Basketball',
            format: '3x3',
            level: 'inter-university',
            scope: 'external',
            ...specialDetails
        });
    }

    // 3. NPUGA Special Edition (Other Sports)
    const otherSports = ['Table Tennis', 'Scrabble', 'Chess'];

    for (const sport of otherSports) {
        const specialOther = await db.select().from(competitions)
            .where(and(eq(competitions.name, 'NPUGA Special Edition'), eq(competitions.sport, sport)))
            .get();

        if (specialOther) {
            console.log(`Updating NPUGA Special Edition (${sport})...`);
            await db.update(competitions)
                .set({
                    ...specialDetails,
                    format: 'tournament', // Generic tournament format
                    rules: JSON.stringify({ notes: `Hosted at Bells University. ${sport} Event.` })
                })
                .where(eq(competitions.id, specialOther.id));
        } else {
            console.log(`Creating NPUGA Special Edition (${sport})...`);
            await db.insert(competitions).values({
                id: nanoid(),
                name: 'NPUGA Special Edition',
                sport: sport,
                format: 'tournament',
                level: 'inter-university',
                scope: 'external',
                ...specialDetails
            });
        }
    }

    // 4. Main NPUGA Games
    // User says "Main competition... sometime this year".
    // I will create generic entries for this.

    const mainSports = ['Football', 'Basketball'];

    for (const sport of mainSports) {
        const mainComp = await db.select().from(competitions)
            .where(and(eq(competitions.name, 'NPUGA Games'), eq(competitions.sport, sport)))
            .get();

        const mainDetails = {
            season: '2026',
            status: 'upcoming', // Sometime this year
            description: 'Main NPUGA Games 2026. The full edition of the Nigerian Private University Games Association championships.',
            level: 'inter-university',
            scope: 'external',
            isFeatured: true,
            displayOrder: 10
        };

        if (mainComp) {
            console.log(`Updating Main NPUGA Games (${sport})...`);
            await db.update(competitions)
                .set(mainDetails)
                .where(eq(competitions.id, mainComp.id));
        } else {
            console.log(`Creating Main NPUGA Games (${sport})...`);
            await db.insert(competitions).values({
                id: nanoid(),
                name: 'NPUGA Games',
                sport: sport,
                format: 'tournament',
                ...mainDetails
            });
        }
    }

    console.log('\n--- Final Comparison ---');
    const all = await db.select().from(competitions);
    all.forEach(c => console.log(`[${c.name}] (${c.sport}) - ${c.description?.substring(0, 50)}...`));
}

updateNpugaDetails().catch(console.error);
