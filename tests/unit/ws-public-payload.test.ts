import { describe, it, expect } from 'vitest';
import { toPublicMatchEvent, toPublicMatchUpdate } from '@/lib/ws-public-payload';

const BANNED = ['loggerId', 'loggerName', 'approvedBy', 'approvalStatus', 'approvedAt', 'managerNotes', 'profileId', 'email'];

function keysDeep(value: unknown, acc = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach((v) => keysDeep(v, acc));
    else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) { acc.add(k); keysDeep(v, acc); }
    }
    return acc;
}

describe('toPublicMatchEvent', () => {
    const inserted = {
        id: 'evt1', matchId: 'm1', type: 'Goal', minute: 12, second: 5, period: 'FIRST_HALF',
        teamId: 't1', playerId: 'p1', relatedPlayerId: null, detail: null, isEyePoint: false, value: null,
        loggerId: 'logger_123', loggerName: 'admin-001', createdAt: new Date(0),
    };

    it('removes logger identity and keeps the public event fields', () => {
        const out = toPublicMatchEvent(inserted) as Record<string, unknown>;
        expect('loggerId' in out).toBe(false);
        expect('loggerName' in out).toBe(false);
        expect(out).toMatchObject({ id: 'evt1', matchId: 'm1', type: 'Goal', minute: 12, teamId: 't1', playerId: 'p1' });
    });

    it('does not mutate the original event (the DB insert and the REST response still need it)', () => {
        toPublicMatchEvent(inserted);
        expect(inserted.loggerId).toBe('logger_123');
        expect(inserted.loggerName).toBe('admin-001');
    });

    it('emits no banned key', () => {
        const keys = keysDeep(toPublicMatchEvent(inserted));
        for (const k of BANNED) expect(keys.has(k)).toBe(false);
    });
});

describe('toPublicMatchUpdate', () => {
    it('keeps only the fields the viewer hooks read, plus matchId', () => {
        const out = toPublicMatchUpdate('m1', {
            updatedAt: new Date(0),
            status: 'LIVE', currentPeriod: 'FIRST_HALF', homeScore: 1, awayScore: 0, minute: 7, extraTime: null,
            shootoutHomeScore: 3, shootoutAwayScore: 2,
        });
        expect(out).toEqual({
            matchId: 'm1', status: 'LIVE', currentPeriod: 'FIRST_HALF', homeScore: 1, awayScore: 0, minute: 7,
            extraTime: null, shootoutHomeScore: 3, shootoutAwayScore: 2,
        });
    });

    it('never forwards admin-only or structural update fields', () => {
        const out = toPublicMatchUpdate('m1', {
            status: 'FINISHED',
            loggerId: 'logger_123', approvalStatus: 'APPROVED', approvedBy: 'admin-001', approvedAt: new Date(0),
            managerNotes: 'private', lineups: '{"home":{}}', stats: '{}', venue: 'x', homeTeamId: 't9', startTime: new Date(0),
        });
        const keys = keysDeep(out);
        for (const k of BANNED) expect(keys.has(k)).toBe(false);
        for (const k of ['lineups', 'stats', 'venue', 'homeTeamId', 'startTime']) expect(keys.has(k)).toBe(false);
        expect(out).toEqual({ matchId: 'm1', status: 'FINISHED' });
    });

    it('omits fields that were not part of the update', () => {
        expect(toPublicMatchUpdate('m1', { minute: 3 })).toEqual({ matchId: 'm1', minute: 3 });
    });
});
