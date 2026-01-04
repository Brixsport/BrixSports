/**
 * Database Migration: Add User Lineups Tables
 * 
 * This migration adds support for user-created dream lineups
 * separate from official match lineups.
 * 
 * Run this with: npm run db:migrate
 */

import { db } from './index';

async function migrate() {
    console.log('🔄 Starting migration: Add User Lineups Tables...');

    try {
        // Create user_lineups table
        await db.run(`
            CREATE TABLE IF NOT EXISTS user_lineups (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                match_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                formation TEXT NOT NULL,
                team_type TEXT NOT NULL,
                sport TEXT NOT NULL,
                starters TEXT NOT NULL,
                substitutes TEXT,
                is_public INTEGER DEFAULT 1,
                likes_count INTEGER DEFAULT 0,
                shares_count INTEGER DEFAULT 0,
                views_count INTEGER DEFAULT 0,
                created_at INTEGER,
                updated_at INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Created user_lineups table');

        // Create user_lineup_likes table
        await db.run(`
            CREATE TABLE IF NOT EXISTS user_lineup_likes (
                id TEXT PRIMARY KEY,
                lineup_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at INTEGER,
                FOREIGN KEY (lineup_id) REFERENCES user_lineups(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Created user_lineup_likes table');

        // Create user_lineup_comments table
        await db.run(`
            CREATE TABLE IF NOT EXISTS user_lineup_comments (
                id TEXT PRIMARY KEY,
                lineup_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                parent_id TEXT,
                likes_count INTEGER DEFAULT 0,
                created_at INTEGER,
                updated_at INTEGER,
                FOREIGN KEY (lineup_id) REFERENCES user_lineups(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Created user_lineup_comments table');

        // Create indexes for better performance
        await db.run(`
            CREATE INDEX IF NOT EXISTS idx_user_lineups_user_id 
            ON user_lineups(user_id)
        `);
        await db.run(`
            CREATE INDEX IF NOT EXISTS idx_user_lineups_match_id 
            ON user_lineups(match_id)
        `);
        await db.run(`
            CREATE INDEX IF NOT EXISTS idx_user_lineups_public 
            ON user_lineups(is_public)
        `);
        await db.run(`
            CREATE INDEX IF NOT EXISTS idx_user_lineup_likes_lineup_id 
            ON user_lineup_likes(lineup_id)
        `);
        await db.run(`
            CREATE INDEX IF NOT EXISTS idx_user_lineup_comments_lineup_id 
            ON user_lineup_comments(lineup_id)
        `);
        console.log('✅ Created indexes');

        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrate()
        .then(() => {
            console.log('✅ All done!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        });
}

export { migrate };
