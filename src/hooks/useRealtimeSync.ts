/**
 * WebSocket Hook for Real-time Multi-Logger Sync
 * Now uses the shared Socket.IO connection instead of raw WebSocket
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/hooks/useWebSocket';
import type { SyncEvent } from '@/lib/multiLogger';

interface UseRealtimeSyncOptions {
    matchId: string;
    loggerId: string;
    loggerName: string;
    enabled?: boolean;
    onEvent?: (event: SyncEvent) => void;
    onLoggerJoined?: (logger: { loggerId: string; loggerName: string }) => void;
    onLoggerLeft?: (loggerId: string) => void;
}

export function useRealtimeSync({
    matchId,
    loggerId,
    loggerName,
    enabled = true,
    onEvent,
    onLoggerJoined,
    onLoggerLeft,
}: UseRealtimeSyncOptions) {
    const [activeLoggers, setActiveLoggers] = useState<Array<{ loggerId: string; loggerName: string }>>([]);
    const { socket, isConnected } = useSocket();

    // Join/leave logger room on the shared socket
    useEffect(() => {
        if (!socket || !isConnected || !enabled) return;

        // Send join message
        socket.emit('logger:join', { matchId, loggerId, loggerName });

        // Event handlers
        const handleEvent = (data: SyncEvent) => {
            onEvent?.(data);
        };

        const handleLoggerJoined = (data: { loggerId: string; loggerName: string }) => {
            setActiveLoggers(prev => [...prev, data]);
            onLoggerJoined?.(data);
        };

        const handleLoggerLeft = (data: { loggerId: string }) => {
            setActiveLoggers(prev => prev.filter(l => l.loggerId !== data.loggerId));
            onLoggerLeft?.(data.loggerId);
        };

        const handleSyncResponse = (data: { loggers: Array<{ loggerId: string; loggerName: string }> }) => {
            setActiveLoggers(data.loggers || []);
        };

        socket.on('logger:event', handleEvent);
        socket.on('logger-joined', handleLoggerJoined);
        socket.on('logger-left', handleLoggerLeft);
        socket.on('sync-response', handleSyncResponse);

        return () => {
            socket.emit('logger:leave', { matchId, loggerId });
            socket.off('logger:event', handleEvent);
            socket.off('logger-joined', handleLoggerJoined);
            socket.off('logger-left', handleLoggerLeft);
            socket.off('sync-response', handleSyncResponse);
        };
    }, [socket, isConnected, enabled, matchId, loggerId, loggerName, onEvent, onLoggerJoined, onLoggerLeft]);

    const broadcastEvent = useCallback((event: SyncEvent) => {
        if (socket?.connected) {
            socket.emit('logger:broadcast-event', { matchId, event });
        }
    }, [socket, matchId]);

    return {
        isConnected,
        activeLoggers,
        broadcastEvent,
        reconnect: () => { }, // No-op, shared socket handles reconnection
        disconnect: () => { }, // No-op, shared socket managed by SocketProvider
    };
}
