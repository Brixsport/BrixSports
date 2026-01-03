/**
 * Substitution Management Service
 * Handles player substitutions with time tracking and validation
 */

import { MatchEvent } from '@/db/schema';

export interface PlayerTimeTracking {
    playerId: string;
    playerName: string;
    timeOn: number; // minute entered
    timeOff?: number; // minute exited (undefined if still on field)
    totalMinutes: number;
    isActive: boolean;
}

export interface SubstitutionValidation {
    isValid: boolean;
    errors: string[];
}

export interface SubstitutionRules {
    maxSubstitutions: number;
    allowResubstitution: boolean;
    requiresEligibility: boolean;
}

export class SubstitutionManager {
    private static readonly SPORT_RULES: Record<string, SubstitutionRules> = {
        football: {
            maxSubstitutions: 5,
            allowResubstitution: false,
            requiresEligibility: true,
        },
        basketball: {
            maxSubstitutions: -1, // unlimited
            allowResubstitution: true,
            requiresEligibility: false,
        },
        track: {
            maxSubstitutions: 0, // no substitutions in track events
            allowResubstitution: false,
            requiresEligibility: false,
        },
    };

    /**
     * Validate a substitution request
     */
    static validateSubstitution(
        sport: string,
        teamId: string,
        outgoingPlayerId: string,
        incomingPlayerId: string,
        currentMinute: number,
        existingEvents: MatchEvent[],
        activePlayerIds: string[]
    ): SubstitutionValidation {
        const errors: string[] = [];
        const rules = this.SPORT_RULES[sport.toLowerCase()] || this.SPORT_RULES.football;

        // Check if sport allows substitutions
        if (rules.maxSubstitutions === 0) {
            errors.push('Substitutions are not allowed in this sport');
            return { isValid: false, errors };
        }

        // Check if outgoing player is on the field
        if (!activePlayerIds.includes(outgoingPlayerId)) {
            errors.push('Outgoing player is not currently on the field');
        }

        // Check if incoming player is already on the field
        if (activePlayerIds.includes(incomingPlayerId)) {
            errors.push('Incoming player is already on the field');
        }

        // Check if incoming player has been substituted out before (if resubstitution not allowed)
        if (!rules.allowResubstitution) {
            const playerSubstitutions = existingEvents.filter(
                e => e.type === 'SUBSTITUTION' &&
                    e.playerId === incomingPlayerId &&
                    e.teamId === teamId
            );

            if (playerSubstitutions.length > 0) {
                errors.push('Player has already been substituted and cannot return to the field');
            }
        }

        // Check maximum substitutions limit
        if (rules.maxSubstitutions > 0) {
            const teamSubstitutions = existingEvents.filter(
                e => e.type === 'SUBSTITUTION' && e.teamId === teamId
            );

            if (teamSubstitutions.length >= rules.maxSubstitutions) {
                errors.push(`Maximum substitutions (${rules.maxSubstitutions}) reached for this team`);
            }
        }

        // Check timing (cannot substitute at minute 0)
        if (currentMinute <= 0) {
            errors.push('Substitutions cannot be made before the match starts');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Create player time tracking from match events
     */
    static createTimeTracking(
        playerId: string,
        playerName: string,
        events: MatchEvent[],
        currentMinute: number,
        startedOnField: boolean = true
    ): PlayerTimeTracking {
        const playerSubEvents = events.filter(
            e => e.type === 'SUBSTITUTION' &&
                (e.playerId === playerId || e.relatedPlayerId === playerId)
        ).sort((a, b) => a.minute - b.minute);

        let timeOn = startedOnField ? 0 : -1;
        let timeOff: number | undefined = undefined;
        let isActive = startedOnField;

        for (const event of playerSubEvents) {
            if (event.relatedPlayerId === playerId) {
                // Player coming on
                timeOn = event.minute;
                isActive = true;
                timeOff = undefined;
            } else if (event.playerId === playerId) {
                // Player going off
                timeOff = event.minute;
                isActive = false;
            }
        }

        // Calculate total minutes
        let totalMinutes = 0;
        if (timeOn >= 0) {
            if (isActive) {
                // Player is still on the field
                totalMinutes = currentMinute - timeOn;
            } else if (timeOff !== undefined) {
                // Player has been substituted off
                totalMinutes = timeOff - timeOn;
            }
        }

        return {
            playerId,
            playerName,
            timeOn,
            timeOff,
            totalMinutes: Math.max(0, totalMinutes),
            isActive,
        };
    }

    /**
     * Get all active players on the field
     */
    static getActivePlayers(
        startingLineup: string[],
        events: MatchEvent[]
    ): string[] {
        const activePlayers = new Set(startingLineup);

        const substitutions = events
            .filter(e => e.type === 'SUBSTITUTION')
            .sort((a, b) => a.minute - b.minute);

        for (const sub of substitutions) {
            if (sub.playerId) {
                activePlayers.delete(sub.playerId); // Remove outgoing player
            }
            if (sub.relatedPlayerId) {
                activePlayers.add(sub.relatedPlayerId); // Add incoming player
            }
        }

        return Array.from(activePlayers);
    }

    /**
     * Get time tracking for all players in a team
     */
    static getTeamTimeTracking(
        teamPlayers: Array<{ id: string; name: string }>,
        startingLineup: string[],
        events: MatchEvent[],
        currentMinute: number
    ): PlayerTimeTracking[] {
        return teamPlayers.map(player =>
            this.createTimeTracking(
                player.id,
                player.name,
                events,
                currentMinute,
                startingLineup.includes(player.id)
            )
        );
    }

    /**
     * Calculate time-weighted statistics for a player
     */
    static calculateTimeWeightedStats(
        timeTracking: PlayerTimeTracking,
        totalMatchMinutes: number,
        rawStats: number
    ): number {
        if (totalMatchMinutes === 0 || timeTracking.totalMinutes === 0) {
            return 0;
        }

        const timeWeight = timeTracking.totalMinutes / totalMatchMinutes;
        return Math.round(rawStats * timeWeight * 10) / 10;
    }

    /**
     * Get substitution summary for a match
     */
    static getSubstitutionSummary(
        events: MatchEvent[],
        teamId: string
    ): {
        total: number;
        remaining: number;
        substitutions: Array<{
            minute: number;
            outgoingPlayer: string;
            incomingPlayer: string;
        }>;
    } {
        const sport = 'football'; // This should be passed as parameter
        const rules = this.SPORT_RULES[sport];

        const teamSubs = events.filter(
            e => e.type === 'SUBSTITUTION' && e.teamId === teamId
        ).sort((a, b) => a.minute - b.minute);

        const substitutions = teamSubs.map(sub => ({
            minute: sub.minute,
            outgoingPlayer: sub.playerId || 'Unknown',
            incomingPlayer: sub.relatedPlayerId || 'Unknown',
        }));

        const remaining = rules.maxSubstitutions > 0
            ? Math.max(0, rules.maxSubstitutions - teamSubs.length)
            : -1; // unlimited

        return {
            total: teamSubs.length,
            remaining,
            substitutions,
        };
    }

    /**
     * Check if a player is eligible for substitution
     */
    static isPlayerEligible(
        playerId: string,
        teamId: string,
        events: MatchEvent[],
        sport: string
    ): { eligible: boolean; reason?: string } {
        const rules = this.SPORT_RULES[sport.toLowerCase()] || this.SPORT_RULES.football;

        if (!rules.allowResubstitution) {
            const wasSubstitutedOut = events.some(
                e => e.type === 'SUBSTITUTION' &&
                    e.playerId === playerId &&
                    e.teamId === teamId
            );

            if (wasSubstitutedOut) {
                return {
                    eligible: false,
                    reason: 'Player has already been substituted out and cannot return',
                };
            }
        }

        // Check if player has a red card
        const hasRedCard = events.some(
            e => e.type === 'RED_CARD' && e.playerId === playerId
        );

        if (hasRedCard) {
            return {
                eligible: false,
                reason: 'Player has been sent off and cannot be substituted',
            };
        }

        return { eligible: true };
    }

    /**
     * Get match duration in minutes based on sport
     */
    static getMatchDuration(sport: string, currentStatus: string): number {
        switch (sport.toLowerCase()) {
            case 'football':
                return currentStatus === 'FINISHED' ? 90 : 45; // Full time or half time
            case 'basketball':
                return 48; // 4 quarters × 12 minutes (NBA) or 40 minutes (FIBA)
            case 'track':
                return 0; // No fixed duration for track events
            default:
                return 90;
        }
    }
}
