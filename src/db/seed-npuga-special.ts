
import { db } from './index';
import { teams, players, matches, competitions, loggers, matchLoggerAssignments } from './schema';
import { nanoid } from 'nanoid';
import { eq, or, like } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

async function seedNpugaSpecial() {
    console.log('🚀 Starting NPUGA Special Edition Seed...\n');

    try {
        // 1. Ensure Competition Exists
        const competitionName = 'NPUGA Special Edition';
        let competition = await db.query.competitions.findFirst({
            where: (c, { eq }) => eq(c.name, competitionName),
        });

        if (!competition) {
            console.log('➕ Creating Competition...');
            const newComp = {
                id: 'npuga-special-2026',
                name: competitionName,
                sport: 'Football',
                format: 'league',
                season: '2026',
                startDate: new Date('2026-03-01'),
                endDate: new Date('2026-03-10'),
                description: 'NPUGA Special Edition 5-aside Football Tournament',
                level: 'inter-university',
                playersPerSide: 5,
                status: 'ongoing',
                registrationOpen: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await db.insert(competitions).values(newComp);
            competition = newComp as any;
            console.log('✅ Competition created.');
        } else {
            console.log('⏭️ Competition already exists.');
        }

        // 2. Ensure Teams Exist
        const team1Name = 'Bells University';
        const team2Name = 'Covenant University';

        let bells = await db.query.teams.findFirst({
            where: (t, { eq }) => eq(t.name, team1Name),
        });

        let covenant = await db.query.teams.findFirst({
            where: (t, { eq }) => eq(t.name, team2Name),
        });

        if (!bells) {
            console.log('➕ Creating Bells University Team...');
            const id = 'bells-uni-id';
            await db.insert(teams).values({
                id,
                name: team1Name,
                shortName: 'BELLS',
                logo: '',
                university: 'Ota, Ogun State',
                color: '#EA580C',
                sport: 'Football',
            });
            bells = { id } as any;
        }

        if (!covenant) {
            console.log('➕ Creating Covenant University Team...');
            const id = 'covenant-uni-id';
            await db.insert(teams).values({
                id,
                name: team2Name,
                shortName: 'COV',
                logo: '',
                university: 'Ota, Ogun State',
                color: '#7C3AED',
                sport: 'Football',
            });
            covenant = { id } as any;
        }

        // 3. Ensure Players (5 each)
        const ensurePlayers = async (teamId: string, teamShort: string) => {
            const existing = await db.query.players.findMany({
                where: (p, { eq }) => eq(p.teamId, teamId),
            });
            if (existing.length < 5) {
                console.log(`➕ Adding players for ${teamShort}...`);
                for (let i = 1; i <= 5; i++) {
                    await db.insert(players).values({
                        id: `p-${teamShort.toLowerCase()}-${i}-${nanoid(4)}`,
                        name: `${teamShort} Player ${i}`,
                        jerseyName: `PLAYER ${i}`,
                        number: 10 + i,
                        teamId: teamId,
                        position: i === 1 ? 'Goalkeeper' : 'Forward',
                        rating: 7.0,
                    });
                }
            }
        };
        await ensurePlayers(bells!.id, 'BELLS');
        await ensurePlayers(covenant!.id, 'COV');

        // 4. Ensure Loggers
        const loggerEmails = ['test-logger@brix.com', 'admin@brixsport.com'];
        const LoggerIds: string[] = [];

        for (const email of loggerEmails) {
            let logger = await db.query.loggers.findFirst({
                where: (l, { eq }) => eq(l.email, email),
            });

            if (!logger) {
                console.log(`➕ Creating Logger: ${email}...`);
                const id = nanoid();
                const hashedPassword = await bcrypt.hash('password123', 10);
                await db.insert(loggers).values({
                    id,
                    name: email.split('@')[0],
                    email,
                    password: hashedPassword,
                    role: email.includes('admin') ? 'admin' : 'logger',
                    status: 'active',
                    isAvailable: true,
                });
                LoggerIds.push(id);
            } else {
                LoggerIds.push(logger.id);
            }
        }

        // 5. Create Match
        const matchId = 'npuga-test-match-1';
        const existingMatch = await db.query.matches.findFirst({
            where: (m, { eq }) => eq(m.id, matchId),
        });

        if (existingMatch) {
            console.log('🗑️ Cleaning up existing test match and assignments...');
            await db.delete(matchLoggerAssignments).where(eq(matchLoggerAssignments.matchId, matchId));
            await db.delete(matches).where(eq(matches.id, matchId));
        }

        console.log('➕ Creating Match...');
        const startTime = new Date();
        startTime.setMinutes(startTime.getMinutes() + 5);

        await db.insert(matches).values({
            id: matchId,
            sport: 'Football',
            homeTeamId: bells!.id,
            awayTeamId: covenant!.id,
            homeScore: 0,
            awayScore: 0,
            status: 'UPCOMING',
            startTime: startTime.toISOString(),
            venue: 'NPuga Central Arena',
            competition: competitionName,
            matchType: 'competition',
            competitionLevel: 'inter-university',
            loggerId: LoggerIds[0], // Fallback for old system
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // 6. Create Assignments for ALL test loggers
        console.log('➕ Creating Logger Assignments...');
        for (const loggerId of LoggerIds) {
            await db.insert(matchLoggerAssignments).values({
                id: nanoid(),
                matchId: matchId,
                loggerId: loggerId,
                role: 'primary',
                status: 'active',
                assignedAt: new Date(),
            });
        }

        console.log('\n✅ SEED COMPLETE!');
        console.log(`Match ID: ${matchId}`);
        console.log(`Assigned Loggers: ${loggerEmails.join(', ')}`);
        console.log(`Password: password123`);

    } catch (error) {
        console.error('❌ Seed Failed:', error);
    }
}

seedNpugaSpecial().then(() => process.exit(0));
