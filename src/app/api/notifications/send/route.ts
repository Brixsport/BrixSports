import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { db } from '@/db';
import { pushSubscriptions, userFollows, userFavorites, users } from '@/db/schema';
import { eq, inArray, and, or } from 'drizzle-orm';

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

// Helper function to get target user IDs based on audience selection
async function getTargetUserIds(
  targetAudience: string,
  selectedTeams?: string[],
  selectedMatch?: string
): Promise<string[]> {
  switch (targetAudience) {
    case 'team_followers': {
      if (!selectedTeams || selectedTeams.length === 0) {
        return [];
      }
      
      // Get users who follow any of the selected teams
      const teamFollowers = await db
        .select({ userId: userFollows.userId })
        .from(userFollows)
        .where(
          and(
            eq(userFollows.followType, 'team'),
            inArray(userFollows.followId, selectedTeams)
          )
        );
      
      const teamFavorites = await db
        .select({ userId: userFavorites.userId })
        .from(userFavorites)
        .where(
          and(
            eq(userFavorites.favoriteType, 'team'),
            inArray(userFavorites.favoriteId, selectedTeams)
          )
        );
      
      const primaryTeamFans = await db
        .select({ userId: users.id })
        .from(users)
        .where(inArray(users.favoriteTeamId, selectedTeams));
      
      const allUserIds = new Set([
        ...teamFollowers.map(f => f.userId),
        ...teamFavorites.map(f => f.userId),
        ...primaryTeamFans.map(f => f.userId),
      ]);
      
      return Array.from(allUserIds);
    }
    
    case 'match_specific': {
      // For match-specific, we'd need match data to get team IDs
      // For now, return all users (fallback)
      return [];
    }
    
    case 'all':
    default:
      return []; // Empty means all subscribers
  }
}

// POST /api/notifications/send - Send push notification to subscribers
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
        const { 
            type, 
            title, 
            body: notificationBody, 
            icon, 
            url, 
            image,
            actions,
            vibrate,
            requireInteraction,
            newsId, 
            transferId,
            targetAudience,
            selectedTeams,
            selectedMatch,
            matchId
        } = body;

        console.log('[Notifications API] Received request:', {
            type,
            title,
            body: notificationBody?.substring(0, 50),
            icon,
            image,
            url,
            targetAudience,
            selectedTeams,
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

        // Get target user IDs if filtering by audience
        const targetUserIds = await getTargetUserIds(targetAudience, selectedTeams, selectedMatch);
        
        // Build notification payload with all options
        const payloadObj: any = {
            title,
            body: notificationBody,
            icon: icon || '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            data: {
                url: url || '/',
                type,
                newsId,
                transferId,
                matchId,
            },
            actions: actions || [
                { action: 'view', title: 'View' },
                { action: 'close', title: 'Close' },
            ],
        };
        
        // Add optional fields
        if (image) payloadObj.image = image;
        if (vibrate) payloadObj.vibrate = vibrate;
        if (requireInteraction) payloadObj.requireInteraction = requireInteraction;

        const payload = JSON.stringify(payloadObj);

        // Fetch subscriptions based on target audience
        const allSubscriptions = await (targetUserIds.length > 0
            ? db.select().from(pushSubscriptions).where(
                inArray(pushSubscriptions.userId, targetUserIds)
            )
            : db.select().from(pushSubscriptions)
        );
        
        console.log('[Notifications API] Found subscriptions:', {
            total: allSubscriptions.length,
            targetAudience,
            targetUserCount: targetUserIds.length,
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

                await webpush.sendNotification(pushSubscription, payload);
                successCount++;
            } catch (error: any) {
                console.error(`[Notifications API] Failed to send to ${sub.id}:`, error.message);

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

        // Save to history
        const historyEntry = {
            title,
            body: notificationBody,
            targetAudience,
            sentTo: successCount,
            totalSubscriptions: allSubscriptions.length,
            failedSubscriptions: failedSubscriptions.length,
            sentAt: new Date().toISOString(),
        };
        
        // Save to history API (fire and forget)
        try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(historyEntry),
            });
        } catch (e) {
            console.log('[Notifications API] Failed to save history:', e);
        }

        console.log('[Notifications API] Final result:', {
            success: true,
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
