/**
 * WebSocket Client Hook
 * Provides real-time event updates using Socket.IO
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MatchEvent } from '@/db/schema';

export interface SocketEventData {
    matchId: string;
    event: MatchEvent;
    updatedRatings?: Array<{ playerId: string; newRating: number }>;
    updatedStats?: { teamId: string; stats: any };
    timestamp: number;
}

export interface UseWebSocketOptions {
    matchId?: string;
    autoConnect?: boolean;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
}

export interface UseWebSocketReturn {
    socket: Socket | null;
    isConnected: boolean;
    subscribe: (matchId: string) => void;
    unsubscribe: (matchId: string) => void;
    emit: (event: string, data: any) => void;
    on: (event: string, handler: (data: any) => void) => void;
    off: (event: string, handler?: (data: any) => void) => void;
}

/**
 * Custom hook for WebSocket connection
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
    const {
        matchId,
        autoConnect = true,
        onConnect,
        onDisconnect,
        onError,
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!autoConnect) return;

        // Initialize Socket.IO connection
        let socketUrl = process.env.NEXT_PUBLIC_WS_URL;

        // Determine if we are on localhost
        const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

        // If no URL is provided and we are NOT on localhost, do not attempt to connect to avoiding polling Vercel
        if (!socketUrl && !isLocalhost) {
            console.warn('WebSocket URL not configured. Real-time features disabled.');
            return;
        }

        // If on localhost and no URL, default to current origin (handled by server.js)
        if (!socketUrl) {
            socketUrl = '';
        }

        // Safety check: specific fix for local development to avoid connecting to production
        if (isLocalhost) {
            if (socketUrl.includes('vercel.app') || socketUrl.includes('herokuapp.com')) {
                console.warn('⚠️ Dev mode detected: Ignoring production WS URL to prevent connection errors. Using local origin.');
                socketUrl = ''; // Use current origin (relative path)
            }
        }

        const socket = io(socketUrl, {
            path: '/api/socket',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketRef.current = socket;

        // Connection event handlers
        socket.on('connect', () => {
            console.log('WebSocket connected:', socket.id);
            setIsConnected(true);
            onConnect?.();

            // Auto-subscribe to match if matchId provided
            if (matchId) {
                socket.emit('match:subscribe', { matchId });
            }
        });

        socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            setIsConnected(false);
            onDisconnect?.();
        });

        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            onError?.(error);
        });

        socket.on('error', (error) => {
            console.error('WebSocket error:', error);
            onError?.(error);
        });

        return () => {
            if (matchId) {
                socket.emit('match:unsubscribe', { matchId });
            }
            socket.disconnect();
        };
    }, [autoConnect, matchId, onConnect, onDisconnect, onError]);

    const subscribe = useCallback((matchId: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('match:subscribe', { matchId });
            console.log('Subscribed to match:', matchId);
        }
    }, []);

    const unsubscribe = useCallback((matchId: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('match:unsubscribe', { matchId });
            console.log('Unsubscribed from match:', matchId);
        }
    }, []);

    const emit = useCallback((event: string, data: any) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(event, data);
        } else {
            console.warn('Socket not connected, cannot emit event:', event);
        }
    }, []);

    const on = useCallback((event: string, handler: (data: any) => void) => {
        if (socketRef.current) {
            socketRef.current.on(event, handler);
        }
    }, []);

    const off = useCallback((event: string, handler?: (data: any) => void) => {
        if (socketRef.current) {
            if (handler) {
                socketRef.current.off(event, handler);
            } else {
                socketRef.current.off(event);
            }
        }
    }, []);

    return {
        socket: socketRef.current,
        isConnected,
        subscribe,
        unsubscribe,
        emit,
        on,
        off,
    };
}

/**
 * Hook for subscribing to match events
 */
