// Phase 3 (TESTING_STRATEGY_2026-09-18.md): POST /api/matches/[id]/assign-logger
// against real staging -- admin gate, and the atomic check-then-insert
// duplicate guard (BUG-008's original fix, and isLoggerAssigned's own
// primary caller/consumer).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BASE_URL, authHeaders, loadRealFixtures, newThrowawayMatchId, deleteMatch, db, type RealFixtures } from './helpers';
import { isLoggerAssigned } from '@/lib/match-logger-helpers';

describe('assign-logger route', () => {
    let fx: RealFixtures;
    let matchId: string;

    beforeAll(async () => {
        fx = await loadRealFixtures();
        matchId = newThrowawayMatchId('assign-logger');
        const create = await fetch(`${BASE_URL}/api/matches`, {
            method: 'POST',
            headers: authHeaders(fx.adminToken),
            body: JSON.stringify({
                id: matchId, sport: 'Football', homeTeamId: fx.home.id, awayTeamId: fx.away.id,
                status: 'PENDING', startTime: new Date().toISOString(), venue: 'Integration Test',
                competition: 'Integration Test', matchType: 'friendly',
            }),
        });
        if (create.status !== 201) throw new Error(`fixture setup failed: ${create.status} ${await create.text()}`);
    });

    afterAll(async () => {
        await deleteMatch(matchId);
        expect(await db.execute({ sql: `SELECT COUNT(*) as c FROM matches WHERE id = ?`, args: [matchId] })
            .then(r => Number((r.rows[0] as any).c))).toBe(0);
    });

    it('rejects a non-admin caller with 401', async () => {
        const res = await fetch(`${BASE_URL}/api/matches/${matchId}/assign-logger`, {
            method: 'POST', headers: authHeaders(fx.loggerToken), body: JSON.stringify({ loggerId: fx.logger.id }),
        });
        expect(res.status).toBe(401);
    });

    it('isLoggerAssigned is false before assignment, true after -- DB-backed, not a pure function', async () => {
        expect(await isLoggerAssigned(matchId, fx.logger.id)).toBe(false);

        const res = await fetch(`${BASE_URL}/api/matches/${matchId}/assign-logger`, {
            method: 'POST', headers: authHeaders(fx.adminToken), body: JSON.stringify({ loggerId: fx.logger.id }),
        });
        expect(res.status).toBe(200);

        expect(await isLoggerAssigned(matchId, fx.logger.id)).toBe(true);
    });

    it('rejects a duplicate assignment with 409 and never creates a second row', async () => {
        const res = await fetch(`${BASE_URL}/api/matches/${matchId}/assign-logger`, {
            method: 'POST', headers: authHeaders(fx.adminToken), body: JSON.stringify({ loggerId: fx.logger.id }),
        });
        expect(res.status).toBe(409);

        const row = await db.execute({
            sql: `SELECT COUNT(*) as c FROM match_logger_assignments WHERE match_id = ? AND logger_id = ? AND status = 'active'`,
            args: [matchId, fx.logger.id],
        });
        expect(Number((row.rows[0] as any).c)).toBe(1);
    });
});
