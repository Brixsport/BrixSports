/**
 * WebSocket Client - Singleton Connection Manager
 * Uses React Context to share a SINGLE Socket.IO connection across all hooks/components.
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { MatchEvent } from '@/db/schema';

// ─── Types ──────────────────────────────────────────────────────

export interface SocketEventData {
    matchId: string;
    event: MatchEvent;
    updatedRatings?: Array<{ playerId: string; newRating: number }>;
    updatedStats?: { teamId: string; stats: any };
    timestamp: number;
}

interface SocketContextValue {
    socket: Socket | null;
    isConnected: boolean;
}

// ─── Context ────────────────────────────────────────────────────

const SocketContext = createContext<SocketContextValue>({
    socket: null,
    isConnected: false,
});

let stableFallback: SocketContextValue | null = null;

// ─── Singleton Connection ───────────────────────────────────────
// Kept outside React to survive re-renders and StrictMode double-mounts

let sharedSocket: Socket | null = null;
let connectionCount = 0;

function getOrCreateSocket(): Socket | null {
    if (sharedSocket?.connected || sharedSocket?.active) {
        return sharedSocket;
    }

    let socketUrl = process.env.NEXT_PUBLIC_WS_URL;

    const isLocalhost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('172.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.endsWith('.local')
    );

    if (!socketUrl) {
        if (isLocalhost) {
            socketUrl = `${window.location.protocol}//${window.location.host}`;
            console.info(`[WS] Dev mode: using ${socketUrl}`);
        } else {
            console.warn('⚠️ NEXT_PUBLIC_WS_URL not configured. Real-time features disabled.');
            return null;
        }
    }

    // Safety: don't connect to production WS from localhost
    if (isLocalhost && (socketUrl.includes('vercel.app') || socketUrl.includes('herokuapp.com') || socketUrl.includes('brixsports.com') || socketUrl.includes('railway.app'))) {
        console.warn('⚠️ Dev mode: Ignoring production WS URL.');
        socketUrl = `${window.location.protocol}//${window.location.host}`;
    }

    sharedSocket = io(socketUrl, {
        path: '/api/socket',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
    });

    let reconnectAttempts = 0;

    sharedSocket.on('connect', () => {
        console.log(`[WS] Connected: ${sharedSocket?.id}`);
        reconnectAttempts = 0;
    });

    sharedSocket.on('disconnect', (reason) => {
        console.log(`[WS] Disconnected: ${reason}`);
    });

    sharedSocket.on('connect_error', (error) => {
        reconnectAttempts++;
        if (reconnectAttempts <= 3) {
            console.warn(`[WS] Connection error (attempt ${reconnectAttempts}/5):`, error.message);
        } else if (reconnectAttempts === 5) {
            // Do NOT call disconnect() — it permanently kills Socket.IO's reconnection loop.
            console.warn('[WS] Max reconnection attempts reached. Waiting for server...');
        }
    });

    sharedSocket.on('reconnect_failed', () => {
        // Socket.IO exhausted all retries. Start a manual 30 s retry loop so the page
        // recovers when the server returns without needing a hard refresh.
        console.warn('[WS] reconnect_failed — starting manual retry loop (30 s)');
        const retryInterval = setInterval(() => {
            if (sharedSocket?.connected) {
                clearInterval(retryInterval);
                return;
            }
            console.log('[WS] Manual retry attempt');
            reconnectAttempts = 0;
            sharedSocket?.connect();
        }, 30000);
    });

    return sharedSocket;
}

// ─── Provider Component ─────────────────────────────────────────

export function SocketProvider({ children }: { children: ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        connectionCount++;
        const socket = getOrCreateSocket();
        socketRef.current = socket;

        if (!socket) return;

        const handleConnect = () => setIsConnected(true);
        const handleDisconnect = () => setIsConnected(false);

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);

        // Heartbeat to prevent idle timeouts on proxies/load-balancers
        const heartbeatInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('ping');
            }
        }, 30000); // Every 30 seconds

        // Set initial state
        setIsConnected(socket.connected);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            clearInterval(heartbeatInterval);
            connectionCount--;

            // Only disconnect if no one is using it
            if (connectionCount <= 0) {
                socket.disconnect();
                sharedSocket = null;
                connectionCount = 0;
            }
        };
    }, []);

    const contextValue = useMemo(() => ({
        socket: socketRef.current || sharedSocket,
        isConnected
    }), [isConnected]);

    return (
        <SocketContext.Provider value={contextValue}>
            {children}
        </SocketContext.Provider>
    );
}

// ─── Base Hook ──────────────────────────────────────────────────

/**
 * Core hook - returns the shared socket and connection status.
 * All other hooks should use this instead of creating their own connections.
 */
