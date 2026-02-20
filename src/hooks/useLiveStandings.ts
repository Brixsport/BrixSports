/**
 * Live Standings Hook
 * Real-time standings updates using the shared WebSocket connection
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/hooks/useWebSocket';

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
    const [liveMatches, setLiveMatches] = useState<string[]>([]);

    // Use the shared socket connection
    const { socket, isConnected } = useSocket();

    // Fetch initial standings
    const fetchStandings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({ competition: competitionId });
            if (sport) params.append('sport', sport);

            const response = await fetch(`/api/standings?${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch standings');
            }

            const data = await response.json();

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

    // Subscribe to competition updates via shared socket
    useEffect(() => {
        if (!socket || !isConnected || !autoConnect) return;

        socket.emit('join-competition', competitionId);

        const handleStandingsUpdate = (data: { standings: StandingRow[] }) => {
            setStandings(data.standings);
        };

        const handleLiveMatches = (data: { matches: string[] }) => {
            setLiveMatches(data.matches);
        };

        socket.on('standings-update', handleStandingsUpdate);
        socket.on('live-matches', handleLiveMatches);

        return () => {
            socket.emit('leave-competition', competitionId);
            socket.off('standings-update', handleStandingsUpdate);
            socket.off('live-matches', handleLiveMatches);
        };
    }, [socket, isConnected, autoConnect, competitionId]);

    // Initial fetch
    useEffect(() => {
        fetchStandings();
    }, [fetchStandings]);

    return {
        standings,
        loading,
        error,
        isConnected,
        liveMatches,
        refresh: fetchStandings,
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
                    return {
                        ...standing,
                        goalsFor: newGoalsFor,
                        goalsAgainst: newGoalsAgainst,
                        goalDifference: newGoalsFor - newGoalsAgainst,
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
                    return {
                        ...standing,
                        played: standing.played + 1,
                        won: newWon,
                        drawn: newDrawn,
                        lost: newLost,
                        points: newWon * 3 + newDrawn,
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

    return { standings, updateForGoal, updateForResult, reset };
}
