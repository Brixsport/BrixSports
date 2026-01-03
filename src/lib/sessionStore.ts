/**
 * Database-based Session Storage
 * Alternative to Redis using SQLite for logger sessions
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';

// Session storage using SQLite
export class DatabaseSessionStore {
    private tableName = 'logger_sessions';

    constructor() {
        this.initializeTable();
    }

    /**
     * Initialize sessions table if it doesn't exist
     */
    private async initializeTable() {
        try {
            await db.run(sql`
                CREATE TABLE IF NOT EXISTS logger_sessions (
                    id TEXT PRIMARY KEY,
                    match_id TEXT NOT NULL,
                    logger_id TEXT NOT NULL,
                    logger_name TEXT NOT NULL,
                    last_heartbeat INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    data TEXT,
                    UNIQUE(match_id, logger_id)
                )
            `);

            // Create index for faster queries
            await db.run(sql`
                CREATE INDEX IF NOT EXISTS idx_logger_sessions_match 
                ON logger_sessions(match_id)
            `);

            await db.run(sql`
                CREATE INDEX IF NOT EXISTS idx_logger_sessions_heartbeat 
                ON logger_sessions(last_heartbeat)
            `);
        } catch (error) {
            console.error('Error initializing sessions table:', error);
        }
    }

    /**
     * Set/Update a session
     */
    async set(key: string, value: any, ttl?: number): Promise<void> {
        const now = Date.now();
        const data = JSON.stringify(value);

        try {
            await db.run(sql`
                INSERT INTO logger_sessions (
                    id, match_id, logger_id, logger_name, 
                    last_heartbeat, created_at, data
                )
                VALUES (
                    ${key},
                    ${value.matchId},
                    ${value.loggerId},
                    ${value.loggerName},
                    ${now},
                    ${now},
                    ${data}
                )
                ON CONFLICT(match_id, logger_id) 
                DO UPDATE SET
                    last_heartbeat = ${now},
                    data = ${data}
            `);
        } catch (error) {
            console.error('Error setting session:', error);
            throw error;
        }
    }

    /**
     * Get a session
     */
    async get(key: string): Promise<any | null> {
        try {
            const result = await db.get(sql`
                SELECT data FROM logger_sessions 
                WHERE id = ${key}
                LIMIT 1
            `) as any;

            if (!result || !result.data) {
                return null;
            }

            return JSON.parse(result.data as string);
        } catch (error) {
            console.error('Error getting session:', error);
            return null;
        }
    }

    /**
     * Delete a session
     */
    async delete(key: string): Promise<void> {
        try {
            await db.run(sql`
                DELETE FROM logger_sessions 
                WHERE id = ${key}
            `);
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    }

    /**
     * Get all sessions for a match
     */
    async getMatchSessions(matchId: string): Promise<any[]> {
        try {
            const results = await db.all(sql`
                SELECT data FROM logger_sessions 
                WHERE match_id = ${matchId}
            `);

            return results.map((r: any) => JSON.parse(r.data));
        } catch (error) {
            console.error('Error getting match sessions:', error);
            return [];
        }
    }

    /**
     * Update heartbeat for a session
     */
    async heartbeat(key: string): Promise<void> {
        const now = Date.now();

        try {
            await db.run(sql`
                UPDATE logger_sessions 
                SET last_heartbeat = ${now}
                WHERE id = ${key}
            `);
        } catch (error) {
            console.error('Error updating heartbeat:', error);
        }
    }

    /**
     * Clean up expired sessions
     * Remove sessions with no heartbeat in last 2 minutes
     */
    async cleanup(maxAge: number = 120000): Promise<number> {
        const threshold = Date.now() - maxAge;

        try {
            const result = await db.run(sql`
                DELETE FROM logger_sessions 
                WHERE last_heartbeat < ${threshold}
            `) as any;

            return result.changes || 0;
        } catch (error) {
            console.error('Error cleaning up sessions:', error);
            return 0;
        }
    }

    /**
     * Get session count for a match
     */
    async getSessionCount(matchId: string): Promise<number> {
        try {
            const result = await db.get(sql`
                SELECT COUNT(*) as count 
                FROM logger_sessions 
                WHERE match_id = ${matchId}
            `) as any;

            return result?.count || 0;
        } catch (error) {
            console.error('Error getting session count:', error);
            return 0;
        }
    }

    /**
     * Get all active sessions (with recent heartbeat)
     */
    async getActiveSessions(maxAge: number = 120000): Promise<any[]> {
        const threshold = Date.now() - maxAge;

        try {
            const results = await db.all(sql`
                SELECT data FROM logger_sessions 
                WHERE last_heartbeat >= ${threshold}
            `);

            return results.map((r: any) => JSON.parse(r.data));
        } catch (error) {
            console.error('Error getting active sessions:', error);
            return [];
        }
    }

    /**
     * Check if a logger is active in a match
     */
    async isLoggerActive(matchId: string, loggerId: string, maxAge: number = 120000): Promise<boolean> {
        const threshold = Date.now() - maxAge;

        try {
            const result = await db.get(sql`
                SELECT COUNT(*) as count 
                FROM logger_sessions 
                WHERE match_id = ${matchId} 
                AND logger_id = ${loggerId}
                AND last_heartbeat >= ${threshold}
            `) as any;

            return (result?.count || 0) > 0;
        } catch (error) {
            console.error('Error checking logger status:', error);
            return false;
        }
    }
}

// Singleton instance
let sessionStore: DatabaseSessionStore | null = null;

export function getSessionStore(): DatabaseSessionStore {
    if (!sessionStore) {
        sessionStore = new DatabaseSessionStore();
    }
    return sessionStore;
}

/**
 * Background cleanup job
 * Run this periodically to remove expired sessions
 */
export async function runSessionCleanup() {
    const store = getSessionStore();
    const removed = await store.cleanup();

    if (removed > 0) {
        console.log(`Cleaned up ${removed} expired sessions`);
    }
}

// Auto-cleanup every 5 minutes
if (typeof window === 'undefined') {
    setInterval(() => {
        runSessionCleanup();
    }, 5 * 60 * 1000);
}
