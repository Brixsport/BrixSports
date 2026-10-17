/**
 * Pure helpers shared by the player-stats write path (event POST / PATCH) and the
 * revert path (event DELETE, match DELETE). No database access here so the key
 * derivation and the event -> stat mapping can be unit-tested and, more importantly,
 * can never drift apart between the write and the revert side.
 */

export interface StatsKey {
    season: string;
    competitionId: string | null;
}

/**
 * A stats row is identified by (playerId, season, competitionId). The season comes from
 * the match's competition when it has one, otherwise the current season. A match with no
 * competition keeps competitionId null.
 */
export function deriveStatsKey(input: {
    competitionId: string | null | undefined;
    competitionSeason: string | null | undefined;
    currentSeason: string;
}): StatsKey {
    const competitionId = input.competitionId || null;
    const season = competitionId && input.competitionSeason ? input.competitionSeason : input.currentSeason;
    return { season, competitionId };
}

export type StatDeltas = Record<string, number>;

export interface StatEventInput {
    type: string;
    playerId?: string | null;
    relatedPlayerId?: string | null;
    /** Whether a basketball shot was made (POST: the explicit flag; revert: stored value > 0). */
    made?: boolean;
}

export interface StatEffect {
    playerId: string;
    deltas: StatDeltas;
}

function footballDeltas(eventType: string): StatDeltas {
    switch (eventType.toUpperCase().replace(/\s+/g, '_')) {
        case 'GOAL': return { goals: 1, shotsOnTarget: 1 };
        case 'ASSIST': return { assists: 1 };
        case 'OWN_GOAL': return { ownGoals: 1 };
        case 'PENALTY': return { penaltiesScored: 1, shotsOnTarget: 1 };
        case 'PENALTY_MISSED': return { shotsOffTarget: 1 };
        case 'PENALTY_SAVED': return { shotsOnTarget: 1 };
        case 'FOUL': return { foulsCommitted: 1 };
        case 'YELLOW_CARD': return { yellowCards: 1 };
        case 'RED_CARD': return { redCards: 1 };
        case 'SAVE': return { saves: 1 };
        default: return {};
    }
}

function basketballDeltas(eventType: string, made: boolean): StatDeltas {
    switch (eventType) {
        case 'Field Goal':
            return made ? { fieldGoalsAttempted: 1, fieldGoalsMade: 1, totalPoints: 2 } : { fieldGoalsAttempted: 1 };
        case 'Three Pointer':
            return made ? { threePointersAttempted: 1, threePointersMade: 1, totalPoints: 3 } : { threePointersAttempted: 1 };
        case 'Free Throw':
            return made ? { freeThrowsAttempted: 1, freeThrowsMade: 1, totalPoints: 1 } : { freeThrowsAttempted: 1 };
        case 'Rebound': return { totalRebounds: 1 };
        case 'Assist': return { assists: 1 };
        case 'Steal': return { steals: 1 };
        case 'Block': return { blocks: 1 };
        case 'Turnover': return { turnovers: 1 };
        case 'Foul': return { personalFouls: 1 };
        case 'Technical Foul': return { technicalFouls: 1 };
        default: return {};
    }
}

/** Stat increments one event type is worth for one player (empty when it counts for nothing). */
export function getStatDeltas(sport: string, eventType: string, made: boolean): StatDeltas {
    if (sport === 'Basketball') return basketballDeltas(eventType, made);
    if (sport === 'Football') return footballDeltas(eventType);
    return {};
}

/**
 * Every player-stat effect one event has: the player on the event, plus the keeper
 * (relatedPlayerId) who is credited a Save when a penalty is saved. The write path adds these
 * effects and the revert path removes the very same list.
 */
export function getEventStatEffects(sport: string, event: StatEventInput): StatEffect[] {
    const effects: StatEffect[] = [];
    const made = event.made === true;

    if (event.playerId) {
        const deltas = getStatDeltas(sport, event.type, made);
        if (Object.keys(deltas).length > 0) effects.push({ playerId: event.playerId, deltas });
    }

    if (event.type.toUpperCase().replace(/\s+/g, '_') === 'PENALTY_SAVED' && event.relatedPlayerId) {
        const deltas = getStatDeltas(sport, 'Save', false);
        if (Object.keys(deltas).length > 0) effects.push({ playerId: event.relatedPlayerId, deltas });
    }

    return effects;
}

/** Sum effects per player (a match delete reverts many events with one update per player). */
export function mergeStatEffects(effects: StatEffect[]): StatEffect[] {
    const byPlayer = new Map<string, StatDeltas>();
    for (const effect of effects) {
        const total = byPlayer.get(effect.playerId) ?? {};
        for (const [column, delta] of Object.entries(effect.deltas)) {
            total[column] = (total[column] ?? 0) + delta;
        }
        byPlayer.set(effect.playerId, total);
    }
    return Array.from(byPlayer, ([playerId, deltas]) => ({ playerId, deltas }));
}

/**
 * How an increment is written. A real competition is covered by the unique index
 * (player, season, competition_id), so one atomic upsert is enough. A NULL competition never
 * conflicts in that index (each NULL is distinct), so the row has to be looked up first and
 * either updated or inserted.
 */
export type StatsWriteMode = 'upsert' | 'update-existing' | 'insert-new';

export function decideStatsWrite(competitionId: string | null, existingRowId: string | null | undefined): StatsWriteMode {
    if (competitionId) return 'upsert';
    return existingRowId ? 'update-existing' : 'insert-new';
}
