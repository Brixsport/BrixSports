import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { db } from '@/db';
import { pushSubscriptions, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const authUser = await getAuthUser(request).catch(() => null);
    if (!authUser || authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: any = {
        timestamp: new Date().toISOString(),
        steps: [],
    };

    try {
        // Step 1: Check environment variables
        results.steps.push({
            step: 1,
            name: 'Environment Variables',
            vapidPublicKeyExists: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
            vapidPrivateKeyExists: !!process.env.VAPID_PRIVATE_KEY,
            vapidPublicKeyLength: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.length || 0,
            vapidPrivateKeyLength: process.env.VAPID_PRIVATE_KEY?.length || 0,
            vapidPublicKeyPreview: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.substring(0, 20) + '...',
        });

        // Step 2: Try to configure web-push
        try {
            const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@brixsport.com';
            if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                webpush.setVapidDetails(
                    vapidSubject,
                    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                    process.env.VAPID_PRIVATE_KEY
                );
                results.steps.push({
                    step: 2,
                    name: 'VAPID Configuration',
                    success: true,
                    message: 'VAPID configured successfully',
                });
            } else {
                results.steps.push({
                    step: 2,
                    name: 'VAPID Configuration',
                    success: false,
                    error: 'Missing VAPID keys',
                });
                return NextResponse.json(results);
            }
        } catch (error) {
            console.error('[Diagnose] VAPID configuration error:', error);
            results.steps.push({
                step: 2,
                name: 'VAPID Configuration',
                success: false,
                error: 'Failed to configure VAPID',
            });
            return NextResponse.json(results);
        }

        // Step 3: Check subscriptions in database
        try {
            const allSubscriptions = await db.select().from(pushSubscriptions);
            results.steps.push({
                step: 3,
                name: 'Database Subscriptions',
                success: true,
                totalSubscriptions: allSubscriptions.length,
                subscriptions: allSubscriptions.map(sub => ({
                    id: sub.id,
                    userId: sub.userId,
                    endpoint: sub.endpoint.substring(0, 100),
                    endpointDomain: new URL(sub.endpoint).hostname,
                    hasP256dh: !!sub.p256dh,
                    hasAuth: !!sub.auth,
                    p256dhLength: sub.p256dh?.length,
                    authLength: sub.auth?.length,
                })),
            });

            if (allSubscriptions.length === 0) {
                results.steps.push({
                    step: 3.5,
                    name: 'Subscription Check',
                    warning: true,
                    message: 'No subscriptions found in database',
                });
            }
        } catch (error) {
            console.error('[Diagnose] Database subscriptions error:', error);
            results.steps.push({
                step: 3,
                name: 'Database Subscriptions',
                success: false,
                error: 'Failed to query subscriptions',
            });
        }

        // Step 4: Validate subscription endpoints
        const allSubscriptions = await db.select().from(pushSubscriptions);
        const validationIssues: string[] = [];
        
        for (const sub of allSubscriptions) {
            // Check endpoint is FCM
            if (!sub.endpoint.includes('fcm.googleapis.com') && !sub.endpoint.includes('updates.push.services.mozilla.com')) {
                validationIssues.push(`Subscription ${sub.id}: Endpoint is not FCM or Mozilla (${sub.endpoint.substring(0, 50)})`);
            }
            
            // Check keys exist
            if (!sub.p256dh || !sub.auth) {
                validationIssues.push(`Subscription ${sub.id}: Missing encryption keys`);
            }
            
            // Check user exists
            const userExists = await db.select({ id: users.id }).from(users).where(eq(users.id, sub.userId)).limit(1);
            if (userExists.length === 0) {
                validationIssues.push(`Subscription ${sub.id}: User ${sub.userId} does not exist`);
            }
        }

        results.steps.push({
            step: 4,
            name: 'Subscription Validation',
            issues: validationIssues,
            issueCount: validationIssues.length,
        });

        // Step 5: Try to send a test notification (but don't actually send)
        try {
            const payload = JSON.stringify({
                title: 'Test',
                body: 'Test notification',
            });
            
            // Just validate the payload format
            JSON.parse(payload);
            
            results.steps.push({
                step: 5,
                name: 'Payload Validation',
                success: true,
                payloadSize: payload.length,
            });
        } catch (error: any) {
            results.steps.push({
                step: 5,
                name: 'Payload Validation',
                success: false,
                error: error.message,
            });
        }

        results.overallSuccess = results.steps.every((s: any) => s.success !== false);
        
        return NextResponse.json(results);
    } catch (error) {
        console.error('[Diagnose] Diagnostic failed:', error);
        return NextResponse.json({ error: 'Diagnostic failed' }, { status: 500 });
    }
}

// POST to actually test send to a specific subscription
export async function POST(request: NextRequest) {
    const authUser = await getAuthUser(request).catch(() => null);
    if (!authUser || authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { subscriptionId } = await request.json();
        
        // Configure VAPID
        const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@brixsport.com';
        if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
        }
        
        webpush.setVapidDetails(
            vapidSubject,
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );

        // Get subscription
        let subscription;
        if (subscriptionId) {
            const sub = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.id, subscriptionId)).limit(1);
            subscription = sub[0];
        } else {
            // Get first subscription
            const sub = await db.select().from(pushSubscriptions).limit(1);
            subscription = sub[0];
        }

        if (!subscription) {
            return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
        }

        const payload = JSON.stringify({
            title: '🔔 Direct Test Notification',
            body: 'This is a direct test from the diagnose endpoint',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-96x96.png',
            data: {
                url: '/',
                type: 'test',
            },
            tag: 'diagnose-test',
            requireInteraction: true,
            vibrate: [200, 100, 200],
        });

        const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
            },
        };

        console.log('[Diagnose] Sending to:', subscription.endpoint.substring(0, 50));
        
        try {
            await webpush.sendNotification(pushSubscription, payload);
            return NextResponse.json({
                success: true,
                message: 'Notification sent successfully',
                subscriptionId: subscription.id,
                endpoint: subscription.endpoint.substring(0, 50) + '...',
            });
        } catch (error) {
            console.error('[Diagnose] Send failed:', error);
            return NextResponse.json({
                success: false,
                error: 'Failed to send notification',
                subscriptionId: subscription.id,
            }, { status: 500 });
        }
    } catch (error) {
        console.error('[Diagnose] POST failed:', error);
        return NextResponse.json({ error: 'Diagnostic send failed' }, { status: 500 });
    }
}
