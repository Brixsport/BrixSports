/**
 * Event Validation System
 * Prevents invalid events based on sport rules
 */

export interface ValidationRule {
    type: string;
    validate: (event: any, context: ValidationContext) => ValidationResult;
    message: string;
}

export interface ValidationContext {
    sport: 'Football' | 'Basketball';
    events: any[];
    players: any[];
    match: any;
    currentQuarter?: number;
    currentHalf?: number;
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
    warning?: string;
    suggestion?: string;
}

/**
 * Basketball Validation Rules
 */
export const basketballRules: ValidationRule[] = [
    // Rule 1: Maximum 5 fouls per player
    {
        type: 'Foul',
        validate: (event, context) => {
            const playerFouls = context.events.filter(
                e => e.playerId === event.playerId && e.type === 'Foul'
            ).length;

            if (playerFouls >= 5) {
                return {
                    valid: false,
                    error: 'Player already has 5 fouls and is fouled out',
                    suggestion: 'This player cannot commit more fouls',
                };
            }

            if (playerFouls === 4) {
                return {
                    valid: true,
                    warning: 'This is the player\'s 5th foul - they will foul out',
                };
            }

            return { valid: true };
        },
        message: 'Maximum 5 fouls per player',
    },

    // Rule 2: Valid point values
    {
        type: 'Field Goal',
        validate: (event, context) => {
            if (event.value !== 2) {
                return {
                    valid: false,
                    error: 'Field goals must be worth 2 points',
                };
            }
            return { valid: true };
        },
        message: 'Field goals are worth 2 points',
    },

    {
        type: 'Three Pointer',
        validate: (event, context) => {
            if (event.value !== 3) {
                return {
                    valid: false,
                    error: 'Three pointers must be worth 3 points',
                };
            }
            return { valid: true };
        },
        message: 'Three pointers are worth 3 points',
    },

    {
        type: 'Free Throw',
        validate: (event, context) => {
            if (event.value !== 1) {
                return {
                    valid: false,
                    error: 'Free throws must be worth 1 point',
                };
            }
            return { valid: true };
        },
        message: 'Free throws are worth 1 point',
    },

    // Rule 3: Maximum 5 players on court per team
    {
        type: 'Substitution',
        validate: (event, context) => {
            // Check if substitution would exceed 5 players
            const teamEvents = context.events.filter(e => e.teamId === event.teamId);
            const activePlayers = new Set<string>();

            // Track active players
            teamEvents.forEach(e => {
                if (e.type === 'Substitution') {
                    activePlayers.delete(e.playerId); // Player out
                    if (e.relatedPlayerId) {
                        activePlayers.add(e.relatedPlayerId); // Player in
                    }
                } else if (e.playerId) {
                    activePlayers.add(e.playerId);
                }
            });

            if (activePlayers.size >= 5 && !activePlayers.has(event.playerId)) {
                return {
                    valid: false,
                    error: 'Cannot have more than 5 players on court',
                };
            }

            return { valid: true };
        },
        message: 'Maximum 5 players on court per team',
    },

    // Rule 4: Timeouts limit (typically 5 per team)
    {
        type: 'Timeout',
        validate: (event, context) => {
            const teamTimeouts = context.events.filter(
                e => e.teamId === event.teamId && e.type === 'Timeout'
            ).length;

            if (teamTimeouts >= 5) {
                return {
                    valid: false,
                    error: 'Team has used all 5 timeouts',
                };
            }

            if (teamTimeouts === 4) {
                return {
                    valid: true,
                    warning: 'This is the team\'s last timeout',
                };
            }

            return { valid: true };
        },
        message: 'Maximum 5 timeouts per team',
    },
];

/**
 * Football Validation Rules
 */
