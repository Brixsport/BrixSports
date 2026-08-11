import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { db } from '@/db';
import { pushSubscriptions, pushSubscriptionMatches, userFollows, userFavorites, users, matches, userPreferences } from '@/db/schema';
import { eq, inArray, and, or, ne } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { logNotificationSend } from '@/lib/notifications/match-notification-service';

// BUG-204: a bounded ceiling on the "send to all" query -- CLAUDE.md requires a
// .limit() on every list endpoint with no exceptions. This is not a targeting
// change (the audience is still genuinely "everyone"), just a hard cap so this
// can never become a truly unbounded scan as the subscriber base grows.
const MAX_BROADCAST_SUBSCRIPTIONS = 5000;

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

// Users following/favoriting/primary-supporting any of a set of teams.
// BACKLOG-212 item 2: previously ignored userPreferences.matchAlerts entirely,
// unlike sendMatchEventNotification() -- same filter, same "no record = TRUE
// per schema default" reasoning, applied here now that the composer is
// officially in scope.
async function getTeamFollowerUserIds(teamIds: string[]): Promise<string[]> {
  const [teamFollowers, teamFavorites, primaryTeamFans] = await Promise.all([
    db.select({ userId: userFollows.userId }).from(userFollows).where(
      and(eq(userFollows.followType, 'team'), inArray(userFollows.followId, teamIds))
    ),
    db.select({ userId: userFavorites.userId }).from(userFavorites).where(
      and(eq(userFavorites.favoriteType, 'team'), inArray(userFavorites.favoriteId, teamIds))
    ),
    db.select({ userId: users.id }).from(users).where(inArray(users.favoriteTeamId, teamIds)),
  ]);

  const potentialUserIds = Array.from(new Set([
    ...teamFollowers.map(f => f.userId),
    ...teamFavorites.map(f => f.userId),
    ...primaryTeamFans.map(f => f.userId),
  ]));
  if (potentialUserIds.length === 0) return [];

  // Session 51: also excludes userPreferences.notifications === false, the same
  // master-mute fix applied to match-notification-service.ts's identical query --
  // keeps this composer path consistent with the real event-notification path.
  const disabledPrefUsers = await db
    .select({ userId: userPreferences.userId })
    .from(userPreferences)
    .where(and(
      inArray(userPreferences.userId, potentialUserIds),
      or(eq(userPreferences.matchAlerts, false), eq(userPreferences.notifications, false))
    ));
  const disabledUserIds = new Set(disabledPrefUsers.map(p => p.userId));

  return potentialUserIds.filter(id => !disabledUserIds.has(id));
}

// BUG-204: previously returned [] for both "no filter, send to everyone" (audience
// 'all') and "filtered down to nobody" (empty team selection; match_specific was
// literally unimplemented and always fell into this branch). Both were then
// treated identically as "no filter" at the call site, so selecting a specific
// match or an empty team list silently sent to every subscriber with no warning.
// Now returns `null` to mean "no filter" (only 'all' means this) and a `string[]`
// (possibly empty) to mean "exactly these users, and only these" for every
// audience-scoped case -- an empty array must never fall back to "everyone".
async function getTargetUserIds(
  targetAudience: string,
  selectedTeams?: string[],
  selectedMatch?: string
): Promise<string[] | null> {
  switch (targetAudience) {
    case 'team_followers': {
      if (!selectedTeams || selectedTeams.length === 0) {
        return []; // nothing selected -> nobody, not everybody
      }
      return getTeamFollowerUserIds(selectedTeams);
    }

    case 'match_specific': {
      if (!selectedMatch) {
        return [];
      }
      const match = await db
        .select({ homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId })
        .from(matches)
        .where(eq(matches.id, selectedMatch))
        .get();
      if (!match) {
        return [];
      }
      // Followers of either team in this specific match. Anonymous per-match
      // subscribers (BACKLOG-150, no userId at all) are merged in separately
      // at the call site via pushSubscriptionMatches, not through this path.
      return getTeamFollowerUserIds([match.homeTeamId, match.awayTeamId]);
    }

    case 'all':
    default:
      return null; // explicit "no filter" -- the only case this should mean everyone
  }
}

