/**
 * Run Database Migrations
 * 
 * This script runs all pending database migrations
 */

import { addMultiLoggerSupport } from './add-multi-logger-support';

async function runMigrations() {
    console.log('🚀 Starting database migrations...\n');

    try {
        // Run multi-logger migration
        await addMultiLoggerSupport();

        console.log('\n✅ All migrations completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migrations
runMigrations();
