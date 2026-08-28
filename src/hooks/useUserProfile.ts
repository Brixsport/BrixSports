'use client';

import { useState, useEffect, useCallback } from 'react';
import { getClientErrorMessage } from '@/lib/client-error';

export interface UserProfile {
    id: string;
    email: string;
    name: string;
    avatar: string | null;
    bio: string | null;
    favoriteTeamId: string | null;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserPreferences {
    id: string;
    userId: string;
    theme: string;
    language: string;
    notifications: boolean;
    emailNotifications: boolean;
    favoriteSports: string[];
    defaultView: string;
    timezone: string;
    updatedAt: Date;
}

export interface UserStats {
    favoriteTeam: any | null;
    totalFavorites: number;
    totalFollows: number;
    favoritesByType: Record<string, number>;
    followsByType: Record<string, number>;
}

interface UserProfileData {
    user: UserProfile;
    preferences: UserPreferences | null;
    stats: UserStats | null;
}

interface UseUserProfileOptions {
    userId: string;
    includeStats?: boolean;
}

export function useUserProfile({ userId, includeStats = true }: UseUserProfileOptions) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (includeStats) {
                params.append('includeStats', 'true');
            }

            const response = await fetch(`/api/users/${userId}?${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch user profile');
            }

            const data: UserProfileData = await response.json();

            setProfile(data.user);
            setPreferences(data.preferences);
            setStats(data.stats);
        } catch (err) {
            setError(getClientErrorMessage(err, 'An error occurred'));
        } finally {
            setLoading(false);
        }
    }, [userId, includeStats]);

    const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                throw new Error('Failed to update profile');
            }

            const data = await response.json();
            setProfile(data.user);
            return true;
        } catch (err) {
            console.error('Error updating profile:', err);
            return false;
        }
    }, [userId]);

    const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
        try {
            const response = await fetch(`/api/users/${userId}/preferences`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                throw new Error('Failed to update preferences');
            }

            const data = await response.json();
            setPreferences(data.preferences);
            return true;
        } catch (err) {
            console.error('Error updating preferences:', err);
            return false;
        }
    }, [userId]);

    const resetPreferences = useCallback(async () => {
        try {
            const response = await fetch(`/api/users/${userId}/preferences`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to reset preferences');
            }

            const data = await response.json();
            setPreferences(data.preferences);
            return true;
        } catch (err) {
            console.error('Error resetting preferences:', err);
            return false;
        }
    }, [userId]);

    const deleteAccount = useCallback(async () => {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete account');
            }

            return true;
        } catch (err) {
            console.error('Error deleting account:', err);
            return false;
        }
    }, [userId]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    return {
        profile,
        preferences,
        stats,
        loading,
        error,
        refresh: fetchProfile,
        updateProfile,
        updatePreferences,
        resetPreferences,
        deleteAccount,
    };
}

// Hook for managing user preferences only
export function useUserPreferences(userId: string) {
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPreferences = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/users/${userId}/preferences`);

            if (!response.ok) {
                throw new Error('Failed to fetch preferences');
            }

            const data = await response.json();
            setPreferences(data.preferences);
        } catch (err) {
            setError(getClientErrorMessage(err, 'An error occurred'));
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
        try {
            const response = await fetch(`/api/users/${userId}/preferences`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                throw new Error('Failed to update preferences');
            }

            const data = await response.json();
            setPreferences(data.preferences);
            return true;
        } catch (err) {
            console.error('Error updating preferences:', err);
            return false;
        }
    }, [userId]);

    useEffect(() => {
        fetchPreferences();
    }, [fetchPreferences]);

    return {
        preferences,
        loading,
        error,
        refresh: fetchPreferences,
        updatePreferences,
    };
}
