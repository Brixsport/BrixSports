// Decides which lineup players actually took part in a match, so unused
// substitutes are not given a rating.
//
// A substitution is stored with the player going OFF in playerId and the player
// coming ON in relatedPlayerId. Starters always count as having played. A
// substitute counts only once they came on, or have an event of their own
// (box-score backfills can carry events without a substitution record).

export interface ParticipationEvent {
    type: string;
    playerId?: string | null;
    relatedPlayerId?: string | null;
}

export interface LineupParticipant {
    playerId: string;
    isSubstitute: boolean;
}

/** Ids of players who came on in a substitution or acted in any event. */
export function getEnteredPlayerIds(events: ParticipationEvent[]): Set<string> {
    const entered = new Set<string>();
    for (const event of events) {
        if (event.type === 'Substitution' && event.relatedPlayerId) {
            entered.add(event.relatedPlayerId);
        }
        if (event.playerId) {
            entered.add(event.playerId);
        }
    }
    return entered;
}

/** True when the lineup player should get a rating for this match. */
export function didPlayerPlay(participant: LineupParticipant, enteredPlayerIds: Set<string>): boolean {
    if (!participant.isSubstitute) return true;
    return enteredPlayerIds.has(participant.playerId);
}
