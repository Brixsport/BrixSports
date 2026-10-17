/**
 * A negative minute (-1) is the "minute unknown" marker written by backfilled events, and a missing minute
 * means the same thing. Such an event is shown by name only: never as "-1'", and never clamped to 0 or 1
 * (which would claim a time that is not known). Every place that prints an event minute goes through
 * these helpers instead of interpolating event.minute directly.
 */
export function hasKnownMinute(minute: unknown): minute is number {
    return typeof minute === 'number' && Number.isFinite(minute) && minute >= 0;
}

/** "45'" for a known minute, '' (print nothing) for an unknown one. */
export function formatEventMinute(minute: unknown): string {
    return hasKnownMinute(minute) ? `${minute}'` : '';
}

/** Known minutes only, ascending. */
export function knownMinutes(minutes: unknown[]): number[] {
    return minutes.filter(hasKnownMinute).sort((a, b) => a - b);
}

/** "Wareez 33', 71'" for known minutes, just "Wareez" when none is known. */
export function formatScorerLine(name: string, minutes: unknown[]): string {
    const known = knownMinutes(minutes);
    return known.length > 0 ? `${name} ${known.map(formatEventMinute).join(', ')}` : name;
}
