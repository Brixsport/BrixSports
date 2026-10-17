import { describe, it, expect } from 'vitest';
import { toEventDto, gateLineups, toMatchDto } from '@/lib/match-detail-shape';

const BANNED_MATCH = ['loggerId', 'approvalStatus', 'managerNotes', 'approvedBy', 'approvedAt'];

describe('match detail shaping', () => {
    const row = {
        event: { id: 'e1', type: 'Goal', minute: 12, loggerId: 'l1', loggerName: 'Ada', value: '2', relatedPlayerId: 'p2' },
        player: { id: 'p1', name: 'A', jerseyName: 'A', number: 9, position: 'FW' },
        relatedPlayer: { id: 'p2', name: 'B', jerseyName: 'B', number: 7, position: 'MF' },
    };

    it('never returns loggerId and hides loggerName from the public', () => {
        const dto = toEventDto(row, false);
        expect(dto).not.toHaveProperty('loggerId');
        expect(dto).not.toHaveProperty('loggerName');
        expect(dto).toMatchObject({ id: 'e1', type: 'Goal', value: 2 });
    });

    it('returns loggerName to staff but still never loggerId', () => {
        const dto = toEventDto(row, true);
        expect(dto).not.toHaveProperty('loggerId');
        expect(dto).toMatchObject({ loggerName: 'Ada' });
    });

    it('nulls player objects whose join matched nothing', () => {
        const dto = toEventDto({ ...row, player: { id: null }, relatedPlayer: { id: null } }, false);
        expect(dto.player).toBeNull();
        expect(dto.relatedPlayer).toBeNull();
        expect(toEventDto({ ...row, player: null, relatedPlayer: null }, false).player).toBeNull();
    });

    it('keeps only published lineups for the public and strips authorship', () => {
        const lineups = {
            home: { status: 'published', formation: '4-4-2', publishedBy: 'u1', publishedByName: 'admin@x.com', publishedByRole: 'admin', unlockedBy: 'u2', unlockedByName: 'boss@x.com' },
            away: { status: 'draft', formation: '4-3-3' },
        };
        const out = gateLineups(lineups, false);
        expect(Object.keys(out)).toEqual(['home']);
        for (const k of ['publishedBy', 'publishedByName', 'publishedByRole', 'unlockedBy', 'unlockedByName']) {
            expect(out.home).not.toHaveProperty(k);
        }
        expect(out.home).toMatchObject({ status: 'published', formation: '4-4-2' });
    });

    it('leaves lineups untouched for staff and passes null through', () => {
        const lineups = { away: { status: 'draft', publishedByName: 'x' } };
        expect(gateLineups(lineups, true)).toBe(lineups);
        expect(gateLineups(null, false)).toBeNull();
    });

    it('drops staff-only and audit match columns', () => {
        const dto = toMatchDto({
            id: 'm1', status: 'LIVE', homeScore: 1,
            loggerId: 'l1', approvalStatus: 'APPROVED', managerNotes: 'n', approvedBy: 'u', approvedAt: 1,
        });
        for (const k of BANNED_MATCH) expect(dto).not.toHaveProperty(k);
        expect(dto).toMatchObject({ id: 'm1', status: 'LIVE', homeScore: 1 });
    });
});
