import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Configure web-push with VAPID keys for each request (serverless-safe)
function configureVAPID(): boolean {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@brixsport.com';

    console.log('[Notifications API] VAPID Configuration:', {
        hasPublicKey: !!vapidPublicKey,
        hasPrivateKey: !!vapidPrivateKey,
        publicKeyLength: vapidPublicKey?.length,
        privateKeyLength: vapidPrivateKey?.length,
    });

    if (vapidPublicKey && vapidPrivateKey) {
        webpush.setVapidDetails(
            vapidSubject,
            vapidPublicKey,
            vapidPrivateKey
        );
        console.log('[Notifications API] VAPID configured successfully');
        return true;
    } else {
        console.error('[Notifications API] VAPID keys missing!');
        return false;
    }
}

// POST /api/notifications/send - Send push notification to all subscribers
export async function POST(request: NextRequest) {
    try {
        // Configure VAPID fresh for each request (serverless-safe)
        const vapidConfigured = configureVAPID();
        if (!vapidConfigured) {
            return NextResponse.json(
                { error: 'VAPID keys not configured. Check server environment variables.' },
                { status: 500 }
            );
        }
        const body = await request.json();
        const { type, title, body: notificationBody, icon, url, newsId, transferId } = body;

        console.log('[Notifications API] Received request:', {
            type,
            title,
            body: notificationBody?.substring(0, 50),
            icon,
            url,
            newsId,
            transferId,
        });

        if (!title || !notificationBody) {
            console.error('[Notifications API] Missing required fields:', { title: !!title, body: !!notificationBody });
            return NextResponse.json(
                { error: 'Missing required fields: title, body' },
                { status: 400 }
            );
        }

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
        
        console.log('[Notifications API] Found subscriptions:', {
            total: allSubscriptions.length,
            subscriptions: allSubscriptions.map(sub => ({
                id: sub.id,
                userId: sub.userId,
                endpoint: sub.endpoint?.substring(0, 50) + '...',
                hasP256dh: !!sub.p256dh,
                hasAuth: !!sub.auth,
                createdAt: sub.createdAt,
            }))
        });

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

                console.log(`[Notifications API] Sending to ${sub.id}:`, {
                    endpoint: sub.endpoint?.substring(0, 50) + '...',
                    hasKeys: !!(pushSubscription.keys.p256dh && pushSubscription.keys.auth)
                });

                await webpush.sendNotification(pushSubscription, payload);
                successCount++;
                console.log(`[Notifications API] Success sending to ${sub.id}`);
            } catch (error: any) {
                console.error(`[Notifications API] Failed to send to ${sub.id}:`, {
                    error: error.message,
                    statusCode: error.statusCode,
                    headers: error.headers,
                    body: error.body,
                    stack: error.stack,
                    endpoint: sub.endpoint.substring(0, 100)
                });

                // If subscription is invalid (410 Gone or 404 Not Found), remove it
                if (error.statusCode === 410 || error.statusCode === 404) {
                    console.log(`[Notifications API] Removing expired subscription ${sub.id}`);
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

        console.log('[Notifications API] Sending to all subscriptions completed:', {
            successCount,
            failedCount: failedSubscriptions.length,
            failedIds: failedSubscriptions,
            totalProcessed: allSubscriptions.length
        });

        console.log('[Notifications API] Final result:', {
            success: true,
            message: 'Push notification sent successfully',
            sentTo: successCount,
            totalSubscriptions: allSubscriptions.length,
            failedSubscriptions: failedSubscriptions.length,
        });

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
