/**
 * Player Rating Calculation Service
 * Handles sport-specific rating calculations with Eye Point and time-weighted support
 */

import { MatchEvent } from '@/db/schema';

export interface PlayerStats {
    // Football
    goals?: number;
    assists?: number;
    saves?: number;
    yellowCards?: number;
    redCards?: number;
    shotsOnTarget?: number;
    shotsOffTarget?: number;
    tackles?: number;
    interceptions?: number;

    // Basketball
    points?: number;
    rebounds?: number;
    assists_basketball?: number;
    steals?: number;
    blocks?: number;
    turnovers?: number;
    fouls?: number;
    fieldGoalsMade?: number;
    fieldGoalsAttempted?: number;
    threePointersMade?: number;
    threePointersAttempted?: number;
    freeThrowsMade?: number;
    freeThrowsAttempted?: number;

    // Track & Field
    position?: number;
    time?: number;
    recordBroken?: boolean;

    // Common
    eyePoints?: number;
    minutesPlayed?: number;
}

export interface RatingCalculationResult {
    newRating: number;
    breakdown: {
        baseRating: number;
        positiveAdjustments: number;
        negativeAdjustments: number;
        eyePointBonus: number;
        timeWeightedAdjustment?: number;
    };
}

export class RatingCalculator {
    private static readonly BASE_RATING = 7.0;
    private static readonly EYE_POINT_BONUS = 0.5;

    /** Normalise event type strings for comparison regardless of casing or separator.
     *  'Goal', 'GOAL', 'goal' → 'goal'
     *  'Yellow Card', 'YELLOW_CARD' → 'yellowcard'
     */
    private static normalizeType(type: string): string {
        return type.toLowerCase().replace(/[\s_-]+/g, '');
    }

    /**
     * Calculate player rating based on sport and statistics
     */
    static calculateRating(
        sport: string,
        stats: PlayerStats,
        baseRating: number = this.BASE_RATING
    ): RatingCalculationResult {
        switch (sport.toLowerCase()) {
            case 'football':
                return this.calculateFootballRating(stats, baseRating);
            case 'basketball':
                return this.calculateBasketballRating(stats, baseRating);
            case 'track':
            case 'track & field':
                return this.calculateTrackRating(stats, baseRating);
            default:
                return {
                    newRating: baseRating,
                    breakdown: {
                        baseRating,
                        positiveAdjustments: 0,
                        negativeAdjustments: 0,
                        eyePointBonus: 0,
                    },
                };
        }
    }

    /**
     * Calculate Football player rating
     */
    private static calculateFootballRating(
        stats: PlayerStats,
        baseRating: number
    ): RatingCalculationResult {
        const goals = stats.goals || 0;
        const assists = stats.assists || 0;
        const saves = stats.saves || 0;
        const yellowCards = stats.yellowCards || 0;
        const redCards = stats.redCards || 0;
        const eyePoints = stats.eyePoints || 0;
        const shotsOnTarget = stats.shotsOnTarget || 0;
        const tackles = stats.tackles || 0;
        const interceptions = stats.interceptions || 0;

        const positiveAdjustments =
            goals * 1.0 +
            assists * 0.5 +
            saves * 0.3 +
            shotsOnTarget * 0.1 +
            tackles * 0.1 +
            interceptions * 0.1;

        const negativeAdjustments =
            yellowCards * 0.2 +
            redCards * 1.0;

        const eyePointBonus = eyePoints * this.EYE_POINT_BONUS;

        const newRating = Math.max(
            0,
            Math.min(10, baseRating + positiveAdjustments - negativeAdjustments + eyePointBonus)
        );

        return {
            newRating: Math.round(newRating * 10) / 10,
            breakdown: {
                baseRating,
                positiveAdjustments: Math.round(positiveAdjustments * 10) / 10,
                negativeAdjustments: Math.round(negativeAdjustments * 10) / 10,
                eyePointBonus: Math.round(eyePointBonus * 10) / 10,
            },
        };
    }

    /**
     * Calculate Basketball player rating
     */
    private static calculateBasketballRating(
        stats: PlayerStats,
        baseRating: number
    ): RatingCalculationResult {
        const points = stats.points || 0;
        const rebounds = stats.rebounds || 0;
        const assists = stats.assists_basketball || 0;
        const steals = stats.steals || 0;
        const blocks = stats.blocks || 0;
        const turnovers = stats.turnovers || 0;
        const fouls = stats.fouls || 0;
        const eyePoints = stats.eyePoints || 0;

        const positiveAdjustments =
            points * 0.1 +
            rebounds * 0.2 +
            assists * 0.3 +
            steals * 0.4 +
            blocks * 0.4;

        const negativeAdjustments =
            turnovers * 0.2 +
            fouls * 0.1;

        const eyePointBonus = eyePoints * this.EYE_POINT_BONUS;

        const newRating = Math.max(
            0,
            Math.min(10, baseRating + positiveAdjustments - negativeAdjustments + eyePointBonus)
        );

        return {
            newRating: Math.round(newRating * 10) / 10,
            breakdown: {
                baseRating,
                positiveAdjustments: Math.round(positiveAdjustments * 10) / 10,
                negativeAdjustments: Math.round(negativeAdjustments * 10) / 10,
                eyePointBonus: Math.round(eyePointBonus * 10) / 10,
            },
        };
    }

