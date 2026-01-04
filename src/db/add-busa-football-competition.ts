import * as dotenv from 'dotenv';
import { db } from './index';
import { competitions } from './schema';
import { nanoid } from 'nanoid';

// Load environment variables
dotenv.config();

/**
 * Add BUSA League Football Competition to the competitions table
 */

async function addBusaFootballCompetition() {
    console.log('🏆 Adding BUSA League Football to competitions...');

    try {
        const busaFootballCompetition = {
            id: nanoid(),
            name: 'BUSA LEAGUE FOOTBALL',
            sport: 'Football',
            format: 'group_knockout', // Group stage followed by knockout
            season: '2025/2026',
            startDate: new Date('2025-11-07'),
            endDate: new Date('2026-01-15'),
            description: 'BUSA League Football Championship - 16 teams competing in group stages followed by knockout rounds',
            level: 'busa-league',
            scope: 'internal',
            numberOfTeams: 16,
            numberOfGroups: 4,
            teamsPerGroup: 4,
            status: 'ongoing',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.insert(competitions).values(busaFootballCompetition);

        console.log('✅ BUSA League Football competition added successfully!');
        console.log(`   - Competition ID: ${busaFootballCompetition.id}`);
        console.log(`   - Name: ${busaFootballCompetition.name}`);
        console.log(`   - Format: ${busaFootballCompetition.format}`);
        console.log(`   - Teams: ${busaFootballCompetition.numberOfTeams}`);
    } catch (error) {
        console.error('❌ Error adding BUSA League Football competition:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    addBusaFootballCompetition()
        .then(() => {
            console.log('Competition added successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Failed to add competition:', error);
            process.exit(1);
        });
}

export { addBusaFootballCompetition };
