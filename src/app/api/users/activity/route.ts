/**
 * User Activity API
 * Track and retrieve user activity for the activity feed
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userActivity, users, teams, players, matches } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

/**
 * GET user's activity history
 * GET /api/users/activity?userId=xxx&limit=20&type=match_watched
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20), 100);
        const activityType = searchParams.get('type');

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        // Build query
        let query = db
            .select()
            .from(userActivity)
            .where(eq(userActivity.userId, userId))
            .orderBy(desc(userActivity.createdAt))
            .limit(limit);

        if (activityType) {
            query = db
                .select()
                .from(userActivity)
                .where(
                    and(
                        eq(userActivity.userId, userId),
                        eq(userActivity.activityType, activityType)
                    )
                )
                .orderBy(desc(userActivity.createdAt))
                .limit(limit) as any;
        }

        const activities = await query;

        // Fetch related entity details
        const activitiesWithDetails = await Promise.all(
            activities.map(async (activity) => {
                let entityDetails = null;

                if (activity.entityType && activity.entityId) {
                    switch (activity.entityType) {
                        case 'team':
                            [entityDetails] = await db
                                .select()
                                .from(teams)
                                .where(eq(teams.id, activity.entityId));
                            break;
                        case 'player':
                            [entityDetails] = await db
                                .select()
                                .from(players)
                                .where(eq(players.id, activity.entityId));
                            break;
                        case 'match':
                            [entityDetails] = await db
                                .select()
                                .from(matches)
                                .where(eq(matches.id, activity.entityId));
                            break;
                    }
                }

                return {
                    ...activity,
                    entityDetails,
                    metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
                };
            })
        );

        return NextResponse.json({
            activities: activitiesWithDetails,
            total: activities.length,
        });
    } catch (error) {
        console.error('Error fetching user activity:', error);
        return NextResponse.json(
            { error: 'Failed to fetch activity' },
            { status: 500 }
        );
    }
}

/**
 * LOG user activity
 * POST /api/users/activity
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, activityType, entityType, entityId, metadata } = body;

        if (!userId || !activityType) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Create activity record
        const activityId = `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await db.insert(userActivity).values({
            id: activityId,
            userId,
            activityType,
            entityType: entityType || null,
            entityId: entityId || null,
            metadata: metadata ? JSON.stringify(metadata) : null,
        });

        return NextResponse.json(
            {
                success: true,
                activityId,
                message: 'Activity logged successfully',
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error logging activity:', error);
        return NextResponse.json(
            { error: 'Failed to log activity' },
            { status: 500 }
        );
    }
}

/**
 * GET activity statistics
 * GET /api/users/activity/stats?userId=xxx
 */
export async function PATCH(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        // Get activity counts by type
        const stats = await db
            .select({
                activityType: userActivity.activityType,
                count: sql<number>`count(*)`,
            })
            .from(userActivity)
            .where(eq(userActivity.userId, userId))
            .groupBy(userActivity.activityType);

        // Get total activity count
        const [totalResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(userActivity)
            .where(eq(userActivity.userId, userId));

        return NextResponse.json({
            stats: stats.reduce((acc, stat) => {
                acc[stat.activityType] = stat.count;
                return acc;
            }, {} as Record<string, number>),
            total: totalResult?.count || 0,
        });
    } catch (error) {
        console.error('Error fetching activity stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch activity stats' },
            { status: 500 }
        );
    }
}

/**
 * DELETE user activity (clear history)
 * DELETE /api/users/activity?userId=xxx&before=timestamp
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const before = searchParams.get('before'); // Optional: delete activities before this timestamp

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        if (before) {
            // Delete activities before specific date
            const beforeDate = new Date(parseInt(before));
            await db
                .delete(userActivity)
                .where(
                    and(
                        eq(userActivity.userId, userId),
                        sql`${userActivity.createdAt} < ${beforeDate}`
                    )
                );
        } else {
            // Delete all activities for user
            await db
                .delete(userActivity)
                .where(eq(userActivity.userId, userId));
        }

        return NextResponse.json({
            success: true,
            message: 'Activity history cleared',
        });
    } catch (error) {
        console.error('Error deleting activity:', error);
        return NextResponse.json(
            { error: 'Failed to delete activity' },
            { status: 500 }
        );
    }
}
