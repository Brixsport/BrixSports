/**
 * useMultiLogger Hook
 * Manages multi-logger sessions, real-time sync, and conflict resolution
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncEvent, EventConflict, mergeEvents, detectConflicts } from '@/lib/multiLogger';
import { useSocket } from './useWebSocket';

interface UseMultiLoggerProps {
    matchId: string;
    loggerId: string;
    loggerName: string;
    enabled?: boolean;
    // BACKLOG-151: called the instant another logger's event arrives over the
    // WS `logger:event` channel (see broadcastEvent/below) -- lets the caller
    // (FootballLogger/BasketballLogger) fold it into local state immediately
    // via their existing manager.mergeExternalEvents(), the same reconstruction
    // path the 10s poll already used. Real-time conflict *detection* still runs
    // on the next poll tick (detectConflicts needs the full local event set,
    // which this hook doesn't hold) -- this closes the "never arrives until
    // the poll" gap, not the "conflict flagged instantly" gap. Documented
    // limitation, not silently dropped.
    onIncomingEvent?: (event: SyncEvent) => void;
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
    onIncomingEvent,
}: UseMultiLoggerProps) {
    const [activeLoggers, setActiveLoggers] = useState<LoggerInfo[]>([]);
    const [conflicts, setConflicts] = useState<EventConflict[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');

    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
    const pollInterval = useRef<NodeJS.Timeout | null>(null);

    // BACKLOG-151: real cross-device push, using the WS server's already-built
    // (but previously unused by this hook) logger:join/logger:broadcast-event
    // channel (ws-server/index.js) -- shares the app's one singleton socket
    // connection rather than opening a second one.
    const { socket, isConnected: wsConnected } = useSocket();
    const onIncomingEventRef = useRef(onIncomingEvent);
    onIncomingEventRef.current = onIncomingEvent;

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
                // match_events.value is a TEXT column storing JSON.stringify(value) --
                // the raw string ("1", "2") was passed straight through here, unlike
                // BasketballLogger's own initial-mount fetch which already parses it.
                // Every event picked up via this 15s sync silently turned numeric into
                // string, breaking any downstream arithmetic (BasketballLogger's
                // calculatePlayerRating: `rating += event.value` string-concatenates
                // instead of adding, then `.toFixed()` throws on the resulting string).
                value: e.value != null ? (typeof e.value === 'string' ? JSON.parse(e.value) : e.value) : undefined,
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
     * Broadcast event to other loggers. BACKLOG-151: this used to only fire a
     * same-tab window CustomEvent (never left the browser tab). Now also emits
     * over the shared WS socket's logger:broadcast-event channel -- the server
     * (ws-server/index.js) relays it to every other logger:join'd socket for
     * this match as logger:event, in real time. The window event is kept too
     * (cheap, and something in-tab may still listen for it).
     */
    const broadcastEvent = useCallback((event: SyncEvent) => {
        if (!isConnected) return;

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

        if (socket && wsConnected) {
            socket.emit('logger:broadcast-event', { matchId, event: { ...event, loggerId, loggerName } });
        }
    }, [matchId, loggerId, loggerName, isConnected, socket, wsConnected]);

    /**
     * Resolve a conflict. BACKLOG-151: this used to only flip a local React
     * flag -- the DB and every public viewer kept seeing the conflicting data
     * exactly as before. For keep-first/keep-second (the only resolutions the
     * UI actually offers -- MultiLoggerStatus.tsx never renders a "merge"
     * button), now really deletes the losing event server-side via the
     * existing, already-atomic DELETE /api/matches/[id]/events/[eventId]
     * route (score/stat revert + WS broadcast all handled there already).
     * keep-both and merge intentionally make no server call -- keep-both
     * means both events are legitimately real, and a real field-level merge
     * is out of scope here (never exposed in the UI, so never invoked).
     * Best-effort: if the delete 404s (e.g. the "losing" event was only
     * local/unsynced, never actually persisted), still resolve locally
     * rather than leaving the banner stuck -- matches this codebase's
     * existing "don't throw on best-effort cleanup" pattern (see
     * revertPlayerStat in events/[eventId]/route.ts).
     */
    const resolveConflict = useCallback(async (
        conflictId: string,
        resolution: 'keep-first' | 'keep-second' | 'keep-both' | 'merge'
    ) => {
        const conflict = conflicts.find(c => c.id === conflictId);

        if (conflict && (resolution === 'keep-first' || resolution === 'keep-second')) {
            const loserEvent = resolution === 'keep-first' ? conflict.event2 : conflict.event1;
            try {
                const res = await fetch(`/api/matches/${matchId}/events/${loserEvent.id}`, {
                    method: 'DELETE',
                });
                if (!res.ok && res.status !== 404) {
                    console.error(`Failed to delete losing event ${loserEvent.id} for conflict ${conflictId}: ${res.status}`);
                }
            } catch (error) {
                console.error(`Failed to resolve conflict ${conflictId} server-side:`, error);
            }
        }

        setConflicts(prev =>
            prev.map(c =>
                c.id === conflictId
                    ? { ...c, resolved: true, resolution }
                    : c
            )
        );
    }, [conflicts, matchId]);

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

    // BACKLOG-151: real-time logger presence + event push over the shared WS
    // socket, alongside (not replacing) the REST join/leave above and the 10s
    // poll below -- REST still tracks DB-backed presence for other consumers
    // (e.g. an admin view), the poll stays as a reconciliation fallback if the
    // socket ever drops. This effect is what actually closes BACKLOG-151's
    // "never leaves the browser tab" gap.
    useEffect(() => {
        if (!enabled || !socket || !wsConnected) return;

        socket.emit('logger:join', { matchId, loggerId, loggerName });

        const handleSyncResponse = ({ loggers }: { loggers: { loggerId: string; loggerName: string }[] }) => {
            setActiveLoggers(
                loggers
                    .filter(l => l.loggerId !== loggerId)
                    .map(l => ({ ...l, joinedAt: new Date(), lastActivity: new Date() }))
            );
        };
        const handleLoggerJoined = ({ loggerId: joinedId, loggerName: joinedName }: { loggerId: string; loggerName: string }) => {
            if (joinedId === loggerId) return;
            setActiveLoggers(prev =>
                prev.some(l => l.loggerId === joinedId)
                    ? prev
                    : [...prev, { loggerId: joinedId, loggerName: joinedName, joinedAt: new Date(), lastActivity: new Date() }]
            );
        };
        const handleLoggerLeft = ({ loggerId: leftId }: { loggerId: string }) => {
            setActiveLoggers(prev => prev.filter(l => l.loggerId !== leftId));
        };
        const handleLoggerEvent = (event: SyncEvent) => {
            onIncomingEventRef.current?.(event);
        };

        socket.on('sync-response', handleSyncResponse);
        socket.on('logger-joined', handleLoggerJoined);
        socket.on('logger-left', handleLoggerLeft);
        socket.on('logger:event', handleLoggerEvent);

        return () => {
            socket.emit('logger:leave', { matchId, loggerId });
            socket.off('sync-response', handleSyncResponse);
            socket.off('logger-joined', handleLoggerJoined);
            socket.off('logger-left', handleLoggerLeft);
            socket.off('logger:event', handleLoggerEvent);
        };
    }, [enabled, socket, wsConnected, matchId, loggerId, loggerName]);

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
