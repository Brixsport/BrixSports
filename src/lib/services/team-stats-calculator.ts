/**
 * Team Statistics Calculation Service
 * Handles sport-specific team statistics calculations
 */

import { MatchEvent } from '@/db/schema';

export interface FootballTeamStats {
    possession: number;
    shots: number;
    shotsOnTarget: number;
    corners: number;
    fouls: number;
    yellowCards: number;
    redCards: number;
    saves: number;
    passAccuracy: number;
    tackles: number;
    interceptions: number;
    offsides: number;
}

export interface BasketballTeamStats {
    points: number;
    fieldGoals: { made: number; attempted: number; percentage: number };
    threePointers: { made: number; attempted: number; percentage: number };
    freeThrows: { made: number; attempted: number; percentage: number };
    rebounds: { offensive: number; defensive: number; total: number };
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fouls: number;
}

export interface TrackTeamStats {
    goldMedals: number;
    silverMedals: number;
    bronzeMedals: number;
    totalPoints: number;
    records: number;
    participations: number;
}

export type TeamStats = FootballTeamStats | BasketballTeamStats | TrackTeamStats;

export class TeamStatsCalculator {
    /**
     * Calculate team statistics from match events
     */
    static calculateStats(
        teamId: string,
        events: MatchEvent[],
        sport: string
    ): TeamStats {
        const teamEvents = events.filter(e => e.teamId === teamId);

        switch (sport.toLowerCase()) {
            case 'football':
                return this.calculateFootballStats(teamEvents, events);
            case 'basketball':
                return this.calculateBasketballStats(teamEvents);
            case 'track':
            case 'track & field':
                return this.calculateTrackStats(teamEvents);
            default:
                return this.getDefaultStats(sport);
        }
    }

    /**
     * Calculate Football team statistics
     */
    private static calculateFootballStats(
        teamEvents: MatchEvent[],
        allEvents: MatchEvent[]
    ): FootballTeamStats {
        const shots = teamEvents.filter(e =>
            e.type === 'SHOT_ON_TARGET' || e.type === 'SHOT_OFF_TARGET'
        ).length;

        const shotsOnTarget = teamEvents.filter(e =>
            e.type === 'SHOT_ON_TARGET'
        ).length;

        const corners = teamEvents.filter(e => e.type === 'CORNER').length;
        const fouls = teamEvents.filter(e => e.type === 'FOUL').length;
        const yellowCards = teamEvents.filter(e => e.type === 'YELLOW_CARD').length;
        const redCards = teamEvents.filter(e => e.type === 'RED_CARD').length;
        const saves = teamEvents.filter(e => e.type === 'SAVE').length;
        const tackles = teamEvents.filter(e => e.type === 'TACKLE').length;
        const interceptions = teamEvents.filter(e => e.type === 'INTERCEPTION').length;
        const offsides = teamEvents.filter(e => e.type === 'OFFSIDE').length;

        // Calculate possession percentage
        const possessionEvents = allEvents.filter(e => e.type === 'POSSESSION');
        const teamPossessionEvents = possessionEvents.filter(e => e.teamId === teamEvents[0]?.teamId);
        const possession = possessionEvents.length > 0
            ? Math.round((teamPossessionEvents.length / possessionEvents.length) * 100)
            : 50;

        // Calculate pass accuracy (simplified)
        const passes = teamEvents.filter(e => e.type === 'PASS_COMPLETE' || e.type === 'PASS_INCOMPLETE');
        const completedPasses = teamEvents.filter(e => e.type === 'PASS_COMPLETE').length;
        const passAccuracy = passes.length > 0
            ? Math.round((completedPasses / passes.length) * 100)
            : 0;

        return {
            possession,
            shots,
            shotsOnTarget,
            corners,
            fouls,
            yellowCards,
            redCards,
            saves,
            passAccuracy,
            tackles,
            interceptions,
            offsides,
        };
    }

