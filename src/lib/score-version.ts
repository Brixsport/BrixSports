/**
 * Ordering for live score broadcasts.
 *
 * Each score change is broadcast by its own request, so two quick goals can reach a viewer out of
 * order (1-0 after 2-0) and the older score would stay on screen. The server stamps every score
 * broadcast with a version that only goes up; the client keeps the highest version it has applied
 * and ignores anything older. A payload without a usable version (an older server, a hand-sent
 * packet) is always applied, exactly as before.
 */
export function acceptScoreVersion(
    lastApplied: number | undefined,
    incoming: unknown
): { accept: boolean; next: number | undefined } {
    if (typeof incoming !== 'number' || !Number.isFinite(incoming)) {
        return { accept: true, next: lastApplied };
    }
    if (lastApplied !== undefined && incoming < lastApplied) {
        return { accept: false, next: lastApplied };
    }
    return { accept: true, next: incoming };
}

/**
 * A version that never repeats or goes backwards within one process: the current server time in
 * milliseconds, bumped by one when two calls land in the same millisecond.
 */
export function createScoreVersionClock(now: () => number = Date.now): () => number {
    let last = 0;
    return () => {
        last = Math.max(now(), last + 1);
        return last;
    };
}
