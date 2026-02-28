
import { db } from '../src/db';
import { competitions } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function addUpcomingCompetitions() {
    console.log('--- Adding Upcoming Competitions (Football & Basketball) ---');

    const newCompetitions = [
        {
            name: 'Intercollege Competition',
            description: 'Internal Intercollege Championship',
            level: 'college',
            items: [
                { sport: 'Football', format: 'knockout' },
                { sport: 'Basketball', format: 'knockout' }
            ]
        },
        {
            name: 'BUESA League',
            description: 'Bells University Engineering Students Association League',
            level: 'department',
            items: [
                { sport: 'Football', format: 'league' },
                { sport: 'Basketball', format: 'league' }
            ]
        }
    ];

    for (const comp of newCompetitions) {
        for (const item of comp.items) {
            // Check if exists
            const existing = await db.select().from(competitions)
                .where(
                    and(
                        eq(competitions.name, comp.name),
                        eq(competitions.sport, item.sport)
                    )
                ).get();

            if (!existing) {
                console.log(`Creating ${comp.name} (${item.sport})...`);
                await db.insert(competitions).values({
                    id: nanoid(),
                    name: comp.name,
                    sport: item.sport, // 'Football' or 'Basketball'
                    format: item.format,
                    season: '2026',
                    status: 'upcoming',
                    description: comp.description,
                    level: comp.level as any,
                    scope: 'internal',
                    isFeatured: true,
                    displayOrder: 5
                });
            } else {
                console.log(`${comp.name} (${item.sport}) already exists.`);
            }
        }
    }

    console.log('\n--- Current Competitions List ---');
    const all = await db.select().from(competitions);
    all.forEach(c => console.log(`- ${c.name} (${c.sport}) [${c.status}]`));
}

addUpcomingCompetitions().catch(console.error);
