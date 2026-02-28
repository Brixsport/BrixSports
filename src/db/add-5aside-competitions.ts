import * as dotenv from 'dotenv';
import { db } from './index';
import { competitions } from './schema';
import { nanoid } from 'nanoid';

// Load environment variables
dotenv.config();

/**
 * Add NPUGA 5-Aside Football Competition
 * Hosted by Bells University
 */

async function addNpugaCompetition() {
    console.log('🏆 Adding NPUGA 5-Aside Football Competition...');

    try {
        const npugaCompetition = {
            id: nanoid(),
            name: 'NPUGA 5-Aside Football Championship',
            sport: 'Football',
            format: 'knockout', // Knockout tournament
            season: '2026',
            startDate: new Date('2026-03-15'),
            endDate: new Date('2026-03-20'),
            description: 'Nigerian Private Universities Games Association (NPUGA) 5-Aside Football Championship hosted by Bells University',
            level: 'inter-university',
            scope: 'external',
            numberOfTeams: 12,
            playersPerSide: 5, // 5-aside format
            gender: 'mixed', // Mixed gender competition
            registrationOpen: true,
            registrationDeadline: new Date('2026-03-01'),
            maxTeams: 12,
            entryFee: 'Free',
            hostOrganization: 'Bells University',
            status: 'upcoming',
            rules: JSON.stringify({
                matchDuration: 40,
                playersPerSide: 5,
                extraTime: false,
                penalties: true,
                rounds: ['Round of 16', 'Quarter Finals', 'Semi Finals', 'Final'],
                substitutions: 3,
                yellowCardSuspension: 2,
                redCardSuspension: 1,
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.insert(competitions).values(npugaCompetition);

        console.log('✅ NPUGA Competition added successfully!');
        console.log(`   - Competition ID: ${npugaCompetition.id}`);
        console.log(`   - Name: ${npugaCompetition.name}`);
        console.log(`   - Format: ${npugaCompetition.playersPerSide}-aside ${npugaCompetition.format}`);
        console.log(`   - Teams: ${npugaCompetition.numberOfTeams}`);
        console.log(`   - Registration Open: ${npugaCompetition.registrationOpen}`);
        console.log(`   - Host: ${npugaCompetition.hostOrganization}`);
    } catch (error) {
        console.error('❌ Error adding NPUGA competition:', error);
        throw error;
    }
}

/**
 * Add Female 5-Aside University Competition
 */
async function addFemale5AsideCompetition() {
    console.log('🏆 Adding Female 5-Aside University Competition...');

    try {
        const femaleCompetition = {
            id: nanoid(),
            name: 'Nigerian Universities Female 5-Aside Championship',
            sport: 'Football',
            format: 'group_knockout',
            season: '2026',
            startDate: new Date('2026-04-10'),
            endDate: new Date('2026-04-15'),
            description: 'Inter-university female 5-aside football championship',
            level: 'inter-university',
            scope: 'external',
            numberOfTeams: 8,
            numberOfGroups: 2,
            teamsPerGroup: 4,
            playersPerSide: 5,
            gender: 'female', // Female-only competition
            registrationOpen: true,
            registrationDeadline: new Date('2026-03-25'),
            maxTeams: 8,
            entryFee: 'Free',
            hostOrganization: 'University of Lagos',
            status: 'upcoming',
            rules: JSON.stringify({
                matchDuration: 40,
                playersPerSide: 5,
                groupStage: {
                    pointsForWin: 3,
                    pointsForDraw: 1,
                    pointsForLoss: 0,
                    teamsToAdvance: 2,
                },
                knockout: {
                    extraTime: false,
                    penalties: true,
                    rounds: ['Semi Finals', 'Final'],
                },
                substitutions: 3,
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.insert(competitions).values(femaleCompetition);

        console.log('✅ Female 5-Aside Competition added successfully!');
        console.log(`   - Competition ID: ${femaleCompetition.id}`);
        console.log(`   - Name: ${femaleCompetition.name}`);
        console.log(`   - Format: ${femaleCompetition.playersPerSide}-aside ${femaleCompetition.format}`);
        console.log(`   - Gender: ${femaleCompetition.gender}`);
        console.log(`   - Teams: ${femaleCompetition.numberOfTeams}`);
    } catch (error) {
        console.error('❌ Error adding Female 5-Aside competition:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    Promise.all([
        addNpugaCompetition(),
        addFemale5AsideCompetition(),
    ])
        .then(() => {
            console.log('\n✅ All competitions added successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Failed to add competitions:', error);
            process.exit(1);
        });
}

export { addNpugaCompetition, addFemale5AsideCompetition };
