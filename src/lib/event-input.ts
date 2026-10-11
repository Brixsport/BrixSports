/**
 * Validation for POST /api/matches/[id]/events input.
 *
 * Returns an error message for the first invalid field, or null when the input is acceptable.
 * Bad input must be rejected (422), never stored or credited: a scoring event whose teamId is not
 * one of the match's two teams used to be credited to the AWAY side, and a non-string `type`
 * used to crash the route with a 500.
 */
export interface EventInputFields {
    type: unknown;
    minute: unknown;
    second?: unknown;
    detail?: unknown;
    teamId?: unknown;
    made?: unknown;
}

export interface EventInputMatch {
    homeTeamId: string;
    awayTeamId: string;
    sport: string;
}

const SCORING_FOOTBALL = new Set(['GOAL', 'PENALTY', 'OWN_GOAL']);
const SCORING_BASKETBALL = new Set(['FIELD_GOAL', 'THREE_POINTER', 'FREE_THROW']);

export function validateEventInput(input: EventInputFields, match: EventInputMatch): string | null {
    const { type, minute, second, detail, teamId, made } = input;

    if (typeof type !== 'string' || type.trim() === '' || type.length > 64) {
        return 'Event type must be a non-empty string of at most 64 characters';
    }

    const minuteNum = Number(minute);
    if (minute === null || typeof minute === 'boolean' || !Number.isFinite(minuteNum) || minuteNum < 0 || minuteNum > 400) {
        return 'Event minute must be a number between 0 and 400';
    }

    if (second !== undefined && second !== null) {
        const secondNum = Number(second);
        if (typeof second === 'boolean' || !Number.isFinite(secondNum) || secondNum < 0 || secondNum > 3600) {
            return 'Event second must be a number between 0 and 3600';
        }
    }

    if (detail !== undefined && detail !== null && (typeof detail !== 'string' || detail.length > 1000)) {
        return 'Event detail must be a string of at most 1000 characters';
    }

    // An empty string is stored as null by the route, so it counts as "no team", not as invalid.
    if (teamId && (typeof teamId !== 'string' || (teamId !== match.homeTeamId && teamId !== match.awayTeamId))) {
        return 'teamId must be one of the two teams in this match';
    }

    const typeKey = type.toUpperCase().replace(/\s+/g, '_');
    const creditsScore =
        SCORING_FOOTBALL.has(typeKey) ||
        (match.sport === 'Basketball' && made === true && SCORING_BASKETBALL.has(typeKey));
    if (creditsScore && !teamId) {
        return 'teamId is required for an event that changes the score';
    }

    return null;
}
