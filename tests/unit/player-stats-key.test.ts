import { describe, it, expect } from 'vitest';
import {
    deriveStatsKey,
    decideStatsWrite,
    getStatDeltas,
    getEventStatEffects,
    mergeStatEffects,
} from '@/lib/player-stats-key';

describe('deriveStatsKey', () => {
    it('uses the competition season when the match has a competition', () => {
        expect(deriveStatsKey({ competitionId: 'c1', competitionSeason: '2025/2026', currentSeason: '2026/2027' }))
            .toEqual({ season: '2025/2026', competitionId: 'c1' });
    });

    it('falls back to the current season when the competition has no season', () => {
        expect(deriveStatsKey({ competitionId: 'c1', competitionSeason: null, currentSeason: '2026/2027' }))
            .toEqual({ season: '2026/2027', competitionId: 'c1' });
    });

    it('keeps competitionId null and uses the current season for a match with no competition', () => {
        expect(deriveStatsKey({ competitionId: null, competitionSeason: null, currentSeason: '2026/2027' }))
            .toEqual({ season: '2026/2027', competitionId: null });
        expect(deriveStatsKey({ competitionId: undefined, competitionSeason: '1999', currentSeason: '2026/2027' }))
            .toEqual({ season: '2026/2027', competitionId: null });
    });

    it('gives different keys for the same player in two competitions', () => {
        const a = deriveStatsKey({ competitionId: 'c1', competitionSeason: '2025', currentSeason: '2026' });
        const b = deriveStatsKey({ competitionId: 'c2', competitionSeason: '2024', currentSeason: '2026' });
        expect(a).not.toEqual(b);
    });
});

describe('decideStatsWrite', () => {
    it('uses the atomic upsert whenever there is a competition', () => {
        expect(decideStatsWrite('c1', null)).toBe('upsert');
        expect(decideStatsWrite('c1', 'row-1')).toBe('upsert');
    });

    it('updates the existing row for a NULL competition instead of inserting another', () => {
        expect(decideStatsWrite(null, 'row-1')).toBe('update-existing');
    });

    it('inserts only when no NULL-competition row exists yet', () => {
        expect(decideStatsWrite(null, null)).toBe('insert-new');
        expect(decideStatsWrite(null, undefined)).toBe('insert-new');
    });
});

describe('getStatDeltas', () => {
    it('maps football events', () => {
        expect(getStatDeltas('Football', 'Goal', false)).toEqual({ goals: 1, shotsOnTarget: 1 });
        expect(getStatDeltas('Football', 'Yellow Card', false)).toEqual({ yellowCards: 1 });
        expect(getStatDeltas('Football', 'RED_CARD', false)).toEqual({ redCards: 1 });
        expect(getStatDeltas('Football', 'Corner', false)).toEqual({});
    });

    it('counts a basketball miss as an attempt only and a make as attempt, made and points', () => {
        expect(getStatDeltas('Basketball', 'Three Pointer', false)).toEqual({ threePointersAttempted: 1 });
        expect(getStatDeltas('Basketball', 'Three Pointer', true))
            .toEqual({ threePointersAttempted: 1, threePointersMade: 1, totalPoints: 3 });
        expect(getStatDeltas('Basketball', 'Free Throw', true).totalPoints).toBe(1);
    });

    it('returns nothing for a sport without stats', () => {
        expect(getStatDeltas('Chess', 'Goal', true)).toEqual({});
    });
});

describe('getEventStatEffects', () => {
    it('credits the player on the event', () => {
        expect(getEventStatEffects('Football', { type: 'Goal', playerId: 'p1' }))
            .toEqual([{ playerId: 'p1', deltas: { goals: 1, shotsOnTarget: 1 } }]);
    });

    it('credits the keeper a save on a saved penalty, besides the taker', () => {
        const effects = getEventStatEffects('Football', { type: 'Penalty Saved', playerId: 'taker', relatedPlayerId: 'keeper' });
        expect(effects).toEqual([
            { playerId: 'taker', deltas: { shotsOnTarget: 1 } },
            { playerId: 'keeper', deltas: { saves: 1 } },
        ]);
    });

    it('credits the keeper even when the taker is not recorded', () => {
        expect(getEventStatEffects('Football', { type: 'PENALTY_SAVED', relatedPlayerId: 'keeper' }))
            .toEqual([{ playerId: 'keeper', deltas: { saves: 1 } }]);
    });

    it('has no effect without a player or for an uncounted type', () => {
        expect(getEventStatEffects('Football', { type: 'Goal' })).toEqual([]);
        expect(getEventStatEffects('Football', { type: 'Corner', playerId: 'p1' })).toEqual([]);
    });

    it('is the same list for write and revert (the revert reads made from the stored value)', () => {
        const write = getEventStatEffects('Basketball', { type: 'Field Goal', playerId: 'p1', made: true });
        const revert = getEventStatEffects('Basketball', { type: 'Field Goal', playerId: 'p1', made: true });
        expect(revert).toEqual(write);
        expect(write[0].deltas.totalPoints).toBe(2);
    });
});

describe('mergeStatEffects', () => {
    it('sums deltas per player', () => {
        const merged = mergeStatEffects([
            { playerId: 'p1', deltas: { goals: 1, shotsOnTarget: 1 } },
            { playerId: 'p2', deltas: { yellowCards: 1 } },
            { playerId: 'p1', deltas: { goals: 1, assists: 1 } },
        ]);
        expect(merged).toEqual([
            { playerId: 'p1', deltas: { goals: 2, shotsOnTarget: 1, assists: 1 } },
            { playerId: 'p2', deltas: { yellowCards: 1 } },
        ]);
    });
});
