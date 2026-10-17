// Phase 3 (TESTING_STRATEGY_2026-09-18.md): POST/GET /api/matches against
// real staging -- BACKLOG-397's mass-assignment fix (the allow-list must
// actually reject banned/admin-only fields sent in the body, not just
// document that it should) and the public list's own loggerId strip.
import { describe, it, expect, afterAll } from 'vitest';
import { BASE_URL, authHeaders, loadRealFixtures, cleanupFixtures, newThrowawayMatchId, deleteMatch, db, type RealFixtures } from './helpers';

describe('matches route — creation allow-list and public field exposure', () => {
    let fx: RealFixtures;
    const createdMatchIds: string[] = [];

    afterAll(async () => {
        for (const id of createdMatchIds) await deleteMatch(id);
        if (fx) await cleanupFixtures(fx);
        if (createdMatchIds.length > 0) {
            const placeholders = createdMatchIds.map(() => '?').join(',');
            const row = await db.execute({ sql: `SELECT COUNT(*) as c FROM matches WHERE id IN (${placeholders})`, args: createdMatchIds });
            expect(Number((row.rows[0] as any).c)).toBe(0);
        }
    });

    it('rejects an unauthenticated POST with 401', async () => {
        fx = fx ?? (await loadRealFixtures());
        const res = await fetch(`${BASE_URL}/api/matches`, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ id: newThrowawayMatchId('unauth'), sport: 'Football', homeTeamId: fx.home.id, awayTeamId: fx.away.id }),
        });
        expect(res.status).toBe(401);
    });

    it('BACKLOG-397: ignores client-sent approvalStatus/managerNotes/approvedBy/loggerId/homeScore even for an admin', async () => {
        fx = fx ?? (await loadRealFixtures());
        const matchId = newThrowawayMatchId('mass-assign');
        createdMatchIds.push(matchId);

        const res = await fetch(`${BASE_URL}/api/matches`, {
            method: 'POST',
            headers: authHeaders(fx.adminToken),
            body: JSON.stringify({
                id: matchId, sport: 'Football', homeTeamId: fx.home.id, awayTeamId: fx.away.id,
                status: 'PENDING', startTime: new Date().toISOString(), venue: 'Integration Test',
                competition: 'Integration Test', matchType: 'friendly',
                // Everything below must be silently dropped by MATCH_CREATE_FIELDS's allow-list.
                approvalStatus: 'APPROVED',
                managerNotes: 'should never persist',
                approvedBy: fx.admin.id,
                loggerId: fx.logger.id,
                homeScore: 99,
                awayScore: 99,
            }),
        });
        expect(res.status).toBe(201);

        const row = await db.execute({
            sql: `SELECT approval_status, manager_notes, approved_by, logger_id, home_score, away_score FROM matches WHERE id = ?`,
            args: [matchId],
        });
        const persisted = row.rows[0] as any;
        // expect.soft, not expect: each of these 6 fields is an independent
        // exploit target -- a first assertion throwing would hide whether the
        // other 5 are also vulnerable or not (found the hard way: an earlier
        // draft used plain expect() here and a BACKLOG.md entry briefly
        // claimed "the other 5 stayed safe" based on assertions that never
        // actually ran).
        expect.soft(persisted.approval_status, 'approval_status').toBe('PENDING'); // schema default, NOT the client-sent 'APPROVED'
        expect.soft(persisted.manager_notes, 'manager_notes').toBeNull();
        expect.soft(persisted.approved_by, 'approved_by').toBeNull();
        expect.soft(persisted.logger_id, 'logger_id').toBeNull();
        expect.soft(persisted.home_score, 'home_score').toBe(0);
        expect.soft(persisted.away_score, 'away_score').toBe(0);
    });

    it('never exposes loggerId in the public (unauthenticated) list response, even for a match with a logger assigned', async () => {
        fx = fx ?? (await loadRealFixtures());
        const matchId = newThrowawayMatchId('logger-exposure');
        createdMatchIds.push(matchId);

        const create = await fetch(`${BASE_URL}/api/matches`, {
            method: 'POST', headers: authHeaders(fx.adminToken),
            body: JSON.stringify({
                id: matchId, sport: 'Football', homeTeamId: fx.home.id, awayTeamId: fx.away.id,
                status: 'LIVE', startTime: new Date().toISOString(), venue: 'Integration Test',
                competition: 'Integration Test', matchType: 'friendly',
            }),
        });
        expect(create.status).toBe(201);

        const assign = await fetch(`${BASE_URL}/api/matches/${matchId}/assign-logger`, {
            method: 'POST', headers: authHeaders(fx.adminToken), body: JSON.stringify({ loggerId: fx.logger.id }),
        });
        expect(assign.ok).toBe(true);

        const publicList = await fetch(`${BASE_URL}/api/matches?competition=Integration Test&limit=200`, { headers: authHeaders() });
        const publicBody = await publicList.json();
        const publicMatch = publicBody.find((m: any) => m.id === matchId);
        expect(publicMatch).toBeDefined();
        expect('loggerId' in publicMatch).toBe(false);

        // Note: matches.loggerId is a legacy single-logger column that the
        // modern assign-logger flow never writes to (assignments live in
        // match_logger_assignments instead) -- confirmed by a failing first
        // draft of this test that expected it to equal the assigned logger's
        // id. The security property this test actually needs to prove is key
        // *presence* (admin) vs *absence* (public) on whatever the field's
        // value is, not that assigning a logger populates this specific column.
        const adminList = await fetch(`${BASE_URL}/api/matches?competition=Integration Test&limit=200`, { headers: authHeaders(fx.adminToken) });
        const adminBody = await adminList.json();
        const adminMatch = adminBody.find((m: any) => m.id === matchId);
        expect('loggerId' in adminMatch).toBe(true);
    });
});
