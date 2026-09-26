// Phase 2 (TESTING_STRATEGY_2026-09-18.md): src/lib/competitionDraw.ts is
// explicitly documented as pure, DB-import-free draw computation -- the
// cleanest possible unit-test target in this codebase.
import { describe, it, expect } from 'vitest';
import {
    buildPots,
    computeLeaguePhaseDraw,
    assignHomeAway,
    validateDraw,
    suggestSeedPairings,
    type DrawPairing,
} from '@/lib/competitionDraw';

const TEAMS_20 = Array.from({ length: 20 }, (_, i) => `team-${i + 1}`);

describe('buildPots', () => {
    it('splits 20 teams into 4 pots of 5, preserving seed order within each pot', () => {
        const pots = buildPots(TEAMS_20);
        expect(pots).toHaveLength(4);
        expect(pots.every(p => p.length === 5)).toBe(true);
        expect(pots[0]).toEqual(TEAMS_20.slice(0, 5));
    });

    it('throws when the seed order does not divide evenly by pot count', () => {
        expect(() => buildPots(TEAMS_20.slice(0, 19))).toThrow(/evenly divisible/);
    });
});

describe('computeLeaguePhaseDraw', () => {
    it('requires exactly 20 teams', () => {
        expect(() => computeLeaguePhaseDraw(TEAMS_20.slice(0, 19))).toThrow(/requires exactly 20 teams/);
    });

    it('produces 4 rounds of 10 pairings each (40 total), every team appearing exactly 4 times', () => {
        const { pairings } = computeLeaguePhaseDraw(TEAMS_20);
        expect(pairings).toHaveLength(40);
        for (let round = 1; round <= 4; round++) {
            expect(pairings.filter(p => p.round === round)).toHaveLength(10);
        }
        const appearances = new Map<string, number>();
        for (const p of pairings) {
            appearances.set(p.teamA, (appearances.get(p.teamA) ?? 0) + 1);
            appearances.set(p.teamB, (appearances.get(p.teamB) ?? 0) + 1);
        }
        for (const team of TEAMS_20) {
            expect(appearances.get(team)).toBe(4);
        }
    });

    it('never pairs a team against itself', () => {
        const { pairings } = computeLeaguePhaseDraw(TEAMS_20);
        expect(pairings.every(p => p.teamA !== p.teamB)).toBe(true);
    });
});

describe('assignHomeAway + validateDraw — full round trip', () => {
    it('produces a fully valid draw for a real 20-team seed order', () => {
        const { pairings } = computeLeaguePhaseDraw(TEAMS_20);
        const directed = assignHomeAway(pairings);
        const validation = validateDraw(TEAMS_20, directed);
        expect(validation.errors).toEqual([]);
        expect(validation.valid).toBe(true);
    });

    it('gives every team exactly 2 home and 2 away matches', () => {
        const { pairings } = computeLeaguePhaseDraw(TEAMS_20);
        const directed = assignHomeAway(pairings);
        const homeCount = new Map<string, number>();
        const awayCount = new Map<string, number>();
        for (const p of directed) {
            homeCount.set(p.homeTeamId, (homeCount.get(p.homeTeamId) ?? 0) + 1);
            awayCount.set(p.awayTeamId, (awayCount.get(p.awayTeamId) ?? 0) + 1);
        }
        for (const team of TEAMS_20) {
            expect(homeCount.get(team)).toBe(2);
            expect(awayCount.get(team)).toBe(2);
        }
    });
});

describe('validateDraw — catches a broken draw', () => {
    it('flags a team facing the same opponent twice', () => {
        const broken: DrawPairing[] = [
            { round: 1, index: 0, homeTeamId: 'a', awayTeamId: 'b' },
            { round: 2, index: 0, homeTeamId: 'b', awayTeamId: 'a' }, // same pairing again
        ];
        const result = validateDraw(['a', 'b'], broken);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('more than once'))).toBe(true);
    });

    it('flags a team with two matches in the same round', () => {
        const broken: DrawPairing[] = [
            { round: 1, index: 0, homeTeamId: 'a', awayTeamId: 'b' },
            { round: 1, index: 1, homeTeamId: 'a', awayTeamId: 'c' },
        ];
        const result = validateDraw(['a', 'b', 'c'], broken);
        expect(result.errors.some(e => e.includes('two matches in round 1'))).toBe(true);
    });
});

describe('suggestSeedPairings', () => {
    it('pairs seed 1 vs last, 2 vs second-to-last, etc.', () => {
        const teams = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'];
        const pairs = suggestSeedPairings(teams);
        expect(pairs).toEqual([
            { seed: 1, opponentSeed: 8, teamId: 't1', opponentTeamId: 't8' },
            { seed: 2, opponentSeed: 7, teamId: 't2', opponentTeamId: 't7' },
            { seed: 3, opponentSeed: 6, teamId: 't3', opponentTeamId: 't6' },
            { seed: 4, opponentSeed: 5, teamId: 't4', opponentTeamId: 't5' },
        ]);
    });

    it('throws for an odd number of teams', () => {
        expect(() => suggestSeedPairings(['t1', 't2', 't3'])).toThrow(/positive even number/);
    });

    it('throws for zero teams', () => {
        expect(() => suggestSeedPairings([])).toThrow(/positive even number/);
    });
});
