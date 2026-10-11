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