    /**
     * Calculate Track & Field player rating
     */
    private static calculateTrackRating(
        stats: PlayerStats,
        baseRating: number
    ): RatingCalculationResult {
        const position = stats.position || 0;
        const recordBroken = stats.recordBroken || false;
        const eyePoints = stats.eyePoints || 0;

        let positionBonus = 0;
        if (position === 1) positionBonus = 2.0;
        else if (position === 2) positionBonus = 1.5;
        else if (position === 3) positionBonus = 1.0;
        else if (position > 0) positionBonus = 0.5;

        const recordBonus = recordBroken ? 1.0 : 0;
        const eyePointBonus = eyePoints * this.EYE_POINT_BONUS;

        const positiveAdjustments = positionBonus + recordBonus;

        const newRating = Math.max(
            0,
            Math.min(10, baseRating + positiveAdjustments + eyePointBonus)
        );

        return {
            newRating: Math.round(newRating * 10) / 10,
            breakdown: {
                baseRating,
                positiveAdjustments: Math.round(positiveAdjustments * 10) / 10,
                negativeAdjustments: 0,
                eyePointBonus: Math.round(eyePointBonus * 10) / 10,
            },
        };
    }

    /**
     * Apply time-weighted adjustment for substitutions
     */
    static applyTimeWeighting(
        rating: number,
        minutesPlayed: number,
        totalMatchMinutes: number
    ): number {
        if (totalMatchMinutes === 0) return rating;

        const timeWeight = minutesPlayed / totalMatchMinutes;
        const weightedRating = rating * timeWeight;

        return Math.round(weightedRating * 10) / 10;
    }

    /**
     * Calculate player statistics from match events
     */
    static calculateStatsFromEvents(
        playerId: string,
        events: MatchEvent[],
        sport: string
    ): PlayerStats {
        const stats: PlayerStats = {
            eyePoints: 0,
        };

        const playerEvents = events.filter(e => e.playerId === playerId);

        switch (sport.toLowerCase()) {
            case 'football':
                stats.goals = playerEvents.filter(e => this.normalizeType(e.type) === 'goal').length;
                stats.assists = playerEvents.filter(e => this.normalizeType(e.type) === 'assist').length;
                stats.saves = playerEvents.filter(e => this.normalizeType(e.type) === 'save').length;
                stats.yellowCards = playerEvents.filter(e => this.normalizeType(e.type) === 'yellowcard').length;
                stats.redCards = playerEvents.filter(e => this.normalizeType(e.type) === 'redcard').length;
                stats.shotsOnTarget = playerEvents.filter(e => this.normalizeType(e.type) === 'shotontarget').length;
                stats.shotsOffTarget = playerEvents.filter(e => this.normalizeType(e.type) === 'shotofftarget').length;
                stats.tackles = playerEvents.filter(e => this.normalizeType(e.type) === 'tackle').length;
                stats.interceptions = playerEvents.filter(e => this.normalizeType(e.type) === 'interception').length;
                break;

            case 'basketball':
                const fieldGoals = playerEvents.filter(e => this.normalizeType(e.type) === 'fieldgoal');
                const threePointers = playerEvents.filter(e => this.normalizeType(e.type) === 'threepointer');
                const freeThrows = playerEvents.filter(e => this.normalizeType(e.type) === 'freethrow');

                stats.points =
                    fieldGoals.length * 2 +
                    threePointers.length * 3 +
                    freeThrows.length * 1;

                stats.rebounds = playerEvents.filter(e => this.normalizeType(e.type) === 'rebound').length;
                stats.assists_basketball = playerEvents.filter(e => this.normalizeType(e.type) === 'assist').length;
                stats.steals = playerEvents.filter(e => this.normalizeType(e.type) === 'steal').length;
                stats.blocks = playerEvents.filter(e => this.normalizeType(e.type) === 'block').length;
                stats.turnovers = playerEvents.filter(e => this.normalizeType(e.type) === 'turnover').length;
                stats.fouls = playerEvents.filter(e => this.normalizeType(e.type) === 'foul').length;
                break;

            case 'track':
            case 'track & field':
                const finishEvent = playerEvents.find(e => this.normalizeType(e.type) === 'finish');
                if (finishEvent && finishEvent.value) {
                    const value = JSON.parse(finishEvent.value);
                    stats.position = value.position;
                    stats.time = value.time;
                }
                stats.recordBroken = playerEvents.some(e => this.normalizeType(e.type) === 'recordbroken');
                break;
        }

        // Count Eye Points
        stats.eyePoints = playerEvents.filter(e => e.isEyePoint).length;

        return stats;
    }

    /**
     * Add Eye Point bonus to player rating
     */
    static addEyePointBonus(currentRating: number): number {
        const newRating = currentRating + this.EYE_POINT_BONUS;
        return Math.min(10, Math.round(newRating * 10) / 10);
    }
}
