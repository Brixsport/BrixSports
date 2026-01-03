import * as dotenv from 'dotenv';
import { db } from './index';
import { teams, players, matches, standings } from './schema';

// Load environment variables
dotenv.config();

/**
 * BUSA League Football Seeding Script
 * Seeds 16 teams in 4 groups (A, B, C, D) with actual match data
 */

async function seedBusaFootball() {
    console.log('🏆 Seeding BUSA League Football (16 Teams - Group Stage + Knockout)...');

    try {
        // Define 16 BUSA Football Teams (4 groups of 4 teams each)
        const busaTeams = [
            // Group A
            {
                id: 'busa-joga',
                name: 'Joga-Bonito',
                shortName: 'JOG',
                logo: '/assests/Logos/football/joga bonito-fc.jpg',
                university: 'Bells University',
                color: '#FF6B00',
                sport: 'Football',
                group: 'A',
            },
            {
                id: 'busa-wolves',
                name: 'Wolves FC',
                shortName: 'WOL',
                logo: '/assests/Logos/football/wolves-fc.png',
                university: 'Bells University',
                color: '#FDB913',
                sport: 'Football',
                group: 'A',
            },
            {
                id: 'busa-westbridge',
                name: 'Westbridge',
                shortName: 'WES',
                logo: '/assests/Logos/football/Westbridge-fc.jpg',
                university: 'Bells University',
                color: '#0066CC',
                sport: 'Football',
                group: 'A',
            },
            {
                id: 'busa-prime',
                name: 'Prime FC',
                shortName: 'PRI',
                logo: '/assests/Logos/football/prime-fc.jpg',
                university: 'Bells University',
                color: '#FFD700',
                sport: 'Football',
                group: 'A',
            },
            // Group B
            {
                id: 'busa-kings',
                name: 'Kings FC',
                shortName: 'KIN',
                logo: '/assests/Logos/football/kings-fc.jpg',
                university: 'Bells University',
                color: '#4B0082',
                sport: 'Football',
                group: 'B',
            },
            {
                id: 'busa-hammers',
                name: 'Hammers',
                shortName: 'HAM',
                logo: '/assests/Logos/football/hammers-fc.jpg',
                university: 'Bells University',
                color: '#7A263A',
                sport: 'Football',
                group: 'B',
            },
            {
                id: 'busa-cruise',
                name: 'Cruise FC',
                shortName: 'CRU',
                logo: '/assests/Logos/football/cruise-fc.jpg',
                university: 'Bells University',
                color: '#00BFFF',
                sport: 'Football',
                group: 'B',
            },
            {
                id: 'busa-santos',
                name: 'Santos',
                shortName: 'SAN',
                logo: '/assests/Logos/football/santos-fc.jpg',
                university: 'Bells University',
                color: '#000000',
                sport: 'Football',
                group: 'B',
            },
            // Group C
            {
                id: 'busa-legacy',
                name: 'Legacy FC',
                shortName: 'LEG',
                logo: '/assests/Logos/football/legacy-fc.jpg',
                university: 'Bells University',
                color: '#8B4513',
                sport: 'Football',
                group: 'C',
            },
            {
                id: 'busa-agenda',
                name: 'Agenda FC',
                shortName: 'AGE',
                logo: '/assests/Logos/football/agenda-fc.jpg',
                university: 'Bells University',
                color: '#2E8B57',
                sport: 'Football',
                group: 'C',
            },
            {
                id: 'busa-allianz',
                name: 'Allianz FC',
                shortName: 'ALL',
                logo: '/assests/Logos/football/allianz-fc.jpg',
                university: 'Bells University',
                color: '#0047AB',
                sport: 'Football',
                group: 'C',
            },
            {
                id: 'busa-lafabrica',
                name: 'La Fabrica',
                shortName: 'FAB',
                logo: '/assests/Logos/football/la-fabrica.jpg',
                university: 'Bells University',
                color: '#DC143C',
                sport: 'Football',
                group: 'C',
            },
            // Group D
            {
                id: 'busa-underrated',
                name: 'Underrated FC',
                shortName: 'UND',
                logo: '/assests/Logos/football/underrated-fc.jpg',
                university: 'Bells University',
                color: '#FF1493',
                sport: 'Football',
                group: 'D',
            },
            {
                id: 'busa-quantum',
                name: 'Quantum FC',
                shortName: 'QUA',
                logo: '/assests/Logos/football/quantum-fc.jpg',
                university: 'Bells University',
                color: '#9400D3',
                sport: 'Football',
                group: 'D',
            },
            {
                id: 'busa-pirates',
                name: 'Pirates FC',
                shortName: 'PIR',
                logo: '/assests/Logos/football/pirates-fc.jpg',
                university: 'Bells University',
                color: '#000000',
                sport: 'Football',
                group: 'D',
            },
            {
                id: 'busa-deadline',
                name: 'Deadline FC',
                shortName: 'DEA',
                logo: '/assests/Logos/football/Deadline-fc.jpeg',
                university: 'Bells University',
                color: '#FF4500',
                sport: 'Football',
                group: 'D',
            },
        ];

        // Teams already exist in database - skipping insertion
        // Insert Teams
        // console.log('📋 Inserting 16 BUSA Football teams...');
        // for (const team of busaTeams) {
        //     await db.insert(teams).values(team);
        // }

        console.log('✅ Using existing teams in database');

        // Note: Player rosters will be added separately for semi-finalists
        // (Joga-Bonito, Kings FC, Hammers, Pirates FC)
        console.log('⚠️  Player rosters should be uploaded separately for semi-finalists');

        // Actual match data from the competition
        const matchData = [
            { date: "07/11/2025", group: "A", round: "1", home: "Joga", away: "Wolves FC", homeScore: 7, awayScore: 0, status: "FINISHED" },
            { date: "08/11/2025", group: "C", round: "1", home: "Legacy FC", away: "Agenda FC", homeScore: 0, awayScore: 2, status: "FINISHED" },
            { date: "08/11/2025", group: "C", round: "1", home: "Allianz FC", away: "La Fabrica", homeScore: 1, awayScore: 1, status: "FINISHED" },
            { date: "08/11/2025", group: "D", round: "1", home: "Underrated FC", away: "Quantum FC", homeScore: 4, awayScore: 0, status: "FINISHED" },
            { date: "08/11/2025", group: "B", round: "1", home: "Kings FC", away: "Hammers", homeScore: 2, awayScore: 0, status: "FINISHED" },
            { date: "09/11/2025", group: "A", round: "1", home: "Westbridge", away: "Prime FC", homeScore: 2, awayScore: 3, status: "FINISHED" },
            { date: "09/11/2025", group: "B", round: "1", home: "Cruise FC", away: "Santos", homeScore: 4, awayScore: 2, status: "FINISHED" },
            { date: "12/11/2025", group: "C", round: "2", home: "Allianz FC", away: "Agenda FC", homeScore: 1, awayScore: 1, status: "FINISHED" },
            { date: "14/11/2025", group: "A", round: "2", home: "Joga", away: "Westbridge", homeScore: 4, awayScore: 0, status: "FINISHED" },
            { date: "15/11/2025", group: "C", round: "2", home: "Legacy FC", away: "La Fabrica", homeScore: 0, awayScore: 1, status: "FINISHED" },
            { date: "15/11/2025", group: "A", round: "2", home: "Wolves FC", away: "Prime FC", homeScore: 0, awayScore: 1, status: "FINISHED" },
            { date: "15/11/2025", group: "D", round: "2", home: "Pirates FC", away: "Quantum FC", homeScore: 2, awayScore: 1, status: "FINISHED" },
            { date: "15/11/2025", group: "B", round: "2", home: "Cruise FC", away: "Hammers", homeScore: 2, awayScore: 2, status: "FINISHED" },
            { date: "16/11/2025", group: "D", round: "2", home: "Underrated FC", away: "Deadline FC", homeScore: 3, awayScore: 1, status: "FINISHED" },
            { date: "16/11/2025", group: "B", round: "2", home: "Kings FC", away: "Santos", homeScore: 5, awayScore: 0, status: "FINISHED" },
            { date: "19/11/2025", group: "B", round: "3", home: "Hammers", away: "Santos", homeScore: 6, awayScore: 0, status: "FINISHED" },
            { date: "21/11/2025", group: "D", round: "3", home: "Pirates FC", away: "Deadline FC", homeScore: 10, awayScore: 0, status: "FINISHED" },
            { date: "22/11/2025", group: "B", round: "3", home: "Kings FC", away: "Cruise FC", homeScore: 15, awayScore: 0, status: "FINISHED" },
            { date: "22/11/2025", group: "A", round: "3", home: "Wolves FC", away: "Westbridge", homeScore: 3, awayScore: 1, status: "FINISHED" },
            { date: "22/11/2025", group: "C", round: "3", home: "Agenda FC", away: "La Fabrica", homeScore: 5, awayScore: 1, status: "FINISHED" },
            { date: "22/11/2025", group: "A", round: "3", home: "Joga", away: "Prime FC", homeScore: 4, awayScore: 0, status: "FINISHED" },
            { date: "23/11/2025", group: "C", round: "3", home: "Allianz FC", away: "Legacy FC", homeScore: 3, awayScore: 0, status: "FINISHED" },
            { date: "23/11/2025", group: "D", round: "3", home: "Pirates FC", away: "Underrated FC", homeScore: 1, awayScore: 0, status: "FINISHED" },
            { date: "10/12/2025", group: null, round: "QF", home: "Kings FC", away: "Allianz FC", homeScore: 1, awayScore: 0, status: "FINISHED" },
            { date: "12/12/2025", group: null, round: "QF", home: "Agenda FC", away: "Hammers", homeScore: 1, awayScore: 3, status: "FINISHED" },
            { date: "13/12/2025", group: null, round: "QF", home: "Pirates FC", away: "Prime FC", homeScore: 3, awayScore: 0, status: "FINISHED" },
            { date: "14/12/2025", group: null, round: "QF", home: "Joga", away: "Underrated FC", homeScore: 1, awayScore: 0, status: "FINISHED" },
            // Semi-Finals
            { date: "09/01/2026", group: null, round: "SF", home: "Kings FC", away: "Pirates FC", homeScore: 0, awayScore: 0, status: "UPCOMING" },
            { date: "11/01/2026", group: null, round: "SF", home: "Joga ", away: "Hammers", homeScore: 0, awayScore: 0, status: "UPCOMING" },
        ];

        // Helper function to get team ID from name
        const getTeamId = (teamName: string): string => {
            const teamMap: Record<string, string> = {
                'Joga': 'busa-joga',
                'Wolves FC': 'busa-wolves',
                'Westbridge': 'busa-westbridge',
                'Prime FC': 'busa-prime',
                'Kings FC': 'busa-kings',
                'Hammers': 'busa-hammers',
                'Cruise FC': 'busa-cruise',
                'Santos': 'busa-santos',
                'Legacy FC': 'busa-legacy',
                'Agenda FC': 'busa-agenda',
                'Allianz FC': 'busa-allianz',
                'La Fabrica': 'busa-lafabrica',
                'Underrated FC': 'busa-underrated',
                'Quantum FC': 'busa-quantum',
                'Pirates FC': 'busa-pirates',
                'Deadline FC': 'busa-deadline',
            };
            return teamMap[teamName] || '';
        };

        // Helper function to parse date (DD/MM/YYYY)
        const parseDate = (dateStr: string): Date => {
            const [day, month, year] = dateStr.split('/');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        };

        // Insert matches
        console.log('⚽ Inserting matches...');
        let matchId = 1;
        for (const match of matchData) {
            const homeTeamId = getTeamId(match.home);
            const awayTeamId = getTeamId(match.away);
            const matchDate = parseDate(match.date);

            await db.insert(matches).values({
                id: `busa-match-${matchId}`,
                sport: 'Football',
                homeTeamId,
                awayTeamId,
                homeScore: match.homeScore,
                awayScore: match.awayScore,
                status: match.status,
                startTime: matchDate.toISOString(),
                venue: 'BELLS UNIVERSITY FOOTBALL PITCH',
                competition: match.group
                    ? `BUSA League Football - Group ${match.group}`
                    : match.round === 'SF'
                        ? 'BUSA League Football - Semi Finals'
                        : 'BUSA League Football - Quarter Finals',
                stats: JSON.stringify({
                    possession: [50 + Math.random() * 20 - 10, 50 + Math.random() * 20 - 10],
                    shots: [Math.floor(Math.random() * 15) + 5, Math.floor(Math.random() * 15) + 5],
                    shotsOnTarget: [Math.floor(Math.random() * 8) + 2, Math.floor(Math.random() * 8) + 2],
                    corners: [Math.floor(Math.random() * 10), Math.floor(Math.random() * 10)],
                    fouls: [Math.floor(Math.random() * 15), Math.floor(Math.random() * 15)],
                    yellowCards: [Math.floor(Math.random() * 3), Math.floor(Math.random() * 3)],
                    redCards: [0, 0],
                }),
            });
            matchId++;
        }

        // Calculate standings for each group
        console.log('📊 Calculating group standings...');
        const groupStats: Record<string, Record<string, any>> = {
            'A': {}, 'B': {}, 'C': {}, 'D': {}
        };

        // Initialize stats for all teams
        busaTeams.forEach(team => {
            if (team.group) {
                groupStats[team.group][team.id] = {
                    teamId: team.id,
                    played: 0,
                    won: 0,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    goalDifference: 0,
                    points: 0,
                };
            }
        });

        // Calculate stats from group stage matches
        matchData.forEach(match => {
            if (match.group && match.status === 'FINISHED') {
                const homeTeamId = getTeamId(match.home);
                const awayTeamId = getTeamId(match.away);
                const homeStats = groupStats[match.group][homeTeamId];
                const awayStats = groupStats[match.group][awayTeamId];

                if (homeStats && awayStats) {
                    homeStats.played++;
                    awayStats.played++;
                    homeStats.goalsFor += match.homeScore;
                    homeStats.goalsAgainst += match.awayScore;
                    awayStats.goalsFor += match.awayScore;
                    awayStats.goalsAgainst += match.homeScore;

                    if (match.homeScore > match.awayScore) {
                        homeStats.won++;
                        homeStats.points += 3;
                        awayStats.lost++;
                    } else if (match.homeScore < match.awayScore) {
                        awayStats.won++;
                        awayStats.points += 3;
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
            }
        });

        // Insert standings
        let standingId = 1;
        for (const group of ['A', 'B', 'C', 'D']) {
            for (const teamId in groupStats[group]) {
                const stats = groupStats[group][teamId];
                await db.insert(standings).values({
                    id: `busa-standing-${standingId}`,
                    teamId: stats.teamId,
                    sport: 'Football',
                    competition: `BUSA League Football - Group ${group}`,
                    ...stats,
                });
                standingId++;
            }
        }

        console.log('✅ BUSA League Football seeded successfully!');
        console.log(`   - 16 Teams inserted (4 groups)`);
        console.log(`   - ${matchData.length} Matches inserted`);
        console.log(`   - Group stage completed, Quarter Finals finished, Semi Finals scheduled`);
        console.log(`   - ⚠️  Upload player rosters for semi-finalists: Joga-Bonito, Kings FC, Hammers, Pirates FC`);
    } catch (error) {
        console.error('❌ Error seeding BUSA League Football:', error);
        throw error;
    }
}

// Run seed if this file is executed directly
if (require.main === module) {
    seedBusaFootball()
        .then(() => {
            console.log('Seed completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Seed failed:', error);
            process.exit(1);
        });
}

export { seedBusaFootball };
