import { and, asc, desc, gte, lt, or, sql, type SQL } from 'drizzle-orm';
import { matches } from '@/db/schema';

// Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD window on matches.startTime (text column, ISO-prefixed
// values compare correctly as strings). `from` is inclusive, `to` is inclusive of that whole day.
// Day granularity on purpose: the sport routes are edge-cached per query string, so a per-viewer
// timestamp would defeat the cache.
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDay(s: string): boolean {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function nextDay(s: string): string {
    const d = new Date(`${s}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

export type MatchRange =
    | { ok: true; conditions: SQL[]; ranged: boolean }
    | { ok: false; error: string };

export function parseMatchRange(searchParams: URLSearchParams): MatchRange {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const conditions: SQL[] = [];
    if (from !== null) {
        if (!DAY.test(from) || !isRealDay(from)) return { ok: false, error: 'from must be a valid YYYY-MM-DD date' };
        conditions.push(gte(matches.startTime, from));
    }
    if (to !== null) {
        if (!DAY.test(to) || !isRealDay(to)) return { ok: false, error: 'to must be a valid YYYY-MM-DD date' };
        conditions.push(lt(matches.startTime, nextDay(to)));
    }
    if (from !== null && to !== null && from > to) return { ok: false, error: 'from must not be after to' };
    if (conditions.length === 0) return { ok: true, conditions, ranged: false };
    // Legacy rows whose start_time is not ISO-prefixed (e.g. an epoch-ms string, 1 on prod) cannot be
    // compared as text, so they are always included rather than silently orphaned. The client's day
    // filter still decides whether they show.
    const nonIso = sql`${matches.startTime} NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'`;
    return { ok: true, conditions: [or(and(...conditions), nonIso)!], ranged: true };
}

/** Ranged requests are chronological (startTime, id); unranged keep the legacy newest-created order. */
export function matchRangeOrder(ranged: boolean) {
    return ranged ? [asc(matches.startTime), asc(matches.id)] : [desc(matches.createdAt), desc(matches.id)];
}
