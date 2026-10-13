import { validateEventInput, type EventInputMatch } from '@/lib/event-input';
import { safeParseEventValue } from '@/lib/eventValue';

/**
 * Validation for PATCH /api/matches/[id]/events/[eventId].
 *
 * A scoring event (goal, penalty, own goal, a made basketball shot) has already moved the match
 * score and the player's stats. Editing its type, its team or its made/value in place would leave
 * a ghost point, so those edits are rejected and the client is told to delete the event and log it
 * again. Everything else (minute, detail, period, the player on a scoring event, any edit to a
 * non-scoring event) stays editable.
 */

export interface EventPatchExisting {
    type: string;
    teamId: string | null;
    /** match_events.value as stored (JSON text) */
    value: string | null;
}

const FOOTBALL_SCORING = new Set(['GOAL', 'PENALTY', 'OWN_GOAL']);
const BASKETBALL_SCORING = new Set(['FIELD_GOAL', 'THREE_POINTER', 'FREE_THROW']);

const normalizeType = (type: string) => type.toUpperCase().replace(/\s+/g, '_');

/** True when this stored event is currently credited to the match score. */
export function isScoringEvent(sport: string, type: string, parsedValue: unknown): boolean {
    const key = normalizeType(type);
    if (FOOTBALL_SCORING.has(key)) return true;
    return sport === 'Basketball' && BASKETBALL_SCORING.has(key) && typeof parsedValue === 'number' && parsedValue > 0;
}

export const SCORING_EDIT_MESSAGE =
    'A scoring event cannot be edited in place. Delete the event and log it again.';

function isStringOrNull(v: unknown): boolean {
    return v === null || typeof v === 'string';
}

/** Returns an error message (respond 422) or null when the patch is acceptable. */
export function validateEventPatch(
    body: Record<string, unknown>,
    existing: EventPatchExisting,
    match: EventInputMatch
): string | null {
    const existingValue = safeParseEventValue(existing.value);
    const wasMake = typeof existingValue === 'number' && existingValue > 0;

    const type = body.type !== undefined ? body.type : existing.type;
    const teamId = body.teamId !== undefined ? body.teamId : existing.teamId;

    const fieldError = validateEventInput(
        {
            type,
            // The minute is only checked when it is being edited: backfilled events carry -1.
            minute: body.minute !== undefined ? body.minute : 0,
            second: body.second,
            detail: body.detail,
            teamId,
            made: wasMake,
        },
        match
    );
    if (fieldError) return fieldError;

    if (body.playerId !== undefined && !isStringOrNull(body.playerId)) return 'playerId must be a string or null';
    if (body.relatedPlayerId !== undefined && !isStringOrNull(body.relatedPlayerId)) return 'relatedPlayerId must be a string or null';
    if (body.period !== undefined && (!isStringOrNull(body.period) || (typeof body.period === 'string' && body.period.length > 32))) {
        return 'period must be a string of at most 32 characters or null';
    }

    const existingScoring = isScoringEvent(match.sport, existing.type, existingValue);

    if (typeof body.type === 'string' && normalizeType(body.type) !== normalizeType(existing.type)) {
        const intoScoringType = FOOTBALL_SCORING.has(normalizeType(body.type)) || BASKETBALL_SCORING.has(normalizeType(body.type));
        if (existingScoring || intoScoringType) return SCORING_EDIT_MESSAGE;
    }

    if (existingScoring) {
        if (body.teamId !== undefined && (body.teamId || null) !== existing.teamId) return SCORING_EDIT_MESSAGE;
        if (body.made !== undefined && body.made !== wasMake) return SCORING_EDIT_MESSAGE;
        if (body.value !== undefined && JSON.stringify(body.value) !== existing.value) return SCORING_EDIT_MESSAGE;
    }

    return null;
}
