/**
 * Live-score overlay for list pages.
 *
 * The homepage's full match lists come from the heavy sport routes (up to 100 matches each), whose edge
 * cache revalidates slowly, so a goal can take several seconds to show. While a match is live the page also
 * polls the tiny, edge-cacheable /api/live-matches and patches just the live fields into its state; the
 * full lists keep refreshing on their own slower poll and stay the source of truth.
 *
 * `needsFullRefresh` tells the caller to reload the full lists right away: a match we show as LIVE is no
 * longer in the live list (it finished or was reset), or a LIVE match appeared that we do not show as LIVE.
 */
export interface LiveOverlayInput {
    id: string;
    status: string;
    homeScore?: number | null;
    awayScore?: number | null;
    currentPeriod?: string | null;
    shootoutHomeScore?: number | null;
    shootoutAwayScore?: number | null;
}

export interface LiveOverlayResult<T> {
    next: T[];
    changed: boolean;
    needsFullRefresh: boolean;
}

type PatchableMatch = {
    id: string;
    status: string;
    homeScore?: any;
    awayScore?: any;
    currentPeriod?: any;
    shootoutHomeScore?: any;
    shootoutAwayScore?: any;
};

export function mergeLiveScores<T extends PatchableMatch>(current: T[], live: LiveOverlayInput[]): LiveOverlayResult<T> {
    const liveById = new Map(live.map((m) => [m.id, m]));
    const currentLiveIds = new Set<string>();
    let needsFullRefresh = false;
    let changed = false;

    const next = current.map((m) => {
        if (m.status !== 'LIVE') return m;
        currentLiveIds.add(m.id);
        const l = liveById.get(m.id);
        if (!l) {
            needsFullRefresh = true;
            return m;
        }
        // Same value semantics as the page's own transform: scores default to 0, shootout scores to undefined,
        // currentPeriod to null.
        const homeScore = l.homeScore || 0;
        const awayScore = l.awayScore || 0;
        const currentPeriod = l.currentPeriod ?? null;
        const shootoutHomeScore = l.shootoutHomeScore ?? undefined;
        const shootoutAwayScore = l.shootoutAwayScore ?? undefined;
        if (
            m.homeScore === homeScore &&
            m.awayScore === awayScore &&
            (m.currentPeriod ?? null) === currentPeriod &&
            m.shootoutHomeScore === shootoutHomeScore &&
            m.shootoutAwayScore === shootoutAwayScore
        ) {
            return m;
        }
        changed = true;
        return { ...m, homeScore, awayScore, currentPeriod, shootoutHomeScore, shootoutAwayScore };
    });

    for (const l of live) {
        if (!currentLiveIds.has(l.id)) needsFullRefresh = true;
    }

    return { next: changed ? next : current, changed, needsFullRefresh };
}

/** Minimum gap between overlay-triggered reloads of the heavy lists. */
export const FULL_REFRESH_COOLDOWN_MS = 10000;
/** A live snapshot older than this is not trusted to patch a freshly loaded list. */
export const LIVE_SNAPSHOT_MAX_AGE_MS = 15000;

export interface FullRefreshGate {
    needsFullRefresh: boolean;
    /** True while a load of the full lists is already running. */
    inFlight: boolean;
    /** When the last overlay-triggered reload started (ms), or null if none yet. */
    lastRunAt: number | null;
    now: number;
    cooldownMs?: number;
}

/**
 * Whether the overlay should reload the full lists now. A match that ended stays LIVE in the edge-cached
 * lists for a while, so `needsFullRefresh` keeps coming back true on every tick; the gate stops that from
 * turning into a heavy reload every few seconds.
 */
export function shouldRunFullRefresh(gate: FullRefreshGate): boolean {
    if (!gate.needsFullRefresh || gate.inFlight) return false;
    if (gate.lastRunAt === null) return true;
    return gate.now - gate.lastRunAt >= (gate.cooldownMs ?? FULL_REFRESH_COOLDOWN_MS);
}

export interface LiveSnapshot {
    live: LiveOverlayInput[];
    /** When the snapshot was received (ms). */
    at: number;
}

/**
 * Re-applies the latest live snapshot onto a freshly loaded full list, so a slow list response (which lags
 * the live endpoint) cannot flip a score back. Returns the list untouched when there is no usable snapshot.
 */
export function applyLiveSnapshot<T extends PatchableMatch>(
    current: T[],
    snapshot: LiveSnapshot | null,
    now: number,
    maxAgeMs: number = LIVE_SNAPSHOT_MAX_AGE_MS
): T[] {
    if (!snapshot || now - snapshot.at > maxAgeMs) return current;
    return mergeLiveScores(current, snapshot.live).next;
}
