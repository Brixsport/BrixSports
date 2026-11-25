/**
 * Narrow carve-outs that let a real `logger` through the blanket /admin/** and
 * /api/admin/** gate in middleware.ts and admin/layout.tsx.
 *
 * This is only the first layer: every route listed here still verifies the role
 * and (for lineups) match assignment itself via getAuthUser() + isLoggerAssigned().
 * Never widen this to a prefix like "/admin" or "/api/admin".
 */

const isUnder = (pathname: string, base: string) =>
    pathname === base || pathname.startsWith(`${base}/`);

/** Admin pages a logger may open. */
const LOGGER_PAGE_BASES = ['/admin/match-ratings', '/admin/match-lineups'];

/**
 * Admin API routes a logger may call. Only what the lineup page needs:
 * the assigned-matches list (already scoped to the caller's assignments in the
 * handler) and the lineup publish route (assignment re-checked in the handler).
 */
const LOGGER_API_BASES = ['/api/admin/assigned-matches', '/api/admin/match-lineups'];

export function isLoggerScopedAdminPath(role: unknown, pathname: string): boolean {
    if (role !== 'logger') return false;
    const bases = pathname.startsWith('/api/') ? LOGGER_API_BASES : LOGGER_PAGE_BASES;
    return bases.some((base) => isUnder(pathname, base));
}
