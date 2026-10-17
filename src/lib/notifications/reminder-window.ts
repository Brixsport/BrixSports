/**
 * Kickoff-window helpers for the reminder cron. matches.start_time is a plain
 * text column holding whatever string the writer sent (full ISO with a zone, or
 * a zone-less datetime-local value), so it is parsed in code rather than
 * compared lexically in SQL.
 */

/** True when `startTime` parses and falls within [now, now + windowMs]. */
export function isStartWithinWindow(startTime: string, now: Date, windowMs: number): boolean {
    const start = new Date(startTime);
    if (isNaN(start.getTime())) return false;
    return start.getTime() >= now.getTime() && start.getTime() <= now.getTime() + windowMs;
}

/**
 * Walk every page of an offset-paged, stably ordered result set and keep the rows
 * that pass `keep`, so the window is applied to ALL candidates rather than to
 * whichever 500 rows the database happened to return first.
 */
export async function collectAcrossPages<T>(
    fetchPage: (offset: number, pageSize: number) => Promise<T[]>,
    keep: (row: T) => boolean,
    pageSize: number,
    maxPages: number,
): Promise<{ rows: T[]; truncated: boolean }> {
    const rows: T[] = [];
    for (let page = 0; page < maxPages; page++) {
        const batch = await fetchPage(page * pageSize, pageSize);
        for (const row of batch) {
            if (keep(row)) rows.push(row);
        }
        if (batch.length < pageSize) return { rows, truncated: false };
    }
    return { rows, truncated: true };
}
