/**
 * User Profile API
 * Manage user profile information and preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, userPreferences, userFavorites, userFollows, teams } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * GET user profile with stats
 * GET /api/users/[id]/route.ts?includeStats=true
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: userId } = await params;
        const { searchParams } = new URL(request.url);
        const includeStats = searchParams.get('includeStats') === 'true';

        // Get user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId));

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Get user preferences
        const [preferences] = await db
            .select()
            .from(userPreferences)
            .where(eq(userPreferences.userId, userId));

        let stats = null;
        if (includeStats) {
            // Get favorite team details
            let favoriteTeam = null;
            if (user.favoriteTeamId) {
                [favoriteTeam] = await db
                    .select()
                    .from(teams)
                    .where(eq(teams.id, user.favoriteTeamId));
            }

            // Get counts
            const [favoritesCount] = await db
                .select({ count: sql<number>`count(*)` })
                .from(userFavorites)
                .where(eq(userFavorites.userId, userId));

            const [followsCount] = await db
                .select({ count: sql<number>`count(*)` })
                .from(userFollows)
                .where(eq(userFollows.userId, userId));

            // Get favorites by type
            const favoritesByType = await db
                .select({
                    type: userFavorites.favoriteType,
                    count: sql<number>`count(*)`,
                })
                .from(userFavorites)
                .where(eq(userFavorites.userId, userId))
                .groupBy(userFavorites.favoriteType);

            // Get follows by type
            const followsByType = await db
                .select({
                    type: userFollows.followType,
                    count: sql<number>`count(*)`,
                })
                .from(userFollows)
                .where(eq(userFollows.userId, userId))
                .groupBy(userFollows.followType);

            stats = {
                favoriteTeam,
                totalFavorites: favoritesCount?.count || 0,
                totalFollows: followsCount?.count || 0,
                favoritesByType: favoritesByType.reduce((acc, item) => {
                    acc[item.type] = item.count;
                    return acc;
                }, {} as Record<string, number>),
                followsByType: followsByType.reduce((acc, item) => {
                    acc[item.type] = item.count;
                    return acc;
                }, {} as Record<string, number>),
            };
        }

        return NextResponse.json({
            user: {
                ...user,
                password: undefined, // Don't send password
            },
            preferences,
            stats,
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user profile' },
            { status: 500 }
        );
    }
}

/**
 * UPDATE user profile
 * PATCH /api/users/[id]/route.ts
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: userId } = await params;
        const body = await request.json();
        const { name, bio, avatar, coverImage, favoriteTeamId } = body;

        // Build update object
        const updateData: any = {
            updatedAt: new Date(),
        };

        if (name !== undefined) updateData.name = name;
        if (bio !== undefined) updateData.bio = bio;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (coverImage !== undefined) updateData.coverImage = coverImage;
        if (favoriteTeamId !== undefined) updateData.favoriteTeamId = favoriteTeamId;

        // Update user
        await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, userId));

        // Get updated user
        const [updatedUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId));

        return NextResponse.json({
            success: true,
            user: {
                ...updatedUser,
                password: undefined,
            },
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        return NextResponse.json(
            { error: 'Failed to update user profile' },
            { status: 500 }
        );
    }
}

/**
 * DELETE user account
 * DELETE /api/users/[id]/route.ts
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: userId } = await params;

        // Delete user (cascade will handle related records)
        await db
            .delete(users)
            .where(eq(users.id, userId));

        return NextResponse.json({
            success: true,
            message: 'User account deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting user account:', error);
        return NextResponse.json(
            { error: 'Failed to delete user account' },
            { status: 500 }
        );
    }
}
