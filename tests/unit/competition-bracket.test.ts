import { describe, expect, it } from 'vitest';
import { deriveBracket, knockoutRank, seedPairs } from '@/lib/competition-bracket';

describe('knockoutRank', () => {
  it('ranks knockout stages in order and ignores league rounds', () => {
    expect(knockoutRank('Quarter Finals')).toBeLessThan(knockoutRank('Semi-Final')!);
    expect(knockoutRank('Semifinals')).toBeLessThan(knockoutRank('3rd Place Playoff')!);
    expect(knockoutRank('3rd Place')).toBeLessThan(knockoutRank('Final')!);
    expect(knockoutRank('Round of 16')).toBeLessThan(knockoutRank('Quarter-Final')!);
    for (const r of ['Group A', 'Group Stage', 'Match Day 3', 'Round 4', 'Group Day 1', null, '']) {
      expect(knockoutRank(r)).toBeNull();
    }
  });
});

describe('seedPairs', () => {
  it('pairs 8 qualifiers in bracket order', () => {
    expect(seedPairs(8).map((p) => `${p.homeSeed}v${p.awaySeed}`)).toEqual(['1v8', '4v5', '2v7', '3v6']);
  });
  it('handles 4 and rejects non powers of two', () => {
    expect(seedPairs(4).map((p) => `${p.homeSeed}v${p.awaySeed}`)).toEqual(['1v4', '2v3']);
    expect(seedPairs(6)).toEqual([]);
  });
});

describe('deriveBracket', () => {
  it('keeps only knockout rounds, ordered, matches by time', () => {
    const rounds = deriveBracket([
      { id: 'g', round: 'Group A', status: 'FINISHED' },
      { id: 'f', round: 'Final', status: 'FINISHED', startTime: '2026-02-02', homeTeam: { name: 'A' }, awayTeam: { name: 'B' }, homeScore: 1, awayScore: 0 },
      { id: 'q2', round: 'Quarter Finals', status: 'FINISHED', startTime: '2026-02-02' },
      { id: 'q1', round: 'Quarter Finals', status: 'FINISHED', startTime: '2026-02-01' },
    ]);
    expect(rounds.map((r) => r.label)).toEqual(['Quarter Finals', 'Final']);
    expect(rounds[0].matches.map((m) => m.id)).toEqual(['q1', 'q2']);
    expect(rounds[1].matches[0].homeScore).toBe(1);
  });
});
