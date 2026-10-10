/**
 * -1 is the "minute unknown" sentinel goals-only backfill scripts write (no
 * full logsheet available -- BACKLOG-122/294). Rendering it raw produces a
 * broken-looking "-1'"; a bare 0' reads as pre-kickoff. Every public-facing
 * minute display should go through this rather than interpolate event.minute
 * directly. LiveMatchTimeline.tsx's grouped "All" view is the one deliberate
 * exception -- it hides the whole Timeline tab for these matches instead
 * (unknown minute makes any ordering untrustworthy there), so it checks
 * event.minute directly rather than using this clamp.
 */
export function displayMinute(minute: number | null | undefined): number {
    if (minute == null) return 1;
    return Math.max(1, minute);
}
