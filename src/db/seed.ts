import { db } from './index';
import { teams, players, matches, loggers, standings, bracketNodes } from './schema';

async function seed() {
    console.log('🌱 Seeding database...');

    try {
        // Clear existing data
        console.log('Clearing existing data...');
        await db.delete(bracketNodes);
        await db.delete(standings);
        await db.delete(matches);
        await db.delete(players);
        await db.delete(teams);
        await db.delete(loggers);

        // Insert Teams
        console.log('Inserting teams...');
        await db.insert(teams).values([
            {
                id: 'unilag',
                name: 'UNILAG Marines',
                shortName: 'LAG',
                logo: '🌊',
                university: 'University of Lagos',
                color: '#003366',
                played: 5,
                won: 4,
                drawn: 1,
                lost: 0,
                goalsFor: 12,
                goalsAgainst: 3,
                points: 13,
            },
            {
                id: 'uniben',
                name: 'UNIBEN Royals',
                shortName: 'BEN',
                logo: '🦁',
                university: 'University of Benin',
                color: '#990000',
                played: 5,
                won: 3,
                drawn: 1,
                lost: 1,
                goalsFor: 8,
                goalsAgainst: 5,
                points: 10,
            },
            {
                id: 'ui',
                name: 'UI Pioneers',
                shortName: 'UI',
                logo: '🎓',
                university: 'University of Ibadan',
                color: '#FFD700',
                played: 5,
                won: 2,
                drawn: 2,
                lost: 1,
                goalsFor: 6,
                goalsAgainst: 6,
                points: 8,
            },
            {
                id: 'oau',
                name: 'OAU Ife Giants',
                shortName: 'OAU',
                logo: '🐘',
                university: 'Obafemi Awolowo University',
                color: '#000080',
                played: 5,
                won: 1,
                drawn: 2,
                lost: 2,
                goalsFor: 4,
                goalsAgainst: 7,
                points: 5,
            },
        ]);

        // Insert Players
        console.log('Inserting players...');
        await db.insert(players).values([
            {
                id: 'p1',
                name: 'Tunde Adeyemi',
                number: 10,
                teamId: 'unilag',
                position: 'ST',
                rating: 8.5,
                eyePoints: 12,
                age: 21,
                height: '185cm',
                nationality: 'Nigeria',
                attributes: JSON.stringify({ speed: 88, shooting: 92, passing: 78, dribbling: 85, defense: 45, physical: 80 }),
            },
            {
                id: 'p2',
                name: 'Emeka Obi',
                number: 7,
                teamId: 'uniben',
                position: 'CM',
                rating: 7.8,
                eyePoints: 8,
                age: 22,
                attributes: JSON.stringify({ speed: 75, shooting: 70, passing: 88, dribbling: 82, defense: 72, physical: 75 }),
            },
            {
                id: 'p3',
                name: 'Segun Bello',
                number: 9,
                teamId: 'unilag',
                position: 'LW',
                rating: 8.2,
                eyePoints: 15,
                age: 20,
                attributes: JSON.stringify({ speed: 94, shooting: 80, passing: 75, dribbling: 90, defense: 30, physical: 65 }),
            },
            {
                id: 'p4',
                name: 'Chisom Oke',
                number: 4,
                teamId: 'unilag',
                position: 'CB',
                rating: 7.5,
                eyePoints: 3,
                age: 23,
                attributes: JSON.stringify({ speed: 70, shooting: 40, passing: 65, dribbling: 50, defense: 92, physical: 95 }),
            },
            {
                id: 'p5',
                name: 'Adebayo Johnson',
                number: 11,
                teamId: 'ui',
                position: 'RW',
                rating: 7.9,
                eyePoints: 10,
                age: 21,
                attributes: JSON.stringify({ speed: 90, shooting: 85, passing: 72, dribbling: 88, defense: 35, physical: 70 }),
            },
            {
                id: 'p6',
                name: 'Oluwaseun Ajayi',
                number: 5,
                teamId: 'oau',
                position: 'CDM',
                rating: 7.6,
                eyePoints: 5,
                age: 22,
                attributes: JSON.stringify({ speed: 72, shooting: 60, passing: 80, dribbling: 70, defense: 88, physical: 85 }),
            },
        ]);

        // Insert Matches
        console.log('Inserting matches...');
        const now = new Date();
        const matchesSeed = [
            {
                id: 'm1',
                sport: 'Football',
                homeTeamId: 'unilag',
                awayTeamId: 'uniben',
                homeScore: 2,
                awayScore: 1,
                status: 'LIVE',
                startTime: new Date(now.getTime() - 3600000), // 1 hour ago
                venue: 'UNILAG Sports Center',
                competition: 'NUGA Games 2024',
                loggerId: 'l1',
                stats: JSON.stringify({
                    possession: [58, 42],
                    shots: [12, 7],
                    shotsOnTarget: [5, 3],
                    corners: [6, 2],
                    fouls: [8, 11],
                    yellowCards: [1, 2],
                    redCards: [0, 0],
                }),
                lineups: JSON.stringify({
                    home: [
                        { playerId: 'p1', rating: 8.5, position: 'ST', status: 'playing' },
                        { playerId: 'p3', rating: 7.9, position: 'LW', status: 'playing' },
                        { playerId: 'p4', rating: 7.2, position: 'CB', status: 'playing' },
                    ],
                    away: [
                        { playerId: 'p2', rating: 7.8, position: 'CM', status: 'playing' },
                    ],
                }),
            },
            {
                id: 'm2',
                sport: 'Track',
                homeTeamId: 'unilag',
                awayTeamId: 'ui',
                homeScore: 0,
                awayScore: 0,
                status: 'UPCOMING',
                startTime: new Date(now.getTime() + 86400000), // Tomorrow
                venue: 'UNILAG Track',
                competition: 'NUGA Track Finals',
                loggerId: 'l1',
                stats: JSON.stringify({
                    possession: [0, 0],
                    shots: [0, 0],
                    shotsOnTarget: [0, 0],
                    corners: [0, 0],
                    fouls: [0, 0],
                    yellowCards: [0, 0],
                    redCards: [0, 0],
                }),
            },
            {
                id: 'm3',
                sport: 'Basketball',
                homeTeamId: 'ui',
                awayTeamId: 'oau',
                homeScore: 0,
                awayScore: 0,
                status: 'UPCOMING',
                startTime: new Date(now.getTime() + 172800000), // 2 days from now
                venue: 'UI Sports Complex',
                competition: 'NUGA Basketball Championship',
                loggerId: 'l1',
                stats: JSON.stringify({
                    possession: [0, 0],
                    shots: [0, 0],
                    shotsOnTarget: [0, 0],
                    corners: [0, 0],
                    fouls: [0, 0],
                    yellowCards: [0, 0],
                    redCards: [0, 0],
                }),
            },
        ];

        for (const match of matchesSeed) {
            await db.insert(matches).values({
                id: match.id,
                sport: match.sport,
                homeTeamId: match.homeTeamId,
                awayTeamId: match.awayTeamId,
                homeScore: match.homeScore,
                awayScore: match.awayScore,
                status: match.status,
                startTime: new Date(match.startTime).toISOString(),
                venue: match.venue,
                competition: match.competition,
                loggerId: match.loggerId,
                stats: match.stats,
                lineups: match.lineups,
            });
        }

        // Insert Loggers
        console.log('Inserting loggers...');
        await db.insert(loggers).values([
            {
                id: 'l1',
                name: 'John Logger',
                email: 'admin@brix.com',
                password: 'admin', // In production, this should be hashed
                role: 'admin',
            },
        ]);

        // Insert Standings
        console.log('Inserting standings...');
        await db.insert(standings).values([
            {
                id: 's1',
                teamId: 'unilag',
                sport: 'Football',
                competition: 'NUGA Games 2024',
                played: 5,
                won: 4,
                drawn: 1,
                lost: 0,
                goalsFor: 12,
                goalsAgainst: 3,
                goalDifference: 9,
                points: 13,
            },
            {
                id: 's2',
                teamId: 'uniben',
                sport: 'Football',
                competition: 'NUGA Games 2024',
                played: 5,
                won: 3,
                drawn: 1,
                lost: 1,
                goalsFor: 8,
                goalsAgainst: 5,
                goalDifference: 3,
                points: 10,
            },
            {
                id: 's3',
                teamId: 'ui',
                sport: 'Football',
                competition: 'NUGA Games 2024',
                played: 5,
                won: 2,
                drawn: 2,
                lost: 1,
                goalsFor: 6,
                goalsAgainst: 6,
                goalDifference: 0,
                points: 8,
            },
            {
                id: 's4',
                teamId: 'oau',
                sport: 'Football',
                competition: 'NUGA Games 2024',
                played: 5,
                won: 1,
                drawn: 2,
                lost: 2,
                goalsFor: 4,
                goalsAgainst: 7,
                goalDifference: -3,
                points: 5,
            },
        ]);

        // Insert Bracket Nodes
        console.log('Inserting bracket nodes...');
        await db.insert(bracketNodes).values([
            {
                id: 'f1',
                competition: 'NUGA Games 2024',
                sport: 'Football',
                title: 'Final',
                status: 'PENDING',
                round: 'FINAL',
                position: 1,
            },
            {
                id: 'sf1',
                competition: 'NUGA Games 2024',
                sport: 'Football',
                title: 'Semi-Final 1',
                nextMatchId: 'f1',
                homeTeamId: 'unilag',
                awayTeamId: 'oau',
                status: 'PENDING',
                round: 'SEMI_FINAL',
                position: 1,
            },
            {
                id: 'sf2',
                competition: 'NUGA Games 2024',
                sport: 'Football',
                title: 'Semi-Final 2',
                nextMatchId: 'f1',
                homeTeamId: 'uniben',
                awayTeamId: 'ui',
                status: 'PENDING',
                round: 'SEMI_FINAL',
                position: 2,
            },
        ]);

        console.log('✅ Database seeded successfully!');
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    }
}

// Run seed if this file is executed directly
if (require.main === module) {
    seed()
        .then(() => {
            console.log('Seed completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Seed failed:', error);
            process.exit(1);
        });
}

export { seed };
