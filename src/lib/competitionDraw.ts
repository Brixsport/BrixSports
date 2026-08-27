// Pure, DB-import-free draw computation for the predetermined ("UCL-style")
// league-phase draw and generic knockout seed suggestions. No side effects,
// no DB access -- safe to import from server or client code, and to unit
// test offline (see dev/verify-draw.ts). Same convention as standingsSort.ts.

export interface UndirectedPairing {
    round: number; // 1-based
    index: number; // stable position within the round
    teamA: string;
    teamB: string;
}

export interface DrawPairing {
    round: number;
    index: number;
    homeTeamId: string;
    awayTeamId: string;
}

const POT_COUNT = 4;
const ROUNDS_PER_TEAM = 4;

export function buildPots(seedOrder: string[], potCount = POT_COUNT): string[][] {
    if (potCount <= 0 || seedOrder.length % potCount !== 0) {
        throw new Error(`Seed order length (${seedOrder.length}) must be evenly divisible by pot count (${potCount})`);
    }
    const potSize = seedOrder.length / potCount;
    const pots: string[][] = [];
    for (let p = 0; p < potCount; p++) {
        pots.push(seedOrder.slice(p * potSize, (p + 1) * potSize));
    }
    return pots;
}

// Cyclic pairing between two same-size pots: potA[i] vs potB[(i+offset) % size].
function pairPots(potA: string[], potB: string[], offset: number): [string, string][] {
    const size = potA.length;
    const pairs: [string, string][] = [];
    for (let i = 0; i < size; i++) {
        pairs.push([potA[i], potB[(i + offset) % size]]);
    }
    return pairs;
}

/**
 * POT_CIRCLE_V1: given 20 seeded teams split into 4 pots of 5, produces 4
 * rounds where every team faces 4 distinct opponents, entirely predetermined
 * (no dependency on any round's results). Round 4 repeats round 1's
 * pot-pairing at a different offset -- since offset 1 != offset 0 (mod 5),
 * no team repeats its round-1 opponent.
 *
 * Deliberate asymmetry, stated honestly rather than hidden: pot 1 faces pot
 * 2 twice (rounds 1 and 4) and pot 3 faces pot 4 twice, because true "one
 * opponent per pot" (real UCL's rule) is mathematically impossible with
 * pots of 5 -- odd, so no perfect intra-pot matching exists.
 */
export function computeLeaguePhaseDraw(seedOrder: string[]): { pairings: UndirectedPairing[]; pots: string[][] } {
    if (seedOrder.length !== 20) {
        throw new Error(`POT_CIRCLE_V1 requires exactly 20 teams, got ${seedOrder.length}`);
    }
    const pots = buildPots(seedOrder, POT_COUNT);
    const [pot1, pot2, pot3, pot4] = pots;

    const roundDefs: [string[], string[], number][][] = [
        [[pot1, pot2, 0], [pot3, pot4, 0]],
        [[pot1, pot3, 0], [pot2, pot4, 0]],
        [[pot1, pot4, 0], [pot2, pot3, 0]],
        [[pot1, pot2, 1], [pot3, pot4, 1]],
    ];

    const pairings: UndirectedPairing[] = [];
    roundDefs.forEach((halves, roundIdx) => {
        let index = 0;
        for (const [potA, potB, offset] of halves) {
            for (const [teamA, teamB] of pairPots(potA, potB, offset)) {
                pairings.push({ round: roundIdx + 1, index: index++, teamA, teamB });
            }
        }
    });

    return { pairings, pots };
}

/**
 * Assigns home/away to each undirected pairing so every team ends up with
 * exactly 2 home and 2 away matches. Tries a greedy running-count balance
 * first (favor whichever side currently has fewer assigned home matches);
 * if that doesn't land exactly even for every team, falls back to orienting
 * an Eulerian circuit of the pairing graph (Hierholzer's algorithm), which
 * IS guaranteed exact for any connected graph where every vertex has even
 * degree -- this graph is 4-regular by construction (every team appears in
 * exactly 4 pairings), and connected (every pot pairs with every other pot
 * across the 4 rounds).
 */
export function assignHomeAway(pairings: UndirectedPairing[]): DrawPairing[] {
    const greedy = greedyBalance(pairings);
    if (isExactlyBalanced(pairings, greedy)) return toDrawPairings(pairings, greedy);

    const eulerian = eulerianBalance(pairings);
    if (!isExactlyBalanced(pairings, eulerian)) {
        throw new Error(
            'assignHomeAway: neither greedy nor Eulerian orientation achieved an exact 2-home/2-away split -- the pairing graph is not 4-regular/connected as expected.'
        );
    }
    return toDrawPairings(pairings, eulerian);
}

function greedyBalance(pairings: UndirectedPairing[]): string[] {
    const homeCount = new Map<string, number>();
    const homeOf: string[] = [];
    for (const p of pairings) {
        const a = homeCount.get(p.teamA) ?? 0;
        const b = homeCount.get(p.teamB) ?? 0;
        const home = a <= b ? p.teamA : p.teamB;
        homeOf.push(home);
        homeCount.set(home, (homeCount.get(home) ?? 0) + 1);
    }
    return homeOf;
}

