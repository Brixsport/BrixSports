/**
 * Who may post an official lineup through POST /api/admin/match-lineups/[id].
 * Kept pure so the rule is unit-testable; the route supplies the verified role
 * (from getAuthUser) and the assignment lookup (isLoggerAssigned).
 */

export type LineupPostDecision =
    | { allow: true }
    | { allow: false; status: 401 | 403; error: string };

export function decideLineupPost(input: {
    role: string | null | undefined;
    isAssigned: boolean;
    matchStatus: string;
}): LineupPostDecision {
    const { role, isAssigned, matchStatus } = input;
    if (!role) return { allow: false, status: 401, error: 'Unauthorized' };
    if (role === 'admin') return { allow: true };
    if (role !== 'logger') return { allow: false, status: 403, error: 'Forbidden' };
    if (!isAssigned) return { allow: false, status: 403, error: 'Not assigned to this match' };
    if (matchStatus !== 'UPCOMING') {
        return {
            allow: false,
            status: 403,
            error: 'Lineups can only be posted before the match starts. Contact an admin for changes.',
        };
    }
    return { allow: true };
}

/** Sports whose logger is FootballLogger (formation-pitch lineups). Mirrors src/app/logger/page.tsx. */
const FOOTBALL_FAMILY = new Set(['football', 'five-a-side', '5-a-side', '5-aside', 'futsal']);

export function isFootballFamilySport(sport: string | null | undefined): boolean {
    return FOOTBALL_FAMILY.has((sport || '').trim().toLowerCase());
}
