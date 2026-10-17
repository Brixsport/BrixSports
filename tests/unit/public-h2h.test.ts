import { describe, it, expect } from 'vitest';
import { toPublicH2HMatch, toPublicH2HTeam } from '@/lib/public-h2h';

const BANNED = ['approvalStatus', 'approvedBy', 'approvedAt', 'managerNotes', 'loggerId', 'assignedLoggers', 'stats', 'lineups', 'ownerOrganizationId'];

describe('public head-to-head shaping', () => {
    it('drops staff-only match columns', () => {
        const dto = toPublicH2HMatch({
            id: 'm1', sport: 'Football', homeTeamId: 'a', awayTeamId: 'b', homeScore: 2, awayScore: 1, status: 'FINISHED',
            startTime: 1, competition: 'League', competitionId: 'c', venue: 'V',
            approvalStatus: 'PENDING', approvedBy: 'u', approvedAt: 5, managerNotes: 'secret', loggerId: 'l1', stats: '{}', lineups: '{}',
        });
        for (const k of BANNED) expect(dto).not.toHaveProperty(k);
        expect(dto).toMatchObject({ id: 'm1', homeScore: 2, awayScore: 1, status: 'FINISHED' });
    });

    it('keeps only public team fields and passes undefined through', () => {
        const dto = toPublicH2HTeam({ id: 't', name: 'N', shortName: 'N', logo: 'l', university: 'U', color: '#fff', sport: 'Football', ownerOrganizationId: 'org', played: 3 });
        expect(dto).not.toHaveProperty('ownerOrganizationId');
        expect(dto).not.toHaveProperty('played');
        expect(dto).toMatchObject({ id: 't', name: 'N', logo: 'l' });
        expect(toPublicH2HTeam(undefined)).toBeUndefined();
    });
});
