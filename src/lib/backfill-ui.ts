/**
 * Pure helpers behind the admin "Add match events" screen: roster search that understands
 * nicknames and jersey numbers, and conversion of the screen's rows into the API payload.
 */
import { BACKFILL_EVENT_TYPES, type BackfillEventInput } from '@/lib/event-backfill';

export interface RosterPlayer {
    playerId: string;
    name: string;
    jerseyName: string | null;
    jerseyNumber: number | null;
    nicknames: string[];
}

export type Side = 'home' | 'away';

export interface EventRow {
    key: string;
    type: (typeof BACKFILL_EVENT_TYPES)[number];
    side: Side;
    playerId: string;
    /** Assist rows only: the scorer the pass led to. */
    relatedPlayerId: string;
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, '').trim();

/**
 * Rank roster players for a typed query. Exact nickname/jersey-name/number hits come first,
 * then prefix matches, then substring matches on the name. An empty query returns the roster
 * in its given order. Every word of the query must match somewhere.
 */
export function searchRoster(roster: RosterPlayer[], query: string, limit = 12): RosterPlayer[] {
    const words = norm(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return roster.slice(0, limit);

    const scored: Array<{ p: RosterPlayer; score: number }> = [];
    for (const p of roster) {
        const fields = [p.name, p.jerseyName, ...p.nicknames, p.jerseyNumber != null ? String(p.jerseyNumber) : ''].map(norm).filter(Boolean);
        let total = 0;
        let ok = true;
        for (const w of words) {
            let best = 0;
            for (const f of fields) {
                if (f === w) best = Math.max(best, 4);
                else if (f.startsWith(w) || f.split(' ').some(part => part.startsWith(w))) best = Math.max(best, 3);
                else if (f.includes(w)) best = Math.max(best, 2);
            }
            if (best === 0) { ok = false; break; }
            total += best;
        }
        if (ok) scored.push({ p, score: total });
    }
    return scored.sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name)).slice(0, limit).map(s => s.p);
}

/** Label shown in pickers: "Name (Jersey Name) #7". */
export function playerLabel(p: Pick<RosterPlayer, 'name' | 'jerseyName' | 'jerseyNumber'>): string {
    const jersey = p.jerseyName && norm(p.jerseyName) !== norm(p.name) ? ` (${p.jerseyName})` : '';
    const number = p.jerseyNumber != null ? ` #${p.jerseyNumber}` : '';
    return `${p.name}${jersey}${number}`;
}

/** Rows to the POST body. A row with a missing required player is reported, not silently dropped. */
export function rowsToPayload(
    rows: EventRow[],
    teamIds: { home: string; away: string }
): { events: BackfillEventInput[]; problems: string[] } {
    const problems: string[] = [];
    const events: BackfillEventInput[] = [];
    rows.forEach((row, i) => {
        const label = `Event ${i + 1}`;
        const needsPlayer = row.type !== 'Goal' && row.type !== 'Penalty';
        if (needsPlayer && !row.playerId) problems.push(`${label}: pick a player for ${row.type}`);
        if (row.type === 'Assist' && !row.relatedPlayerId) problems.push(`${label}: pick the scorer this assist led to`);
        events.push({
            type: row.type,
            teamId: teamIds[row.side],
            playerId: row.playerId || null,
            relatedPlayerId: row.type === 'Assist' ? row.relatedPlayerId || null : null,
        });
    });
    return { events, problems };
}

/** Scorers an assist on this side can point at: goals and penalties with a known player. */
export function scorerOptions(rows: EventRow[], side: Side): string[] {
    return Array.from(new Set(rows.filter(r => r.side === side && (r.type === 'Goal' || r.type === 'Penalty') && r.playerId).map(r => r.playerId)));
}

/** Score the rows add up to, matching the server: goals and penalties for the side, own goals for the other side. */
export function scoreFromRows(rows: EventRow[]): { home: number; away: number } {
    const score = { home: 0, away: 0 };
    for (const r of rows) {
        if (r.type === 'Goal' || r.type === 'Penalty') score[r.side] += 1;
        else if (r.type === 'Own Goal') score[r.side === 'home' ? 'away' : 'home'] += 1;
    }
    return score;
}
