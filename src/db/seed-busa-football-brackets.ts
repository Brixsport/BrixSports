import * as dotenv from 'dotenv';
import { db } from './index';
import { bracketNodes } from './schema';

// Load environment variables
dotenv.config();

/**
 * BUSA League Football Bracket Seeding Script
 * Creates bracket structure for Quarter Finals and Semi Finals
 */

async function seedBusaFootballBrackets() {
    console.log('🏆 Seeding BUSA League Football Brackets...');

    try {
        // Define bracket nodes for the knockout stages
        const brackets = [
            // SEMI FINALS (2 matches)
            {
                id: 'busa-fb-sf1',
                competition: 'BUSA LEAGUE FOOTBALL',
                sport: 'Football',
                title: 'Semi-Final 1',
                matchId: null, // Will be linked when match is created
                nextMatchId: 'busa-fb-final',
                homeTeamId: 'busa-kings',
                awayTeamId: 'busa-pirates',
                homeScore: null,
                awayScore: null,
                status: 'UPCOMING',
                round: 'SEMI_FINAL',
                position: 1,
            },
            {
                id: 'busa-fb-sf2',
                competition: 'BUSA LEAGUE FOOTBALL',
                sport: 'Football',
                title: 'Semi-Final 2',
                matchId: null, // Will be linked when match is created
                nextMatchId: 'busa-fb-final',
                homeTeamId: 'busa-joga',
                awayTeamId: 'busa-hammers',
                homeScore: null,
                awayScore: null,
                status: 'UPCOMING',
                round: 'SEMI_FINAL',
                position: 2,
            },
            // QUARTER FINALS (4 matches - already finished)
            {
                id: 'busa-fb-qf1',
                competition: 'BUSA LEAGUE FOOTBALL',
                sport: 'Football',
                title: 'Quarter-Final 1',
                matchId: null,
                nextMatchId: 'busa-fb-sf1',
                homeTeamId: 'busa-kings',
                awayTeamId: 'busa-allianz',
                homeScore: 1,
                awayScore: 0,
                status: 'FINISHED',
                round: 'QUARTER_FINAL',
                position: 1,
            },
            {
                id: 'busa-fb-qf2',
                competition: 'BUSA LEAGUE FOOTBALL',
                sport: 'Football',
                title: 'Quarter-Final 2',
                matchId: null,
                nextMatchId: 'busa-fb-sf2',
                homeTeamId: 'busa-agenda',
                awayTeamId: 'busa-hammers',
                homeScore: 1,
                awayScore: 3,
                status: 'FINISHED',
                round: 'QUARTER_FINAL',
                position: 2,
            },
            {
                id: 'busa-fb-qf3',
                competition: 'BUSA LEAGUE FOOTBALL',
                sport: 'Football',
                title: 'Quarter-Final 3',
                matchId: null,
                nextMatchId: 'busa-fb-sf1',
                homeTeamId: 'busa-pirates',
                awayTeamId: 'busa-prime',
                homeScore: 3,
                awayScore: 0,
                status: 'FINISHED',
                round: 'QUARTER_FINAL',
                position: 3,
            },
            {
                id: 'busa-fb-qf4',
                competition: 'BUSA LEAGUE FOOTBALL',
                sport: 'Football',
                title: 'Quarter-Final 4',
                matchId: null,
                nextMatchId: 'busa-fb-sf2',
                homeTeamId: 'busa-joga',
                awayTeamId: 'busa-underrated',
                homeScore: 1,
                awayScore: 0,
                status: 'FINISHED',
                round: 'QUARTER_FINAL',
                position: 4,
            },
            // FINAL (placeholder - teams TBD)
            {
                id: 'busa-fb-final',
                competition: 'BUSA LEAGUE FOOTBALL',
                sport: 'Football',
                title: 'Final',
                matchId: null,
                nextMatchId: null,
                homeTeamId: null,
                awayTeamId: null,
                homeScore: null,
                awayScore: null,
                status: 'PENDING',
                round: 'FINAL',
                position: 1,
            },
        ];

        // Insert bracket nodes
        console.log('📊 Inserting bracket nodes...');
        for (const bracket of brackets) {
            await db.insert(bracketNodes).values({
                ...bracket,
                createdAt: new Date(),
            });
        }

        console.log('✅ BUSA League Football Brackets seeded successfully!');
        console.log(`   - ${brackets.length} bracket nodes created`);
        console.log(`   - 4 Quarter Finals (FINISHED)`);
        console.log(`   - 2 Semi Finals (UPCOMING)`);
        console.log(`   - 1 Final (PENDING - awaits semi-final results)`);
    } catch (error) {
        console.error('❌ Error seeding BUSA League Football Brackets:', error);
        throw error;
    }
}

// Run seed if this file is executed directly
if (require.main === module) {
    seedBusaFootballBrackets()
        .then(() => {
            console.log('Bracket seed completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Bracket seed failed:', error);
            process.exit(1);
        });
}

export { seedBusaFootballBrackets };
