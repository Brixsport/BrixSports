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

        // Determine if we are on localhost or a local network IP
        const isLocalhost = typeof window !== 'undefined' && (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.startsWith('192.168.') ||
            window.location.hostname.startsWith('172.') ||
            window.location.hostname.startsWith('10.') ||
            window.location.hostname.endsWith('.local')
        );

        // Check if we are on Vercel (often doesn't support stateful WebSockets without a separate server)
        const isVercel = typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');

        // If no URL is provided:
        if (!socketUrl) {
            if (isVercel) {
                // On Vercel, we definitely want a dedicated WS URL, otherwise polling will kill performance
                console.warn('⚠️ WebSocket URL not configured on Vercel. Real-time features disabled.');
                return;
            }

            // On other domains (like brixsports.com) or localhost, fallback to current origin
            if (typeof window !== 'undefined') {
                socketUrl = `${window.location.protocol}//${window.location.host}`;
                console.info(`WebSocket: No URL configured, falling back to ${socketUrl}`);
            } else {
                return; // Server-side execution
            }
        }

        // Safety check: specific fix for local development to avoid connecting to production
        if (isLocalhost) {
            if (socketUrl.includes('vercel.app') || socketUrl.includes('herokuapp.com') || socketUrl.includes('brixsports.com')) {
                console.warn('⚠️ Dev mode detected: Ignoring production WS URL to prevent connection errors. Using local origin.');
                socketUrl = `${window.location.protocol}//${window.location.host}`; // Use current local origin
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
 * Hook for subscribing to match timer updates
 */
export function useMatchTimer(matchId: string) {
    const [time, setTime] = useState<{ minute: number; extraTime: number; half: number; period?: string } | null>(null);

    const { on, off } = useWebSocket({
        matchId,
        autoConnect: true,
    });

    useEffect(() => {
        const handleTimeUpdate = (data: {
            matchId: string;
            minute: number;
            extraTime: number;
            half: number;
            period?: string;
        }) => {
            if (data.matchId === matchId) {
                setTime({
                    minute: data.minute,
                    extraTime: data.extraTime,
                    half: data.half,
                    period: data.period
                });
            }
        };

        on('match:time:updated', handleTimeUpdate);
        on('match:time:update', handleTimeUpdate); // Listen to both just in case

        return () => {
            off('match:time:updated', handleTimeUpdate);
            off('match:time:update', handleTimeUpdate);
        };
    }, [matchId, on, off]);

    return time;
}

/**
 * Hook for subscribing to match status updates
 */
export function useMatchStatus(matchId: string, initialStatus: string = 'UPCOMING', initialScore = { home: 0, away: 0 }) {
    const [status, setStatus] = useState<string>(initialStatus);
    const [score, setScore] = useState<{ home: number; away: number }>(initialScore);

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

/**
 * Hook for subscribing to lineup updates
 */
export function useLineupUpdates(matchId: string) {
    const [lineups, setLineups] = useState<{ home: any; away: any } | null>(null);

    const { on, off } = useWebSocket({
        matchId,
        autoConnect: true,
    });

    useEffect(() => {
        const handleLineupUpdate = (data: {
            matchId: string;
            lineups: { home: any; away: any };
        }) => {
            if (data.matchId === matchId) {
                setLineups(data.lineups);
            }
        };

        on('match:lineup:updated', handleLineupUpdate);

        return () => {
            off('match:lineup:updated', handleLineupUpdate);
        };
    }, [matchId, on, off]);

    return lineups;
}
