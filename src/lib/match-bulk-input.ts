/**
 * Input validation for the admin match bulk endpoints and match creation.
 * Pure functions (no DB) so they can be unit tested.
 */
export const MAX_BULK_MATCH_IDS = 200;

// Statuses a bulk update may set. FINISHED is deliberately absent: finishing a
// match runs standings, ratings and bracket updates in the single-match route,
// which this endpoint does not do.
export const BULK_SETTABLE_MATCH_STATUSES = ['PENDING', 'UPCOMING', 'LIVE', 'CANCELLED'] as const;
const ALL_MATCH_STATUSES = ['PENDING', 'UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED'];

export type BulkMatchUpdateParse =
    | { ok: true; ids: string[]; update: { status?: string; venue?: string; competition?: string } }
    | { ok: false; error: string };

export function parseBulkMatchUpdate(body: unknown): BulkMatchUpdateParse {
    const { ids, updates } = (body && typeof body === 'object' ? body : {}) as { ids?: unknown; updates?: unknown };

    if (!Array.isArray(ids) || ids.length === 0 || !updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return { ok: false, error: 'Invalid request: Expected an array of ids and an updates object' };
    }
    if (ids.length > MAX_BULK_MATCH_IDS) {
        return { ok: false, error: `At most ${MAX_BULK_MATCH_IDS} matches can be updated per request` };
    }
    if (ids.some((id) => typeof id !== 'string' || id === '')) {
        return { ok: false, error: 'ids must be non-empty strings' };
    }

    const { status, venue, competition } = updates as { status?: unknown; venue?: unknown; competition?: unknown };
    const update: { status?: string; venue?: string; competition?: string } = {};

    if (status) {
        if (typeof status !== 'string' || !ALL_MATCH_STATUSES.includes(status)) {
            return { ok: false, error: `status must be one of ${ALL_MATCH_STATUSES.join(', ')}` };
        }
        if (!(BULK_SETTABLE_MATCH_STATUSES as readonly string[]).includes(status)) {
            return { ok: false, error: 'Finish a match from its own page so standings and ratings are updated' };
        }
        update.status = status;
    }
    if (venue) {
        if (typeof venue !== 'string' || venue.length > 200) {
            return { ok: false, error: 'venue must be a string of at most 200 characters' };
        }
        update.venue = venue;
    }
    if (competition) {
        if (typeof competition !== 'string' || competition.length > 200) {
            return { ok: false, error: 'competition must be a string of at most 200 characters' };
        }
        update.competition = competition;
    }

    return { ok: true, ids: ids as string[], update };
}

/** Returns an error message when the two team ids cannot form a match, else null. */
export function validateMatchTeams(homeTeamId: unknown, awayTeamId: unknown): string | null {
    if (typeof homeTeamId !== 'string' || homeTeamId === '' || typeof awayTeamId !== 'string' || awayTeamId === '') {
        return 'homeTeamId and awayTeamId are required';
    }
    if (homeTeamId === awayTeamId) {
        return 'A match needs two different teams';
    }
    return null;
}