export function useMatchEvents(matchId: string) {
    const [events, setEvents] = useState<MatchEvent[]>([]);
    const [latestEvent, setLatestEvent] = useState<MatchEvent | null>(null);

    const { isConnected, on, off, socket } = useWebSocket({
        matchId,
        autoConnect: true,
    });

    useEffect(() => {
        const handleNewEvent = (data: SocketEventData) => {
            if (data.matchId === matchId) {
                setLatestEvent(data.event);
                setEvents(prev => [...prev, data.event]);
            }
        };

        const handleEventDeleted = (data: { matchId: string; eventId: string }) => {
            if (data.matchId === matchId) {
                setEvents(prev => prev.filter(e => e.id !== data.eventId));
            }
        };

        on('event:new', handleNewEvent);
        on('event:deleted', handleEventDeleted);

        return () => {
            off('event:new', handleNewEvent);
            off('event:deleted', handleEventDeleted);
        };
    }, [matchId, on, off]);

    return {
        events,
        latestEvent,
        isConnected,
        socket
    };
}

/**
 * Hook for subscribing to player rating updates
 */
export function usePlayerRatings(matchId: string) {
    const [ratings, setRatings] = useState<Record<string, number>>({});

    const { on, off } = useWebSocket({
        matchId,
        autoConnect: true,
    });

    useEffect(() => {
        const handleRatingUpdate = (data: {
            matchId: string;
            playerId: string;
            rating: number;
        }) => {
            if (data.matchId === matchId) {
                setRatings(prev => ({
                    ...prev,
                    [data.playerId]: data.rating,
                }));
            }
        };

        on('rating:updated', handleRatingUpdate);

        return () => {
            off('rating:updated', handleRatingUpdate);
        };
    }, [matchId, on, off]);

    return ratings;
}

/**
 * Hook for subscribing to team statistics updates
 */
export function useTeamStats(matchId: string) {
    const [stats, setStats] = useState<Record<string, any>>({});

    const { on, off } = useWebSocket({
        matchId,
        autoConnect: true,
    });

    useEffect(() => {
        const handleStatsUpdate = (data: {
            matchId: string;
            teamId: string;
            stats: any;
        }) => {
            if (data.matchId === matchId) {
                setStats(prev => ({
                    ...prev,
                    [data.teamId]: data.stats,
                }));
            }
        };

        on('stats:updated', handleStatsUpdate);

        return () => {
            off('stats:updated', handleStatsUpdate);
        };
    }, [matchId, on, off]);

    return stats;
}

/**
 * Hook for subscribing to match status updates
 */
export function useMatchStatus(matchId: string) {
    const [status, setStatus] = useState<string>('UPCOMING');
    const [score, setScore] = useState<{ home: number; away: number }>({ home: 0, away: 0 });

    const { on, off } = useWebSocket({
        matchId,
        autoConnect: true,
    });

    useEffect(() => {
        const handleStatusUpdate = (data: {
            matchId: string;
            status: string;
        }) => {
            if (data.matchId === matchId) {
                setStatus(data.status);
            }
        };

        const handleScoreUpdate = (data: {
            matchId: string;
            homeScore: number;
            awayScore: number;
        }) => {
            if (data.matchId === matchId) {
                setScore({ home: data.homeScore, away: data.awayScore });
            }
        };

        const handleMatchUpdate = (data: {
            matchId: string;
            status?: string;
            homeScore?: number;
            awayScore?: number;
        }) => {
            if (data.matchId === matchId) {
                if (data.status) setStatus(data.status);
                if (data.homeScore !== undefined && data.awayScore !== undefined) {
                    setScore({ home: data.homeScore, away: data.awayScore });
                }
            }
        };

        on('match:status:changed', handleStatusUpdate);
        on('match:score:updated', handleScoreUpdate);
        on('match:updated', handleMatchUpdate);

        return () => {
            off('match:status:changed', handleStatusUpdate);
            off('match:score:updated', handleScoreUpdate);
            off('match:updated', handleMatchUpdate);
        };
    }, [matchId, on, off]);

    return { status, score };
}

/**
 * Hook for subscribing to live viewer count
 */
export function useMatchViewers(matchId: string) {
    const [viewerCount, setViewerCount] = useState<number>(0);

    const { on, off } = useWebSocket({
        matchId,
        autoConnect: true,
    });

    useEffect(() => {
        const handleViewersUpdate = (data: { matchId: string; count: number }) => {
            if (data.matchId === matchId) {
                setViewerCount(data.count);
            }
        };

        on('match:viewers', handleViewersUpdate);

        return () => {
            off('match:viewers', handleViewersUpdate);
        };
    }, [matchId, on, off]);

    return viewerCount;
}
