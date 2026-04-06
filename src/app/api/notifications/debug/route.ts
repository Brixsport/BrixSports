import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';

export async function GET() {
    try {
        // Get all subscriptions for debugging
        const allSubscriptions = await db.select().from(pushSubscriptions);
        
        console.log('[Debug] All subscriptions in database:');
        allSubscriptions.forEach((sub, index) => {
            console.log(`[${index + 1}] Subscription:`, {
                id: sub.id,
                userId: sub.userId,
                endpoint: sub.endpoint,
                endpointDomain: new URL(sub.endpoint).hostname,
                hasP256dh: !!sub.p256dh,
                hasAuth: !!sub.auth,
                p256dhLength: sub.p256dh?.length,
                authLength: sub.auth?.length,
                createdAt: sub.createdAt,
                updatedAt: sub.updatedAt,
                userAgent: sub.userAgent,
            });
        });

        // Check for potential issues
        const issues: string[] = [];
        allSubscriptions.forEach(sub => {
            // Check if endpoint is FCM
            if (!sub.endpoint.includes('fcm.googleapis.com')) {
                issues.push(`Subscription ${sub.id}: Not FCM endpoint`);
            }
            
            // Check if keys are present
            if (!sub.p256dh || !sub.auth) {
                issues.push(`Subscription ${sub.id}: Missing encryption keys`);
            }
            
            // Check if subscription is old (more than 30 days)
            const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
            const updatedAt = new Date(sub.updatedAt as number);
            if (updatedAt.getTime() && updatedAt.getTime() < thirtyDaysAgo.getTime()) {
                issues.push(`Subscription ${sub.id}: Older than 30 days`);
            }
        });

        return NextResponse.json({
            success: true,
            totalSubscriptions: allSubscriptions.length,
            subscriptions: allSubscriptions.map(sub => ({
                id: sub.id,
                userId: sub.userId,
                endpoint: sub.endpoint.substring(0, 100) + '...',
                domain: new URL(sub.endpoint).hostname,
                hasKeys: !!(sub.p256dh && sub.auth),
                createdAt: sub.createdAt,
                updatedAt: sub.updatedAt,
            })),
            issues,
            message: issues.length > 0 ? `Found ${issues.length} potential issues` : 'All subscriptions look valid'
        });
    } catch (error) {
        console.error('[Debug] Error:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        );
    }
}
