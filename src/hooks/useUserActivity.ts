'use client';

import { useState, useEffect, useCallback } from 'react';
import { getClientErrorMessage } from '@/lib/client-error';
import { getRelativeTime, getActivityColor } from '@/components/ActivityFeed';
import type { ActivityItem } from '@/components/ActivityFeed';

interface UseUserActivityOptions {
    userId: string;
    limit?: number;
    type?: string;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

interface ActivityResponse {
    activities: any[];
    total: number;
}

export function useUserActivity({
    userId,
    limit = 20,
    type,
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
}: UseUserActivityOptions) {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchActivities = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                userId,
                limit: limit.toString(),
            });

            if (type) {
                params.append('type', type);
            }

            const response = await fetch(`/api/users/activity?${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch activities');
            }

            const data: ActivityResponse = await response.json();

            // Transform API response to ActivityItem format
            const transformedActivities: ActivityItem[] = data.activities.map((activity) => {
                const metadata = activity.metadata || {};

                return {
                    id: activity.id,
                    type: activity.activityType,
                    title: generateActivityTitle(activity),
                    subtitle: generateActivitySubtitle(activity),
                    time: getRelativeTime(new Date(activity.createdAt)),
                    color: getActivityColor(activity.activityType),
                    entityType: activity.entityType,
                    entityId: activity.entityId,
                    metadata: metadata,
                };
            });

            setActivities(transformedActivities);
        } catch (err) {
            setError(getClientErrorMessage(err, 'An error occurred'));
        } finally {
            setLoading(false);
        }
    }, [userId, limit, type]);

    // Log new activity
    const logActivity = useCallback(async (
        activityType: string,
        entityType?: string,
        entityId?: string,
        metadata?: any
    ) => {
        try {
            const response = await fetch('/api/users/activity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    activityType,
                    entityType,
                    entityId,
                    metadata,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to log activity');
            }

            // Refresh activities after logging
            await fetchActivities();

            return true;
        } catch (err) {
            console.error('Error logging activity:', err);
            return false;
        }
    }, [userId, fetchActivities]);

    // Clear activity history
    const clearHistory = useCallback(async (beforeTimestamp?: number) => {
        try {
            const params = new URLSearchParams({ userId });
            if (beforeTimestamp) {
                params.append('before', beforeTimestamp.toString());
            }

            const response = await fetch(`/api/users/activity?${params}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to clear history');
            }

            await fetchActivities();
            return true;
        } catch (err) {
            console.error('Error clearing history:', err);
            return false;
        }
    }, [userId, fetchActivities]);

    // Initial fetch
    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    // Auto-refresh
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(fetchActivities, refreshInterval);
        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchActivities]);

    return {
        activities,
        loading,
        error,
        refresh: fetchActivities,
        logActivity,
        clearHistory,
    };
}

// Helper functions to generate activity titles and subtitles
function generateActivityTitle(activity: any): string {
    const metadata = activity.metadata || {};

    switch (activity.activityType) {
        case 'match_watched':
            return `Watched ${metadata.homeTeam || 'Team'} vs ${metadata.awayTeam || 'Team'}`;
        case 'team_followed':
            return `Started following ${activity.entityDetails?.name || 'a team'}`;
        case 'player_followed':
            return `Started following ${activity.entityDetails?.name || 'a player'}`;
        case 'favorite_added':
            if (activity.entityType === 'team') {
                return `Added ${activity.entityDetails?.name || 'team'} to favorites`;
            } else if (activity.entityType === 'player') {
                return `Added ${activity.entityDetails?.name || 'player'} to favorites`;
            }
            return 'Added to favorites';
        case 'prediction_made':
            return `Predicted ${metadata.prediction || 'match outcome'}`;
        case 'competition_followed':
            return `Started following ${activity.entityDetails?.name || 'a competition'}`;
        default:
            return 'Activity';
    }
}

function generateActivitySubtitle(activity: any): string {
    const metadata = activity.metadata || {};

    switch (activity.activityType) {
        case 'match_watched':
            return `${metadata.sport || 'Match'} • ${metadata.competition || ''}`;
        case 'team_followed':
        case 'player_followed':
            return activity.entityDetails?.university || activity.entityDetails?.team || '';
        case 'favorite_added':
            if (activity.entityType === 'player') {
                return `${activity.entityDetails?.team || ''} • ${activity.entityDetails?.position || ''}`;
            }
            return activity.entityDetails?.university || '';
        case 'prediction_made':
            return metadata.competition || 'Match prediction';
        case 'competition_followed':
            return `${metadata.sport || ''} • ${metadata.teams || ''} teams`;
        default:
            return '';
    }
}

// Convenience hooks for specific activity types
export function useMatchActivity(userId: string) {
    return useUserActivity({ userId, type: 'match_watched', limit: 10 });
}

export function useFavoriteActivity(userId: string) {
    return useUserActivity({ userId, type: 'favorite_added', limit: 10 });
}

export function useFollowActivity(userId: string) {
    return useUserActivity({
        userId,
        limit: 10,
    });
}
