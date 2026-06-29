/**
 * Match State Manager - Production Grade
 * Single source of truth for all match state
 * 
 * Key Features:
 * - Timestamp-based clock (no drift)
 * - Immutable event log with player snapshots
 * - State machine for match status
 * - Persistent state with validation
 * - Event-driven updates
 * 
 * @version 2.0.0
 */

import { Player } from '@/types';

// ========== TYPE DEFINITIONS ==========

export type MatchPeriod =
    | 'NOT_STARTED'
    | 'FIRST_HALF'
    | 'HALF_TIME'
    | 'SECOND_HALF'
    | 'EXTRA_TIME_1'
    | 'EXTRA_TIME_2'
    | 'PENALTY_SHOOTOUT'
    | 'FINISHED'
    | 'SUSPENDED'
    | 'ABANDONED';

export type FootballEventType =
    // Scoring
    | 'Goal' | 'Penalty' | 'Own Goal' | 'Assist'
    // Discipline
    | 'Yellow Card' | 'Red Card' | 'Foul' | 'Push' | 'Handball'
    // Defensive
    | 'Save' | 'Catch' | 'Block' | 'Interception' | 'Clearance' | 'Tackle'
    // Set Pieces
    | 'Corner' | 'Free Kick' | 'Throw In' | 'Goal Kick'
    // General
    | 'Shot' | 'Shot on Target' | 'Shot off Target' | 'Offside' | 'Substitution'
    // Penalty outcomes
    | 'Penalty Saved' | 'Penalty Missed';

export interface PlayerSnapshot {
    name: string;
    number: number;
    teamId: string;
}

export interface MatchEvent {
    id: string;
    matchId: string;
    type: FootballEventType;

    // Time reference (absolute for logic, display for UI)
    absoluteMinute: number;
    displayMinute: number;
    second: number;
    period: MatchPeriod;

    // Player reference (STABLE + SNAPSHOT)
    playerId: string | null;
    playerSnapshot: PlayerSnapshot | null;

    // Related player (assists, substitutions)
    relatedPlayerId: string | null;
    relatedPlayerSnapshot: PlayerSnapshot | null;

    // Metadata
    teamId: string;
    detail: string;
    value?: number;

    // Audit
    createdAt: Date;
    loggerId: string;
}

export interface MatchClock {
    absoluteMinute: number;  // Continuous: 0 → 120+
    displayMinute: number;   // Display: 0-45, 45-90, 90-105, etc.
    second: number;          // 0-59
    period: MatchPeriod;
    isRunning: boolean;

    // Timestamp-based tracking (prevents drift)
    lastTickTimestamp: number;
    startTimestamp: number | null;
    announcedStoppage: number | null; // e.g., 3, 5 (minutes)
    periodEndTriggered: boolean; // Prevents multiple period end triggers
}

export interface MatchScore {
    home: number;
    away: number;
}

export interface LineupEntry {
    playerId: string;
    position: string;
    rating: number;
    isCaptain?: boolean;
    isMotM?: boolean;
    isStarter?: boolean;
}

export interface MatchStats {
    // Shooting
    shots: [number, number];              // [home, away]
    shotsOnTarget: [number, number];
    shotsOffTarget: [number, number];

    // Scoring
    goals: [number, number];
    penalties: [number, number];
    ownGoals: [number, number];

    // Possession (calculated from events)
    possessionEvents: [number, number];   // Count of attacking events
    possession: [number, number]; // Calculated %

    // Football-specific stats
    expectedGoals: [number, number];

    // Passing & Attacking
    assists: [number, number];

    // Defensive
    saves: [number, number];
    catches: [number, number];
    blocks: [number, number];
    interceptions: [number, number];
    clearances: [number, number];
    tackles: [number, number];

    // Set Pieces
    corners: [number, number];
    freeKicks: [number, number];
    throwIns: [number, number];
    goalKicks: [number, number];

    // Discipline
    fouls: [number, number];
    yellowCards: [number, number];
    redCards: [number, number];

    // Other
    offsides: [number, number];
    substitutions: [number, number];
}

export interface MatchState {
    matchId: string;
    homeTeamId: string;
    awayTeamId: string;

    clock: MatchClock;
    score: MatchScore;
    events: MatchEvent[];

    teamRatings: {
        home: number;
        away: number;
    };

    stats: MatchStats;

    players: {
        home: Map<string, Player>;
        away: Map<string, Player>;
    };

    lineups: {
        home: LineupEntry[];
        away: LineupEntry[];
    };

    // Metadata
    halfDuration: number;  // Default 45 minutes
    version: number;       // For migration/validation
}

export type StateListener = (state: MatchState) => void;
export type EventListener = (event: MatchEvent) => void;

// ========== SINGLETON REGISTRY ==========

const managerRegistry = new Map<string, MatchStateManager>();

export function getMatchStateManager(matchId: string, initialState?: Partial<MatchState>): MatchStateManager {
    if (!managerRegistry.has(matchId)) {
        managerRegistry.set(matchId, new MatchStateManager(matchId, initialState));
    }
    return managerRegistry.get(matchId)!;
}

export function destroyMatchStateManager(matchId: string): void {
    const manager = managerRegistry.get(matchId);
    if (manager) {
        manager.destroy();
        managerRegistry.delete(matchId);
    }
}

