/**
 * Allow-listed competition update fields, shared by the admin bulk update.
 *
 * Only the fields below can be written through the API; anything else in the
 * request (id, winnerId, runnerUpId, completedAt, followersCount ...) is ignored.
 * Pure function so it can be unit tested without a database.
 */
export const MAX_BULK_COMPETITION_DELETES = 20;

const STRING_FIELDS = ['name', 'sport', 'format', 'season', 'description', 'level', 'scope', 'status', 'logo'] as const;
const INTEGER_FIELDS = ['numberOfTeams', 'numberOfGroups', 'teamsPerGroup'] as const;

export type CompetitionUpdateResult =
    | { ok: true; update: Record<string, unknown> }
    | { ok: false; error: string };

export function buildCompetitionUpdate(data: Record<string, unknown>): CompetitionUpdateResult {
    const update: Record<string, unknown> = {};

    for (const field of STRING_FIELDS) {
        const value = data[field];
        if (value === undefined) continue;
        if (value !== null && typeof value !== 'string') {
            return { ok: false, error: `${field} must be a string` };
        }
        update[field] = value;
    }

    if (data.structure !== undefined) {
        if (data.structure !== null && typeof data.structure !== 'string') {
            return { ok: false, error: 'structure must be a string' };
        }
        update.structure = data.structure || null;
    }

    for (const field of INTEGER_FIELDS) {
        const value = data[field];
        if (value === undefined) continue;
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            return { ok: false, error: `${field} must be a non-negative whole number` };
        }
        update[field] = value;
    }

    if (data.isMultiSport !== undefined) {
        if (typeof data.isMultiSport !== 'boolean') {
            return { ok: false, error: 'isMultiSport must be a boolean' };
        }
        update.isMultiSport = data.isMultiSport;
    }

    for (const field of ['startDate', 'endDate'] as const) {
        const value = data[field];
        if (value === undefined) continue;
        if (value === null) {
            update[field] = null;
            continue;
        }
        const parsed = new Date(value as string | number);
        if (isNaN(parsed.getTime())) {
            return { ok: false, error: `Invalid ${field}` };
        }
        update[field] = parsed;
    }

    if (data.rules !== undefined) {
        update.rules = data.rules !== null && typeof data.rules === 'object' ? JSON.stringify(data.rules) : data.rules;
    }

    for (const field of ['hostOrganizationId', 'governingOrganizationId'] as const) {
        const value = data[field];
        if (value === undefined) continue;
        if (typeof value !== 'string' || value === '') {
            return { ok: false, error: `${field} must be an organization id` };
        }
        update[field] = value;
    }

    return { ok: true, update };
}