    /**
     * Calculate Basketball team statistics
     */
    private static calculateBasketballStats(teamEvents: MatchEvent[]): BasketballTeamStats {
        const fieldGoalsMade = teamEvents.filter(e => e.type === 'FIELD_GOAL').length;
        const fieldGoalsAttempted = teamEvents.filter(e =>
            e.type === 'FIELD_GOAL' || e.type === 'FIELD_GOAL_MISS'
        ).length;

        const threePointersMade = teamEvents.filter(e => e.type === 'THREE_POINTER').length;
        const threePointersAttempted = teamEvents.filter(e =>
            e.type === 'THREE_POINTER' || e.type === 'THREE_POINTER_MISS'
        ).length;

        const freeThrowsMade = teamEvents.filter(e => e.type === 'FREE_THROW').length;
        const freeThrowsAttempted = teamEvents.filter(e =>
            e.type === 'FREE_THROW' || e.type === 'FREE_THROW_MISS'
        ).length;

        const offensiveRebounds = teamEvents.filter(e =>
            e.type === 'REBOUND' && e.detail === 'offensive'
        ).length;
        const defensiveRebounds = teamEvents.filter(e =>
            e.type === 'REBOUND' && e.detail === 'defensive'
        ).length;

        const assists = teamEvents.filter(e => e.type === 'ASSIST').length;
        const steals = teamEvents.filter(e => e.type === 'STEAL').length;
        const blocks = teamEvents.filter(e => e.type === 'BLOCK').length;
        const turnovers = teamEvents.filter(e => e.type === 'TURNOVER').length;
        const fouls = teamEvents.filter(e => e.type === 'FOUL').length;

        const points = (fieldGoalsMade * 2) + (threePointersMade * 3) + freeThrowsMade;

        return {
            points,
            fieldGoals: {
                made: fieldGoalsMade,
                attempted: fieldGoalsAttempted,
                percentage: fieldGoalsAttempted > 0
                    ? Math.round((fieldGoalsMade / fieldGoalsAttempted) * 100)
                    : 0,
            },
            threePointers: {
                made: threePointersMade,
                attempted: threePointersAttempted,
                percentage: threePointersAttempted > 0
                    ? Math.round((threePointersMade / threePointersAttempted) * 100)
                    : 0,
            },
            freeThrows: {
                made: freeThrowsMade,
                attempted: freeThrowsAttempted,
                percentage: freeThrowsAttempted > 0
                    ? Math.round((freeThrowsMade / freeThrowsAttempted) * 100)
                    : 0,
            },
            rebounds: {
                offensive: offensiveRebounds,
                defensive: defensiveRebounds,
                total: offensiveRebounds + defensiveRebounds,
            },
            assists,
            steals,
            blocks,
            turnovers,
            fouls,
        };
    }

    /**
     * Calculate Track & Field team statistics
     */
    private static calculateTrackStats(teamEvents: MatchEvent[]): TrackTeamStats {
        const finishEvents = teamEvents.filter(e => e.type === 'FINISH');

        let goldMedals = 0;
        let silverMedals = 0;
        let bronzeMedals = 0;

        finishEvents.forEach(event => {
            if (event.value) {
                const value = JSON.parse(event.value);
                if (value.position === 1) goldMedals++;
                else if (value.position === 2) silverMedals++;
                else if (value.position === 3) bronzeMedals++;
            }
        });

        const records = teamEvents.filter(e => e.type === 'RECORD_BROKEN').length;

        // Points system: Gold = 5, Silver = 3, Bronze = 1
        const totalPoints = (goldMedals * 5) + (silverMedals * 3) + (bronzeMedals * 1);

        return {
            goldMedals,
            silverMedals,
            bronzeMedals,
            totalPoints,
            records,
            participations: finishEvents.length,
        };
    }

    /**
     * Get default empty stats for a sport
     */
    private static getDefaultStats(sport: string): TeamStats {
        switch (sport.toLowerCase()) {
            case 'football':
                return {
                    possession: 0,
                    shots: 0,
                    shotsOnTarget: 0,
                    corners: 0,
                    fouls: 0,
                    yellowCards: 0,
                    redCards: 0,
                    saves: 0,
                    passAccuracy: 0,
                    tackles: 0,
                    interceptions: 0,
                    offsides: 0,
                };
            case 'basketball':
                return {
                    points: 0,
                    fieldGoals: { made: 0, attempted: 0, percentage: 0 },
                    threePointers: { made: 0, attempted: 0, percentage: 0 },
                    freeThrows: { made: 0, attempted: 0, percentage: 0 },
                    rebounds: { offensive: 0, defensive: 0, total: 0 },
                    assists: 0,
                    steals: 0,
                    blocks: 0,
                    turnovers: 0,
                    fouls: 0,
                };
            case 'track':
            case 'track & field':
                return {
                    goldMedals: 0,
                    silverMedals: 0,
                    bronzeMedals: 0,
                    totalPoints: 0,
                    records: 0,
                    participations: 0,
                };
            default:
                return {
                    possession: 0,
                    shots: 0,
                    shotsOnTarget: 0,
                    corners: 0,
                    fouls: 0,
                    yellowCards: 0,
                    redCards: 0,
                    saves: 0,
                    passAccuracy: 0,
                    tackles: 0,
                    interceptions: 0,
                    offsides: 0,
                };
        }
    }