export function useSocket() {
    const context = useContext(SocketContext);

    // Fallback: if used outside provider, return the shared socket directly
    if (!context.socket && sharedSocket) {
        if (!stableFallback || stableFallback.socket !== sharedSocket || stableFallback.isConnected !== sharedSocket.connected) {
            stableFallback = {
                socket: sharedSocket,
                isConnected: sharedSocket.connected
            };
        }
        return stableFallback;
    }

    return context;
}

// ─── Match Subscription Hook ────────────────────────────────────

export function useMatchSubscription(matchId: string | undefined) {
    const { socket, isConnected } = useSocket();

    useEffect(() => {
        if (!socket || !isConnected || !matchId) return;

        socket.emit('match:subscribe', { matchId });

        return () => {
            socket.emit('match:unsubscribe', { matchId });
        };
    }, [socket, isConnected, matchId]);

    return { socket, isConnected };
}

// ─── Convenience Hooks (all share the SAME connection) ──────────

/**
 * Hook for subscribing to match events
 */
export function useMatchEvents(matchId: string) {
    const [events, setEvents] = useState<MatchEvent[]>([]);
    const [latestEvent, setLatestEvent] = useState<MatchEvent | null>(null);

    const { socket, isConnected } = useMatchSubscription(matchId);

    useEffect(() => {
        if (!socket) return;

        const handleNewEvent = (data: SocketEventData & { score?: any; teamRatings?: any; stats?: any; lineups?: any; status?: string }) => {
            console.log(`[WS] New event received for Match ${matchId}:`, data);
            if (data.matchId === matchId) {
                // Enrich the event with top-level match state if provided
                const enrichedEvent = {
                    ...data.event,
                    score: data.score,
                    teamRatings: data.teamRatings,
                    stats: data.stats,
                    lineups: data.lineups,
                    status: data.status
                };
                setLatestEvent(enrichedEvent);
                setEvents(prev => [...prev, data.event]);
            } else {
                console.warn(`[WS] MatchId mismatch! Expected ${matchId}, got ${data.matchId}`);
            }
        };

        const handleEventDeleted = (data: { matchId: string; eventId: string }) => {
            console.log(`[WS] Event deleted for Match ${matchId}:`, data);
            if (data.matchId === matchId) {
                setEvents(prev => prev.filter(e => e.id !== data.eventId));
            }
        };

        socket.on('event:new', handleNewEvent);
        socket.on('event:deleted', handleEventDeleted);

        return () => {
            socket.off('event:new', handleNewEvent);
            socket.off('event:deleted', handleEventDeleted);
        };
    }, [socket, matchId]);

    return { events, latestEvent, isConnected, socket };
}

/**
 * Hook for subscribing to player rating updates
 */
export function usePlayerRatings(matchId: string) {
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const { socket } = useMatchSubscription(matchId);

    useEffect(() => {
        if (!socket) return;

        const handleRatingUpdate = (data: { matchId: string; playerId: string; rating: number }) => {
            console.log(`[WS] Rating update received for Match ${matchId}:`, data);
            if (data.matchId === matchId) {
                setRatings(prev => ({ ...prev, [data.playerId]: data.rating }));
            }
        };

        socket.on('rating:updated', handleRatingUpdate);
        return () => { socket.off('rating:updated', handleRatingUpdate); };
    }, [socket, matchId]);

    return ratings;
}

/**
 * Hook for subscribing to team statistics updates
 */
export function useTeamStats(matchId: string) {
    const [stats, setStats] = useState<Record<string, any>>({});
    const { socket } = useMatchSubscription(matchId);

    useEffect(() => {
        if (!socket) return;

        const handleStatsUpdate = (data: { matchId: string; teamId: string; stats: any }) => {
            if (data.matchId === matchId) {
                setStats(prev => ({ ...prev, [data.teamId]: data.stats }));
            }
        };

        socket.on('stats:updated', handleStatsUpdate);
        return () => { socket.off('stats:updated', handleStatsUpdate); };
    }, [socket, matchId]);

    return stats;
}

/**
 * Hook for subscribing to match timer updates
 */
