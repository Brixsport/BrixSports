/**
 * Push Notification Subscription API
 * POST /api/notifications/subscribe - Subscribe to push notifications
 * DELETE /api/notifications/subscribe - Unsubscribe from push notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pushSubscriptions, pushSubscriptionMatches, users, matches } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { ANONYMOUS_PUSH_USER_ID, ensureAnonymousPushUser } from '@/lib/notifications/anonymous-subscriber';

/**
 * Subscribe to push notifications.
 *
 * BACKLOG-150: two paths now. An authenticated user subscribes as before
 * (userId required, targeted later via team-follow preferences). An
 * anonymous viewer subscribes with a client-generated deviceId + a specific
 * matchId instead -- no login required, no userId in the request body. Auth
 * is checked with .catch(() => null) (established pattern, see
 * known-issues.md "Public GET With Conditional Admin Enrichment") rather than
 * a hard 401, since this route must serve both callers.
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request).catch(() => null);

        const body = await request.json();
        const { userId, subscription, deviceId, matchId } = body;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return NextResponse.json(
                { error: 'Invalid subscription format' },
                { status: 400 }
            );
        }

        const isAnonymous = !authUser;
        let effectiveUserId: string;

        if (isAnonymous) {
            if (!deviceId || !matchId) {
                return NextResponse.json(
                    { error: 'Anonymous subscriptions require deviceId and matchId' },
                    { status: 400 }
                );
            }
            const matchExists = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).limit(1);
            if (matchExists.length === 0) {
                return NextResponse.json({ error: 'Match not found' }, { status: 404 });
            }
            await ensureAnonymousPushUser();
            effectiveUserId = ANONYMOUS_PUSH_USER_ID;
        } else {
            // Authenticated path -- userId in the body must match the verified session
            // (or be an admin acting on someone else's behalf), never trusted as-is.
            if (userId && userId !== authUser.id && authUser.role !== 'admin') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            effectiveUserId = userId || authUser.id;

            const userExists = await db.select({ id: users.id }).from(users).where(eq(users.id, effectiveUserId)).limit(1);
            if (userExists.length === 0) {
                return NextResponse.json({ error: 'User not found. Please log in first.' }, { status: 400 });
            }
        }

        // Check if subscription already exists for this endpoint
        const existing = await db
            .select()
            .from(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
            .limit(1);

        // deviceId is captured for authenticated subscribers too when the client sends
        // one (not just the anonymous path) -- this is what makes the anon-to-auth
        // handoff (see BUG-150's follow-up note) able to recognize "this is the same
        // browser that subscribed anonymously earlier" once a login-time hook is built,
        // rather than relying on endpoint matching alone.
        let subscriptionId: string;
        if (existing.length > 0) {
            subscriptionId = existing[0].id;
            await db
                .update(pushSubscriptions)
                .set({
                    userId: effectiveUserId,
                    deviceId: deviceId || existing[0].deviceId,
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth,
                    userAgent: request.headers.get('user-agent') || undefined,
                })
                .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
        } else {
            subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            await db.insert(pushSubscriptions).values({
                id: subscriptionId,
                userId: effectiveUserId,
                deviceId: deviceId || null,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                userAgent: request.headers.get('user-agent') || undefined,
            });
        }

        if (isAnonymous) {
            const linked = await db
                .select({ matchId: pushSubscriptionMatches.matchId })
                .from(pushSubscriptionMatches)
                .where(eq(pushSubscriptionMatches.subscriptionId, subscriptionId));
            if (!linked.some(l => l.matchId === matchId)) {
                await db.insert(pushSubscriptionMatches).values({
                    id: `psm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    subscriptionId,
                    matchId,
                });
            }
        }

        console.log('[NotificationAPI] Subscription saved successfully:', {
            userId: effectiveUserId,
            anonymous: isAnonymous,
            isUpdate: existing.length > 0,
            endpoint: subscription.endpoint.substring(0, 50),
        });

        return NextResponse.json({
            success: true,
            message: 'Subscription saved successfully',
        });
    } catch (error: any) {
        console.error('[NotificationAPI] Error saving subscription:', error);
        return NextResponse.json(
            { error: 'Failed to save subscription', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Unsubscribe from push notifications.
 *
 * BACKLOG-150: anonymous path -- deviceId + matchId unlinks that one match
 * (a device can be following several matches at once). If that was the
 * device's last linked match, the now-orphaned subscription row is removed
 * too, since an anonymous subscription with zero match-links is inert.
 */
export async function DELETE(request: NextRequest) {
    try {
        // BACKLOG-188: auth check moved above the body parse -- a malformed/empty
        // body used to throw inside request.json() before ever reaching getAuthUser(),
        // masking a real 401 as a generic 500.
        const authUser = await getAuthUser(request).catch(() => null);
        const body = await request.json();
        const { userId, deviceId, matchId } = body;

        if (!authUser) {
            if (!deviceId || !matchId) {
                return NextResponse.json({ error: 'Missing deviceId or matchId' }, { status: 400 });
            }

            const subs = await db
                .select({ id: pushSubscriptions.id })
                .from(pushSubscriptions)
                .where(eq(pushSubscriptions.deviceId, deviceId));

            for (const sub of subs) {
                await db
                    .delete(pushSubscriptionMatches)
                    .where(and(eq(pushSubscriptionMatches.subscriptionId, sub.id), eq(pushSubscriptionMatches.matchId, matchId)));

                const remaining = await db
                    .select({ id: pushSubscriptionMatches.id })
                    .from(pushSubscriptionMatches)
                    .where(eq(pushSubscriptionMatches.subscriptionId, sub.id))
                    .limit(1);
                if (remaining.length === 0) {
                    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
                }
            }

            return NextResponse.json({ success: true, message: 'Unsubscribed from match' });
        }

        if (!userId) {
            return NextResponse.json(
                { error: 'Missing userId' },
                { status: 400 }
            );
        }

        if (authUser.id !== userId && authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.id !== userId && authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
