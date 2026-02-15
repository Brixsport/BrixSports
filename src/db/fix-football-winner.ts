import * as dotenv from 'dotenv';
import { db } from './index';
import { competitions } from './schema';
import { eq } from 'drizzle-orm';

dotenv.config();

/**
 * Fix BUSA League Football winner to Kings FC
 */

async function fixFootballWinner() {
    console.log('🔧 Fixing BUSA League Football winner...\n');

    try {
        const footballCompId = 'xm1OcBFeugKxLDHH6Xi6p'; // BUSA LEAGUE FOOTBALL
        const kingsFCId = 'busa-kings'; // Kings FC

        await db.update(competitions)
            .set({
                winnerId: kingsFCId,
                highlights: 'Kings FC crowned champions of BUSA League Football 2025/2026 season!',
                updatedAt: new Date(),
            })
            .where(eq(competitions.id, footballCompId));

        console.log('✅ Football winner updated!');
        console.log(`   - Competition: BUSA LEAGUE FOOTBALL`);
        console.log(`   - Winner: Kings FC`);
        console.log(`   - Status: completed\n`);

        // Verify
        const updated = await db.query.competitions.findFirst({
            where: eq(competitions.id, footballCompId),
            with: {
                winner: true,
            },
        });

        if (updated?.winner) {
            console.log('✅ Verification successful!');
            console.log(`   - Winner name: ${updated.winner.name}`);
            console.log(`   - Winner ID: ${updated.winnerId}`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    fixFootballWinner()
        .then(() => {
            console.log('\n✅ Winner fixed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

export { fixFootballWinner };
