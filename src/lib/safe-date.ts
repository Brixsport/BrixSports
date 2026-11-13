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

// Admins type kick-off times in local (Lagos, WAT, UTC+1, no DST) time.
const LAGOS_OFFSET = '+01:00';
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
// ISO-like date or date-time with no zone designator ("2026-11-11T15:50", "2026-11-11 15:50:30").
const ZONELESS_ISO = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;

/**
 * Canonical form for matches.start_time: ISO-8601 UTC with a Z suffix.
 * Zone-less input is read as Africa/Lagos; epoch numbers/strings and zoned ISO
 * strings are converted as-is. Returns null for anything unparseable so the
 * caller can answer 422.
 */
export function normalizeStartTime(value: DateInput): string | null {
    if (value === null || value === undefined || value === '') return null;

    let d: Date | null;
    if (typeof value === 'string' && ZONELESS_ISO.test(value.trim())) {
        const [, date, time = '00:00', seconds = '00'] = value.trim().match(ZONELESS_ISO)!;
        d = parseSafeDate(`${date}T${time}:${seconds}${LAGOS_OFFSET}`);
    } else {
        d = parseSafeDate(value);
    }
    return d ? d.toISOString() : null;
}

/** Value for an <input type="datetime-local"> showing `value` in Lagos time ("" when unusable). */
export function toLagosInputValue(value: DateInput): string {
    const d = parseSafeDate(value);
    if (!d) return '';
    return new Date(d.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 16);
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
