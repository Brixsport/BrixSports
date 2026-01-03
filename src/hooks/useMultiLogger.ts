/**
 * useMultiLogger Hook
 * Manages multi-logger sessions, real-time sync, and conflict resolution
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncEvent, EventConflict, mergeEvents, detectConflicts } from '@/lib/multiLogger';

interface UseMultiLoggerProps {
    matchId: string;
    loggerId: string;
    loggerName: string;
    enabled?: boolean;
}

interface LoggerInfo {
    loggerId: string;
    loggerName: string;
    joinedAt: Date;
    lastActivity: Date;
}

export function useMultiLogger({
    matchId,
    loggerId,
    loggerName,
    enabled = true,
}: UseMultiLoggerProps) {
    const [activeLoggers, setActiveLoggers] = useState<LoggerInfo[]>([]);
    const [conflicts, setConflicts] = useState<EventConflict[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');

    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
    const pollInterval = useRef<NodeJS.Timeout | null>(null);

    /**
     * Join the match as a logger
     */
    const joinMatch = useCallback(async () => {
        if (!enabled) return;

        try {
            const response = await fetch(`/api/matches/${matchId}/loggers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loggerId }),
            });

            if (response.ok) {
                const data = await response.json();
                setActiveLoggers(data.otherLoggers || []);
                setIsConnected(true);
                console.log(`✅ Joined match ${matchId} as logger ${loggerName}`);
                console.log(`👥 ${data.activeLoggers} logger(s) active`);
            }
        } catch (error) {
            console.error('Failed to join match:', error);
            setIsConnected(false);
        }
    }, [matchId, loggerId, loggerName, enabled]);

    /**
     * Leave the match
     */
    const leaveMatch = useCallback(async () => {
        try {
            await fetch(`/api/matches/${matchId}/loggers?loggerId=${loggerId}`, {
                method: 'DELETE',
            });
            setIsConnected(false);
            console.log(`👋 Left match ${matchId}`);
        } catch (error) {
            console.error('Failed to leave match:', error);
        }
    }, [matchId, loggerId]);

    /**
     * Send heartbeat to keep session alive
     */
    const sendHeartbeat = useCallback(async () => {
        if (!isConnected) return;

        try {
            await fetch(`/api/matches/${matchId}/loggers`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loggerId }),
            });
        } catch (error) {
            console.error('Heartbeat failed:', error);
        }
    }, [matchId, loggerId, isConnected]);

    /**
     * Poll for other loggers' activity
     */
    const pollActiveLoggers = useCallback(async () => {
        if (!isConnected) return;

        try {
            const response = await fetch(`/api/matches/${matchId}/loggers`);
            if (response.ok) {
                const data = await response.json();
                setActiveLoggers(
                    data.loggers.filter((l: LoggerInfo) => l.loggerId !== loggerId)
                );
            }
        } catch (error) {
            console.error('Failed to poll active loggers:', error);
        }
    }, [matchId, loggerId, isConnected]);

    /**
     * Sync events with other loggers
     */
    const syncEvents = useCallback(async (localEvents: SyncEvent[]) => {
        if (!isConnected) return localEvents;

        setSyncStatus('syncing');

        try {
            // Fetch all events from database
            const response = await fetch(`/api/matches/${matchId}/events`);
            if (!response.ok) {
                setSyncStatus('error');
                return localEvents;
            }

            const data = await response.json();
            const remoteEvents: SyncEvent[] = data.events.map((e: any) => ({
                id: e.id,
                type: e.type,
                minute: e.minute,
                second: e.second,
                teamId: e.teamId,
                playerId: e.playerId,
                relatedPlayerId: e.relatedPlayerId,
                detail: e.detail,
                value: e.value,
                loggerId: e.loggerId || 'unknown',
                loggerName: e.loggerName || 'Unknown Logger',
                timestamp: new Date(e.createdAt),
                synced: true,
            }));

            // Merge local and remote events
            const { merged, conflicts: detectedConflicts } = mergeEvents(
                localEvents,
                remoteEvents
            );

            // Update conflicts
            if (detectedConflicts.length > 0) {
                setConflicts(detectedConflicts);
                console.warn(`⚠️ ${detectedConflicts.length} conflict(s) detected`);
            }

            setSyncStatus('synced');
            return merged;
        } catch (error) {
            console.error('Sync failed:', error);
            setSyncStatus('error');
            return localEvents;
        }
    }, [matchId, isConnected]);

    /**
     * Broadcast event to other loggers
     */
    const broadcastEvent = useCallback((event: SyncEvent) => {
        if (!isConnected) return;

        // Dispatch custom event for local listeners
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('MULTI_LOGGER_EVENT', {
                detail: {
                    matchId,
                    loggerId,
                    loggerName,
                    event,
                },
            }));
        }
    }, [matchId, loggerId, loggerName, isConnected]);

    /**
     * Resolve a conflict
     */
    const resolveConflict = useCallback((
        conflictId: string,
        resolution: 'keep-first' | 'keep-second' | 'keep-both' | 'merge'
    ) => {
        setConflicts(prev =>
            prev.map(c =>
                c.id === conflictId
                    ? { ...c, resolved: true, resolution }
                    : c
            )
        );
    }, []);

    // Join match on mount
    useEffect(() => {
        if (enabled) {
            joinMatch();
        }

        return () => {
            if (enabled) {
                leaveMatch();
            }
        };
    }, [enabled, joinMatch, leaveMatch]);

    // Setup heartbeat
    useEffect(() => {
        if (!isConnected) return;

        // Send heartbeat every 30 seconds
        heartbeatInterval.current = setInterval(sendHeartbeat, 30000);

        return () => {
            if (heartbeatInterval.current) {
                clearInterval(heartbeatInterval.current);
            }
        };
    }, [isConnected, sendHeartbeat]);

    // Setup polling for active loggers
    useEffect(() => {
        if (!isConnected) return;

        // Poll every 10 seconds
        pollInterval.current = setInterval(pollActiveLoggers, 10000);

        return () => {
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        };
    }, [isConnected, pollActiveLoggers]);

    return {
        // State
        activeLoggers,
        conflicts,
        isConnected,
        syncStatus,
        isMultiLogger: activeLoggers.length > 0,

        // Actions
        joinMatch,
        leaveMatch,
        syncEvents,
        broadcastEvent,
        resolveConflict,
    };
}
