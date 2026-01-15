// Rating Calculator - Auto-calculate player ratings based on match events

interface PlayerStats {
    playerId: string;
    position: string;
    goals: number;
    assists: number;
    eyePoints: number;
    yellowCards: number;
    redCards: number;
    shotsOnTarget: number;
    shotsOffTarget: number;
    fouls: number;
    isSubstituted: boolean;
    minutesPlayed: number;
}

interface RatingBreakdown {
    goals: number;
    assists: number;
    eyePoints: number;
    cards: number;
    shots: number;
    fouls: number;
    positionBonus: number;
}

export class RatingCalculator {
    private static readonly BASE_RATING = 6.0;
    private static readonly MAX_RATING = 10.0;
    private static readonly MIN_RATING = 1.0;

    /**
     * Calculate auto-rating based on logged events
     * Improved algorithm with better scaling and position-specific logic
     */
    static calculateAutoRating(stats: PlayerStats): { rating: number; breakdown: RatingBreakdown } {
        let rating = this.BASE_RATING;
        const breakdown: RatingBreakdown = {
            goals: 0,
            assists: 0,
            eyePoints: 0,
            cards: 0,
            shots: 0,
            fouls: 0,
            positionBonus: 0
        };

        const position = stats.position.toLowerCase();
        const isDefensive = position.includes('gk') || position.includes('def') || position.includes('cb') || position.includes('lb') || position.includes('rb');
        const isMidfield = position.includes('mid') || position.includes('cm') || position.includes('cdm') || position.includes('cam');
        const isAttacking = position.includes('fw') || position.includes('st') || position.includes('cf') || position.includes('wing');

        // ========== GOALS ==========
        // Diminishing returns for multiple goals, position-weighted
        if (stats.goals > 0) {
            let goalValue = 0;

            // First goal is most valuable, subsequent goals have diminishing returns
            for (let i = 0; i < stats.goals; i++) {
                let baseValue = 1.2; // Base value for first goal

                // Diminishing returns: 1.2, 0.9, 0.7, 0.6...
                if (i === 1) baseValue = 0.9;
                else if (i === 2) baseValue = 0.7;
                else if (i >= 3) baseValue = 0.6;

                // Position multipliers
                if (position.includes('gk')) {
                    goalValue += baseValue * 2.5; // GK goal is legendary
                } else if (isDefensive) {
                    goalValue += baseValue * 1.8; // Defender goal is exceptional
                } else if (position.includes('cdm') || position.includes('dm')) {
                    goalValue += baseValue * 1.5; // DM goal is great
                } else if (isMidfield) {
                    goalValue += baseValue * 1.3; // Midfielder goal is good
                } else if (isAttacking) {
                    goalValue += baseValue * 1.1; // Forward goal is expected
                }
            }

            breakdown.goals = goalValue;
            rating += goalValue;
        }

        // ========== ASSISTS ==========
        // Assists are valuable but slightly less than goals
        if (stats.assists > 0) {
            let assistValue = 0;

            for (let i = 0; i < stats.assists; i++) {
                let baseValue = 0.9; // Base value for first assist

                if (i === 1) baseValue = 0.7;
                else if (i === 2) baseValue = 0.6;
                else if (i >= 3) baseValue = 0.5;

                // Position multipliers for assists
                if (isDefensive) {
                    assistValue += baseValue * 1.3; // Defender assist is impressive
                } else if (isMidfield || position.includes('wing')) {
                    assistValue += baseValue * 1.1; // Expected from creative players
                } else {
                    assistValue += baseValue * 1.0;
                }
            }

            breakdown.assists = assistValue;
            rating += assistValue;
        }

        // ========== EYE POINTS ==========
        // Special moments (key passes, tackles, saves, etc.)
        if (stats.eyePoints > 0) {
            // Eye points are valuable but capped to prevent inflation
            const eyeValue = Math.min(stats.eyePoints * 0.4, 1.5);
            breakdown.eyePoints = eyeValue;
            rating += eyeValue;
        }

        // ========== SHOTS ON TARGET ==========
        // Reward attacking intent, but don't over-value
        if (stats.shotsOnTarget > 0) {
            const shotValue = Math.min(stats.shotsOnTarget * 0.15, 0.6);
            breakdown.shots = shotValue;
            rating += shotValue;
        }

        // ========== SHOTS OFF TARGET ==========
        // Slight penalty for wastefulness (only if excessive)
        if (stats.shotsOffTarget > 3) {
            const wastefulness = -(stats.shotsOffTarget - 3) * 0.05;
            breakdown.shots += Math.max(wastefulness, -0.3);
            rating += Math.max(wastefulness, -0.3);
        }

        // ========== CARDS ==========
        // Yellow cards are moderate penalties, red cards are severe
        if (stats.yellowCards > 0) {
            const yellowPenalty = -stats.yellowCards * 0.4;
            breakdown.cards = yellowPenalty;
            rating += yellowPenalty;
        }
        if (stats.redCards > 0) {
            const redPenalty = -stats.redCards * 1.5; // Severe penalty
            breakdown.cards += redPenalty;
            rating += redPenalty;
        }

        // ========== FOULS ==========
        // Excessive fouls are penalized
        if (stats.fouls > 2) {
            const foulPenalty = -Math.min((stats.fouls - 2) * 0.1, 0.4);
            breakdown.fouls = foulPenalty;
            rating += foulPenalty;
        }

        // ========== MINUTES PLAYED ==========
        // Full match bonus (stamina and consistency)
        if (stats.minutesPlayed >= 85 && !stats.isSubstituted) {
            breakdown.positionBonus += 0.15;
            rating += 0.15;
        }
        // Penalty for very early substitution (suggests poor performance)
        else if (stats.isSubstituted && stats.minutesPlayed < 30) {
            breakdown.positionBonus -= 0.3;
            rating -= 0.3;
        }

        // ========== POSITION-SPECIFIC BASELINE ADJUSTMENTS ==========
        // Defensive players often underrated by pure stats
        if (isDefensive && stats.goals === 0 && stats.assists === 0) {
            // If no attacking contributions but played full match, slight bonus
            if (stats.minutesPlayed >= 75 && stats.yellowCards === 0 && stats.redCards === 0) {
                breakdown.positionBonus += 0.2;
                rating += 0.2;
            }
        }

        // Cap rating between MIN and MAX
        rating = Math.max(this.MIN_RATING, Math.min(this.MAX_RATING, rating));

        return {
            rating: Math.round(rating * 10) / 10, // Round to 1 decimal
            breakdown
        };
    }

