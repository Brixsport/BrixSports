import { describe, it, expect } from 'vitest';
import { planMatchPatchEffects, canWriteMatchStats } from '@/lib/match-patch-effects';

describe('planMatchPatchEffects', () => {
    it('runs the full-time effects on the transition into FINISHED', () => {
        expect(planMatchPatchEffects({ storedStatus: 'LIVE', bodyStatus: 'FINISHED', scoreChanged: false }))
            .toEqual({ runFullTime: true, standings: 'by-match' });
    });

    it('does not repeat them when FINISHED is sent again', () => {
        expect(planMatchPatchEffects({ storedStatus: 'FINISHED', bodyStatus: 'FINISHED', scoreChanged: false }))
            .toEqual({ runFullTime: false, standings: 'none' });
    });

    it('refreshes standings, without the full-time effects, when a finished score is corrected', () => {
        expect(planMatchPatchEffects({ storedStatus: 'FINISHED', bodyStatus: undefined, scoreChanged: true }))
            .toEqual({ runFullTime: false, standings: 'by-match' });
        expect(planMatchPatchEffects({ storedStatus: 'FINISHED', bodyStatus: 'FINISHED', scoreChanged: true }))
            .toEqual({ runFullTime: false, standings: 'by-match' });
    });

    it('recomputes by teams when a finished match is reopened', () => {
        expect(planMatchPatchEffects({ storedStatus: 'FINISHED', bodyStatus: 'LIVE', scoreChanged: false }))
            .toEqual({ runFullTime: false, standings: 'by-teams' });
    });

    it('does nothing for writes on a match that is not finished', () => {
        expect(planMatchPatchEffects({ storedStatus: 'LIVE', bodyStatus: undefined, scoreChanged: true }))
            .toEqual({ runFullTime: false, standings: 'none' });
        expect(planMatchPatchEffects({ storedStatus: 'UPCOMING', bodyStatus: 'LIVE', scoreChanged: false }))
            .toEqual({ runFullTime: false, standings: 'none' });
    });
});

describe('canWriteMatchStats', () => {
    it('lets a logger write stats until the match is finished', () => {
        expect(canWriteMatchStats('logger', 'LIVE')).toBe(true);
    });

    it('stops a logger overwriting stats on a finished match', () => {
        expect(canWriteMatchStats('logger', 'FINISHED')).toBe(false);
    });

    it('lets an admin write stats at any time', () => {
        expect(canWriteMatchStats('admin', 'FINISHED')).toBe(true);
    });
});
