import { format } from 'date-fns';

// BACKLOG-471: a few staging/prod rows hold start_time as a stringified epoch
// ("1788963960000.0"). `new Date("1788963960000.0")` is Invalid Date, and
// date-fns format() throws RangeError on it, crashing the whole page. These
// helpers never throw: they return the caller's fallback instead.

export type DateInput = Date | string | number | null | undefined;

// All digits with an optional ".0"-style fractional part -> epoch milliseconds.
const EPOCH_STRING = /^\d{10,}(\.\d+)?$/;

/** Parse a Date | ISO string | ms-epoch number | ms-epoch float string. Returns null when unusable. */
export function parseSafeDate(value: DateInput): Date | null {
    if (value === null || value === undefined || value === '') return null;

    let d: Date;
    if (value instanceof Date) {
        d = value;
    } else if (typeof value === 'number') {
        d = new Date(value);
    } else if (typeof value === 'string') {
        const trimmed = value.trim();
        d = EPOCH_STRING.test(trimmed) ? new Date(Math.trunc(Number(trimmed))) : new Date(trimmed);
    } else {
        return null;
    }

    return isNaN(d.getTime()) ? null : d;
}

/** date-fns format() that returns `fallback` instead of throwing on an invalid date. */
export function safeFormat(value: DateInput, pattern: string, fallback = 'TBD'): string {
    const d = parseSafeDate(value);
    if (!d) return fallback;
    try {
        return format(d, pattern);
    } catch {
        return fallback;
    }
}

export type LocaleKind = 'time' | 'date' | 'datetime';

/**
 * toLocaleTimeString / toLocaleDateString / toLocaleString that returns `fallback`
 * instead of rendering the literal text "Invalid Date".
 */
export function safeToLocale(
    value: DateInput,
    kind: LocaleKind,
    opts?: Intl.DateTimeFormatOptions,
    fallback = 'TBD',
    locales?: string | string[]
): string {
    const d = parseSafeDate(value);
    if (!d) return fallback;
    try {
        if (kind === 'time') return d.toLocaleTimeString(locales, opts);
        if (kind === 'date') return d.toLocaleDateString(locales, opts);
        return d.toLocaleString(locales, opts);
    } catch {
        return fallback;
    }
}
