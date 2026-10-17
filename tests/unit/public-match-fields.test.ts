import { describe, it, expect } from 'vitest';
import { PUBLIC_FIXTURE_MATCH_FIELDS } from '@/lib/public-match-fields';

describe('public fixture match projection', () => {
    it('never selects staff-only or bulky columns', () => {
        const keys = Object.keys(PUBLIC_FIXTURE_MATCH_FIELDS);
        for (const banned of ['loggerId', 'approvalStatus', 'approvedBy', 'approvedAt', 'managerNotes', 'lineups', 'assignedLoggers']) {
            expect(keys).not.toContain(banned);
        }
    });

    it('keeps the fields fixture lists render', () => {
        const keys = Object.keys(PUBLIC_FIXTURE_MATCH_FIELDS);
        for (const k of ['id', 'homeTeamId', 'awayTeamId', 'homeScore', 'awayScore', 'status', 'startTime', 'competitionId']) {
            expect(keys).toContain(k);
        }
    });
});
