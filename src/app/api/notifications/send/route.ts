import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Configure web-push with VAPID keys for each request (serverless-safe)
function configureVAPID(): { success: boolean; error?: string } {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@brixsport.com';

    console.log('[Notifications API] VAPID Configuration:', {
        hasPublicKey: !!vapidPublicKey,
        hasPrivateKey: !!vapidPrivateKey,
        publicKeyLength: vapidPublicKey?.length,
        privateKeyLength: vapidPrivateKey?.length,
        publicKeyPreview: vapidPublicKey?.substring(0, 20) + '...',
        privateKeyPreview: vapidPrivateKey?.substring(0, 20) + '...',
    });

    if (!vapidPublicKey || !vapidPrivateKey) {
        console.error('[Notifications API] VAPID keys missing!');
        return { success: false, error: 'VAPID keys not set in environment' };
    }

    // Validate key format (base64url)
    const base64urlPattern = /^[A-Za-z0-9_-]+$/;
    if (!base64urlPattern.test(vapidPublicKey)) {
        console.error('[Notifications API] VAPID public key has invalid characters');
        return { success: false, error: 'VAPID public key contains invalid characters (should be base64url)' };
    }
    if (!base64urlPattern.test(vapidPrivateKey)) {
        console.error('[Notifications API] VAPID private key has invalid characters');
        return { success: false, error: 'VAPID private key contains invalid characters (should be base64url)' };
    }

    // Check key lengths (typical lengths for ECDSA P-256 keys)
    if (vapidPublicKey.length < 80) {
        console.error('[Notifications API] VAPID public key too short:', vapidPublicKey.length);
        return { success: false, error: `VAPID public key too short (${vapidPublicKey.length} chars, expected ~87)` };
    }
    if (vapidPrivateKey.length < 40) {
        console.error('[Notifications API] VAPID private key too short:', vapidPrivateKey.length);
        return { success: false, error: `VAPID private key too short (${vapidPrivateKey.length} chars, expected ~43)` };
    }

    try {
        webpush.setVapidDetails(
            vapidSubject,
            vapidPublicKey,
            vapidPrivateKey
        );
        console.log('[Notifications API] VAPID configured successfully');
        return { success: true };
    } catch (error: any) {
        console.error('[Notifications API] VAPID configuration failed:', error);
        return { success: false, error: `VAPID configuration error: ${error.message}` };
    }
}

// POST /api/notifications/send - Send push notification to all subscribers
export async function POST(request: NextRequest) {
    try {
        // Configure VAPID fresh for each request (serverless-safe)
        const vapidResult = configureVAPID();
        if (!vapidResult.success) {
            return NextResponse.json(
                { error: vapidResult.error || 'VAPID configuration failed' },
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
