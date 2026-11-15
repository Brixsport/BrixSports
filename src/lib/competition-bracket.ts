// Derives a knockout bracket from a competition's fixtures, and projects the
// seeded first knockout round from a standings table. Pure functions.

export interface BracketTeam {
  name: string;
  logo?: string | null;
}

export interface BracketMatch {
  id: string;
  status: string;
  startTime?: string | null;
  home: BracketTeam | null;
  away: BracketTeam | null;
  homeScore: number | null;
  awayScore: number | null;
  shootout: string | null;
}

export interface BracketRound {
  label: string;
  rank: number;
  matches: BracketMatch[];
}

export interface FixtureLike {
  id: string;
  round?: string | null;
  status: string;
  startTime?: string | null;
  homeTeam?: { name?: string; logo?: string | null } | null;
  awayTeam?: { name?: string; logo?: string | null } | null;
  homeScore?: number | null;
  awayScore?: number | null;
  shootoutHomeScore?: number | null;
  shootoutAwayScore?: number | null;
}

/** Lower rank = earlier stage. Null means the round is not a knockout stage. */
export function knockoutRank(round: string | null | undefined): number | null {
  if (!round) return null;
  const r = round.toLowerCase().replace(/[-_]/g, ' ');
  if (/\bgroup\b|match ?day|group day/.test(r)) return null;
  const roundOf = r.match(/round of (\d+)/);
  if (roundOf) return 6 - (Math.log2(Number(roundOf[1])) - 3);
  if (/quarter/.test(r)) return 6;
  if (/semi/.test(r)) return 7;
  if (/3rd|third/.test(r)) return 8;
  if (/\bfinal\b/.test(r)) return 9;
  return null;
}

/**
 * "4-3 pens" for a finished match level after play that went to a shootout. The
 * shootout columns default to 0 on every match, so a 0-0 pair means no shootout.
 */
export function shootoutLabel(m: {
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  shootoutHomeScore?: number | null;
  shootoutAwayScore?: number | null;
}): string | null {
  if (m.status !== 'FINISHED' || m.homeScore !== m.awayScore) return null;
  const h = m.shootoutHomeScore ?? 0;
  const a = m.shootoutAwayScore ?? 0;
  if (h + a === 0 || h === a) return null;
  return `${h}-${a} pens`;
}

export function deriveBracket(fixtures: FixtureLike[]): BracketRound[] {
  const byRound = new Map<string, BracketRound>();
  for (const f of fixtures) {
    const rank = knockoutRank(f.round);
    if (rank === null || !f.round) continue;
    const round = byRound.get(f.round) ?? { label: f.round.replace(/_/g, ' '), rank, matches: [] };
    round.matches.push({
      id: f.id,
      status: f.status,
      startTime: f.startTime ?? null,
      home: f.homeTeam?.name ? { name: f.homeTeam.name, logo: f.homeTeam.logo } : null,
      away: f.awayTeam?.name ? { name: f.awayTeam.name, logo: f.awayTeam.logo } : null,
      homeScore: typeof f.homeScore === 'number' ? f.homeScore : null,
      awayScore: typeof f.awayScore === 'number' ? f.awayScore : null,
      shootout: shootoutLabel(f),
    });
    byRound.set(f.round, round);
  }
  const rounds = [...byRound.values()].sort((a, b) => a.rank - b.rank);
  for (const round of rounds) {
    round.matches.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  }
  return rounds;
}

export interface SeedPair {
  homeSeed: number;
  awaySeed: number;
}

/**
 * Seeded pairings for a straight knockout of `qualifiers` teams, in bracket
 * order so neighbouring pairs meet in the next round: 8 -> 1v8, 4v5, 2v7, 3v6.
 */
export function seedPairs(qualifiers: number): SeedPair[] {
  if (qualifiers < 2 || (qualifiers & (qualifiers - 1)) !== 0) return [];
  let order = [1];
  while (order.length < qualifiers) {
    const size = order.length * 2;
    order = order.flatMap((seed) => [seed, size + 1 - seed]);
  }
  const pairs: SeedPair[] = [];
  for (let i = 0; i < order.length; i += 2) pairs.push({ homeSeed: order[i], awaySeed: order[i + 1] });
  return pairs;
}
