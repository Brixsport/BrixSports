/**
 * User Preferences API
 * Manage user preferences and settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET user preferences
 * GET /api/users/[id]/preferences
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: userId } = await params;

        const [preferences] = await db
            .select()
            .from(userPreferences)
            .where(eq(userPreferences.userId, userId));

        if (!preferences) {
            // Create default preferences if none exist
            const prefId = `pref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            await db.insert(userPreferences).values({
                id: prefId,
                userId,
                theme: 'dark',
                language: 'en',
                notifications: true,
                emailNotifications: true,
                matchAlerts: true,
                playerRatings: true,
                scoutUpdates: true,
                milestones: true,
                matchReminders: true,
                favoriteTeamUpdates: true,
                weeklyDigest: false,
                profileVisibility: 'public',
                showStats: true,
                showActivity: true,
                soundEffects: true,
                animations: true,
                compactMode: false,
                favoriteSports: JSON.stringify(['Football']),
                defaultView: 'standings',
                timezone: 'UTC',
            });

            const [newPreferences] = await db
                .select()
                .from(userPreferences)
                .where(eq(userPreferences.userId, userId));

            return NextResponse.json({
                preferences: {
                    ...newPreferences,
                    favoriteSports: JSON.parse(newPreferences.favoriteSports || '[]'),
                },
            });
        }

        return NextResponse.json({
            preferences: {
                ...preferences,
                favoriteSports: JSON.parse(preferences.favoriteSports || '[]'),
            },
        });
    } catch (error) {
        console.error('Error fetching user preferences:', error);
        return NextResponse.json(
            { error: 'Failed to fetch preferences' },
            { status: 500 }
        );
    }
}

/**
 * UPDATE user preferences
 * PATCH /api/users/[id]/preferences
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: userId } = await params;
        const body = await request.json();

        // Build update object
        const updateData: any = {
            updatedAt: new Date(),
        };

        // Update only provided fields
        if (body.theme !== undefined) updateData.theme = body.theme;
        if (body.language !== undefined) updateData.language = body.language;
        if (body.notifications !== undefined) updateData.notifications = body.notifications;
        if (body.emailNotifications !== undefined) updateData.emailNotifications = body.emailNotifications;
        if (body.matchReminders !== undefined) updateData.matchReminders = body.matchReminders;
        if (body.favoriteTeamUpdates !== undefined) updateData.favoriteTeamUpdates = body.favoriteTeamUpdates;
        if (body.weeklyDigest !== undefined) updateData.weeklyDigest = body.weeklyDigest;
        if (body.profileVisibility !== undefined) updateData.profileVisibility = body.profileVisibility;
        if (body.showStats !== undefined) updateData.showStats = body.showStats;
        if (body.showActivity !== undefined) updateData.showActivity = body.showActivity;
        if (body.soundEffects !== undefined) updateData.soundEffects = body.soundEffects;
        if (body.animations !== undefined) updateData.animations = body.animations;
        if (body.compactMode !== undefined) updateData.compactMode = body.compactMode;
        if (body.favoriteSports !== undefined) {
            updateData.favoriteSports = JSON.stringify(body.favoriteSports);
        }
        if (body.matchAlerts !== undefined) updateData.matchAlerts = body.matchAlerts;
        if (body.playerRatings !== undefined) updateData.playerRatings = body.playerRatings;
        if (body.scoutUpdates !== undefined) updateData.scoutUpdates = body.scoutUpdates;
        if (body.milestones !== undefined) updateData.milestones = body.milestones;
        if (body.defaultView !== undefined) updateData.defaultView = body.defaultView;
        if (body.timezone !== undefined) updateData.timezone = body.timezone;

        // Update preferences
        await db
            .update(userPreferences)
            .set(updateData)
            .where(eq(userPreferences.userId, userId));

        // Get updated preferences
        const [updatedPreferences] = await db
            .select()
            .from(userPreferences)
            .where(eq(userPreferences.userId, userId));

        return NextResponse.json({
            success: true,
            preferences: {
                ...updatedPreferences,
                favoriteSports: JSON.parse(updatedPreferences.favoriteSports || '[]'),
            },
        });
    } catch (error) {
        console.error('Error updating user preferences:', error);
        return NextResponse.json(
            { error: 'Failed to update preferences' },
            { status: 500 }
        );
    }
}

/**
 * RESET user preferences to defaults
 * DELETE /api/users/[id]/preferences
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: userId } = await params;

        // Reset to default preferences
        await db
            .update(userPreferences)
            .set({
                theme: 'dark',
                language: 'en',
                notifications: true,
                emailNotifications: true,
                favoriteSports: JSON.stringify(['Football']),
                defaultView: 'standings',
                timezone: 'UTC',
                updatedAt: new Date(),
            })
            .where(eq(userPreferences.userId, userId));

        const [resetPreferences] = await db
            .select()
            .from(userPreferences)
            .where(eq(userPreferences.userId, userId));

        return NextResponse.json({
            success: true,
            message: 'Preferences reset to defaults',
            preferences: {
                ...resetPreferences,
                favoriteSports: JSON.parse(resetPreferences.favoriteSports || '[]'),
            },
        });
    } catch (error) {
        console.error('Error resetting user preferences:', error);
        return NextResponse.json(
            { error: 'Failed to reset preferences' },
            { status: 500 }
        );
    }
}
