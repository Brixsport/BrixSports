/**
 * WebSocket Hook for Real-time Multi-Logger Sync
 * Replaces polling with instant event synchronization
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { SyncEvent } from '@/lib/multiLogger';

interface UseWebSocketOptions {
    matchId: string;
    loggerId: string;
    loggerName: string;
    enabled?: boolean;
    onEvent?: (event: SyncEvent) => void;
    onLoggerJoined?: (logger: { loggerId: string; loggerName: string }) => void;
    onLoggerLeft?: (loggerId: string) => void;
}

interface WebSocketMessage {
    type: 'event' | 'logger-joined' | 'logger-left' | 'sync-request' | 'sync-response';
    data: any;
}

export function useRealtimeSync({
    matchId,
    loggerId,
    loggerName,
    enabled = true,
    onEvent,
    onLoggerJoined,
    onLoggerLeft,
}: UseWebSocketOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const [activeLoggers, setActiveLoggers] = useState<Array<{ loggerId: string; loggerName: string }>>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            // Use custom WebSocket server or fallback to polling
            const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:3001`;
            const ws = new WebSocket(`${wsUrl}/logger?matchId=${matchId}&loggerId=${loggerId}`);

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);

                // Send join message
                ws.send(JSON.stringify({
                    type: 'join',
                    data: {
                        matchId,
                        loggerId,
                        loggerName,
                    },
                }));

                // Start heartbeat
                heartbeatIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'heartbeat', data: { loggerId } }));
                    }
                }, 30000); // Every 30 seconds
            };

            ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);

                    switch (message.type) {
                        case 'event':
                            onEvent?.(message.data);
                            break;

                        case 'logger-joined':
                            setActiveLoggers(prev => [...prev, message.data]);
                            onLoggerJoined?.(message.data);
                            break;

                        case 'logger-left':
                            setActiveLoggers(prev =>
                                prev.filter(l => l.loggerId !== message.data.loggerId)
                            );
                            onLoggerLeft?.(message.data.loggerId);
                            break;

                        case 'sync-response':
                            setActiveLoggers(message.data.loggers || []);
                            break;
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);

                if (heartbeatIntervalRef.current) {
                    clearInterval(heartbeatIntervalRef.current);
                }

                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, 3000);
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            setIsConnected(false);
        }
    }, [matchId, loggerId, loggerName, enabled, onEvent, onLoggerJoined, onLoggerLeft]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'leave',
                    data: { matchId, loggerId },
                }));
            }

            wsRef.current.close();
            wsRef.current = null;
        }

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
        }

        setIsConnected(false);
    }, [matchId, loggerId]);

    const broadcastEvent = useCallback((event: SyncEvent) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'event',
                data: event,
            }));
        }
    }, []);

    useEffect(() => {
        if (enabled) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [enabled, connect, disconnect]);

    return {
        isConnected,
        activeLoggers,
        broadcastEvent,
        reconnect: connect,
        disconnect,
    };
}
