// Rating Calculator - Auto-calculate player ratings based on ALL match events
// Every event type affects the final rating

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
    // Additional event types that affect ratings
    saves?: number;              // GK saves
    passesCompleted?: number;   // Successful passes
    passesFailed?: number;      // Failed/incomplete passes
    tackles?: number;           // Successful tackles
    tacklesMissed?: number;     // Failed tackle attempts
    interceptions?: number;     // Interceptions
    clearances?: number;        // Defensive clearances
    blocks?: number;            // Shot/goal blocks
    dribblesCompleted?: number; // Successful dribbles
    dribblesFailed?: number;    // Failed dribbles
    cornersWon?: number;        // Corners won
    cornersConceded?: number;   // Corners conceded
    freeKicksWon?: number;      // Free kicks won (fouled)
    freeKicksConceded?: number; // Free kicks conceded (fouling)
    offsides?: number;          // Offside calls
    ownGoals?: number;          // Own goals
    penaltiesScored?: number;    // Penalty goals
    penaltiesMissed?: number;    // Penalty misses
    penaltiesSaved?: number;    // Penalties saved (GK)
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

        const position = (stats.position || 'CM').toLowerCase();
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

        // ========== SAVES (Goalkeepers) ==========
        if (stats.saves && stats.saves > 0) {
            const saveValue = Math.min(stats.saves * 0.25, 2.0);
            breakdown.goals += saveValue; // Reuse goals field for saves tracking
            rating += saveValue;
        }

        // ========== PASSES ==========
        // Completed passes are good, failed passes are bad
        if (stats.passesCompleted && stats.passesCompleted > 0) {
            // More passes = better, but with diminishing returns
            const passValue = Math.min(stats.passesCompleted * 0.02, 0.5);
            breakdown.assists += passValue; // Track in assists field
            rating += passValue;
        }
        if (stats.passesFailed && stats.passesFailed > 5) {
            // Penalty for excessive failed passes
            const passPenalty = -Math.min((stats.passesFailed - 5) * 0.03, 0.4);
            breakdown.assists += passPenalty;
            rating += passPenalty;
        }

        // ========== DEFENSIVE ACTIONS ==========
        // Tackles
        if (stats.tackles && stats.tackles > 0) {
            const tackleValue = Math.min(stats.tackles * 0.15, 0.8);
            breakdown.fouls += tackleValue; // Reuse fouls field
            rating += tackleValue;
        }
        if (stats.tacklesMissed && stats.tacklesMissed > 3) {
            const missedPenalty = -Math.min((stats.tacklesMissed - 3) * 0.05, 0.3);
            breakdown.fouls += missedPenalty;
            rating += missedPenalty;
        }

        // Interceptions
        if (stats.interceptions && stats.interceptions > 0) {
            const intValue = Math.min(stats.interceptions * 0.12, 0.6);
            breakdown.fouls += intValue;
            rating += intValue;
        }

        // Clearances
        if (stats.clearances && stats.clearances > 0) {
            const clearValue = Math.min(stats.clearances * 0.08, 0.4);
            breakdown.fouls += clearValue;
            rating += clearValue;
        }

        // Blocks
        if (stats.blocks && stats.blocks > 0) {
            const blockValue = Math.min(stats.blocks * 0.15, 0.6);
            breakdown.shots += blockValue; // Track in shots field
            rating += blockValue;
        }

        // ========== DRIBBLING ==========
        if (stats.dribblesCompleted && stats.dribblesCompleted > 0) {
            const dribbleValue = Math.min(stats.dribblesCompleted * 0.08, 0.5);
            breakdown.positionBonus += dribbleValue;
            rating += dribbleValue;
        }
        if (stats.dribblesFailed && stats.dribblesFailed > 3) {
            const dribblePenalty = -Math.min((stats.dribblesFailed - 3) * 0.04, 0.3);
            breakdown.positionBonus += dribblePenalty;
            rating += dribblePenalty;
        }

        // ========== SET PIECES ==========
        // Corners won (attacking pressure)
        if (stats.cornersWon && stats.cornersWon > 0) {
            const cornerValue = Math.min(stats.cornersWon * 0.05, 0.3);
            breakdown.positionBonus += cornerValue;
            rating += cornerValue;
        }
        // Corners conceded (defensive pressure allowed)
        if (stats.cornersConceded && stats.cornersConceded > 3) {
            const cornerPenalty = -Math.min((stats.cornersConceded - 3) * 0.04, 0.3);
            breakdown.positionBonus += cornerPenalty;
            rating += cornerPenalty;
        }

        // Free kicks won (drawn fouls - positive)
        if (stats.freeKicksWon && stats.freeKicksWon > 0) {
            const fkwValue = Math.min(stats.freeKicksWon * 0.06, 0.4);
            breakdown.positionBonus += fkwValue;
            rating += fkwValue;
        }
        // Free kicks conceded (committed fouls - negative, but already counted in fouls)
        // This is additional for set-piece fouls
        if (stats.freeKicksConceded && stats.freeKicksConceded > 2) {
            const fkcPenalty = -Math.min((stats.freeKicksConceded - 2) * 0.05, 0.3);
            breakdown.fouls += fkcPenalty;
            rating += fkcPenalty;
        }

        // ========== DISCIPLINE & ERRORS ==========
        // Offsides
        if (stats.offsides && stats.offsides > 2) {
            const offsidePenalty = -Math.min((stats.offsides - 2) * 0.08, 0.4);
            breakdown.positionBonus += offsidePenalty;
            rating += offsidePenalty;
        }

        // Own goals (severe penalty)
        if (stats.ownGoals && stats.ownGoals > 0) {
            const ogPenalty = -stats.ownGoals * 2.0;
            breakdown.cards += ogPenalty;
            rating += ogPenalty;
        }

        // Penalties scored (bonus)
        if (stats.penaltiesScored && stats.penaltiesScored > 0) {
            // Penalties are already counted as goals, but add slight bonus for composure
            const penBonus = stats.penaltiesScored * 0.1;
            breakdown.positionBonus += penBonus;
            rating += penBonus;
        }
        // Penalties missed (penalty)
        if (stats.penaltiesMissed && stats.penaltiesMissed > 0) {
            const penPenalty = -stats.penaltiesMissed * 0.8;
            breakdown.positionBonus += penPenalty;
            rating += penPenalty;
        }
        // Penalties saved (GK bonus)
        if (stats.penaltiesSaved && stats.penaltiesSaved > 0) {
            const penSaveBonus = stats.penaltiesSaved * 1.0;
            breakdown.goals += penSaveBonus;
            rating += penSaveBonus;
        }

        // ========== FOULS ==========
        // Excessive fouls are penalized
        if (stats.fouls > 2) {
            const foulPenalty = -Math.min((stats.fouls - 2) * 0.1, 0.4);
            breakdown.fouls += foulPenalty;
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