// ========== CONSTANTS ==========

export const RATING_IMPACTS: Partial<Record<FootballEventType, number>> = {
    'Goal': 1.0,
    'Penalty': 0.8,
    'Assist': 0.5,
    'Own Goal': -1.5,
    'Yellow Card': -0.5,
    'Red Card': -2.0,
    'Save': 0.5,
    'Block': 0.2,
    'Interception': 0.2,
    'Tackle': 0.2,
    'Clearance': 0.1,
    'Catch': 0.2,
    'Shot on Target': 0.2,
    'Shot off Target': -0.1,
    'Shot': 0.1,
    'Corner': 0.2,
    'Foul': -0.1,
    'Offside': -0.1,
};

// ========== MATCH STATE MANAGER ==========

export class MatchStateManager {
    private state: MatchState;
    private listeners = new Set<StateListener>();
    private eventListeners = new Set<EventListener>();
    private timerId: NodeJS.Timeout | null = null;
    private destroyed = false;

    constructor(matchId: string, initialState?: Partial<MatchState>) {
        // Check if already exists (prevent duplicate managers)
        if (managerRegistry.has(matchId)) {
            throw new Error(`MatchStateManager already exists for match ${matchId}. Use getMatchStateManager() instead.`);
        }

        this.state = this.initializeState(matchId, initialState);
        this.updateDisplayMinute();

        // Resume clock if it was running
        if (this.state.clock.isRunning) {
            this.startClock();
        }
    }

    // ========== CLOCK MANAGEMENT (TIMESTAMP-BASED) ==========

    startClock(): void {
        if (this.timerId) return; // Already running
        if (this.destroyed) throw new Error('Cannot start clock on destroyed manager');

        const now = Date.now();
        this.state.clock.isRunning = true;
        this.state.clock.lastTickTimestamp = now;

        if (!this.state.clock.startTimestamp) {
            this.state.clock.startTimestamp = now;
        }

        // Tick every second
        this.timerId = setInterval(() => {
            this.tick();
        }, 1000);

        this.notifyListeners();
        this.persistState();
    }

    stopClock(): void {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }

