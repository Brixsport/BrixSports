// Time-aware edge caching for the public match-list APIs.
//
// A flat 2s CDN window (the old setting) only helps when several viewers happen
// to poll inside the same two seconds. With one poll per viewer every ~15s it
// was almost always a miss, so every poll ran a function. The list does not need
// to be that fresh when nothing is happening, so the window depends on the data:
//
//   LIVE  -- a match is live, about to start, or just started and not yet marked
//            live, or the result is empty (a match may be about to appear):
//            short window so scores stay fresh.
//   QUIET -- everything is finished or starts well into the future:
//            long window, one origin hit per minute instead of one per viewer.
//
// Worst case staleness is s-maxage + stale-while-revalidate: 15s while live,
// 3 minutes when quiet. A match an admin sets LIVE more than 30 minutes before
// its scheduled start can show as upcoming for up to 3 minutes on the list
// (the match page itself polls a separate 1s endpoint and is unaffected).

export const LIVE_LIST_CACHE_CONTROL = 'public, s-maxage=5, stale-while-revalidate=10';
export const QUIET_LIST_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=120';

const KICKOFF_LOOKAHEAD_MS = 30 * 60 * 1000;
// A match still "not started" this long after its start time is stale data, not
// a live match; do not let one forgotten row pin the whole list to the short window.
const LATE_START_GRACE_MS = 6 * 60 * 60 * 1000;

const TERMINAL_STATUSES = new Set(['FINISHED', 'CANCELLED', 'CANCELED', 'POSTPONED', 'ABANDONED']);

export interface CacheableMatch {
    status?: string | null;
    startTime?: Date | number | string | null;
}

function toMs(value: CacheableMatch['startTime']): number | null {
    if (value === null || value === undefined) return null;
    const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
}

export function isMatchHot(match: CacheableMatch, now: number): boolean {
    const status = (match.status ?? '').toUpperCase();
    if (status === 'LIVE') return true;
    if (TERMINAL_STATUSES.has(status)) return false;

    const start = toMs(match.startTime);
    if (start === null) return true; // cannot prove it is far away: stay fresh
    return start <= now + KICKOFF_LOOKAHEAD_MS && start >= now - LATE_START_GRACE_MS;
}

export function matchListCacheControl(matches: CacheableMatch[], now: number = Date.now()): string {
    if (matches.length === 0) return LIVE_LIST_CACHE_CONTROL;
    return matches.some((m) => isMatchHot(m, now)) ? LIVE_LIST_CACHE_CONTROL : QUIET_LIST_CACHE_CONTROL;
}
