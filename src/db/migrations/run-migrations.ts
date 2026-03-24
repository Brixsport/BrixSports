/**
 * Run Database Migrations
 * 
 * This script runs all pending database migrations
 */

import { addMultiLoggerSupport } from './add-multi-logger-support';
import { addOrganizationOwnershipSupport } from './add-organization-ownership';
import { backfillPlayerTeamMemberships } from './backfill-player-team-memberships';
import { addOrganizationAffiliationsAndGovernance } from './add-organization-affiliations-and-governance';

async function runMigrations() {
    console.log('🚀 Starting database migrations...\n');

    try {
        // Run multi-logger migration
        await addMultiLoggerSupport();

        // Run organization ownership migration
        await addOrganizationOwnershipSupport();

        // Run player team membership migration
        await backfillPlayerTeamMemberships();

        // Run organization affiliations and competition governance migration
        await addOrganizationAffiliationsAndGovernance();

        console.log('\n✅ All migrations completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migrations
runMigrations();