export const footballRules: ValidationRule[] = [
    // Rule 1: Red card = player ejected
    {
        type: 'Red Card',
        validate: (event, context) => {
            const playerCards = context.events.filter(
                e => e.playerId === event.playerId &&
                    (e.type === 'Yellow Card' || e.type === 'Red Card')
            );

            const hasRedCard = playerCards.some(e => e.type === 'Red Card');
            if (hasRedCard) {
                return {
                    valid: false,
                    error: 'Player already has a red card and is ejected',
                };
            }

            return { valid: true };
        },
        message: 'Players with red cards are ejected',
    },

    // Rule 2: Two yellow cards = red card
    {
        type: 'Yellow Card',
        validate: (event, context) => {
            const yellowCards = context.events.filter(
                e => e.playerId === event.playerId && e.type === 'Yellow Card'
            ).length;

            if (yellowCards >= 2) {
                return {
                    valid: false,
                    error: 'Player already has 2 yellow cards (automatic red)',
                    suggestion: 'Record a red card instead',
                };
            }

            if (yellowCards === 1) {
                return {
                    valid: true,
                    warning: 'This is the player\'s 2nd yellow card - automatic red card',
                };
            }

            return { valid: true };
        },
        message: 'Two yellow cards result in automatic red card',
    },

    // Rule 3: Maximum 3 substitutions (standard rules)
    {
        type: 'Substitution',
        validate: (event, context) => {
            const teamSubs = context.events.filter(
                e => e.teamId === event.teamId && e.type === 'Substitution'
            ).length;

            if (teamSubs >= 3) {
                return {
                    valid: false,
                    error: 'Team has used all 3 substitutions',
                };
            }

            if (teamSubs === 2) {
                return {
                    valid: true,
                    warning: 'This is the team\'s last substitution',
                };
            }

            return { valid: true };
        },
        message: 'Maximum 3 substitutions per team',
    },

    // Rule 4: Goal value validation
    {
        type: 'Goal',
        validate: (event, context) => {
            if (event.value && event.value !== 1) {
                return {
                    valid: false,
                    error: 'Goals are worth 1 point in football',
                };
            }
            return { valid: true };
        },
        message: 'Goals are worth 1 point',
    },

    // Rule 5: Penalty must be from penalty spot
    {
        type: 'Penalty',
        validate: (event, context) => {
            // Check if there was a foul in the box before this
            const recentFouls = context.events
                .filter(e => e.type === 'Foul' && e.minute >= (event.minute - 1))
                .length;

            if (recentFouls === 0) {
                return {
                    valid: true,
                    warning: 'No recent foul recorded - verify penalty was awarded correctly',
                };
            }

            return { valid: true };
        },
        message: 'Penalties should follow fouls in the box',
    },

    // Rule 6: Maximum 11 players on field
    {
        type: 'Substitution',
        validate: (event, context) => {
            const teamEvents = context.events.filter(e => e.teamId === event.teamId);
            const activePlayers = new Set<string>();

            teamEvents.forEach(e => {
                if (e.type === 'Substitution') {
                    activePlayers.delete(e.playerId);
                    if (e.relatedPlayerId) {
                        activePlayers.add(e.relatedPlayerId);
                    }
                } else if (e.playerId) {
                    activePlayers.add(e.playerId);
                }
            });

            if (activePlayers.size >= 11 && !activePlayers.has(event.playerId)) {
                return {
                    valid: false,
                    error: 'Cannot have more than 11 players on field',
                };
            }

            return { valid: true };
        },
        message: 'Maximum 11 players on field per team',
    },
];

/**
 * Validate an event against sport rules
 */
export function validateEvent(
    event: any,
    context: ValidationContext
): ValidationResult {
    const rules = context.sport === 'Basketball' ? basketballRules : footballRules;

    // Find applicable rules for this event type
    const applicableRules = rules.filter(rule => rule.type === event.type);

    // If no specific rules, allow the event
    if (applicableRules.length === 0) {
        return { valid: true };
    }

    // Validate against all applicable rules
    for (const rule of applicableRules) {
        const result = rule.validate(event, context);
        if (!result.valid) {
            return result;
        }
        // Collect warnings
        if (result.warning) {
            return result;
        }
    }

    return { valid: true };
}

/**
 * Get all validation rules for a sport
 */
export function getValidationRules(sport: 'Football' | 'Basketball'): ValidationRule[] {
    return sport === 'Basketball' ? basketballRules : footballRules;
}

/**
 * Check if player is eligible to play
 */
export function isPlayerEligible(
    playerId: string,
    context: ValidationContext
): { eligible: boolean; reason?: string } {
    const playerEvents = context.events.filter(e => e.playerId === playerId);

    if (context.sport === 'Basketball') {
        // Check fouls
        const fouls = playerEvents.filter(e => e.type === 'Foul').length;
        if (fouls >= 5) {
            return { eligible: false, reason: 'Player has fouled out (5 fouls)' };
        }
    }

    if (context.sport === 'Football') {
        // Check red card
        const hasRedCard = playerEvents.some(e => e.type === 'Red Card');
        if (hasRedCard) {
            return { eligible: false, reason: 'Player has been sent off (red card)' };
        }

        // Check two yellow cards
        const yellowCards = playerEvents.filter(e => e.type === 'Yellow Card').length;
        if (yellowCards >= 2) {
            return { eligible: false, reason: 'Player has 2 yellow cards (automatic red)' };
        }
    }

    return { eligible: true };
}

/**
 * Get player status summary
 */
export function getPlayerStatus(
    playerId: string,
    context: ValidationContext
): {
    eligible: boolean;
    fouls?: number;
    yellowCards?: number;
    redCard?: boolean;
    warnings: string[];
} {
    const playerEvents = context.events.filter(e => e.playerId === playerId);
    const warnings: string[] = [];

    if (context.sport === 'Basketball') {
        const fouls = playerEvents.filter(e => e.type === 'Foul').length;

        if (fouls === 4) {
            warnings.push('Player has 4 fouls - one more and they foul out');
        }

        return {
            eligible: fouls < 5,
            fouls,
            warnings,
        };
    }

    if (context.sport === 'Football') {
        const yellowCards = playerEvents.filter(e => e.type === 'Yellow Card').length;
        const redCard = playerEvents.some(e => e.type === 'Red Card');

        if (yellowCards === 1) {
            warnings.push('Player has 1 yellow card - one more results in red');
        }

        return {
            eligible: !redCard && yellowCards < 2,
            yellowCards,
            redCard,
            warnings,
        };
    }

    return { eligible: true, warnings: [] };
}
