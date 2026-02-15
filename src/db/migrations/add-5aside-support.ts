import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Migration: Add 5-aside and registration support
 * 
 * NOTE: With Drizzle ORM, schema changes are applied automatically when you:
 * 1. Update the schema.ts file (already done ✅)
 * 2. Push the schema to the database using drizzle-kit
 * 
 * This script provides instructions for applying the migration.
 */

async function migrate() {
    console.log('🔄 5-Aside and Registration Support Migration\n');
    console.log('✅ Schema has been updated in src/db/schema.ts\n');
    console.log('📝 New features added:');
    console.log('   - playersPerSide field in competitions table');
    console.log('   - gender field in competitions table');
    console.log('   - registrationOpen field in competitions table');
    console.log('   - registrationDeadline field in competitions table');
    console.log('   - maxTeams field in competitions table');
    console.log('   - entryFee field in competitions table');
    console.log('   - hostOrganization field in competitions table');
    console.log('   - team_registrations table');
    console.log('   - registered_players table\n');

    console.log('🚀 To apply these changes to your database:\n');
    console.log('Option 1: Using Drizzle Kit (Recommended)');
    console.log('  npm run db:push');
    console.log('  # or');
    console.log('  npx drizzle-kit push:sqlite\n');

    console.log('Option 2: Generate and run migrations');
    console.log('  npx drizzle-kit generate:sqlite');
    console.log('  npx drizzle-kit migrate\n');

    console.log('Option 3: If using Turso');
    console.log('  turso db shell <your-db-name>');
    console.log('  # Then run the SQL commands manually\n');

    console.log('📚 After migration, you can:');
    console.log('  1. Run: tsx src/db/add-5aside-competitions.ts');
    console.log('     (Adds NPUGA and Female 5-Aside competitions)');
    console.log('  2. Access registration at: /competitions/{id}/register\n');

    console.log('✅ Schema is ready! Run the appropriate command above to apply changes.');
}

// Run migration
if (require.main === module) {
    migrate()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Error:', error);
            process.exit(1);
        });
}

export { migrate };
