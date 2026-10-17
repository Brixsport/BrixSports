// Phase 3 (TESTING_STRATEGY_2026-09-18.md): POST/GET /api/matches/[id]/events
// against real staging -- auth gates, the FINISHED-match write-lock
// (BACKLOG-153), and the public-response field strip (NDPR compliance).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BASE_URL, authHeaders, loadRealFixtures, cleanupFixtures, newThrowawayMatchId, deleteMatch, db, type RealFixtures } from './helpers';

describe('events route — auth and lifecycle gates', () => {
    let fx: RealFixtures;
    let liveMatchId: string;
    let finishedMatchId: string;

    beforeAll(async () => {
        fx = await loadRealFixtures();
        liveMatchId = newThrowawayMatchId('events-live');
        finishedMatchId = newThrowawayMatchId('events-finished');

        const createLive = await fetch(`${BASE_URL}/api/matches`, {
            method: 'POST',
            headers: authHeaders(fx.adminToken),
            body: JSON.stringify({
                id: liveMatchId, sport: 'Football', homeTeamId: fx.home.id, awayTeamId: fx.away.id,
                status: 'LIVE', startTime: new Date().toISOString(), venue: 'Integration Test',
                competition: 'Integration Test', matchType: 'friendly',
            }),
        });
        if (createLive.status !== 201) throw new Error(`fixture setup failed: ${createLive.status} ${await createLive.text()}`);

        const createFinished = await fetch(`${BASE_URL}/api/matches`, {
            method: 'POST',
            headers: authHeaders(fx.adminToken),
            body: JSON.stringify({
                id: finishedMatchId, sport: 'Football', homeTeamId: fx.home.id, awayTeamId: fx.away.id,
                status: 'FINISHED', startTime: new Date().toISOString(), venue: 'Integration Test',
                competition: 'Integration Test', matchType: 'friendly',
            }),
        });
        if (createFinished.status !== 201) throw new Error(`fixture setup failed: ${createFinished.status} ${await createFinished.text()}`);

        const assign = await fetch(`${BASE_URL}/api/matches/${liveMatchId}/assign-logger`, {
            method: 'POST', headers: authHeaders(fx.adminToken), body: JSON.stringify({ loggerId: fx.logger.id }),
        });
        if (!assign.ok) throw new Error(`fixture logger assignment failed: ${assign.status} ${await assign.text()}`);
    });

    afterAll(async () => {
        await deleteMatch(liveMatchId);
        await deleteMatch(finishedMatchId);
        await cleanupFixtures(fx);
        expect(await db.execute({ sql: `SELECT COUNT(*) as c FROM matches WHERE id IN (?, ?)`, args: [liveMatchId, finishedMatchId] })
            .then(r => Number((r.rows[0] as any).c))).toBe(0);
    });

    it('rejects an unauthenticated POST with 401', async () => {
        const res = await fetch(`${BASE_URL}/api/matches/${liveMatchId}/events`, {
            method: 'POST', headers: authHeaders(), body: JSON.stringify({ type: 'Corner', minute: 1 }),
        });
        expect(res.status).toBe(401);
    });

    it('rejects a logger who is not assigned to this match with 403', async () => {
        // A fabricated logger id fails at the AUTH stage (401, no such user) --
        // getAuthUser can't find a row for it -- rather than reaching the
        // separate "assigned to this match?" AUTHORIZATION check this test
        // targets. Needs a real, distinct, unassigned logger account instead.
        if (fx.otherLogger.id === fx.logger.id) {
            console.warn('  SKIP: staging only has one seeded logger account -- cannot construct a real "different logger, not assigned" case.');
            return;
        }
        const res = await fetch(`${BASE_URL}/api/matches/${liveMatchId}/events`, {
            method: 'POST', headers: authHeaders(fx.otherLoggerToken), body: JSON.stringify({ type: 'Corner', minute: 1 }),
        });
        expect(res.status).toBe(403);
    });

    it('accepts a POST from the assigned logger and the row is DB-confirmed', async () => {
        const res = await fetch(`${BASE_URL}/api/matches/${liveMatchId}/events`, {
            method: 'POST', headers: authHeaders(fx.loggerToken),
            body: JSON.stringify({ type: 'Corner', minute: 5, teamId: fx.home.id, detail: 'integration test corner' }),
        });
        expect(res.status).toBe(201);
        const row = await db.execute({ sql: `SELECT COUNT(*) as c FROM match_events WHERE match_id = ? AND type = 'Corner' AND minute = 5`, args: [liveMatchId] });
        expect(Number((row.rows[0] as any).c)).toBe(1);
    });

    it('BACKLOG-153: rejects a POST against a FINISHED match with 409', async () => {
        const res = await fetch(`${BASE_URL}/api/matches/${finishedMatchId}/events`, {
            method: 'POST', headers: authHeaders(fx.adminToken),
            body: JSON.stringify({ type: 'Goal', minute: 90, teamId: fx.home.id, playerId: fx.player.id }),
        });
        expect(res.status).toBe(409);
        const row = await db.execute({ sql: `SELECT COUNT(*) as c FROM match_events WHERE match_id = ?`, args: [finishedMatchId] });
        expect(Number((row.rows[0] as any).c)).toBe(0);
    });

    it('strips loggerId/loggerName from GET for an unauthenticated caller, includes them for an admin', async () => {
        const publicRes = await fetch(`${BASE_URL}/api/matches/${liveMatchId}/events`, { headers: authHeaders() });
        expect(publicRes.status).toBe(200);
        const publicBody = await publicRes.json();
        expect(publicBody.events.length).toBeGreaterThan(0);
        expect(publicBody.events.every((e: any) => !('loggerId' in e) && !('loggerName' in e))).toBe(true);

        const adminRes = await fetch(`${BASE_URL}/api/matches/${liveMatchId}/events`, { headers: authHeaders(fx.adminToken) });
        const adminBody = await adminRes.json();
        expect(adminBody.events.some((e: any) => 'loggerId' in e)).toBe(true);
    });
});
