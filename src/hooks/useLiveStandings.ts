/**
 * Live Standings Hook
 * Real-time standings updates using WebSocket
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface StandingRow {
    position: number;
    teamId: string;
    teamName: string;
    teamLogo: string;
    university: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    form: string[];
}

interface UseLiveStandingsOptions {
    competitionId: string;
    sport?: string;
    autoConnect?: boolean;
}

export function useLiveStandings({
    competitionId,
    sport,
    autoConnect = true,
}: UseLiveStandingsOptions) {
    const [standings, setStandings] = useState<StandingRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [liveMatches, setLiveMatches] = useState<string[]>([]);

    // Fetch initial standings
    const fetchStandings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                competition: competitionId,
            });

            if (sport) {
                params.append('sport', sport);
            }

            const response = await fetch(`/api/standings?${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch standings');
            }

            const data = await response.json();

            // Transform and sort standings
            const transformedStandings = data
                .map((standing: any, index: number) => ({
                    position: index + 1,
                    teamId: standing.teamId,
                    teamName: standing.team?.name || 'Unknown',
                    teamLogo: standing.team?.logo || '❓',
                    university: standing.team?.university || '',
                    played: standing.played,
                    won: standing.won,
                    drawn: standing.drawn,
                    lost: standing.lost,
                    goalsFor: standing.goalsFor,
                    goalsAgainst: standing.goalsAgainst,
                    goalDifference: standing.goalDifference,
                    points: standing.points,
                    form: standing.form || [],
                }))
                .sort((a: StandingRow, b: StandingRow) => {
                    // Sort by points, then goal difference, then goals scored
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
                    return b.goalsFor - a.goalsFor;
                });

            setStandings(transformedStandings);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    }, [competitionId, sport]);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (socket?.connected) return;

        // Determine socket URL
        let socketUrl = process.env.NEXT_PUBLIC_WS_URL;
        if (!socketUrl && typeof window !== 'undefined') {
            socketUrl = `${window.location.protocol}//${window.location.host}`;
        } else if (!socketUrl) {
            socketUrl = 'http://localhost:3000';
        }

        const newSocket = io(socketUrl, {
            path: '/api/socket', // Ensure we use the same path as main hook
            transports: ['websocket', 'polling'], // Allow polling as fallback
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        newSocket.on('connect', () => {
            console.log('Connected to standings WebSocket');
            setIsConnected(true);

            // Join competition room
            newSocket.emit('join-competition', competitionId);
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from standings WebSocket');
            setIsConnected(false);
        });

        // Listen for standings updates
        newSocket.on('standings-update', (data: { standings: StandingRow[] }) => {
            console.log('Received standings update:', data);
            setStandings(data.standings);
        });

        // Listen for live match updates
        newSocket.on('match-update', (data: { matchId: string; homeScore: number; awayScore: number }) => {
            console.log('Match update:', data);
            // Standings will be recalculated on the server and sent via standings-update
        });

        // Listen for live matches list
        newSocket.on('live-matches', (data: { matches: string[] }) => {
            setLiveMatches(data.matches);
        });

        // Listen for match events that affect standings
        newSocket.on('match-event', (data: { type: string; matchId: string; teamId: string }) => {
            console.log('Match event:', data);
            // Could trigger optimistic UI updates here
        });

        newSocket.on('error', (error: any) => {
            console.error('WebSocket error:', error);
            setError('WebSocket connection error');
        });

        setSocket(newSocket);
    }, [competitionId, socket]);

    // Disconnect from WebSocket
    const disconnect = useCallback(() => {
        if (socket) {
            socket.emit('leave-competition', competitionId);
            socket.disconnect();
            setSocket(null);
            setIsConnected(false);
        }
    }, [socket, competitionId]);

    // Manual refresh
    const refresh = useCallback(() => {
        fetchStandings();
    }, [fetchStandings]);

    // Initial fetch
    useEffect(() => {
        fetchStandings();
    }, [fetchStandings]);

    // Auto-connect to WebSocket
    useEffect(() => {
        if (autoConnect) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [autoConnect, connect, disconnect]);

    return {
        standings,
        loading,
        error,
        isConnected,
        liveMatches,
        refresh,
        connect,
        disconnect,
    };
}

// Hook for optimistic standings updates
export function useOptimisticStandings(initialStandings: StandingRow[]) {
    const [standings, setStandings] = useState(initialStandings);

    const updateForGoal = useCallback((teamId: string, isFor: boolean) => {
        setStandings((prev) =>
            prev.map((standing) => {
                if (standing.teamId === teamId) {
                    const newGoalsFor = isFor ? standing.goalsFor + 1 : standing.goalsFor;
                    const newGoalsAgainst = !isFor ? standing.goalsAgainst + 1 : standing.goalsAgainst;
                    const newGD = newGoalsFor - newGoalsAgainst;

                    return {
                        ...standing,
                        goalsFor: newGoalsFor,
                        goalsAgainst: newGoalsAgainst,
                        goalDifference: newGD,
                    };
                }
                return standing;
            })
        );
    }, []);

    const updateForResult = useCallback((teamId: string, result: 'W' | 'D' | 'L') => {
        setStandings((prev) =>
            prev.map((standing) => {
                if (standing.teamId === teamId) {
                    const newWon = result === 'W' ? standing.won + 1 : standing.won;
                    const newDrawn = result === 'D' ? standing.drawn + 1 : standing.drawn;
                    const newLost = result === 'L' ? standing.lost + 1 : standing.lost;
                    const newPoints = newWon * 3 + newDrawn;

                    return {
                        ...standing,
                        played: standing.played + 1,
                        won: newWon,
                        drawn: newDrawn,
                        lost: newLost,
                        points: newPoints,
                        form: [result, ...standing.form.slice(0, 4)],
                    };
                }
                return standing;
            })
        );
    }, []);

    const reset = useCallback(() => {
        setStandings(initialStandings);
    }, [initialStandings]);

    return {
        standings,
        updateForGoal,
        updateForResult,
        reset,
    };
}
