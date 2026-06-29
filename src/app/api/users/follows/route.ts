/**
 * User Follows API
 * Manage user follows with notification preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userFollows, competitions, teams, players } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

/**
 * GET user's follows
 * GET /api/users/follows?userId=xxx&type=team
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const type = searchParams.get('type'); // 'team' | 'player' | 'competition'

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        if (authUser.id !== userId && authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Build query
        let query = db
            .select()
            .from(userFollows);

        if (type) {
            query = query.where(
                and(
                    eq(userFollows.userId, userId),
                    eq(userFollows.followType, type)
                )
            ) as any;
        } else {
            query = query.where(eq(userFollows.userId, userId)) as any;
        }

        const follows = await query;

        // Fetch full details for each follow
        const followsWithDetails = await Promise.all(
            follows.map(async (follow) => {
                let details = null;

                switch (follow.followType) {
                    case 'competition':
                        [details] = await db
                            .select()
                            .from(competitions)
                            .where(eq(competitions.id, follow.followId));
                        break;
                    case 'team':
                        [details] = await db
                            .select()
                            .from(teams)
                            .where(eq(teams.id, follow.followId));
                        break;
                    case 'player':
                        [details] = await db
                            .select()
                            .from(players)
                            .where(eq(players.id, follow.followId));
                        break;
                }

                return {
                    ...follow,
                    details,
                };
            })
        );

        return NextResponse.json({
            follows: followsWithDetails,
        });
    } catch (error) {
        console.error('Error fetching follows:', error);
        return NextResponse.json(
            { error: 'Failed to fetch follows' },
            { status: 500 }
        );
    }
}

/**
 * FOLLOW entity
 * POST /api/users/follows
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { userId, followType, followId, notificationsEnabled = true } = body;

        if (!userId || !followType || !followId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (authUser.id !== userId && authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Check if already following
        const existing = await db
            .select()
            .from(userFollows)
            .where(
                and(
                    eq(userFollows.userId, userId),
                    eq(userFollows.followType, followType),
                    eq(userFollows.followId, followId)
                )
            );

        if (existing.length > 0) {
            return NextResponse.json(
                { error: 'Already following' },
                { status: 400 }
            );
        }

        // Create follow
        const followIdStr = `follow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await db.insert(userFollows).values({
            id: followIdStr,
            userId,
            followType,
            followId,
            notificationsEnabled,
        });

        // Update follower count if competition
        if (followType === 'competition') {
            await db
                .update(competitions)
                .set({ followersCount: sql`${competitions.followersCount} + 1` })
                .where(eq(competitions.id, followId));
        }

        return NextResponse.json({
            success: true,
            followId: followIdStr,
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating follow:', error);
        return NextResponse.json(
            { error: 'Failed to create follow' },
            { status: 500 }
        );
    }
}

/**
 * UNFOLLOW entity
 * DELETE /api/users/follows
 */
export async function DELETE(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const followType = searchParams.get('type');
        const followId = searchParams.get('id');

        if (!userId || !followType || !followId) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        if (authUser.id !== userId && authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Delete follow
        await db
            .delete(userFollows)
            .where(
                and(
                    eq(userFollows.userId, userId),
                    eq(userFollows.followType, followType),
                    eq(userFollows.followId, followId)
                )
            );

        // Update follower count if competition
        if (followType === 'competition') {
            await db
                .update(competitions)
                .set({ followersCount: sql`${competitions.followersCount} - 1` })
                .where(eq(competitions.id, followId));
        }

        return NextResponse.json({
            success: true,
            message: 'Unfollowed successfully',
        });
    } catch (error) {
        console.error('Error unfollowing:', error);
        return NextResponse.json(
            { error: 'Failed to unfollow' },
            { status: 500 }
        );
    }
}

/**
 * UPDATE notification preferences for a follow
 * PATCH /api/users/follows
 */
export async function PATCH(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { userId, followType, followId, notificationsEnabled } = body;

        if (!userId || !followType || !followId || notificationsEnabled === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (authUser.id !== userId && authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Update notification preference
        await db
            .update(userFollows)
            .set({ notificationsEnabled })
            .where(
                and(
                    eq(userFollows.userId, userId),
                    eq(userFollows.followType, followType),
                    eq(userFollows.followId, followId)
                )
            );

        return NextResponse.json({
            success: true,
            message: 'Notification preferences updated',
        });
    } catch (error) {
        console.error('Error updating follow preferences:', error);
        return NextResponse.json(
            { error: 'Failed to update preferences' },
            { status: 500 }
        );
    }
}
