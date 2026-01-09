import { db } from '../src/db';
import { matches, loggers } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function assignMatchesToLogger() {
    try {
        const loggerEmail = process.argv[2];
        const matchId = process.argv[3];

        if (!loggerEmail) {
            console.error('❌ Please provide a logger email');
            console.log('\nUsage:');
            console.log('  npm run assign-match <logger-email> [match-id]');
            console.log('\nExamples:');
            console.log('  npm run assign-match emmanuelowolanke24@gmail.com busa-match-sf2');
            console.log('  npm run assign-match emmanuelowolanke24@gmail.com  (assigns all upcoming matches)');
            process.exit(1);
        }

        // Find the logger
        const logger = await db
            .select()
            .from(loggers)
            .where(eq(loggers.email, loggerEmail.toLowerCase()))
            .get();

        if (!logger) {
            console.error(`❌ Logger with email "${loggerEmail}" not found`);
            process.exit(1);
        }

        console.log(`\n✅ Found logger: ${logger.name} (${logger.email})\n`);

        // Get matches to assign
        let matchesToAssign;

        if (matchId) {
            // Assign specific match
            const match = await db
                .select()
                .from(matches)
                .where(eq(matches.id, matchId))
                .get();

            if (!match) {
                console.error(`❌ Match with ID "${matchId}" not found`);
                process.exit(1);
            }

            matchesToAssign = [match];
        } else {
            // Assign all upcoming matches
            const allMatches = await db.select().from(matches).all();
            matchesToAssign = allMatches.filter(m =>
                (m.status === 'UPCOMING' || m.status === 'LIVE') && !m.loggerId
            );
        }

        if (matchesToAssign.length === 0) {
            console.log('ℹ️  No unassigned upcoming/live matches found');
            process.exit(0);
        }

        console.log(`📋 Assigning ${matchesToAssign.length} match(es) to ${logger.name}:\n`);

        // Assign matches
        for (const match of matchesToAssign) {
            await db
                .update(matches)
                .set({ loggerId: logger.id })
                .where(eq(matches.id, match.id))
                .run();

            console.log(`  ✅ ${match.competition} - ${match.sport}`);
            console.log(`     Match ID: ${match.id}`);
            console.log(`     Status: ${match.status}`);
            console.log(`     Start Time: ${new Date(match.startTime).toLocaleString()}\n`);
        }

        console.log(`\n🎉 Successfully assigned ${matchesToAssign.length} match(es) to ${logger.name}`);
        console.log(`\n💡 The logger can now access these matches at /logger\n`);

    } catch (error) {
        console.error('❌ Error assigning matches:', error);
        process.exit(1);
    }
}

assignMatchesToLogger();
