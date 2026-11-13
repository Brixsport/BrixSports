import { addDays, format, parse } from 'date-fns';
import { parseSafeDate, type DateInput } from '@/lib/safe-date';

// Home feed day navigation. A "day key" is a yyyy-MM-dd string in the viewer's
// local time, so keys sort lexicographically and compare with ===.

const KEY_FORMAT = 'yyyy-MM-dd';

export function toDayKey(value: DateInput): string | null {
    const d = parseSafeDate(value);
    return d ? format(d, KEY_FORMAT) : null;
}

/** Sorted unique day keys that have at least one match. Unparseable dates are skipped. */
export function getMatchDays(matches: ReadonlyArray<{ startTime: DateInput }>): string[] {
    const keys = new Set<string>();
    for (const m of matches) {
        const key = toDayKey(m.startTime);
        if (key) keys.add(key);
    }
    return [...keys].sort();
}

/** Match days plus today, so the strip always shows where "now" is even on an empty day. */
export function withToday(days: string[], todayKey: string): string[] {
    return days.includes(todayKey) ? days : [...days, todayKey].sort();
}

/**
 * The day the feed opens on: a day with a live match, else today, else the next
 * day with fixtures, else the most recent match day. Never an arbitrary empty day.
 */
export function pickDefaultDay(days: string[], todayKey: string, liveDayKey?: string | null): string {
    if (liveDayKey && days.includes(liveDayKey)) return liveDayKey;
    if (days.includes(todayKey)) return todayKey;
    const next = days.find(d => d > todayKey);
    if (next) return next;
    return days.length > 0 ? days[days.length - 1] : todayKey;
}

/** Nearest match day to `key`, looking forward first and then back. */
export function nearestMatchDay(days: string[], key: string): string | null {
    if (days.length === 0) return null;
    if (days.includes(key)) return key;
    return days.find(d => d > key) ?? days[days.length - 1];
}

/** Previous/next entry in `days` relative to `key` (which need not be in the list). */
export function stepMatchDay(days: string[], key: string, direction: -1 | 1): string | null {
    if (direction === 1) return days.find(d => d > key) ?? null;
    for (let i = days.length - 1; i >= 0; i--) if (days[i] < key) return days[i];
    return null;
}

export function dayKeyToDate(key: string): Date {
    return parse(key, KEY_FORMAT, new Date(2000, 0, 1));
}

/** "Today" / "Tomorrow" / "Yesterday", else "Wed 18" (plus year when not the current year). */
export function formatDayLabel(key: string, todayKey: string): { primary: string; secondary: string } {
    const d = dayKeyToDate(key);
    const today = dayKeyToDate(todayKey);
    const rel =
        key === todayKey ? 'Today' :
        key === format(addDays(today, 1), KEY_FORMAT) ? 'Tomorrow' :
        key === format(addDays(today, -1), KEY_FORMAT) ? 'Yesterday' : null;
    const sameYear = d.getFullYear() === today.getFullYear();
    return {
        primary: rel ?? format(d, 'EEE'),
        secondary: format(d, sameYear ? 'd MMM' : 'd MMM yyyy'),
    };
}

/** Day keys (yyyy-MM-dd, local time) from the lightweight match-days feed, optionally for one sport. */
export function dayKeysFromFeed(
    rows: ReadonlyArray<{ sport: string; startTime: DateInput }>,
    matchesSport: (sport: string) => boolean,
): string[] {
    return getMatchDays(rows.filter(r => matchesSport(r.sport)));
}

/** Overwrite-by-id merge: fresh rows replace their old versions, rows outside the fresh fetch are kept. */
export function mergeMatchesById<T extends { id: string }>(existing: ReadonlyArray<T>, fresh: ReadonlyArray<T>): T[] {
    const byId = new Map<string, T>();
    for (const m of existing) byId.set(m.id, m);
    for (const m of fresh) byId.set(m.id, m);
    return [...byId.values()];
}

/** Inclusive [from, to] day keys of `radius` days around `key`, for a ranged matches fetch. */
export function windowAround(key: string, radius: number): { from: string; to: string } {
    const d = dayKeyToDate(key);
    return { from: format(addDays(d, -radius), KEY_FORMAT), to: format(addDays(d, radius), KEY_FORMAT) };
}

/** True when `key` lies inside the inclusive window. */
export function inWindow(key: string, w: { from: string; to: string }): boolean {
    return key >= w.from && key <= w.to;
}
