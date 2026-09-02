// Basketball Rating Calculator — BACKLOG-255 (Ratings Redesign Phase 5)
//
// Basketball's stat vocabulary (Field Goal/Three Pointer/Free Throw/Rebound/
// Steal/Block/Turnover) shares almost nothing with football's keyword-matched
// event model in ratingCalculator.ts, so this is a standalone module, not a
// branch inside that function.
//
// Stat extraction below mirrors BasketballLogger.tsx's own live-tested
// calculatePlayerRating/calculateAdvancedStats — the DB's real event shape —
// not dev/reference-rating-calculator.ts.bak's basketball branch: that file
// counted every 'fieldgoal'-type event as a make, with no distinction from a
// miss. BasketballLogger logs both makes and misses under the same event
// type; `value` (a TEXT column) is what says which — a made shot's value
// equals its point value (2/3/1), a miss is 0. The .bak file's per-stat
// weights (points/rebounds/assists/steals/blocks scaled for a 0-10 baseline)
// were kept — those aren't wrong, just the extraction feeding them was.
//
// Also note: `relatedPlayerId` (not `assistPlayerId` — that name only exists
// in BasketballLogger's own client-side state) is the real DB column an
// assisting player is stored under, on the scorer's own shot event.
//
// `value` isn't always the live logger's numeric shape either: box-score
// backfills (BACKLOG-312/314) write the raw string 'made'/'missed' instead of
// a JSON number. calculateAndSaveRatings() currently can't reach that data
// (it requires a published `lineups`, and every backfilled match is
// confirmed to have none) so this is defensive, not exercised by any live
// path today — but cheap to handle correctly via the same safeParseEventValue
// helper matches/[id]/route.ts's own fallback block uses for the identical
// ambiguity, rather than assuming the numeric shape and silently miscounting
// every backfilled make as a miss if that assumption ever stops holding.

import type { MatchEvent } from '@/db/schema';
import type { RatingConfig } from '@/lib/ratingConfig';
import { safeParseEventValue } from '@/lib/eventValue';

export interface BasketballPlayerStats {
    playerId: string;
    points: number;
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    threePointersMade: number;
    threePointersAttempted: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fouls: number;
    technicalFouls: number;
    eyePoints: number;
}

export interface BasketballRatingBreakdown {
    scoring: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fouls: number;
    eyePoints: number;
}

/**
 * Build a basketball player's stat line from their match events.
 * `events` should be every event for the match (not pre-filtered by player) —
 * assists are credited via `relatedPlayerId` on a teammate's shot event.
 */
export function calculateBasketballStatsFromEvents(
    playerId: string,
    events: MatchEvent[]
): BasketballPlayerStats {
    const playerEvents = events.filter((e) => e.playerId === playerId);

    const stats: BasketballPlayerStats = {
        playerId,
        points: 0,
        fieldGoalsMade: 0,
        fieldGoalsAttempted: 0,
        threePointersMade: 0,
        threePointersAttempted: 0,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fouls: 0,
        technicalFouls: 0,
        eyePoints: 0,
    };

    for (const e of playerEvents) {
        // Live-logged shots: value is JSON, the point value on a make (2/3/1),
        // 0 on a miss. Backfilled shots: value is the raw string 'made'/'missed'.
        // safeParseEventValue returns whichever shape is actually there.
        const parsedValue = safeParseEventValue(e.value);
        const made = typeof parsedValue === 'string'
            ? parsedValue.toLowerCase() === 'made'
            : Number(parsedValue) > 0;

        switch (e.type) {
            case 'Field Goal':
                stats.fieldGoalsAttempted++;
                if (made) {
                    stats.fieldGoalsMade++;
                    stats.points += 2;
                }
                break;
            case 'Three Pointer':
                stats.fieldGoalsAttempted++;
                stats.threePointersAttempted++;
                if (made) {
                    stats.fieldGoalsMade++;
                    stats.threePointersMade++;
                    stats.points += 3;
                }
                break;
            case 'Free Throw':
                stats.freeThrowsAttempted++;
                if (made) {
                    stats.freeThrowsMade++;
                    stats.points += 1;
                }
                break;
            case 'Rebound':
                stats.rebounds++;
                break;
            case 'Steal':
                stats.steals++;
                break;
            case 'Block':
                stats.blocks++;
                break;
            case 'Turnover':
                stats.turnovers++;
                break;
            case 'Foul':
                stats.fouls++;
                break;
            case 'Technical Foul':
                stats.technicalFouls++;
                break;
            case 'Assist':
                stats.assists++;
                break;
        }
    }

    // Same dual-path convention as BasketballLogger.tsx's own calculateAdvancedStats
    // (BACKLOG-143): an assist is credited both via the standalone 'Assist' button
    // above, and via relatedPlayerId set on a teammate's made shot event.
    stats.assists += events.filter(
        (e) => e.relatedPlayerId === playerId && e.type !== 'Substitution'
    ).length;

    stats.eyePoints = playerEvents.filter((e) => e.isEyePoint).length;

    return stats;
}

/**
 * Calculate a basketball player's final match rating (same 0–10-ish scale as
 * football's RatingCalculator, anchored to the same admin-configurable
 * baseRating/min/max/eyePointWeight from ratingConfig.ts).
 *
 * Weights are deliberately much smaller than BasketballLogger.tsx's own live
 * in-match `calculatePlayerRating` — that number starts at 0 and uses large
 * per-event deltas for a punchy real-time feel; this is the final rating
 * shown after the match, anchored to a baseline like football's.
 */
export function calculateBasketballRating(
    stats: BasketballPlayerStats,
    config: RatingConfig
): { rating: number; breakdown: BasketballRatingBreakdown } {
    const breakdown: BasketballRatingBreakdown = {
        scoring: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        fouls: 0,
        eyePoints: 0,
    };

    // Scoring: points made count in full; missed attempts carry a small
    // efficiency penalty so volume shooting without accuracy isn't free.
    const missedFieldGoals = stats.fieldGoalsAttempted - stats.fieldGoalsMade;
    const missedFreeThrows = stats.freeThrowsAttempted - stats.freeThrowsMade;
    breakdown.scoring =
        stats.points * 0.15 - missedFieldGoals * 0.1 - missedFreeThrows * 0.05;

    breakdown.rebounds = stats.rebounds * 0.2;
    breakdown.assists = stats.assists * 0.3;
    breakdown.steals = stats.steals * 0.4;
    breakdown.blocks = stats.blocks * 0.4;
    breakdown.turnovers = -stats.turnovers * 0.25;
    breakdown.fouls = -stats.fouls * 0.15 - stats.technicalFouls * 0.5;
    breakdown.eyePoints = Math.min(stats.eyePoints * config.eyePointWeight, 1.5);

    let rating =
        config.baseRating +
        breakdown.scoring +
        breakdown.rebounds +
        breakdown.assists +
        breakdown.steals +
        breakdown.blocks +
        breakdown.turnovers +
        breakdown.fouls +
        breakdown.eyePoints;

    rating = Math.max(config.minRating, Math.min(config.maxRating, rating));

    return { rating: Math.round(rating * 10) / 10, breakdown };
}
