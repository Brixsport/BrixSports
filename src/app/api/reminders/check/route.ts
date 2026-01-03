/**
 * Match Reminder Checker API
 * Checks for pending reminders and sends notifications
 * This endpoint should be called by a cron job or scheduled task
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchReminders, matches, pushSubscriptions } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import webpush from 'web-push';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@brixsport.com';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

/**
 * POST /api/reminders/check
 * Check for pending reminders and send notifications
 */
export async function POST(request: NextRequest) {
    try {
        // Verify this is a cron job or authorized request
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET || 'dev-cron-secret';

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const now = new Date();

        // Get all pending reminders that should be sent now
        const pendingReminders = await db
            .select({
                reminder: matchReminders,
                match: matches,
            })
            .from(matchReminders)
            .leftJoin(matches, eq(matchReminders.matchId, matches.id))
            .where(
                and(
                    eq(matchReminders.notificationSent, false),
                    lte(matchReminders.reminderTime, now)
                )
            );

        let sentCount = 0;
        const errors: string[] = [];

        // Process each reminder
        for (const { reminder, match } of pendingReminders) {
            if (!reminder || !match) continue;

            try {
                // Get user's push subscriptions
                const userSubscriptions = await db
                    .select()
                    .from(pushSubscriptions)
                    .where(eq(pushSubscriptions.userId, reminder.userId));

                if (userSubscriptions.length === 0) {
                    // No subscriptions, mark as sent anyway
                    await db
                        .update(matchReminders)
                        .set({
                            notificationSent: true,
                            notificationSentAt: now,
                        })
                        .where(eq(matchReminders.id, reminder.id));
                    continue;
                }

                // Create notification payload
                const payload = JSON.stringify({
                    title: '⚽ Match Starting Soon!',
                    body: `${match.homeTeamId} vs ${match.awayTeamId} starts in ${reminder.minutesBefore} minutes`,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/badge-96x96.png',
                    data: {
                        url: `/matches/${match.id}`,
                        type: 'match_reminder',
                        matchId: match.id,
                    },
                    actions: [
                        {
                            action: 'view',
                            title: 'View Match',
                        },
                        {
                            action: 'close',
                            title: 'Dismiss',
                        },
                    ],
                });

                // Send to all user's subscriptions
                for (const sub of userSubscriptions) {
                    try {
                        const pushSubscription = {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth,
                            },
                        };

                        await webpush.sendNotification(pushSubscription, payload);
                    } catch (error: any) {
                        // If subscription is invalid, remove it
                        if (error.statusCode === 410 || error.statusCode === 404) {
                            await db
                                .delete(pushSubscriptions)
                                .where(eq(pushSubscriptions.id, sub.id));
                        }
                    }
                }

                // Mark reminder as sent
                await db
                    .update(matchReminders)
                    .set({
                        notificationSent: true,
                        notificationSentAt: now,
                    })
                    .where(eq(matchReminders.id, reminder.id));

                sentCount++;
            } catch (error: any) {
                console.error(`[Reminder Checker] Error processing reminder ${reminder.id}:`, error);
                errors.push(`Reminder ${reminder.id}: ${error.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            processed: pendingReminders.length,
            sent: sentCount,
            errors: errors.length > 0 ? errors : undefined,
            timestamp: now.toISOString(),
        });
    } catch (error) {
        console.error('[Reminder Checker] Error:', error);
        return NextResponse.json(
            { error: 'Failed to process reminders' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/reminders/check
 * Get status of reminder checker (for monitoring)
 */
export async function GET(request: NextRequest) {
    try {
        const now = new Date();

        // Count pending reminders
        const pendingCount = await db
            .select()
            .from(matchReminders)
            .where(
                and(
                    eq(matchReminders.notificationSent, false),
                    lte(matchReminders.reminderTime, now)
                )
            );

        // Count upcoming reminders (next 24 hours)
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const upcomingCount = await db
            .select()
            .from(matchReminders)
            .where(
                and(
                    eq(matchReminders.notificationSent, false),
                    lte(matchReminders.reminderTime, tomorrow)
                )
            );

        return NextResponse.json({
            status: 'operational',
            pendingNow: pendingCount.length,
            upcomingNext24h: upcomingCount.length,
            timestamp: now.toISOString(),
        });
    } catch (error) {
        console.error('[Reminder Checker] Error getting status:', error);
        return NextResponse.json(
            { error: 'Failed to get status' },
            { status: 500 }
        );
    }
}
