import * as dotenv from 'dotenv';
import { db } from './index';
import { matches, standings } from './schema';

// Load environment variables
dotenv.config();

/**
 * BUSA League Basketball Seeding Script
 * Seeds basketball matches for 6 teams across 10 rounds
 */

async function seedBusaBasketball() {
    console.log('🏀 Seeding BUSA League Basketball (6 Teams - 10 Rounds)...');

    try {
        // Basketball team IDs (from database)
        const teamIds = {
            'TBK': 'NVn_ZGTVuW_Kqx-7I1X7O',
            'Titans': '6ocT9QcqlCS0Di7YiiT0h',
            'Storm': 'Nxf9Wm4L1bCSx711CE_l8',
            'Rim Reapers': 'fDc2Kpc5Z4-h1kFb7h1fA',
            'Vikings': 'TVHhcL_BZEPOw1Hm0G0Ss',
            'Siberia': 'OabMzhI_Zv0vfmQu5kEqQ'
        };

        // Match data for all 10 rounds
        const matchData = [
            // Round 1
            { round: 1, date: '2025-01-15', home: 'TBK', away: 'Titans', homeScore: 48, awayScore: 30, mvp: 'KOSI' },
            { round: 1, date: '2025-01-15', home: 'Storm', away: 'Rim Reapers', homeScore: 48, awayScore: 25, mvp: 'JORDAN' },
            { round: 1, date: '2025-01-15', home: 'Vikings', away: 'Siberia', homeScore: 33, awayScore: 48, mvp: 'JUBA' },

            // Round 2
            { round: 2, date: '2025-01-22', home: 'Titans', away: 'Vikings', homeScore: 20, awayScore: 39, mvp: 'DAVID' },
            { round: 2, date: '2025-01-22', home: 'TBK', away: 'Rim Reapers', homeScore: 32, awayScore: 28, mvp: 'KOSI' },
            { round: 2, date: '2025-01-22', home: 'Storm', away: 'Siberia', homeScore: 43, awayScore: 34, mvp: 'JORDAN' },

            // Round 3
            { round: 3, date: '2025-01-29', home: 'Storm', away: 'Vikings', homeScore: 37, awayScore: 38, mvp: 'DAVID' },
            { round: 3, date: '2025-01-29', home: 'Titans', away: 'Rim Reapers', homeScore: 29, awayScore: 24, mvp: 'ADE' },
            { round: 3, date: '2025-01-29', home: 'TBK', away: 'Siberia', homeScore: 35, awayScore: 24, mvp: 'RICHARD' },

            // Round 4
            { round: 4, date: '2025-02-05', home: 'Siberia', away: 'Titans', homeScore: 39, awayScore: 44, mvp: 'DONALD' },
            { round: 4, date: '2025-02-05', home: 'TBK', away: 'Storm', homeScore: 33, awayScore: 32, mvp: 'KOSI' },
            { round: 4, date: '2025-02-05', home: 'Vikings', away: 'Rim Reapers', homeScore: 64, awayScore: 53, mvp: 'DAVID' },

            // Round 5
            { round: 5, date: '2025-02-12', home: 'Rim Reapers', away: 'Siberia', homeScore: 54, awayScore: 58, mvp: 'JUBA' },
            { round: 5, date: '2025-02-12', home: 'Titans', away: 'Storm', homeScore: 35, awayScore: 34, mvp: 'ADEYEMO' },
            { round: 5, date: '2025-02-12', home: 'TBK', away: 'Vikings', homeScore: 43, awayScore: 37, mvp: 'KOSI' },

            // Round 6
            { round: 6, date: '2025-02-19', home: 'TBK', away: 'Titans', homeScore: 38, awayScore: 22, mvp: 'KOSI' },
            { round: 6, date: '2025-02-19', home: 'Storm', away: 'Rim Reapers', homeScore: 64, awayScore: 33, mvp: 'JORDAN' },
            { round: 6, date: '2025-02-19', home: 'Vikings', away: 'Siberia', homeScore: 48, awayScore: 44, mvp: 'DAVID' },

            // Round 7
            { round: 7, date: '2025-02-26', home: 'Titans', away: 'Vikings', homeScore: 22, awayScore: 30, mvp: 'DAVID' },
            { round: 7, date: '2025-02-26', home: 'TBK', away: 'Rim Reapers', homeScore: 30, awayScore: 24, mvp: 'KOSI' },
            { round: 7, date: '2025-02-26', home: 'Storm', away: 'Siberia', homeScore: 37, awayScore: 44, mvp: 'JUBA' },

            // Round 8
            { round: 8, date: '2025-03-05', home: 'Storm', away: 'Vikings', homeScore: 56, awayScore: 49, mvp: 'JABBAR' },
            { round: 8, date: '2025-03-05', home: 'Titans', away: 'Rim Reapers', homeScore: 44, awayScore: 27, mvp: 'DONALD' },
            { round: 8, date: '2025-03-05', home: 'TBK', away: 'Siberia', homeScore: 35, awayScore: 36, mvp: 'JUBA' },

            // Round 9
            { round: 9, date: '2025-03-12', home: 'Siberia', away: 'Titans', homeScore: 41, awayScore: 34, mvp: 'JUBA' },
            { round: 9, date: '2025-03-12', home: 'TBK', away: 'Storm', homeScore: 44, awayScore: 40, mvp: 'RICHARD' },
            { round: 9, date: '2025-03-12', home: 'Vikings', away: 'Rim Reapers', homeScore: 53, awayScore: 49, mvp: 'DAVID' },

            // Round 10
            { round: 10, date: '2025-03-19', home: 'Rim Reapers', away: 'Siberia', homeScore: 47, awayScore: 58, mvp: 'VICTOR' },
            { round: 10, date: '2025-03-19', home: 'Titans', away: 'Storm', homeScore: 42, awayScore: 43, mvp: 'JORDAN' },
            { round: 10, date: '2025-03-19', home: 'TBK', away: 'Vikings', homeScore: 22, awayScore: 25, mvp: 'JESSE' },
        ];

        // Helper function to get team ID from name
        const getTeamId = (teamName: string): string => {
            return teamIds[teamName as keyof typeof teamIds] || '';
        };

        // Insert matches
        console.log('⚽ Inserting basketball matches...');
        let matchId = 1;
        for (const match of matchData) {
            const homeTeamId = getTeamId(match.home);
            const awayTeamId = getTeamId(match.away);
            const matchDate = new Date(match.date);

            await db.insert(matches).values({
                id: `busa-basketball-${matchId}`,
                sport: 'Basketball',
                homeTeamId,
                awayTeamId,
                homeScore: match.homeScore,
                awayScore: match.awayScore,
                status: 'FINISHED',
                startTime: matchDate.toISOString(),
                venue: 'BELLS UNIVERSITY BASKETBALL COURT',
                competition: `BUSA League Basketball - Round ${match.round}`,
                stats: JSON.stringify({
                    round: match.round,
                    mvp: match.mvp,
                    // Basketball stats
                    fieldGoals: [Math.floor(Math.random() * 30) + 15, Math.floor(Math.random() * 30) + 15],
                    threePointers: [Math.floor(Math.random() * 10) + 3, Math.floor(Math.random() * 10) + 3],
                    freeThrows: [Math.floor(Math.random() * 15) + 5, Math.floor(Math.random() * 15) + 5],
                    rebounds: [Math.floor(Math.random() * 40) + 20, Math.floor(Math.random() * 40) + 20],
                    assists: [Math.floor(Math.random() * 20) + 5, Math.floor(Math.random() * 20) + 5],
                    steals: [Math.floor(Math.random() * 10) + 2, Math.floor(Math.random() * 10) + 2],
                    blocks: [Math.floor(Math.random() * 8) + 1, Math.floor(Math.random() * 8) + 1],
                    turnovers: [Math.floor(Math.random() * 15) + 5, Math.floor(Math.random() * 15) + 5],
                }),
            });
            matchId++;
        }

        // Calculate standings
        console.log('📊 Calculating standings...');
        const teamStats: Record<string, any> = {};

        // Initialize stats for all teams
        Object.values(teamIds).forEach(teamId => {
            teamStats[teamId] = {
                teamId,
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalDifference: 0,
                points: 0,
            };
        });

        // Calculate stats from matches
        matchData.forEach(match => {
            const homeTeamId = getTeamId(match.home);
            const awayTeamId = getTeamId(match.away);
            const homeStats = teamStats[homeTeamId];
            const awayStats = teamStats[awayTeamId];

            if (homeStats && awayStats) {
                homeStats.played++;
                awayStats.played++;
                homeStats.goalsFor += match.homeScore;
                homeStats.goalsAgainst += match.awayScore;
                awayStats.goalsFor += match.awayScore;
                awayStats.goalsAgainst += match.homeScore;

                if (match.homeScore > match.awayScore) {
                    homeStats.won++;
                    homeStats.points += 2; // Basketball: 2 points for win
                    awayStats.lost++;
                } else if (match.homeScore < match.awayScore) {
                    awayStats.won++;
                    awayStats.points += 2;
                    homeStats.lost++;
                } else {
                    homeStats.drawn++;
                    awayStats.drawn++;
                    homeStats.points += 1;
                    awayStats.points += 1;
                }

                homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
                awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;
            }
        });

        // Insert standings
        let standingId = 1;
        for (const teamId in teamStats) {
            const stats = teamStats[teamId];
            await db.insert(standings).values({
                id: `busa-basketball-standing-${standingId}`,
                teamId: stats.teamId,
                sport: 'Basketball',
                competition: 'BUSA League Basketball',
                ...stats,
            });
            standingId++;
        }

        console.log('✅ BUSA League Basketball seeded successfully!');
        console.log(`   - 6 Teams`);
        console.log(`   - ${matchData.length} Matches inserted (10 rounds)`);
        console.log(`   - Standings calculated`);
    } catch (error) {
        console.error('❌ Error seeding BUSA League Basketball:', error);
        throw error;
    }
}

// Run seed if this file is executed directly
if (require.main === module) {
    seedBusaBasketball()
        .then(() => {
            console.log('Seed completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Seed failed:', error);
            process.exit(1);
        });
}

export { seedBusaBasketball };
