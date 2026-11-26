import { describe, expect, it } from 'vitest';
import { toPublicCompetition, toPublicGroup } from '@/lib/competition-public';

const row = {
  id: 'c1',
  name: 'BUSA LEAGUE FOOTBALL',
  sport: 'Football',
  season: '2026/2027',
  status: 'upcoming',
  logo: 'x.png',
  hostOrganizationId: 'org_a',
  governingOrganizationId: 'org_b',
  entryFee: 5000,
  rules: 'secret',
  finalStandings: '[]',
  isArchived: false,
  groupDrawComplete: true,
  requireSquad: true,
  maxSquadSize: 25,
  squadDeadline: null,
  updatedAt: '2026-01-01',
};

describe('toPublicCompetition', () => {
  it('keeps display fields and drops internal ones', () => {
    const out = toPublicCompetition(row);
    expect(out).toMatchObject({ id: 'c1', name: 'BUSA LEAGUE FOOTBALL', season: '2026/2027', status: 'upcoming', logo: 'x.png' });
    for (const k of ['hostOrganizationId', 'governingOrganizationId', 'entryFee', 'rules', 'finalStandings', 'isArchived', 'groupDrawComplete', 'requireSquad', 'maxSquadSize', 'squadDeadline', 'updatedAt']) {
      expect(out).not.toHaveProperty(k);
    }
  });
});

describe('toPublicGroup', () => {
  it('shapes latest and every season', () => {
    const g = toPublicGroup({ groupKey: 'k', name: 'n', sport: 'Football', latest: row, seasons: [row, row] });
    expect(g.latest).not.toHaveProperty('entryFee');
    expect(g.seasons.every((s) => !('hostOrganizationId' in s))).toBe(true);
  });
});