    /**
     * Get suggested rating range based on position and context
     */
    static getSuggestedRange(position: string, teamCleanSheet: boolean, teamWon: boolean): { min: number; max: number; suggestion: string } {
        const pos = position.toLowerCase();

        // Goalkeeper
        if (pos.includes('gk')) {
            if (teamCleanSheet) {
                return {
                    min: 7.0,
                    max: 8.5,
                    suggestion: 'Clean sheet - consider 7.5-8.0 for solid performance'
                };
            }
            return {
                min: 6.0,
                max: 7.5,
                suggestion: 'Typical GK range for average performance'
            };
        }

        // Defenders
        if (pos.includes('def') || pos.includes('cb') || pos.includes('lb') || pos.includes('rb')) {
            if (teamCleanSheet) {
                return {
                    min: 7.0,
                    max: 8.0,
                    suggestion: 'Clean sheet - defenders deserve bonus'
                };
            }
            return {
                min: 6.0,
                max: 7.5,
                suggestion: 'Typical defender range'
            };
        }

        // Defensive Midfielders
        if (pos.includes('cdm') || pos.includes('dm')) {
            return {
                min: 6.5,
                max: 8.0,
                suggestion: 'CDM often underrated - consider their defensive work and passing'
            };
        }

        // Central Midfielders
        if (pos.includes('cm') || pos.includes('mid')) {
            return {
                min: 6.5,
                max: 8.0,
                suggestion: 'CM rated on overall contribution - passing, tackling, positioning'
            };
        }

        // Attacking Midfielders
        if (pos.includes('cam') || pos.includes('am')) {
            return {
                min: 6.0,
                max: 8.5,
                suggestion: 'CAM rated on creativity and goal involvement'
            };
        }

        // Forwards
        if (pos.includes('st') || pos.includes('fw') || pos.includes('cf')) {
            return {
                min: 6.0,
                max: 9.0,
                suggestion: 'Forwards rated primarily on goals and chances created'
            };
        }

        // Default
        return {
            min: 6.0,
            max: 8.0,
            suggestion: 'Standard rating range'
        };
    }

    /**
     * Validate final rating
     */
    static validateRating(rating: number): boolean {
        return rating >= this.MIN_RATING && rating <= this.MAX_RATING;
    }

    /**
     * Get rating description
     */
    static getRatingDescription(rating: number): string {
        if (rating === 10.0) return 'Perfect - Flawless performance (extremely rare)';
        if (rating >= 9.0) return 'Exceptional - Man of the Match level';
        if (rating >= 8.0) return 'Excellent - Outstanding performance';
        if (rating >= 7.0) return 'Good - Above average performance';
        if (rating >= 6.0) return 'Average - Did their job';
        if (rating >= 5.0) return 'Below Average - Poor performance';
        return 'Very Poor - Disastrous performance';
    }

    /**
     * Get rating color class
     */
    static getRatingColor(rating: number): string {
        if (rating >= 7.0) return 'text-green-400';
        if (rating >= 6.0) return 'text-blue-400';
        return 'text-red-400';
    }

    /**
     * Get rating background color class
     */
    static getRatingBgColor(rating: number): string {
        if (rating >= 7.0) return 'bg-green-500/90 border-green-300';
        if (rating >= 6.0) return 'bg-blue-500/90 border-blue-300';
        return 'bg-red-500/90 border-red-300';
    }
}
