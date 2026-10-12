/**
 * Pure gates deciding whether a match-driven push should go out at all.
 * Kept free of DB/network imports so the rules can be unit tested.
 */

/**
 * Friendly matches (including disposable test matches, which are created as
 * friendlies) must never push to real followers.
 */
export function isPushEligibleMatchType(matchType: string | null | undefined): boolean {
    return matchType !== 'friendly';
}

/**
 * A period push (kickoff / half time / full time) is sent only when the stored
 * period actually changed in this request. A retry, replay or double-tap that
 * re-sends the period already on the row must not notify again.
 *
 * `previousPeriod` is the value read BEFORE the update was applied; a null or
 * undefined stored period is treated as the schema default, NOT_STARTED.
 */
export function shouldSendPeriodNotification(input: {
    previousPeriod: string | null | undefined;
    newPeriod: string;
    matchType: string | null | undefined;
}): boolean {
    if (!isPushEligibleMatchType(input.matchType)) return false;
    const previous = input.previousPeriod ?? 'NOT_STARTED';
    return previous !== input.newPeriod;
}