function isExactlyBalanced(pairings: UndirectedPairing[], homeOf: string[]): boolean {
    const homeCount = new Map<string, number>();
    const totalCount = new Map<string, number>();
    pairings.forEach((p, i) => {
        totalCount.set(p.teamA, (totalCount.get(p.teamA) ?? 0) + 1);
        totalCount.set(p.teamB, (totalCount.get(p.teamB) ?? 0) + 1);
        homeCount.set(homeOf[i], (homeCount.get(homeOf[i]) ?? 0) + 1);
    });
    for (const [team, total] of totalCount) {
        const home = homeCount.get(team) ?? 0;
        if (home * 2 !== total) return false;
    }
    return true;
}

// Hierholzer's algorithm: build an Eulerian circuit over the pairing
// multigraph, then orient each edge along the direction it was traversed.
// Each time the circuit revisits a vertex it consumes one incoming and one
// outgoing edge, so a degree-4 vertex (visited twice) ends up with exactly
// 2 outgoing (home) and 2 incoming (away) edges.
function eulerianBalance(pairings: UndirectedPairing[]): string[] {
    interface Edge { to: string; pairingIndex: number; used: boolean }
    const adjacency = new Map<string, Edge[]>();
    const addEdge = (from: string, to: string, pairingIndex: number) => {
        if (!adjacency.has(from)) adjacency.set(from, []);
        adjacency.get(from)!.push({ to, pairingIndex, used: false });
    };
    pairings.forEach((p, i) => {
        addEdge(p.teamA, p.teamB, i);
        addEdge(p.teamB, p.teamA, i);
    });

    const orientation: (string | undefined)[] = new Array(pairings.length);
    const start = pairings[0].teamA;
    const stack = [start];

    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const edges = adjacency.get(current) ?? [];
        const nextEdge = edges.find(e => !e.used);
        if (!nextEdge) {
            stack.pop();
            continue;
        }
        nextEdge.used = true;
        const mirror = (adjacency.get(nextEdge.to) ?? []).find(e => e.pairingIndex === nextEdge.pairingIndex && !e.used);
        if (mirror) mirror.used = true;
        // current -> nextEdge.to: current is the home team for this pairing.
        orientation[nextEdge.pairingIndex] = current;
        stack.push(nextEdge.to);
    }

    if (orientation.some(o => o === undefined)) {
        throw new Error('eulerianBalance: pairing graph is not connected -- could not cover every edge from a single start vertex.');
    }
    return orientation as string[];
}

function toDrawPairings(pairings: UndirectedPairing[], homeOf: string[]): DrawPairing[] {
    return pairings.map((p, i) => {
        const home = homeOf[i];
        const away = home === p.teamA ? p.teamB : p.teamA;
        return { round: p.round, index: p.index, homeTeamId: home, awayTeamId: away };
    });
}

export interface DrawValidation { valid: boolean; errors: string[] }

export function validateDraw(seedOrder: string[], pairings: DrawPairing[]): DrawValidation {
    const errors: string[] = [];
    const opponentsByTeam = new Map<string, Set<string>>();
    const gamesByTeam = new Map<string, number>();
    const homeByTeam = new Map<string, number>();
    const roundsByTeam = new Map<string, Set<number>>();

    for (const p of pairings) {
        const roles: [string, string, boolean][] = [
            [p.homeTeamId, p.awayTeamId, true],
            [p.awayTeamId, p.homeTeamId, false],
        ];
        for (const [team, opp, isHome] of roles) {
            if (!opponentsByTeam.has(team)) opponentsByTeam.set(team, new Set());
            const opponents = opponentsByTeam.get(team)!;
            if (opponents.has(opp)) errors.push(`${team} faces ${opp} more than once`);
            opponents.add(opp);

            gamesByTeam.set(team, (gamesByTeam.get(team) ?? 0) + 1);
            if (isHome) homeByTeam.set(team, (homeByTeam.get(team) ?? 0) + 1);

            if (!roundsByTeam.has(team)) roundsByTeam.set(team, new Set());
            const rounds = roundsByTeam.get(team)!;
            if (rounds.has(p.round)) errors.push(`${team} has two matches in round ${p.round}`);
            rounds.add(p.round);
        }
    }

    for (const team of seedOrder) {
        const games = gamesByTeam.get(team) ?? 0;
        if (games !== ROUNDS_PER_TEAM) errors.push(`${team} has ${games} matches, expected ${ROUNDS_PER_TEAM}`);
        const home = homeByTeam.get(team) ?? 0;
        if (home !== ROUNDS_PER_TEAM / 2) errors.push(`${team} has ${home} home matches, expected ${ROUNDS_PER_TEAM / 2}`);
    }

    return { valid: errors.length === 0, errors };
}

export interface SeedPairing {
    seed: number;
    opponentSeed: number;
    teamId: string;
    opponentTeamId: string;
}

/**
 * Generic top-N knockout seeding suggestion (1 vs N, 2 vs N-1, ...), reused
 * by the manual knockout bracket admin form. Not BUSA-specific -- works for
 * any even N, so the same function covers this competition and any future
 * top-N knockout stage.
 */
export function suggestSeedPairings(orderedTeamIds: string[]): SeedPairing[] {
    const n = orderedTeamIds.length;
    if (n === 0 || n % 2 !== 0) {
        throw new Error(`suggestSeedPairings requires a positive even number of teams, got ${n}`);
    }
    const half = n / 2;
    const pairs: SeedPairing[] = [];
    for (let i = 0; i < half; i++) {
        pairs.push({
            seed: i + 1,
            opponentSeed: n - i,
            teamId: orderedTeamIds[i],
            opponentTeamId: orderedTeamIds[n - 1 - i],
        });
    }
    return pairs;
}