// POST /api/notifications/send - Send push notification to subscribers
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

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

        // Get target user IDs if filtering by audience. `null` = no filter (send to
        // all); a `string[]` (possibly empty) = exactly these users, full stop.
        const targetUserIds = await getTargetUserIds(targetAudience, selectedTeams, selectedMatch);

        // BACKLOG-150 anonymous per-match subscribers have no userId at all, so they
        // can never appear in targetUserIds -- merge them in by subscription id for
        // match_specific specifically, same pattern sendMatchEventNotification() uses.
        let matchAnonymousSubscriptionIds: string[] = [];
        if (targetAudience === 'match_specific' && selectedMatch) {
            const anon = await db
                .select({ id: pushSubscriptions.id })
                .from(pushSubscriptionMatches)
                .innerJoin(pushSubscriptions, eq(pushSubscriptionMatches.subscriptionId, pushSubscriptions.id))
                .where(eq(pushSubscriptionMatches.matchId, selectedMatch));
            matchAnonymousSubscriptionIds = anon.map(a => a.id);
        }

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

        // Fetch subscriptions based on target audience. See getTargetUserIds's own
        // comment (BUG-204) -- null is the only case that means "everyone"; a
        // resolved-but-empty audience must send to nobody, not fall back to all.
        let allSubscriptions: (typeof pushSubscriptions.$inferSelect)[];
        if (targetUserIds === null) {
            // BACKLOG-212 item 2: BACKLOG-150's anonymous per-match subscribers
            // consented to alerts for ONE specific match, not a general broadcast --
            // including them in 'all' was a real consent problem, not just a UX one.
            // Excluded by the sentinel user id their rows are always keyed under.
            allSubscriptions = await db
                .select()
                .from(pushSubscriptions)
                .where(ne(pushSubscriptions.userId, 'anonymous-push-subscriber'))
                .limit(MAX_BROADCAST_SUBSCRIPTIONS);
        } else {
            const idConditions = [];
            if (targetUserIds.length > 0) idConditions.push(inArray(pushSubscriptions.userId, targetUserIds));
            if (matchAnonymousSubscriptionIds.length > 0) idConditions.push(inArray(pushSubscriptions.id, matchAnonymousSubscriptionIds));

            allSubscriptions = idConditions.length > 0
                ? await db.select().from(pushSubscriptions).where(or(...idConditions)).limit(MAX_BROADCAST_SUBSCRIPTIONS)
                : [];
        }

        // Log unique user IDs with subscriptions for debugging
        const uniqueUserIds = [...new Set(allSubscriptions.map(s => s.userId))];
        console.log('[Notifications API] Found subscriptions:', {
            total: allSubscriptions.length,
            targetAudience,
            targetUserCount: targetUserIds === null ? 'all' : targetUserIds.length,
            uniqueUsersWithSubscriptions: uniqueUserIds.length,
            userIds: uniqueUserIds, // List all user IDs that have subscriptions
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

        // BACKLOG-211/roadmap-doc bonus finding: this used to be a self-`fetch()`
        // to /api/notifications/history with no auth headers, which 401'd every
        // single time against that route's own admin gate and was silently
        // swallowed by the surrounding try/catch -- the composer's "Recent
        // History" panel has therefore always been empty. Direct write instead,
        // same shared log table/helper every other send path now uses.
        await logNotificationSend({
            source: 'campaign',
            matchId: matchId || null,
            eventType: type || null,
            targetAudience,
            totalSubscriptions: allSubscriptions.length,
            sentCount: successCount,
            failedCount: failedSubscriptions.length,
        });

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
