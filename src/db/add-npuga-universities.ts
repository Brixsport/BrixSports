import * as dotenv from 'dotenv';
import { db } from './index';
import { teams } from './schema';
import { nanoid } from 'nanoid';

dotenv.config();

/**
 * Add NPUGA Member Universities as Teams
 * These universities can register for NPUGA competitions
 */

const npugaUniversities = [
    { name: 'Achievers University', shortName: 'ACH', location: 'Owo, Ondo State', color: '#1E40AF' },
    { name: 'Adeleke University', shortName: 'ADE', location: 'Ede, Osun State', color: '#7C3AED' },
    { name: 'Afe Babalola University', shortName: 'ABUAD', location: 'Ado Ekiti, Ekiti State', color: '#DC2626' },
    { name: 'Ajayi Crowther University', shortName: 'ACU', location: 'Oyo, Oyo State', color: '#059669' },
    { name: 'Al-Hikmah University', shortName: 'AHU', location: 'Ilorin, Kwara State', color: '#0891B2' },
    { name: 'American University of Nigeria', shortName: 'AUN', location: 'Yola, Adamawa State', color: '#DC2626' },
    { name: 'Babcock University', shortName: 'BU', location: 'Ilishan-Remo, Ogun State', color: '#7C3AED' },
    { name: 'Bells University of Technology', shortName: 'BELLS', location: 'Ota, Ogun State', color: '#EA580C' },
    { name: 'Benson Idahosa University', shortName: 'BIU', location: 'Benin City, Edo State', color: '#DC2626' },
    { name: 'Bingham University', shortName: 'BHU', location: 'Karu, Nasarawa State', color: '#0891B2' },
    { name: 'Bowen University', shortName: 'BU', location: 'Iwo, Osun State', color: '#059669' },
    { name: 'Caleb University', shortName: 'CU', location: 'Imota, Lagos State', color: '#7C3AED' },
    { name: 'Covenant University', shortName: 'CU', location: 'Ota, Ogun State', color: '#7C3AED' },
    { name: 'Crescent University', shortName: 'CUAB', location: 'Abeokuta, Ogun State', color: '#059669' },
    { name: 'Edwin Clark University', shortName: 'ECU', location: 'Kiagbodo, Delta State', color: '#DC2626' },
    { name: 'Elizade University', shortName: 'EU', location: 'Ilara-Mokin, Ondo State', color: '#EA580C' },
    { name: 'Fountain University', shortName: 'FU', location: 'Osogbo, Osun State', color: '#0891B2' },
    { name: 'Godfrey Okoye University', shortName: 'GOUNI', location: 'Enugu, Enugu State', color: '#059669' },
    { name: 'Gregory University', shortName: 'GU', location: 'Uturu, Abia State', color: '#7C3AED' },
    { name: 'Igbinedion University', shortName: 'IU', location: 'Okada, Edo State', color: '#DC2626' },
    { name: 'Joseph Ayo Babalola University', shortName: 'JABU', location: 'Ikeji-Arakeji, Osun State', color: '#EA580C' },
    { name: 'Kwararafa University', shortName: 'KU', location: 'Wukari, Taraba State', color: '#0891B2' },
    { name: 'Landmark University', shortName: 'LMU', location: 'Omu-Aran, Kwara State', color: '#059669' },
    { name: 'Lead City University', shortName: 'LCU', location: 'Ibadan, Oyo State', color: '#7C3AED' },
    { name: 'Madonna University', shortName: 'MU', location: 'Okija, Anambra State', color: '#1E40AF' },
    { name: 'McPherson University', shortName: 'MCU', location: 'Seriki Sotayo, Ogun State', color: '#DC2626' },
    { name: 'Michael and Cecilia Ibru University', shortName: 'MCIU', location: 'Ughelli, Delta State', color: '#EA580C' },
    { name: 'Nile University of Nigeria', shortName: 'NUN', location: 'Abuja, FCT', color: '#0891B2' },
    { name: 'Oduduwa University', shortName: 'OU', location: 'Ipetu-Ijesha, Osun State', color: '#059669' },
    { name: 'Pan-Atlantic University', shortName: 'PAU', location: 'Lagos, Lagos State', color: '#7C3AED' },
    { name: 'Redeemers University', shortName: 'RUN', location: 'Ede, Osun State', color: '#DC2626' },
    { name: 'Renaissance University', shortName: 'RU', location: 'Enugu, Enugu State', color: '#EA580C' },
    { name: 'Ritman University', shortName: 'RU', location: 'Ikot Ekpene, Akwa Ibom State', color: '#0891B2' },
    { name: 'Salem University', shortName: 'SU', location: 'Lokoja, Kogi State', color: '#059669' },
    { name: 'Samuel Adegboyega University', shortName: 'SAU', location: 'Ogwa, Edo State', color: '#7C3AED' },
    { name: 'Veritas University', shortName: 'VU', location: 'Abuja, FCT', color: '#1E40AF' },
    { name: 'Wesley University', shortName: 'WU', location: 'Ondo, Ondo State', color: '#DC2626' },
    { name: 'Western Delta University', shortName: 'WDU', location: 'Oghara, Delta State', color: '#EA580C' },
];

async function addNpugaUniversities() {
    console.log('🏫 Adding NPUGA Member Universities as Teams...\n');

    try {
        let addedCount = 0;
        let skippedCount = 0;

        for (const university of npugaUniversities) {
            // Check if team already exists
            const existing = await db.query.teams.findFirst({
                where: (teams, { eq }) => eq(teams.name, university.name),
            });

            if (existing) {
                console.log(`⏭️  Skipped: ${university.name} (already exists)`);
                skippedCount++;
                continue;
            }

            // Add university as a team
            await db.insert(teams).values({
                id: nanoid(),
                name: university.name,
                shortName: university.shortName,
                logo: '', // Empty string instead of null
                university: university.location,
                color: university.color,
                sport: 'Football', // Default to Football for NPUGA
                createdAt: new Date(),
            });

            console.log(`✅ Added: ${university.name} (${university.shortName})`);
            addedCount++;
        }

        console.log('\n📊 Summary:');
        console.log(`   - Total universities: ${npugaUniversities.length}`);
        console.log(`   - Added: ${addedCount}`);
        console.log(`   - Skipped (already exist): ${skippedCount}`);
        console.log('\n✅ NPUGA universities ready for registration!');

    } catch (error) {
        console.error('❌ Error adding universities:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    addNpugaUniversities()
        .then(() => {
            console.log('\n✅ All universities added successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Failed to add universities:', error);
            process.exit(1);
        });
}

export { addNpugaUniversities };
