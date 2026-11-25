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

/**
 * Lock rule for overwriting an already-published lineup via the lineup POST route.
 * - Not published, or explicitly unlocked: anyone who passed decideLineupPost may write.
 * - Admin: may always correct a published lineup.
 * - Logger: may correct a lineup a logger published (matches how basketball loggers
 *   can edit), but not one an admin published and locked.
 */
export function canOverwritePublishedLineup(input: {
    callerRole: string;
    existing: { status?: string; unlocked?: boolean; publishedByRole?: string } | null | undefined;
}): boolean {
    const { callerRole, existing } = input;
    if (!existing || existing.status !== 'published' || existing.unlocked) return true;
    if (callerRole === 'admin') return true;
    return callerRole === 'logger' && existing.publishedByRole !== 'admin';
}
