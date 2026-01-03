/**
 * Multi-Logger Support System
 * Handles real-time synchronization and conflict resolution for multiple loggers
 */

export interface LoggerSession {
    loggerId: string;
    loggerName: string;
    matchId: string;
    joinedAt: Date;
    lastActivity: Date;
    isActive: boolean;
}

export interface SyncEvent {
    id: string;
    type: string;
    minute: number;
    second: number;
    teamId: string;
    playerId?: string;
    relatedPlayerId?: string;
    detail: string;
    value?: any;
    loggerId: string;
    loggerName: string;
    timestamp: Date;
    synced: boolean;
}

export interface EventConflict {
    id: string;
    event1: SyncEvent;
    event2: SyncEvent;
    conflictType: 'duplicate' | 'contradictory' | 'timing';
    severity: 'low' | 'medium' | 'high';
    resolved: boolean;
    resolution?: 'keep-both' | 'keep-first' | 'keep-second' | 'merge';
}

/**
 * Detect conflicts between events from different loggers
 */
export function detectConflicts(events: SyncEvent[]): EventConflict[] {
    const conflicts: EventConflict[] = [];

    // Group events by time window (within 5 seconds)
    const timeWindows: Map<string, SyncEvent[]> = new Map();

    events.forEach(event => {
        const windowKey = `${event.minute}-${Math.floor(event.second / 5)}`;
        if (!timeWindows.has(windowKey)) {
            timeWindows.set(windowKey, []);
        }
        timeWindows.get(windowKey)!.push(event);
    });

    // Check each time window for conflicts
    timeWindows.forEach((windowEvents) => {
        if (windowEvents.length < 2) return;

        for (let i = 0; i < windowEvents.length; i++) {
            for (let j = i + 1; j < windowEvents.length; j++) {
                const e1 = windowEvents[i];
                const e2 = windowEvents[j];

                // Skip if same logger
                if (e1.loggerId === e2.loggerId) continue;

                // Check for duplicate events (same type, player, time)
                if (
                    e1.type === e2.type &&
                    e1.playerId === e2.playerId &&
                    Math.abs(e1.second - e2.second) <= 3
                ) {
                    conflicts.push({
                        id: `conflict-${e1.id}-${e2.id}`,
                        event1: e1,
                        event2: e2,
                        conflictType: 'duplicate',
                        severity: 'medium',
                        resolved: false,
                    });
                }

                // Check for contradictory events (e.g., goal vs save at same time)
                if (isContradictory(e1, e2)) {
                    conflicts.push({
                        id: `conflict-${e1.id}-${e2.id}`,
                        event1: e1,
                        event2: e2,
                        conflictType: 'contradictory',
                        severity: 'high',
                        resolved: false,
                    });
                }
            }
        }
    });

    return conflicts;
}

/**
 * Check if two events are contradictory
 */
function isContradictory(e1: SyncEvent, e2: SyncEvent): boolean {
    const contradictions: Record<string, string[]> = {
        'Goal': ['Save', 'Shot off Target'],
        'Save': ['Goal'],
        'Shot on Target': ['Shot off Target'],
        'Yellow Card': ['Red Card'], // Can't get both at exact same time
    };

    return contradictions[e1.type]?.includes(e2.type) ||
        contradictions[e2.type]?.includes(e1.type) ||
        false;
}

/**
 * Merge events from multiple loggers
 */
export function mergeEvents(
    localEvents: SyncEvent[],
    remoteEvents: SyncEvent[]
): { merged: SyncEvent[]; conflicts: EventConflict[] } {
    const allEvents = [...localEvents, ...remoteEvents];

    // Remove exact duplicates (same ID)
    const uniqueEvents = Array.from(
        new Map(allEvents.map(e => [e.id, e])).values()
    );

    // Sort by timestamp
    const sorted = uniqueEvents.sort((a, b) => {
        if (a.minute !== b.minute) return a.minute - b.minute;
        if (a.second !== b.second) return a.second - b.second;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    // Detect conflicts
    const conflicts = detectConflicts(sorted);

    return { merged: sorted, conflicts };
}

/**
 * Calculate logger activity score (for auto-resolution)
 */
export function getLoggerReliability(
    loggerId: string,
    events: SyncEvent[]
): number {
    const loggerEvents = events.filter(e => e.loggerId === loggerId);

    // Factors: event count, recency, sync success rate
    const eventCount = loggerEvents.length;
    const syncedCount = loggerEvents.filter(e => e.synced).length;
    const syncRate = eventCount > 0 ? syncedCount / eventCount : 0;

    return syncRate * 0.7 + Math.min(eventCount / 100, 1) * 0.3;
}

/**
 * Auto-resolve conflicts based on logger reliability
 */
export function autoResolveConflicts(
    conflicts: EventConflict[],
    events: SyncEvent[]
): EventConflict[] {
    return conflicts.map(conflict => {
        if (conflict.resolved) return conflict;

        const reliability1 = getLoggerReliability(conflict.event1.loggerId, events);
        const reliability2 = getLoggerReliability(conflict.event2.loggerId, events);

        // For duplicates, keep the one from more reliable logger
        if (conflict.conflictType === 'duplicate') {
            return {
                ...conflict,
                resolved: true,
                resolution: reliability1 >= reliability2 ? 'keep-first' : 'keep-second',
            };
        }

        // For contradictory events, require manual resolution
        if (conflict.conflictType === 'contradictory') {
            return conflict; // Keep unresolved for manual review
        }

        return conflict;
    });
}

/**
 * Generate logger session ID
 */
export function generateSessionId(loggerId: string, matchId: string): string {
    return `${loggerId}-${matchId}-${Date.now()}`;
}

/**
 * Check if logger session is still active (last activity within 2 minutes)
 */
export function isSessionActive(session: LoggerSession): boolean {
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    const diffMinutes = (now.getTime() - lastActivity.getTime()) / 1000 / 60;
    return diffMinutes < 2;
}