        this.state.clock.isRunning = false;
        this.notifyListeners();
        this.persistState();
    }

    /**
     * Timestamp-based tick - prevents drift from setInterval inaccuracy
     */
    private tick(): void {
        const now = Date.now();
        const deltaMs = now - this.state.clock.lastTickTimestamp;
        const deltaSeconds = Math.floor(deltaMs / 1000);

        if (deltaSeconds <= 0) return; // No full second elapsed

        this.state.clock.lastTickTimestamp = now;

        const clock = this.state.clock;
        const totalSeconds = clock.second + deltaSeconds;

        // Update absolute minute and second
        const minutesElapsed = Math.floor(totalSeconds / 60);
        clock.absoluteMinute += minutesElapsed;
        clock.second = totalSeconds % 60;

        // Check for automatic period end
        this.checkPeriodEnd();

        // Update display minute based on period
        this.updateDisplayMinute();

        // Broadcast time update
        this.broadcastTimeUpdate();

        this.notifyListeners();
        this.persistState();
    }

    /**
     * Check if current period has reached its regulation end.
     */
    private checkPeriodEnd(): void {
        const { absoluteMinute, period, periodEndTriggered, announcedStoppage } = this.state.clock;
        const halfDuration = this.state.halfDuration;

        if (periodEndTriggered) return;

        let regulationTime = 0;
        let nextPeriod: MatchPeriod = 'HALF_TIME';

        switch (period) {
            case 'FIRST_HALF':
                regulationTime = halfDuration;
                nextPeriod = 'HALF_TIME';
                break;
            case 'SECOND_HALF':
                regulationTime = halfDuration * 2;
                nextPeriod = 'FINISHED';
                break;
            case 'EXTRA_TIME_1':
                regulationTime = halfDuration * 2 + 15;
                nextPeriod = 'EXTRA_TIME_2';
                break;
            case 'EXTRA_TIME_2':
                regulationTime = halfDuration * 2 + 30;
                nextPeriod = 'FINISHED';
                break;
            default:
                return;
        }

        // Trigger if regulation is reached and NO stoppage time set, 
        // OR if regulation + stoppage time reached.
        const targetTime = regulationTime + (announcedStoppage || 0);

        if (absoluteMinute >= targetTime) {
            this.state.clock.periodEndTriggered = true;
            this.broadcastPeriodEnd(period, nextPeriod);
        }
    }

    private updateDisplayMinute(): void {
        const { absoluteMinute, period, announcedStoppage } = this.state.clock;
        const halfDuration = this.state.halfDuration;

        switch (period) {
            case 'FIRST_HALF':
                this.state.clock.displayMinute = Math.min(absoluteMinute, halfDuration);
                break;
            case 'SECOND_HALF':
                this.state.clock.displayMinute = Math.min(absoluteMinute, halfDuration * 2);
                break;
            case 'EXTRA_TIME_1':
                this.state.clock.displayMinute = Math.min(absoluteMinute, halfDuration * 2 + 15);
                break;
            case 'EXTRA_TIME_2':
                this.state.clock.displayMinute = Math.min(absoluteMinute, halfDuration * 2 + 30);
                break;
            default:
                this.state.clock.displayMinute = absoluteMinute;
        }
    }

    /**
     * Manual time adjustment (for logger corrections)
     */
    setTime(minute: number, second: number = 0): void {
        this.state.clock.absoluteMinute = minute;
        this.state.clock.second = second;
        this.state.clock.lastTickTimestamp = Date.now();
        this.state.clock.periodEndTriggered = false; // Reset trigger if time adjusted back

        this.updateDisplayMinute();
        this.notifyListeners();
        this.persistState();
        this.broadcastTimeUpdate();
    }

    setAnnouncedStoppage(minutes: number): void {
        this.state.clock.announcedStoppage = minutes;
        this.state.clock.periodEndTriggered = false; // Reset so prompt shows again after stoppage
        this.notifyListeners();
        this.persistState();
        this.broadcastTimeUpdate();
    }

    // ========== STATUS MANAGEMENT (STATE MACHINE) ==========

    transitionStatus(to: MatchPeriod): void {
        const from = this.state.clock.period;

        // Validate transition
        if (!this.isValidTransition(from, to)) {
            throw new Error(`Invalid status transition: ${from} → ${to}`);
        }

        this.state.clock.period = to;
        // Reset period end trigger for new period
        this.state.clock.periodEndTriggered = false;

        // Handle period-specific logic
        switch (to) {
            case 'FIRST_HALF':
                this.state.clock.absoluteMinute = 0;
                this.state.clock.second = 0;
                this.state.clock.lastTickTimestamp = Date.now();
                this.startClock();
                break;

            case 'HALF_TIME':
                this.stopClock();
                break;

            case 'SECOND_HALF':
                // Continue from half duration (e.g., 45 minutes) exactly
                this.state.clock.absoluteMinute = this.state.halfDuration;
                this.state.clock.second = 0;
                this.state.clock.lastTickTimestamp = Date.now();
                this.startClock();
                break;

            case 'EXTRA_TIME_1':
                // Start extra time at 90 minutes (2x half, usually)
                this.state.clock.absoluteMinute = this.state.halfDuration * 2;
                this.state.clock.second = 0;
                this.state.clock.lastTickTimestamp = Date.now();
                this.startClock();
                break;

            case 'EXTRA_TIME_2':
                // Start extra time 2 at 105 minutes (2x half + 15)
                // Note: Standard FT is 15min per half of ET.
                this.state.clock.absoluteMinute = this.state.halfDuration * 2 + 15;
                this.state.clock.second = 0;
                this.state.clock.lastTickTimestamp = Date.now();
                this.startClock();
                break;

            case 'FINISHED':
            case 'ABANDONED':
                this.stopClock();
                break;
        }

        this.updateDisplayMinute();
        this.notifyListeners();
        this.persistState();
        this.broadcastStatusChange(from, to);
    }

    /**
     * Complete period transition after extra time has been set
     * Called by UI after user confirms extra time amount
     */
    completePeriodTransition(nextPeriod: MatchPeriod): void {
        // Reset announced stoppage for next period
        this.state.clock.announcedStoppage = null;

        // Transition to next period
        this.transitionStatus(nextPeriod);
    }

    private isValidTransition(from: MatchPeriod, to: MatchPeriod): boolean {
        const validTransitions: Record<MatchPeriod, MatchPeriod[]> = {
            'NOT_STARTED': ['FIRST_HALF'],
            'FIRST_HALF': ['HALF_TIME', 'SUSPENDED'],
            'HALF_TIME': ['SECOND_HALF'],
            'SECOND_HALF': ['FINISHED', 'EXTRA_TIME_1', 'SUSPENDED'],
            'EXTRA_TIME_1': ['EXTRA_TIME_2', 'FINISHED'],
            'EXTRA_TIME_2': ['PENALTY_SHOOTOUT', 'FINISHED'],
            'PENALTY_SHOOTOUT': ['FINISHED'],
            'FINISHED': ['EXTRA_TIME_1', 'PENALTY_SHOOTOUT'], // Allow knockout progression from FT
            'SUSPENDED': ['FIRST_HALF', 'SECOND_HALF', 'ABANDONED'],
            'ABANDONED': [],
        };

        return validTransitions[from]?.includes(to) ?? false;
    }

    /**
     * Lock actions by status (prevent goals during HT, etc.)
     */
    canRecordEvent(): boolean {
        const allowedPeriods: MatchPeriod[] = [
            'FIRST_HALF',
            'SECOND_HALF',
            'EXTRA_TIME_1',
            'EXTRA_TIME_2',
            'PENALTY_SHOOTOUT'
        ];
        return allowedPeriods.includes(this.state.clock.period);
    }

    // ========== EVENT MANAGEMENT ==========

    recordEvent(
        event: Omit<MatchEvent, 'id' | 'absoluteMinute' | 'displayMinute' | 'second' | 'period' | 'createdAt'>
    ): MatchEvent {
        if (!this.canRecordEvent()) {
            throw new Error(`Cannot record events during ${this.state.clock.period}`);
        }

        const { clock } = this.state;

        // Generate server-compatible ID (client-side temporary)
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create full event with current time context
        const fullEvent: MatchEvent = {
            ...event,
            id: tempId,
            absoluteMinute: clock.absoluteMinute,
            displayMinute: clock.displayMinute,
            second: clock.second,
            period: clock.period,
            createdAt: new Date(),
        };

        // Add to immutable event log
        this.state.events = [...this.state.events, fullEvent];

        // LOGIC: Second Yellow = Red
        if (event.type === 'Yellow Card' && event.playerId) {
            const previousYellows = this.state.events.filter(e =>
                e.playerId === event.playerId &&
                e.type === 'Yellow Card' &&
                e.id !== tempId
            );

            if (previousYellows.length >= 1) {
                // Technically 1 previous yellow means this is the 2nd.
                // We'll record an automatic Red Card with a small "id" and "timestamp" offset
                // but for now just pushing it is fine as it's sequential.
                const redEvent = this.recordEvent({
                    matchId: fullEvent.matchId,
                    type: 'Red Card',
                    teamId: fullEvent.teamId,
                    playerId: fullEvent.playerId,
                    playerSnapshot: fullEvent.playerSnapshot,
                    relatedPlayerId: null,
                    relatedPlayerSnapshot: null,
                    detail: `Red Card (Second Yellow)`,
                    loggerId: fullEvent.loggerId
                });
            }
        }

        // Update score if scoring event
        this.updateScoreFromEvent(fullEvent);

        // Update player ratings
        this.applyEventRatingImpact(fullEvent, 1);

        // Update match statistics
        this.calculateMatchStats();

        this.notifyListeners();
        this.notifyEventListeners(fullEvent);
        this.persistState();
        this.broadcastEvent(fullEvent);

        return fullEvent;
    }

    private updateScoreFromEvent(event: MatchEvent): void {
        const isScoringEvent = ['Goal', 'Penalty'].includes(event.type);

        if (isScoringEvent) {
            if (event.teamId === this.state.homeTeamId) {
                this.state.score.home++;
            } else {
                this.state.score.away++;
            }
        } else if (event.type === 'Own Goal') {
            // Own goal scores for opponent
            if (event.teamId === this.state.homeTeamId) {
                this.state.score.away++;
            } else {
                this.state.score.home++;
            }
        }
    }

    private applyEventRatingImpact(event: MatchEvent, multiplier: number): void {
        const impact = RATING_IMPACTS[event.type];
        if (!impact) return;

        const ratingChange = impact * multiplier;

        if (event.playerId) {
            this.updatePlayerRating(event.playerId, event.teamId, ratingChange);
        }
    }

    private updatePlayerRating(playerId: string, teamId: string, delta: number): void {
        // Try to find player in home lineup
        let playerEntry = this.state.lineups.home.find(p => p.playerId === playerId);

        // If not found, try away lineup
        if (!playerEntry) {
            playerEntry = this.state.lineups.away.find(p => p.playerId === playerId);
        }

        if (playerEntry) {
            // Initialize rating if it creates the entry (though finding it implies it exists)
            // Ensure rating stays within realistic bounds (e.g., 1.0 to 10.0)
            const currentRating = playerEntry.rating || 6.0; // Default logical base if 0/undefined
            const newRating = Math.max(1.0, Math.min(10.0, currentRating + delta));
            playerEntry.rating = Number(newRating.toFixed(1)); // Keep it clean

            // Recalculate team OVR
            this.calculateTeamRatings();
        }
    }

    /**
     * Update event ID after server confirmation
     */
    confirmEvent(tempId: string, serverId: string): void {
        const eventIndex = this.state.events.findIndex(e => e.id === tempId);
        if (eventIndex !== -1) {
            this.state.events = [
                ...this.state.events.slice(0, eventIndex),
                { ...this.state.events[eventIndex], id: serverId },
                ...this.state.events.slice(eventIndex + 1)
            ];
            this.notifyListeners();
            this.persistState();
        }
    }

    undoLastEvent(): MatchEvent | null {
        if (this.state.events.length === 0) return null;

        const lastEvent = this.state.events[this.state.events.length - 1];

        // Revert score
        if (['Goal', 'Penalty'].includes(lastEvent.type)) {
            if (lastEvent.teamId === this.state.homeTeamId) {
                this.state.score.home = Math.max(0, this.state.score.home - 1);
            } else {
                this.state.score.away = Math.max(0, this.state.score.away - 1);
            }
        } else if (lastEvent.type === 'Own Goal') {
            if (lastEvent.teamId === this.state.homeTeamId) {
                this.state.score.away = Math.max(0, this.state.score.away - 1);
            } else {
                this.state.score.home = Math.max(0, this.state.score.home - 1);
            }
        }

        // Revert ratings
        this.applyEventRatingImpact(lastEvent, -1);

        // Remove event
        this.state.events = this.state.events.slice(0, -1);

        // Recalculate stats
        this.calculateMatchStats();

        this.notifyListeners();
        this.persistState();
        this.broadcastUndo(lastEvent);

        return lastEvent;
    }

    updateConfig(config: Partial<{ halfDuration: number }>): void {
        if (config.halfDuration !== undefined) {
            this.state.halfDuration = config.halfDuration;
        }

        // After updating config, we should refresh the clock state (display minutes)
        this.updateDisplayMinute();

        this.notifyListeners();
        this.persistState();
    }

    // ========== PLAYER MANAGEMENT ==========

    registerPlayer(player: Player, team: 'home' | 'away'): void {
        const playerMap = team === 'home' ? this.state.players.home : this.state.players.away;
        playerMap.set(player.id, player);
        this.notifyListeners();
        this.persistState();
    }

    registerPlayers(players: Player[], team: 'home' | 'away'): void {
        const playerMap = team === 'home' ? this.state.players.home : this.state.players.away;
        players.forEach(player => playerMap.set(player.id, player));
        this.notifyListeners();
        this.persistState();
    }

    getPlayer(playerId: string): Player | null {
        return this.state.players.home.get(playerId)
            || this.state.players.away.get(playerId)
            || null;
    }

    createPlayerSnapshot(playerId: string): PlayerSnapshot | null {
        const player = this.getPlayer(playerId);
        if (!player) return null;

        return {
            name: player.name,
            number: player.number,
            teamId: player.teamId,
        };
    }

    // ========== SYNC MANAGEMENT ==========

    /**
     * Merge events from external source (multi-logger sync)
     */
    mergeExternalEvents(externalEvents: MatchEvent[]): void {
        let hasChanges = false;
        // Create a map of existing events for easier lookup
        // We handle temp IDs by checking if the external event matches a temp event's properties roughly?
        // Ideally, if we have a temp ID and server sends back a real ID, we should have confirmed it already.
        // But if we missed confirmation, we might duplicate.
        // For now, assume IDs are authoritative.
        const currentIds = new Set(this.state.events.map(e => e.id));
        const newEvents: MatchEvent[] = [];

        for (const extEvent of externalEvents) {
            if (!currentIds.has(extEvent.id)) {
                newEvents.push(extEvent);
                hasChanges = true;
            }
        }

        if (hasChanges) {
            // Add new events
            this.state.events = [...this.state.events, ...newEvents];

            // Sort by time (primary: minute, secondary: second, tertiary: timestamp)
            this.state.events.sort((a, b) => {
                if (a.absoluteMinute !== b.absoluteMinute) return a.absoluteMinute - b.absoluteMinute;
                if (a.second !== b.second) return a.second - b.second;
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            });

            // Re-calculate derived state to ensure consistency
            this.recalculateState();

            this.notifyListeners();
            this.persistState();
        }
    }

    private recalculateState(): void {
        // Reset score
        this.state.score = { home: 0, away: 0 };

        // Reset ratings
        // First reset all player ratings to base (if we track them individually in state.players?)
        // Currently updatePlayerRating modifies lineup entries.
        // We should reset lineup ratings to default/initial.
        // This is complex if we don't have initial ratings stored separately. 
        // As a fallback, we just re-run score logic and re-apply rating deltas. 
        // Note: This assumes lineup ratings were 6.0 adjusted by events only.

        // Reset Lineup Ratings
        const resetLineup = (lineup: LineupEntry[]) => {
            lineup.forEach(p => p.rating = 6.0); // Reset to base
        };
        resetLineup(this.state.lineups.home);
        resetLineup(this.state.lineups.away);

        // Replay all events
        this.state.events.forEach(e => {
            this.updateScoreFromEvent(e);
            this.applyEventRatingImpact(e, 1);
        });

        // Update Team Ratings
        this.calculateTeamRatings();
    }

    // ========== PERSISTENCE (HARDENED) ==========

    private persistState(): void {
        if (typeof window === 'undefined') return;

        try {
            const serialized = {
                ...this.state,
                players: {
                    home: Array.from(this.state.players.home.entries()),
                    away: Array.from(this.state.players.away.entries()),
                },
                version: this.state.version,
            };

            localStorage.setItem(
                `match_state_${this.state.matchId}`,
                JSON.stringify(serialized)
            );
        } catch (error) {
            console.error('Failed to persist match state:', error);
        }
    }

    private loadState(matchId: string): Partial<MatchState> | null {
        if (typeof window === 'undefined') return null;

        try {
            const saved = localStorage.getItem(`match_state_${matchId}`);
            if (!saved) return null;

            const parsed = JSON.parse(saved);

            // Validate version
            if (parsed.version !== 1) {
                console.warn('Match state version mismatch, resetting');
                return null;
            }

            // Defensive rehydration
            return {
                ...parsed,
                players: {
                    home: parsed.players?.home ? new Map(parsed.players.home) : new Map(),
                    away: parsed.players?.away ? new Map(parsed.players.away) : new Map(),
                },
                events: Array.isArray(parsed.events) ? parsed.events : [],
                clock: {
                    ...parsed.clock,
                }
            };
        } catch (error) {
            console.error('Failed to load match state:', error);
            return null;
        }
    }

    clearPersistedState(): void {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(`match_state_${this.state.matchId}`);
    }



    // ========== BROADCASTING ==========

    private broadcastEvent(event: MatchEvent): void {
        if (typeof window === 'undefined') return;

        const payload = {
            matchId: this.state.matchId,
            event,
            score: this.state.score,
            clock: this.state.clock,
        };

        // Standard event
        window.dispatchEvent(new CustomEvent('MATCH_EVENT', { detail: payload }));

        // Legacy/Overlay compatibility event
        window.dispatchEvent(new CustomEvent('FOOTBALL_EVENT', {
            detail: {
                matchId: this.state.matchId,
                event,
                homeScore: this.state.score.home,
                awayScore: this.state.score.away,
                status: this.state.clock.period,
            }
        }));

        // Trigger notification
        this.triggerNotification(event);
    }

    private broadcastUndo(event: MatchEvent): void {
        if (typeof window === 'undefined') return;

        // Broadcast undo specifically
        window.dispatchEvent(new CustomEvent('MATCH_EVENT_UNDO', {
            detail: {
                matchId: this.state.matchId,
                eventId: event.id,
                score: this.state.score,
                teamRatings: this.state.teamRatings
            }
        }));

        window.dispatchEvent(new CustomEvent('FOOTBALL_EVENT_UNDO', {
            detail: {
                matchId: this.state.matchId,
                eventId: event.id,
                score: this.state.score.home
            }
        }));
    }

    private broadcastTimeUpdate(): void {
        if (typeof window === 'undefined') return;

        window.dispatchEvent(new CustomEvent('MATCH_TIME_UPDATE', {
            detail: {
                matchId: this.state.matchId,
                clock: this.state.clock,
            }
        }));
    }

    private broadcastStatusChange(from: MatchPeriod, to: MatchPeriod): void {
        if (typeof window === 'undefined') return;

        window.dispatchEvent(new CustomEvent('MATCH_STATUS_CHANGE', {
            detail: {
                matchId: this.state.matchId,
                from,
                to,
                clock: this.state.clock,
            }
        }));
    }

    private broadcastPeriodEnd(currentPeriod: MatchPeriod, nextPeriod: MatchPeriod): void {
        if (typeof window === 'undefined') return;

        window.dispatchEvent(new CustomEvent('MATCH_PERIOD_END', {
            detail: {
                matchId: this.state.matchId,
                currentPeriod,
                nextPeriod,
                clock: this.state.clock,
                requiresExtraTime: currentPeriod === 'FIRST_HALF' || currentPeriod === 'SECOND_HALF',
            }
        }));
    }

    private triggerNotification(event: MatchEvent): void {
        const notifiableEvents: FootballEventType[] = ['Goal', 'Penalty', 'Penalty Saved', 'Penalty Missed', 'Red Card'];
        console.log('[MatchStateManager] triggerNotification called for:', event.type, 'Notifiable:', notifiableEvents.includes(event.type));
        if (!notifiableEvents.includes(event.type)) return;

        console.log('[MatchStateManager] Dispatching MATCH_NOTIFICATION_TRIGGER:', { matchId: this.state.matchId, eventType: event.type });
        window.dispatchEvent(new CustomEvent('MATCH_NOTIFICATION_TRIGGER', {
            detail: {
                matchId: this.state.matchId,
                event,
                score: this.state.score,
            }
        }));
    }

    private calculateTeamRatings(): void {
        const calculateAvg = (lineup: LineupEntry[]) => {
            const starters = lineup.filter(p => !p.isStarter === false); // Default to starter if undefined? Assume lineup contains active players + subs marked
            // Actually usually lineup contains everyone. We should filter by people on pitch if possible, or just all rated players
            // For OVR, usually it's the 11 on the pitch.
            // Let's assume all entries without isStarter=false are starters
            const active = starters.length > 0 ? starters : lineup;
            if (active.length === 0) return 0;

            const total = active.reduce((sum, p) => sum + (p.rating || 6.0), 0);
            return Number((total / active.length).toFixed(1));
        };

        this.state.teamRatings.home = calculateAvg(this.state.lineups.home);
        this.state.teamRatings.away = calculateAvg(this.state.lineups.away);

        // Broadcast ratings update
        this.broadcastRatingsUpdate();
    }

    private broadcastRatingsUpdate(): void {
        if (typeof window === 'undefined') return;

        window.dispatchEvent(new CustomEvent('MATCH_RATINGS_UPDATE', {
            detail: {
                matchId: this.state.matchId,
                teamRatings: this.state.teamRatings,
                lineups: this.state.lineups
            }
        }));
    }

    // ========== STATS CALCULATION ==========

    private calculateMatchStats(): void {
        // Reset stats
        const stats: MatchStats = {
            shots: [0, 0],
            shotsOnTarget: [0, 0],
            shotsOffTarget: [0, 0],
            goals: [0, 0],
            penalties: [0, 0],
            ownGoals: [0, 0],
            possessionEvents: [0, 0],
            possession: [50, 50],
            expectedGoals: [0, 0],
            assists: [0, 0],
            saves: [0, 0],
            catches: [0, 0],
            blocks: [0, 0],
            interceptions: [0, 0],
            clearances: [0, 0],
            tackles: [0, 0],
            corners: [0, 0],
            freeKicks: [0, 0],
            throwIns: [0, 0],
            goalKicks: [0, 0],
            fouls: [0, 0],
            yellowCards: [0, 0],
            redCards: [0, 0],
            offsides: [0, 0],
            substitutions: [0, 0],
        };

        // Process all events
        this.state.events.forEach(event => {
            const teamIndex = event.teamId === this.state.homeTeamId ? 0 : 1;

            switch (event.type) {
                // Shooting
                case 'Shot':
                    stats.shots[teamIndex]++;
                    stats.possessionEvents[teamIndex]++;
                    break;
                case 'Shot on Target':
                    stats.shots[teamIndex]++;
                    stats.shotsOnTarget[teamIndex]++;
                    stats.possessionEvents[teamIndex]++;
                    break;
                case 'Shot off Target':
                    stats.shots[teamIndex]++;
                    stats.shotsOffTarget[teamIndex]++;
                    stats.possessionEvents[teamIndex]++;
                    break;

                // Scoring
                case 'Goal':
                    stats.goals[teamIndex]++;
                    stats.shots[teamIndex]++;
                    stats.shotsOnTarget[teamIndex]++;
                    stats.possessionEvents[teamIndex]++;
                    break;
                case 'Penalty':
                    stats.penalties[teamIndex]++;
                    stats.goals[teamIndex]++;
                    stats.shots[teamIndex]++;
                    stats.shotsOnTarget[teamIndex]++;
                    stats.possessionEvents[teamIndex]++;
                    break;
                case 'Penalty Saved':
                    stats.penalties[teamIndex]++;
                    stats.shots[teamIndex]++;
                    stats.shotsOnTarget[teamIndex]++;
                    stats.saves[1 - teamIndex]++; // Give save to opponent
                    break;
                case 'Penalty Missed':
                    stats.penalties[teamIndex]++;
                    stats.shots[teamIndex]++;
                    stats.shotsOffTarget[teamIndex]++;
                    break;
                case 'Own Goal':
                    stats.ownGoals[teamIndex]++;
                    break;
                case 'Assist':
                    stats.assists[teamIndex]++;
                    break;

                // Defensive
                case 'Save':
                    stats.saves[teamIndex]++;
                    break;
                case 'Catch':
                    stats.catches[teamIndex]++;
                    break;
                case 'Block':
                    stats.blocks[teamIndex]++;
                    break;
                case 'Interception':
                    stats.interceptions[teamIndex]++;
                    stats.possessionEvents[teamIndex]++;
                    break;
                case 'Clearance':
                    stats.clearances[teamIndex]++;
                    break;
                case 'Tackle':
                    stats.tackles[teamIndex]++;
                    stats.possessionEvents[teamIndex]++;
                    break;

                // Set Pieces
                case 'Corner':
                    stats.corners[teamIndex]++;
                    stats.possessionEvents[teamIndex]++;
                    break;
                case 'Free Kick':
                    stats.freeKicks[teamIndex]++;
                    stats.possessionEvents[teamIndex]++;
                    break;
                case 'Throw In':
                    stats.throwIns[teamIndex]++;
                    stats.possessionEvents[teamIndex]++;
                    break;
                case 'Goal Kick':
                    stats.goalKicks[teamIndex]++;
                    stats.possessionEvents[teamIndex]++;
                    break;

                // Discipline
                case 'Foul':
                    stats.fouls[teamIndex]++;
                    break;
                case 'Yellow Card':
                    stats.yellowCards[teamIndex]++;
                    break;
                case 'Red Card':
                    stats.redCards[teamIndex]++;
                    break;

                // Other
                case 'Offside':
                    stats.offsides[teamIndex]++;
                    break;
                case 'Substitution':
                    stats.substitutions[teamIndex]++;
                    break;
            }
        });

        // Calculate possession percentage
        const totalPossessionEvents = stats.possessionEvents[0] + stats.possessionEvents[1];
        if (totalPossessionEvents > 0) {
            stats.possession[0] = Math.round((stats.possessionEvents[0] / totalPossessionEvents) * 100);
            stats.possession[1] = 100 - stats.possession[0];
        }

        // Rough Expected Goals (xG) calculation
        // Goals are 0.8, Penalties 0.75, shots on target 0.3, shots off target 0.05
        stats.expectedGoals[0] = Number((
            stats.goals[0] * 0.15 + // Subtract some because goals are already in shots
            stats.penalties[0] * 0.75 +
            stats.shotsOnTarget[0] * 0.3 +
            stats.shotsOffTarget[0] * 0.05
        ).toFixed(2));
        stats.expectedGoals[1] = Number((
            stats.goals[1] * 0.15 +
            stats.penalties[1] * 0.75 +
            stats.shotsOnTarget[1] * 0.3 +
            stats.shotsOffTarget[1] * 0.05
        ).toFixed(2));

        this.state.stats = stats;
        this.broadcastStatsUpdate();
    }

    private broadcastStatsUpdate(): void {
        if (typeof window === 'undefined') return;

        window.dispatchEvent(new CustomEvent('MATCH_STATS_UPDATE', {
            detail: {
                matchId: this.state.matchId,
                stats: this.state.stats
            }
        }));
    }

    // ========== GETTERS ==========

    getState(): Readonly<MatchState> {
        return this.state;
    }

    getFormattedTime(): string {
        const { absoluteMinute, second } = this.state.clock;
        const secStr = second < 10 ? `0${second}` : `${second}`;

        // Continuous clock like the Premier League: just keeps counting up
        // e.g., 38:22, 47:05, 93:11
        return `${absoluteMinute}:${secStr}`;
    }

    /**
     * Get how many minutes of added time have actually elapsed
     * beyond regulation for the current period.
     * e.g., if halfDuration=35 and absoluteMinute=38, returns 3
     */
    getElapsedAddedTime(): number {
        const { absoluteMinute, period } = this.state.clock;
        const halfDuration = this.state.halfDuration;

        switch (period) {
            case 'FIRST_HALF':
                return Math.max(0, absoluteMinute - halfDuration);
            case 'SECOND_HALF':
                return Math.max(0, absoluteMinute - (halfDuration * 2));
            case 'EXTRA_TIME_1':
                return Math.max(0, absoluteMinute - (halfDuration * 2 + 15));
            case 'EXTRA_TIME_2':
                return Math.max(0, absoluteMinute - (halfDuration * 2 + 30));
            default:
                return 0;
        }
    }

    /**
     * Get the announced stoppage time (the board the 4th official holds up).
     * Returns null if not yet announced.
     */
    getAnnouncedStoppage(): number | null {
        return this.state.clock.announcedStoppage;
    }

    /**
     * Check whether we're currently in added time for the current period.
     */
    isInAddedTime(): boolean {
        return this.getElapsedAddedTime() > 0;
    }

    isLive(): boolean {
        const livePeriods: MatchPeriod[] = [
            'FIRST_HALF',
            'SECOND_HALF',
            'EXTRA_TIME_1',
            'EXTRA_TIME_2',
            'PENALTY_SHOOTOUT'
        ];
        return livePeriods.includes(this.state.clock.period);
    }

    // ========== INITIALIZATION ==========

    private initializeState(matchId: string, initial?: Partial<MatchState>): MatchState {
        const saved = this.loadState(matchId);
        const now = Date.now();

        const baseClock = {
            absoluteMinute: 0,
            displayMinute: 0,
            second: 0,
            period: 'NOT_STARTED' as const,
            isRunning: false,
            startTimestamp: null,
            ...saved?.clock,
            ...initial?.clock,
            announcedStoppage: null,
            periodEndTriggered: false,
        };

        // Handle catch-up if clock was running
        if (baseClock.isRunning && saved?.clock?.lastTickTimestamp) {
            const elapsedMs = now - saved.clock.lastTickTimestamp;
            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            if (elapsedSeconds > 0) {
                const totalSeconds = baseClock.second + elapsedSeconds;
                baseClock.absoluteMinute += Math.floor(totalSeconds / 60);
                baseClock.second = totalSeconds % 60;
                // Note: displayMinute will be refreshed in the manager logic
            }
        }

        return {
            matchId,
            homeTeamId: initial?.homeTeamId || saved?.homeTeamId || '',
            awayTeamId: initial?.awayTeamId || saved?.awayTeamId || '',

            clock: {
                ...baseClock,
                lastTickTimestamp: now, // Resume from exactly now
            },

            score: {
                home: 0,
                away: 0,
                ...initial?.score,
                ...saved?.score,
            },

            teamRatings: {
                home: 6.0,
                away: 6.0,
                ...initial?.teamRatings,
                ...saved?.teamRatings
            },

            stats: saved?.stats || initial?.stats || {
                shots: [0, 0],
                shotsOnTarget: [0, 0],
                shotsOffTarget: [0, 0],
                goals: [0, 0],
                penalties: [0, 0],
                ownGoals: [0, 0],
                possessionEvents: [0, 0],
                possession: [50, 50],
                expectedGoals: [0, 0],
                assists: [0, 0],
                saves: [0, 0],
                catches: [0, 0],
                blocks: [0, 0],
                interceptions: [0, 0],
                clearances: [0, 0],
                tackles: [0, 0],
                corners: [0, 0],
                freeKicks: [0, 0],
                throwIns: [0, 0],
                goalKicks: [0, 0],
                fouls: [0, 0],
                yellowCards: [0, 0],
                redCards: [0, 0],
                offsides: [0, 0],
                substitutions: [0, 0],
            },

            events: saved?.events || initial?.events || [],

            players: {
                home: saved?.players?.home || initial?.players?.home || new Map(),
                away: saved?.players?.away || initial?.players?.away || new Map(),
            },

            lineups: saved?.lineups || initial?.lineups || { home: [], away: [] },

            halfDuration: saved?.halfDuration || initial?.halfDuration || 45,
            version: 1,
        };
    }

    // ========== CLEANUP ==========

    destroy(): void {
        this.stopClock();
        this.listeners.clear();
        this.eventListeners.clear();
        this.destroyed = true;
    }

    // ========== SUBSCRIPTION & NOTIFICATION ==========

    subscribe(listener: StateListener): () => void {
        this.listeners.add(listener);
        listener(this.state); // Immediate sync
        return () => this.listeners.delete(listener);
    }

    subscribeToEvents(listener: EventListener): () => void {
        this.eventListeners.add(listener);
        return () => this.eventListeners.delete(listener);
    }

    unsubscribe(listener: StateListener): void {
        this.listeners.delete(listener);
    }

    unsubscribeFromEvents(listener: EventListener): void {
        this.eventListeners.delete(listener);
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => {
            try {
                listener(this.state);
            } catch (error) {
                console.error('State listener error:', error);
            }
        });
    }

    private notifyEventListeners(event: MatchEvent): void {
        this.eventListeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('Event listener error:', error);
            }
        });
    }
}
