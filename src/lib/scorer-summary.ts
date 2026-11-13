import { formatScorerLine, knownMinutes } from '@/lib/eventMinute';

// Football event types that put a goal on the board. Mirrors SCORING_FOOTBALL in
// event-input.ts; matching is on the normalised type ("Own Goal" -> OWN_GOAL).
const SCORING_TYPES = new Set(['GOAL', 'PENALTY', 'OWN_GOAL']);

export type ScoringKind = 'goal' | 'penalty' | 'own_goal';

export interface ScoringEventLike {
    type?: string | null;
    detail?: string | null;
    teamId?: string | null;
    minute: number;
    player?: { name?: string | null; jerseyName?: string | null } | null;
    playerSnapshot?: { name?: string | null; jerseyName?: string | null } | null;
}

export function normalizeEventType(type: string | null | undefined): string {
    return (type ?? '').toUpperCase().replace(/\s+/g, '_');
}

/**
 * Which team a scoring event credits, or null when the event is not a goal.
 * An own goal (type OWN_GOAL, or a GOAL whose detail says "own goal") credits the
 * opposing team.
 */
export function creditedGoal(
    event: ScoringEventLike,
    homeTeamId: string,
    awayTeamId: string
): { teamId: string | null | undefined; kind: ScoringKind } | null {
    const type = normalizeEventType(event.type);
    if (!SCORING_TYPES.has(type)) return null;

    const isOwnGoal = type === 'OWN_GOAL' || (event.detail?.toLowerCase().includes('own goal') ?? false);
    if (isOwnGoal) {
        return { teamId: event.teamId === homeTeamId ? awayTeamId : homeTeamId, kind: 'own_goal' };
    }
    return { teamId: event.teamId, kind: type === 'PENALTY' ? 'penalty' : 'goal' };
}

export interface ScorerGoal {
    minute: number;
    penalty: boolean;
}

export interface ScorerSummaryEntry {
    name: string;
    goals: ScorerGoal[];
    firstMinute: number;
}

/** Per-team header scorer list, ordered by first known goal minute (unknown minutes last). */
export function buildScorerSummary(
    events: ScoringEventLike[],
    teamId: string,
    homeTeamId: string,
    awayTeamId: string
): ScorerSummaryEntry[] {
    const byPlayer = new Map<string, ScorerGoal[]>();
    for (const e of events) {
        const credit = creditedGoal(e, homeTeamId, awayTeamId);
        if (!credit || credit.teamId !== teamId) continue;
        const rawName = e.player?.jerseyName ?? e.player?.name ?? e.playerSnapshot?.jerseyName ?? e.playerSnapshot?.name ?? 'Unknown';
        const key = credit.kind === 'own_goal' ? `${rawName} (OG)` : rawName;
        if (!byPlayer.has(key)) byPlayer.set(key, []);
        byPlayer.get(key)!.push({ minute: e.minute, penalty: credit.kind === 'penalty' });
    }
    return Array.from(byPlayer.entries())
        .map(([name, goals]) => {
            const known = knownMinutes(goals.map(g => g.minute));
            return { name, goals, firstMinute: known.length > 0 ? known[0] : Infinity };
        })
        .sort((a, b) => (a.firstMinute === b.firstMinute ? 0 : a.firstMinute - b.firstMinute));
}

/** "Wareez 33', 71'", "Animashaun 51' (P)", or just the name when no minute is known. */
export function formatScorerEntry(entry: ScorerSummaryEntry): string {
    const known = entry.goals
        .filter(g => knownMinutes([g.minute]).length > 0)
        .sort((a, b) => a.minute - b.minute);
    if (known.length === 0) return entry.name;
    return `${entry.name} ${known.map(g => `${formatScorerLine('', [g.minute]).trim()}${g.penalty ? ' (P)' : ''}`).join(', ')}`;
}
