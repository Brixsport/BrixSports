import * as dotenv from 'dotenv';
import { db } from './index';
import { competitions } from './schema';
import { nanoid } from 'nanoid';

// Load environment variables
dotenv.config();

/**
 * Add NPUGA Basketball Competition (Potential Half-Court/3x3)
 */
async function addNpugaBasketball() {
    console.log('🏀 Adding NPUGA Basketball Competition...');

    try {
        const npugaBasketball = {
            id: nanoid(),
            name: 'NPUGA Basketball Championship',
            sport: 'Basketball',
            format: 'knockout', // Tournament style
            season: '2026',
            startDate: new Date('2026-03-18'),
            endDate: new Date('2026-03-22'),
            description: 'NPUGA Basketball Championship. Format (Full Court vs Half Court/3x3) to be confirmed.',
            level: 'inter-university',
            scope: 'external',
            numberOfTeams: 8,
            playersPerSide: 5, // Defaulting to 5, can be updated to 3 for half-court later
            gender: 'mixed',
            registrationOpen: true,
            registrationDeadline: new Date('2026-03-10'),
            maxTeams: 16,
            entryFee: 'Free',
            hostOrganization: 'Bells University',
            status: 'upcoming',
            rules: JSON.stringify({
                matchDuration: 40, // or 10 mins for 3x3
                formatNote: 'Subject to change to Half-Court (3x3)',
                overtime: true,
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.insert(competitions).values(npugaBasketball);

        console.log('✅ NPUGA Basketball added successfully!');
        console.log(`   - Name: ${npugaBasketball.name}`);
        console.log(`   - Status: ${npugaBasketball.status}`);
        console.log(`   - Note: ${npugaBasketball.description}`);

    } catch (error) {
        console.error('❌ Error adding NPUGA Basketball:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    addNpugaBasketball()
        .then(() => {
            console.log('\n✅ Script completed.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}