    /**
     * Update team statistics with a new event
     */
    static updateStatsWithEvent(
        currentStats: TeamStats,
        event: MatchEvent,
        sport: string
    ): TeamStats {
        const stats = { ...currentStats };

        switch (sport.toLowerCase()) {
            case 'football':
                return this.updateFootballStats(stats as FootballTeamStats, event);
            case 'basketball':
                return this.updateBasketballStats(stats as BasketballTeamStats, event);
            case 'track':
            case 'track & field':
                return this.updateTrackStats(stats as TrackTeamStats, event);
            default:
                return stats;
        }
    }

    private static updateFootballStats(
        stats: FootballTeamStats,
        event: MatchEvent
    ): FootballTeamStats {
        const updated = { ...stats };

        switch (event.type) {
            case 'SHOT_ON_TARGET':
                updated.shots++;
                updated.shotsOnTarget++;
                break;
            case 'SHOT_OFF_TARGET':
                updated.shots++;
                break;
            case 'CORNER':
                updated.corners++;
                break;
            case 'FOUL':
                updated.fouls++;
                break;
            case 'YELLOW_CARD':
                updated.yellowCards++;
                break;
            case 'RED_CARD':
                updated.redCards++;
                break;
            case 'SAVE':
                updated.saves++;
                break;
            case 'TACKLE':
                updated.tackles++;
                break;
            case 'INTERCEPTION':
                updated.interceptions++;
                break;
            case 'OFFSIDE':
                updated.offsides++;
                break;
        }

        return updated;
    }

    private static updateBasketballStats(
        stats: BasketballTeamStats,
        event: MatchEvent
    ): BasketballTeamStats {
        const updated = { ...stats };

        switch (event.type) {
            case 'FIELD_GOAL':
                updated.fieldGoals.made++;
                updated.fieldGoals.attempted++;
                updated.points += 2;
                break;
            case 'FIELD_GOAL_MISS':
                updated.fieldGoals.attempted++;
                break;
            case 'THREE_POINTER':
                updated.threePointers.made++;
                updated.threePointers.attempted++;
                updated.points += 3;
                break;
            case 'THREE_POINTER_MISS':
                updated.threePointers.attempted++;
                break;
            case 'FREE_THROW':
                updated.freeThrows.made++;
                updated.freeThrows.attempted++;
                updated.points += 1;
                break;
            case 'FREE_THROW_MISS':
                updated.freeThrows.attempted++;
                break;
            case 'REBOUND':
                if (event.detail === 'offensive') {
                    updated.rebounds.offensive++;
                } else {
                    updated.rebounds.defensive++;
                }
                updated.rebounds.total++;
                break;
            case 'ASSIST':
                updated.assists++;
                break;
            case 'STEAL':
                updated.steals++;
                break;
            case 'BLOCK':
                updated.blocks++;
                break;
            case 'TURNOVER':
                updated.turnovers++;
                break;
            case 'FOUL':
                updated.fouls++;
                break;
        }

        // Recalculate percentages
        updated.fieldGoals.percentage = updated.fieldGoals.attempted > 0
            ? Math.round((updated.fieldGoals.made / updated.fieldGoals.attempted) * 100)
            : 0;
        updated.threePointers.percentage = updated.threePointers.attempted > 0
            ? Math.round((updated.threePointers.made / updated.threePointers.attempted) * 100)
            : 0;
        updated.freeThrows.percentage = updated.freeThrows.attempted > 0
            ? Math.round((updated.freeThrows.made / updated.freeThrows.attempted) * 100)
            : 0;

        return updated;
    }

    private static updateTrackStats(
        stats: TrackTeamStats,
        event: MatchEvent
    ): TrackTeamStats {
        const updated = { ...stats };

        if (event.type === 'FINISH' && event.value) {
            const value = JSON.parse(event.value);
            updated.participations++;

            if (value.position === 1) {
                updated.goldMedals++;
                updated.totalPoints += 5;
            } else if (value.position === 2) {
                updated.silverMedals++;
                updated.totalPoints += 3;
            } else if (value.position === 3) {
                updated.bronzeMedals++;
                updated.totalPoints += 1;
            }
        }

        if (event.type === 'RECORD_BROKEN') {
            updated.records++;
        }

        return updated;
    }
}
