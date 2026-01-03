import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@brixsport.com';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey
    );
}

// POST /api/notifications/send - Send push notification to all subscribers
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, title, body: notificationBody, icon, url, newsId, transferId } = body;

        if (!title || !notificationBody) {
            return NextResponse.json(
                { error: 'Missing required fields: title, body' },
                { status: 400 }
            );
        }

        // TODO: Fetch all push subscriptions from database
        // For now, we'll return success and log the notification
        console.log('[Notifications] Sending push notification:', {
            type,
            title,
            body: notificationBody,
            icon,
            url,
        });

        // Notification payload
        const payload = JSON.stringify({
            title,
            body: notificationBody,
            icon: icon || '/icons/icon-192x192.png',
            badge: '/icons/badge-96x96.png',
            data: {
                url: url || '/',
                type,
                newsId,
                transferId,
            },
            actions: [
                {
                    action: 'view',
                    title: 'View',
                },
                {
                    action: 'close',
                    title: 'Close',
                },
            ],
        });

        // Fetch all push subscriptions from database
        const allSubscriptions = await db.select().from(pushSubscriptions);

        let successCount = 0;
        const failedSubscriptions: string[] = [];

        // Send to all subscriptions
        for (const sub of allSubscriptions) {
            try {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                };

                await webpush.sendNotification(pushSubscription, payload);
                successCount++;
            } catch (error: any) {
                console.error('Failed to send to subscription:', error);

                // If subscription is invalid (410 Gone or 404 Not Found), remove it
                if (error.statusCode === 410 || error.statusCode === 404) {
                    failedSubscriptions.push(sub.id);
                }
            }
        }

        // Clean up invalid subscriptions
        if (failedSubscriptions.length > 0) {
            for (const subId of failedSubscriptions) {
                await db
                    .delete(pushSubscriptions)
                    .where(eq(pushSubscriptions.id, subId));
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Push notification sent successfully',
            sentTo: successCount,
            totalSubscriptions: allSubscriptions.length,
            failedSubscriptions: failedSubscriptions.length,
        });
    } catch (error) {
        console.error('[Notifications API] Error sending notification:', error);
        return NextResponse.json(
            { error: 'Failed to send push notification' },
            { status: 500 }
        );
    }
}
