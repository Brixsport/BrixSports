/**
 * Push Notification Subscription API
 * POST /api/notifications/subscribe - Subscribe to push notifications
 * DELETE /api/notifications/subscribe - Unsubscribe from push notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Subscribe to push notifications
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, subscription } = body;

        if (!userId || !subscription) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Validate subscription format
        if (!subscription.endpoint || !subscription.keys) {
            return NextResponse.json(
                { error: 'Invalid subscription format' },
                { status: 400 }
            );
        }

        // Check if subscription already exists for this endpoint
        const existing = await db
            .select()
            .from(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
            .limit(1);

        if (existing.length > 0) {
            // Update existing subscription
            await db
                .update(pushSubscriptions)
                .set({
                    userId,
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth,
                    userAgent: request.headers.get('user-agent') || undefined,
                    updatedAt: new Date(),
                })
                .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
        } else {
            // Create new subscription
            await db.insert(pushSubscriptions).values({
                id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                userAgent: request.headers.get('user-agent') || undefined,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Subscription saved successfully',
        });
    } catch (error: any) {
        console.error('[NotificationAPI] Error saving subscription:', error);
        console.error('[NotificationAPI] Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack,
        });
        return NextResponse.json(
            { error: 'Failed to save subscription', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json(
                { error: 'Missing userId' },
                { status: 400 }
            );
        }

        // Remove all subscriptions for this user
        await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.userId, userId));

        return NextResponse.json({
            success: true,
            message: 'Subscription removed successfully',
        });
    } catch (error) {
        console.error('[NotificationAPI] Error removing subscription:', error);
        return NextResponse.json(
            { error: 'Failed to remove subscription' },
            { status: 500 }
        );
    }
}

/**
 * Get subscription status
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'Missing userId' },
                { status: 400 }
            );
        }

        // Get subscriptions from database
        const userSubscriptions = await db
            .select()
            .from(pushSubscriptions)
            .where(eq(pushSubscriptions.userId, userId));

        return NextResponse.json({
            subscribed: userSubscriptions.length > 0,
            subscriptions: userSubscriptions,
            count: userSubscriptions.length,
        });
    } catch (error) {
        console.error('[NotificationAPI] Error getting subscription:', error);
        return NextResponse.json(
            { error: 'Failed to get subscription' },
            { status: 500 }
        );
    }
}
