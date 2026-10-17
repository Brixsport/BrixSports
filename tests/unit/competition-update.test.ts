import { describe, it, expect } from 'vitest';
import { buildCompetitionUpdate } from '@/lib/competition-update';

describe('buildCompetitionUpdate', () => {
    it('keeps only allow-listed fields', () => {
        const r = buildCompetitionUpdate({
            name: 'Cup',
            id: 'other',
            winnerId: 'team-1',
            runnerUpId: 'team-2',
            followersCount: 99,
            hostOrganizationId: 'org-1',
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(Object.keys(r.update).sort()).toEqual(['hostOrganizationId', 'name']);
        }
    });

    it('converts dates and stringifies object rules', () => {
        const r = buildCompetitionUpdate({ startDate: '2026-10-01', rules: { a: 1 } });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.update.startDate).toBeInstanceOf(Date);
            expect(r.update.rules).toBe('{"a":1}');
        }
    });

    it('allows clearing a date with null and rejects unparseable ones', () => {
        const cleared = buildCompetitionUpdate({ endDate: null });
        expect(cleared.ok && cleared.update.endDate).toBeNull();
        expect(buildCompetitionUpdate({ startDate: 'nonsense' }).ok).toBe(false);
    });

    it('rejects wrong types', () => {
        expect(buildCompetitionUpdate({ name: { $set: 1 } }).ok).toBe(false);
        expect(buildCompetitionUpdate({ numberOfTeams: '8' }).ok).toBe(false);
        expect(buildCompetitionUpdate({ numberOfTeams: -1 }).ok).toBe(false);
        expect(buildCompetitionUpdate({ isMultiSport: 'yes' }).ok).toBe(false);
        expect(buildCompetitionUpdate({ hostOrganizationId: 5 }).ok).toBe(false);
    });

    it('returns an empty update for an empty object', () => {
        const r = buildCompetitionUpdate({});
        expect(r.ok && Object.keys(r.update).length).toBe(0);
    });
});
