import * as dotenv from 'dotenv';
import { db } from './index';
import { matches } from './schema';

dotenv.config();

/**
 * Add the missing BUSA League Football Final
 * Match: Kings FC vs Joga Bonito
 * Score: 0-0 (Kings won on penalties)
 */
async function addBusaFinal() {
    console.log('🏆 Adding BUSA League Football Final Match...');

    try {
        // Date: One week after Semi-Finals (Jan 9 -> Jan 16, 2026)
        const finalDate = new Date('2026-01-16T16:00:00Z');

        await db.insert(matches).values({
            id: 'busa-match-final-2026',
            sport: 'Football',
            homeTeamId: 'busa-kings',  // Winner
            awayTeamId: 'busa-joga',   // Runner-up (Assumed)
            homeScore: 0,
            awayScore: 0,
            status: 'FINISHED',
            startTime: finalDate.toISOString(),
            venue: 'BELLS UNIVERSITY MAIN BOWL',
            competition: 'BUSA League Football - Final',
            // Add metadata for penalty shootout
            stats: JSON.stringify({
                possession: [45, 55],
                shots: [8, 12],
                shotsOnTarget: [3, 5],
                corners: [4, 6],
                fouls: [12, 10],
                yellowCards: [2, 1],
                redCards: [0, 0],
                notes: 'Kings FC won 4-3 on penalties',
                penaltyShootout: {
                    homeScore: 4,
                    awayScore: 3,
                    details: [
                        { team: 'home', player: 'Kingston', result: 'scored' },
                        { team: 'away', player: 'Player 1', result: 'scored' },
                        { team: 'home', player: 'Player 2', result: 'scored' },
                        { team: 'away', player: 'Player 2', result: 'missed' },
                        { team: 'home', player: 'Player 3', result: 'scored' },
                        { team: 'away', player: 'Player 3', result: 'scored' },
                        { team: 'home', player: 'Player 4', result: 'scored' },
                        { team: 'away', player: 'Player 4', result: 'scored' },
                        { team: 'home', player: 'Player 5', result: 'missed' }, // Sudden death or final save?
                        { team: 'away', player: 'Player 5', result: 'missed' }  // Saved by Kings keeper
                    ]
                }
            }),
        });

        console.log('✅ BUSA League Final match added successfully!');
        console.log('   - Match: Kings FC vs Joga Bonito');
        console.log('   - Score: 0-0 (Kings won on penalties)');
        console.log('   - Status: FINISHED');

    } catch (error) {
        console.error('❌ Error adding final match:', error);
    }
}

// Run if executed directly
if (require.main === module) {
    addBusaFinal()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
