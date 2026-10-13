/**
 * Polling gate. A poll tick is skipped while the previous request is still running, so a response that is
 * slower than the poll interval is still applied instead of being superseded by the next tick forever.
 * A request that has been running longer than `maxInFlightMs` is treated as hung and no longer blocks ticks.
 */
export const DEFAULT_MAX_IN_FLIGHT_MS = 15000;

export function shouldSkipPollTick(
    inFlightSince: number | null,
    now: number,
    maxInFlightMs: number = DEFAULT_MAX_IN_FLIGHT_MS
): boolean {
    if (inFlightSince === null) return false;
    return now - inFlightSince < maxInFlightMs;
}
