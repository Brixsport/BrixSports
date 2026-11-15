import { hasKnownMinute } from '@/lib/eventMinute';

/**
 * Substitutions come from the match events, not from the stored lineup. The logger saves one
 * `Substitution` event per change: `playerId` is the player coming OFF, `relatedPlayerId` the
 * player coming ON (FootballLogger.handleSubIn). The published lineup JSON never carries any of
 * this, so the lineups tab has to derive it.
 */
export interface SubstitutionRow {
    id: string;
    teamId: string | null;
    /** Known minute, or null when it was never recorded (backfilled events use -1). */
    minute: number | null;
    outId: string | null;
    inId: string | null;
    outName: string | null;
    inName: string | null;
    outNumber: number | string | null;
    inNumber: number | string | null;
}

const display = (p: any): string | null => p?.jerseyName || p?.name || null;

export function deriveSubstitutions(events: any[] | null | undefined): SubstitutionRow[] {
    if (!Array.isArray(events)) return [];
    const rows = events
        .filter((e) => e && e.type === 'Substitution')
        .map((e, i): SubstitutionRow & { order: number } => {
            const outId = e.playerId ?? e.player?.id ?? null;
            const inId = e.relatedPlayerId ?? e.relatedPlayer?.id ?? null;
            return {
                id: e.id ?? `sub-${i}`,
                teamId: e.teamId ?? null,
                minute: hasKnownMinute(e.minute) ? e.minute : null,
                outId,
                inId,
                outName: display(e.player),
                inName: display(e.relatedPlayer),
                outNumber: e.player?.number ?? null,
                inNumber: e.relatedPlayer?.number ?? null,
                order: i,
            };
        })
        // A substitution needs both sides to say anything useful.
        .filter((r) => r.outId && r.inId);

    // Chronological; unknown minutes go last, ties keep the order they were logged in.
    rows.sort((a, b) => {
        const am = a.minute ?? Number.POSITIVE_INFINITY;
        const bm = b.minute ?? Number.POSITIVE_INFINITY;
        return am - bm || a.order - b.order;
    });
    return rows.map(({ order: _order, ...r }) => r);
}

/** Player id -> minute (null = unknown) for the players who came off / came on. */
export function substitutionMaps(rows: SubstitutionRow[]) {
    const off = new Map<string, number | null>();
    const on = new Map<string, number | null>();
    for (const r of rows) {
        if (r.outId) off.set(r.outId, r.minute);
        if (r.inId) on.set(r.inId, r.minute);
    }
    return { off, on };
}
