/**
 * useLoggerAnalytics Hook
 * Fetch and manage logger analytics data
 */

import { useState, useEffect, useCallback } from 'react';

export interface LoggerMetrics {
    totalEvents: number;
    recentEvents: number;
    matchesLogged: number;
    recentMatches: number;
    eventsPerMatch: number;
    eventsPerDay: number;
    last7DaysEvents: number;
    qualityScore: number;
}

export interface LoggerAnalytics {
    logger: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
    metrics: LoggerMetrics;
    breakdown: {
        eventTypes: Record<string, number>;
        dayActivity: Record<string, number>;
        hourActivity: Record<string, number>;
    };
    insights: {
        mostActiveMatch: { matchId: string; events: number } | null;
        mostCommonEvent: string | null;
        peakDay: string | null;
        peakHour: string | null;
    };
    timeline: {
        firstEvent: string | null;
        lastEvent: string | null;
        daysSinceFirst: number;
    };
}

interface UseLoggerAnalyticsOptions {
    loggerId?: string;
    timeframe?: number;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export function useLoggerAnalytics({
    loggerId,
    timeframe = 30,
    autoRefresh = false,
    refreshInterval = 60000, // 1 minute
}: UseLoggerAnalyticsOptions = {}) {
    const [analytics, setAnalytics] = useState<LoggerAnalytics | null>(null);
    const [allLoggers, setAllLoggers] = useState<LoggerAnalytics[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalytics = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const url = loggerId
                ? `/api/analytics/loggers?loggerId=${loggerId}&timeframe=${timeframe}`
                : `/api/analytics/loggers?timeframe=${timeframe}`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Failed to fetch analytics');
            }

            const data = await response.json();

            if (loggerId) {
                setAnalytics(data);
                setAllLoggers([]);
            } else {
                setAllLoggers(data.loggers || []);
                setAnalytics(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            console.error('Error fetching analytics:', err);
        } finally {
            setIsLoading(false);
        }
    }, [loggerId, timeframe]);

    // Initial fetch
    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    // Auto-refresh
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchAnalytics();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchAnalytics]);

    // Get leaderboard
    const fetchLeaderboard = useCallback(async (
        metric: keyof LoggerMetrics = 'totalEvents',
        limit: number = 10
    ) => {
        try {
            const response = await fetch('/api/analytics/loggers/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metric, limit, timeframe }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch leaderboard');
            }

            const data = await response.json();
            return data.leaderboard;
        } catch (err) {
            console.error('Error fetching leaderboard:', err);
            return [];
        }
    }, [timeframe]);

    // Get comparison between two loggers
    const compareLoggers = useCallback((logger1Id: string, logger2Id: string) => {
        const logger1 = allLoggers.find(l => l.logger.id === logger1Id);
        const logger2 = allLoggers.find(l => l.logger.id === logger2Id);

        if (!logger1 || !logger2) {
            return null;
        }

        return {
            logger1: logger1.logger,
            logger2: logger2.logger,
            comparison: {
                totalEvents: {
                    logger1: logger1.metrics.totalEvents,
                    logger2: logger2.metrics.totalEvents,
                    difference: logger1.metrics.totalEvents - logger2.metrics.totalEvents,
                    winner: logger1.metrics.totalEvents > logger2.metrics.totalEvents ? 'logger1' : 'logger2',
                },
                matchesLogged: {
                    logger1: logger1.metrics.matchesLogged,
                    logger2: logger2.metrics.matchesLogged,
                    difference: logger1.metrics.matchesLogged - logger2.metrics.matchesLogged,
                    winner: logger1.metrics.matchesLogged > logger2.metrics.matchesLogged ? 'logger1' : 'logger2',
                },
                qualityScore: {
                    logger1: logger1.metrics.qualityScore,
                    logger2: logger2.metrics.qualityScore,
                    difference: logger1.metrics.qualityScore - logger2.metrics.qualityScore,
                    winner: logger1.metrics.qualityScore > logger2.metrics.qualityScore ? 'logger1' : 'logger2',
                },
                eventsPerMatch: {
                    logger1: logger1.metrics.eventsPerMatch,
                    logger2: logger2.metrics.eventsPerMatch,
                    difference: logger1.metrics.eventsPerMatch - logger2.metrics.eventsPerMatch,
                    winner: logger1.metrics.eventsPerMatch > logger2.metrics.eventsPerMatch ? 'logger1' : 'logger2',
                },
            },
        };
    }, [allLoggers]);

    // Get top performers
    const getTopPerformers = useCallback((metric: keyof LoggerMetrics, count: number = 3) => {
        return [...allLoggers]
            .sort((a, b) => b.metrics[metric] - a.metrics[metric])
            .slice(0, count);
    }, [allLoggers]);

    // Get logger rank
    const getLoggerRank = useCallback((loggerId: string, metric: keyof LoggerMetrics = 'totalEvents') => {
        const sorted = [...allLoggers].sort((a, b) => b.metrics[metric] - a.metrics[metric]);
        const rank = sorted.findIndex(l => l.logger.id === loggerId) + 1;
        return rank || null;
    }, [allLoggers]);

    return {
        // Data
        analytics,
        allLoggers,
        isLoading,
        error,

        // Actions
        refresh: fetchAnalytics,
        fetchLeaderboard,
        compareLoggers,
        getTopPerformers,
        getLoggerRank,
    };
}
