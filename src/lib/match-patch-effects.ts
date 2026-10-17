/**
 * Decisions for the side effects of PATCH /api/matches/[id], kept pure so they can be tested.
 *
 * - The full-time side effects (standings, bracket advancement, ratings) run once, on the
 *   transition into FINISHED. A retried FINISHED request on an already finished match is a no-op
 *   for them.
 * - Standings are also refreshed when an admin corrects the score of a finished match, or
 *   reopens a finished match (it must stop counting).
 */

export type StandingsRefresh = 'none' | 'by-match' | 'by-teams';

export interface PatchEffectsInput {
    storedStatus: string | null | undefined;
    /** status in the request body, undefined when not sent */
    bodyStatus: string | undefined;
    /** true when the request changes the stored home or away score */
    scoreChanged: boolean;
}

export interface PatchEffects {
    /** standings + bracket + ratings for the final whistle */
    runFullTime: boolean;
    /**
     * 'by-match': recompute from the match row (it is still FINISHED after the update)
     * 'by-teams': the match is no longer FINISHED after the update, recompute from its teams
     */
    standings: StandingsRefresh;
}

export function planMatchPatchEffects({ storedStatus, bodyStatus, scoreChanged }: PatchEffectsInput): PatchEffects {
    const wasFinished = storedStatus === 'FINISHED';
    const runFullTime = bodyStatus === 'FINISHED' && !wasFinished;
    if (runFullTime) return { runFullTime: true, standings: 'by-match' };

    if (wasFinished) {
        if (bodyStatus !== undefined && bodyStatus !== 'FINISHED') return { runFullTime: false, standings: 'by-teams' };
        if (scoreChanged) return { runFullTime: false, standings: 'by-match' };
    }
    return { runFullTime: false, standings: 'none' };
}

/** `stats` on a finished match can only be written by an admin. */
export function canWriteMatchStats(role: string, storedStatus: string | null | undefined): boolean {
    return role === 'admin' || storedStatus !== 'FINISHED';
}