export function useMatchTimer(matchId: string) {
    const [time, setTime] = useState<{ minute: number; extraTime: number; half: number; period?: string } | null>(null);
    const [isStale, setIsStale] = useState(false);
    const { socket } = useMatchSubscription(matchId);

    useEffect(() => {
        if (!socket) return;

        const handleTimeUpdate = (data: { matchId: string; minute: number; extraTime: number; half: number; period?: string }) => {
            if (data.matchId === matchId) {
                setTime({ minute: data.minute, extraTime: data.extraTime, half: data.half, period: data.period });
                setIsStale(false);
            }
        };

        // Mark stale on disconnect but preserve last-known minute — do not null it.
        // LiveMatchStatus renders the frozen minute with a dimmed indicator instead
        // of dropping to the bare DB period label on every transient hiccup.
        const handleDisconnect = () => setIsStale(true);

        socket.on('match:time:updated', handleTimeUpdate);
        socket.on('match:time:update', handleTimeUpdate);
        socket.on('disconnect', handleDisconnect);

        return () => {
            socket.off('match:time:updated', handleTimeUpdate);
            socket.off('match:time:update', handleTimeUpdate);
            socket.off('disconnect', handleDisconnect);
        };
    }, [socket, matchId]);

    return { time, isStale };
}

/**
 * Hook for subscribing to match status updates
 */
export function useMatchStatus(matchId: string, initialStatus: string = 'UPCOMING', initialScore = { home: 0, away: 0 }) {
    const [status, setStatus] = useState<string>(initialStatus);
    const [score, setScore] = useState<{ home: number; away: number }>(initialScore);
    const { socket } = useMatchSubscription(matchId);

    useEffect(() => {
        if (!socket) return;

        const handleStatusUpdate = (data: { matchId: string; status: string }) => {
            if (data.matchId === matchId) setStatus(data.status);
        };

        const handleScoreUpdate = (data: { matchId: string; homeScore: number; awayScore: number }) => {
            if (data.matchId === matchId) setScore({ home: data.homeScore, away: data.awayScore });
        };

        const handleMatchUpdate = (data: { matchId: string; status?: string; homeScore?: number; awayScore?: number }) => {
            if (data.matchId === matchId) {
                if (data.status) setStatus(data.status);
                if (data.homeScore !== undefined && data.awayScore !== undefined) {
                    setScore({ home: data.homeScore, away: data.awayScore });
                }
            }
        };

        socket.on('match:status:changed', handleStatusUpdate);
        socket.on('match:score:updated', handleScoreUpdate);
        socket.on('match:updated', handleMatchUpdate);

        return () => {
            socket.off('match:status:changed', handleStatusUpdate);
            socket.off('match:score:updated', handleScoreUpdate);
            socket.off('match:updated', handleMatchUpdate);
        };
    }, [socket, matchId]);

    return { status, score };
}

/**
 * Hook for subscribing to live viewer count
 */
export function useMatchViewers(matchId: string) {
    const [viewerCount, setViewerCount] = useState<number>(0);
    const { socket } = useMatchSubscription(matchId);

    useEffect(() => {
        if (!socket) return;

        const handleViewersUpdate = (data: { matchId: string; count: number }) => {
            if (data.matchId === matchId) setViewerCount(data.count);
        };

        socket.on('match:viewers', handleViewersUpdate);
        return () => { socket.off('match:viewers', handleViewersUpdate); };
    }, [socket, matchId]);

    return viewerCount;
}

/**
 * Hook for subscribing to lineup updates
 */
export function useLineupUpdates(matchId: string) {
    const [lineups, setLineups] = useState<{ home: any; away: any } | null>(null);
    const { socket } = useMatchSubscription(matchId);

    useEffect(() => {
        if (!socket) return;

        const handleLineupUpdate = (data: { matchId: string; lineups: { home: any; away: any } }) => {
            if (data.matchId === matchId) setLineups(data.lineups);
        };

        socket.on('match:lineup:updated', handleLineupUpdate);
        return () => { socket.off('match:lineup:updated', handleLineupUpdate); };
    }, [socket, matchId]);

    return lineups;
}

// ─── Legacy Compatibility ───────────────────────────────────────
// For components that import useWebSocket directly

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
 * Legacy useWebSocket hook - now wraps the shared singleton.
 * Components that import this will automatically use the shared connection.
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
    const { matchId } = options;
    const { socket, isConnected } = useMatchSubscription(matchId);

    const subscribe = useCallback((id: string) => {
        socket?.emit('match:subscribe', { matchId: id });
    }, [socket]);

    const unsubscribe = useCallback((id: string) => {
        socket?.emit('match:unsubscribe', { matchId: id });
    }, [socket]);

    const emit = useCallback((event: string, data: any) => {
        if (socket?.connected) {
            socket.emit(event, data);
        } else {
            console.warn('[WS] Not connected, cannot emit:', event);
        }
    }, [socket]);

    const on = useCallback((event: string, handler: (data: any) => void) => {
        socket?.on(event, handler);
    }, [socket]);

    const off = useCallback((event: string, handler?: (data: any) => void) => {
        if (handler) {
            socket?.off(event, handler);
        } else {
            socket?.off(event);
        }
    }, [socket]);

    return { socket, isConnected, subscribe, unsubscribe, emit, on, off };
}
