/**
 * Migration: Add Multi-Logger Support
 * 
 * This migration creates the match_logger_assignments table
 * and migrates existing single-logger assignments from matches.loggerId
 */

import { db } from '../index';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Type definition for match data from database
interface MatchWithLogger {
    id: string;
    loggerId: string;
    created_at: number;
}

export async function addMultiLoggerSupport() {
    console.log('🔄 Starting multi-logger migration...');

    try {
        // Step 1: Create the junction table
        console.log('📋 Creating match_logger_assignments table...');
        await db.run(sql`
            CREATE TABLE IF NOT EXISTS match_logger_assignments (
                id TEXT PRIMARY KEY,
                match_id TEXT NOT NULL,
                logger_id TEXT NOT NULL,
                role TEXT DEFAULT 'primary',
                assigned_at INTEGER,
                assigned_by TEXT,
                status TEXT DEFAULT 'active',
                FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
                FOREIGN KEY (logger_id) REFERENCES loggers(id) ON DELETE CASCADE
            )
        `);

        // Step 2: Create indexes for better query performance
        console.log('📊 Creating indexes...');
        await db.run(sql`
            CREATE INDEX IF NOT EXISTS idx_match_logger_match_id 
            ON match_logger_assignments(match_id)
        `);

        await db.run(sql`
            CREATE INDEX IF NOT EXISTS idx_match_logger_logger_id 
            ON match_logger_assignments(logger_id)
        `);

        await db.run(sql`
            CREATE INDEX IF NOT EXISTS idx_match_logger_status 
            ON match_logger_assignments(status)
        `);

        // Step 3: Migrate existing assignments from matches.logger_id
        console.log('🔄 Migrating existing logger assignments...');

        // Get all matches with assigned loggers
        const matchesWithLoggers = await db.all<MatchWithLogger>(sql`
            SELECT id, logger_id as loggerId, created_at
            FROM matches
            WHERE logger_id IS NOT NULL
        `);

        console.log(`📝 Found ${matchesWithLoggers.length} matches with assigned loggers`);

        // Insert them into the new table
        for (const match of matchesWithLoggers) {
            await db.run(sql`
                INSERT INTO match_logger_assignments (id, match_id, logger_id, role, assigned_at, status)
                VALUES (
                    ${nanoid()},
                    ${match.id},
                    ${match.loggerId},
                    'primary',
                    ${match.created_at},
                    'active'
                )
            `);
        }

        console.log('✅ Migration completed successfully!');
        console.log(`   - Created match_logger_assignments table`);
        console.log(`   - Created 3 indexes for performance`);
        console.log(`   - Migrated ${matchesWithLoggers.length} existing assignments`);
        console.log('');
        console.log('⚠️  Note: The matches.loggerId field is kept for backward compatibility');
        console.log('   You can remove it in a future migration once all code is updated.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    addMultiLoggerSupport()
        .then(() => {
            console.log('✅ Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration script failed:', error);
            process.exit(1);
        });
}
