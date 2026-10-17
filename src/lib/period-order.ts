/**
 * Period ordering, used to reject a backward `currentPeriod` write from a logger.
 *
 * A queued PATCH can be replayed late (offline queue, Background Sync retry) after the match has
 * already moved on; without an ordering check it would drag the match back to an earlier period.
 * Admins may set any period, so callers skip this check for them.
 *
 * Rules:
 *  - the same period again is a no-op and allowed;
 *  - SUSPENDED, and leaving SUSPENDED, is always allowed (the period before it is not recorded);
 *  - FINISHED is always a valid target (it ends the period sequence), and it is also the point
 *    from which the loggers start extra time or penalties after a drawn full time, so as a
 *    source it sits between regular time and extra time;
 *  - a period this table does not know is not judged (other validation decides if it is valid).
 */

const FOOTBALL_RANK: Record<string, number> = {
    NOT_STARTED: 0,
    FIRST_HALF: 1,
    HALF_TIME: 2,
    SECOND_HALF: 3,
    EXTRA_TIME_1: 4,
    EXTRA_TIME_BREAK: 5,
    EXTRA_TIME_2: 6,
    PENALTY_SHOOTOUT: 7,
};

/** Where FINISHED sits when it is the current period: after regular time, before extra time. */
const FOOTBALL_FINISHED_AS_SOURCE = 3.5;
const BASKETBALL_FINISHED_AS_SOURCE = 4.5;

function basketballRank(period: string): number | null {
    if (period === 'NOT_STARTED') return 0;
    if (period === 'HALF_TIME') return 2.5;
    const quarter = /^Q(\d+)$/.exec(period);
    if (quarter) return Number(quarter[1]);
    const overtime = /^OT(\d+)$/.exec(period);
    if (overtime) return 100 + Number(overtime[1]);
    return null;
}

/** Position of a period in the match, or null when unknown for this sport. */
export function periodRank(sport: string, period: string, asSource = false): number | null {
    if (period === 'FINISHED') {
        if (!asSource) return Number.POSITIVE_INFINITY;
        if (sport === 'Football') return FOOTBALL_FINISHED_AS_SOURCE;
        if (sport === 'Basketball') return BASKETBALL_FINISHED_AS_SOURCE;
        return null;
    }
    if (sport === 'Football') return period in FOOTBALL_RANK ? FOOTBALL_RANK[period] : null;
    if (sport === 'Basketball') return basketballRank(period);
    return null;
}

/** True when moving from `previous` to `next` goes backward in the match. */
export function isPeriodRegression(
    sport: string,
    previous: string | null | undefined,
    next: string | null | undefined
): boolean {
    if (!previous || !next || previous === next) return false;
    if (previous === 'SUSPENDED' || next === 'SUSPENDED') return false;

    const from = periodRank(sport, previous, true);
    const to = periodRank(sport, next, false);
    if (from === null || to === null) return false;
    return to < from;
}
