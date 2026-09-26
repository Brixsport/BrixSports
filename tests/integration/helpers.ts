// Shared setup for Phase 3 (TESTING_STRATEGY_2026-09-18.md) API integration
// tests: real HTTP against a real deployed environment, real staging Turso
// DB for direct setup/assertion/cleanup -- same shape as tests/smoke/
// critical-flows.ts and tests/smoke/dual-logger-race.test.ts, just organized
// as Vitest suites. Deliberately does NOT go through src/db (drizzle) --
// raw @libsql/client + raw SQL, so this file has no dependency on src/db's
// own dotenv-loading quirk (see tests/integration/setup.ts's comment).
import { createClient } from '@libsql/client';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

// Deliberately NOT process.env.BASE_URL: Vitest (via Vite) treats BASE_URL as
// a reserved env key mirroring import.meta.env.BASE_URL (the app's base
// public path) and force-overwrites it to '/' regardless of what's set
// beforehand -- confirmed by direct diagnostic, cost real debugging time.
// tests/smoke/*.test.ts (run via plain tsx, no Vite involved) are unaffected
// and keep using BASE_URL directly.
export const BASE_URL = process.env.API_BASE_URL || 'https://staging.brixsports.com';
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

if (!process.env.TURSO_CONNECTION_URL || !process.env.TURSO_AUTH_TOKEN || !JWT_SECRET) {
    throw new Error(
        'tests/integration requires TURSO_CONNECTION_URL, TURSO_AUTH_TOKEN, and JWT_SECRET in .env.local -- ' +
        'per this project convention these should already point at the STAGING Turso instance, never prod.'
    );
}

export const db = createClient({
    url: process.env.TURSO_CONNECTION_URL!.trim(),
    authToken: process.env.TURSO_AUTH_TOKEN,
});

export function authHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (BYPASS) headers['x-vercel-protection-bypass'] = BYPASS;
    return headers;
}

export interface RealFixtures {
    admin: { id: string; email: string };
    logger: { id: string; email: string; name: string };
    /** A second, real, distinct logger -- for "not assigned to this match" tests. Falls back to `logger` if staging only has one seeded. */
    otherLogger: { id: string; email: string; name: string };
    home: { id: string; name: string };
    away: { id: string; name: string };
    player: { id: string; name: string };
    competition: { id: string; season: string };
    adminToken: string;
    loggerToken: string;
    otherLoggerToken: string;
}

/** Pulls real, existing rows to act with -- never creates fixture users/teams/players, only throwaway matches. */
export async function loadRealFixtures(): Promise<RealFixtures> {
    const adminRow = await db.execute(`SELECT id, email FROM users WHERE role = 'admin' LIMIT 1`);
    if (adminRow.rows.length === 0) throw new Error('no admin user found in staging DB');
    const admin = adminRow.rows[0] as unknown as { id: string; email: string };

    const loggerRows = await db.execute(`SELECT id, email, name FROM loggers LIMIT 2`);
    if (loggerRows.rows.length === 0) throw new Error('no logger account found in staging DB');
    const loggerList = loggerRows.rows as unknown as { id: string; email: string; name: string }[];
    const logger = loggerList[0];
    const otherLogger = loggerList[1] ?? loggerList[0];

    const teamsRows = await db.execute(`SELECT id, name FROM teams WHERE sport = 'Football' LIMIT 2`);
    if (teamsRows.rows.length < 2) throw new Error('need at least 2 Football teams in staging DB');
    const [home, away] = teamsRows.rows as unknown as { id: string; name: string }[];

    const playerRow = await db.execute({ sql: `SELECT id, name FROM players WHERE team_id = ? LIMIT 1`, args: [home.id] });
    if (playerRow.rows.length === 0) throw new Error(`no player found for home team ${home.id}`);
    const player = playerRow.rows[0] as unknown as { id: string; name: string };

    const competitionRow = await db.execute(`SELECT id, season FROM competitions LIMIT 1`);
    if (competitionRow.rows.length === 0) throw new Error('no competition found in staging DB');
    const competition = competitionRow.rows[0] as unknown as { id: string; season: string };

    const adminToken = jwt.sign({ userId: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET!, { expiresIn: '1h' });
    const loggerToken = jwt.sign({ userId: logger.id, email: logger.email, role: 'logger' }, JWT_SECRET!, { expiresIn: '1h' });
    const otherLoggerToken = jwt.sign({ userId: otherLogger.id, email: otherLogger.email, role: 'logger' }, JWT_SECRET!, { expiresIn: '1h' });

    return { admin, logger, otherLogger, home, away, player, competition, adminToken, loggerToken, otherLoggerToken };
}

/** Creates a throwaway match directly in the DB (bypassing POST /api/matches) so matches-route.test.ts can test that route in isolation. */
export function newThrowawayMatchId(label: string): string {
    return `test-${label}-${nanoid(8)}`;
}

export async function deleteMatch(matchId: string): Promise<void> {
    await db.execute({ sql: `DELETE FROM match_events WHERE match_id = ?`, args: [matchId] });
    await db.execute({ sql: `DELETE FROM match_logger_assignments WHERE match_id = ?`, args: [matchId] });
    await db.execute({ sql: `DELETE FROM matches WHERE id = ?`, args: [matchId] });
}

export async function countMatches(matchId: string): Promise<number> {
    const result = await db.execute({ sql: `SELECT COUNT(*) as c FROM matches WHERE id = ?`, args: [matchId] });
    return Number((result.rows[0] as any).c);
}
