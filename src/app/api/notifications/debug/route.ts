import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pushSubscriptions, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
        const detailedSubscriptions = [];
        
        for (const sub of allSubscriptions) {
            const details: any = {
                id: sub.id,
                userId: sub.userId,
                endpoint: sub.endpoint.substring(0, 100) + '...',
                domain: new URL(sub.endpoint).hostname,
                hasKeys: !!(sub.p256dh && sub.auth),
                createdAt: sub.createdAt,
                updatedAt: sub.updatedAt,
                issues: [],
            };

            // Check if endpoint is FCM
            if (!sub.endpoint.includes('fcm.googleapis.com') && !sub.endpoint.includes('mozilla')) {
                details.issues.push('Not FCM endpoint');
                issues.push(`Subscription ${sub.id}: Not FCM/Mozilla endpoint (${details.domain})`);
            }
            
            // Check if keys are present
            if (!sub.p256dh || !sub.auth) {
                details.issues.push('Missing encryption keys');
                issues.push(`Subscription ${sub.id}: Missing encryption keys`);
            }
            
            // Check if user exists
            const userExists = await db.select({ id: users.id }).from(users).where(eq(users.id, sub.userId)).limit(1);
            if (userExists.length === 0) {
                details.issues.push('User does not exist');
                issues.push(`Subscription ${sub.id}: User ${sub.userId} does not exist in database`);
            } else {
                details.userValid = true;
            }
            
            // Check if subscription is old (more than 30 days)
            const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
            const updatedAt = new Date(sub.updatedAt as number);
            if (updatedAt.getTime() && updatedAt.getTime() < thirtyDaysAgo.getTime()) {
                details.issues.push('Older than 30 days');
                issues.push(`Subscription ${sub.id}: Older than 30 days`);
            }

            detailedSubscriptions.push(details);
        }

        return NextResponse.json({
            success: true,
            totalSubscriptions: allSubscriptions.length,
            subscriptions: detailedSubscriptions,
            issues,
            issueCount: issues.length,
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
