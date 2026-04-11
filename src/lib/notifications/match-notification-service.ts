/**
 * Match Notification Service
 * Sends push notifications for match events to subscribed users
 */

import { db } from '@/db';
import { pushSubscriptions, userFollows, userFavorites, teams, players, users, userPreferences } from '@/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import webpush from 'web-push';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@brixsport.com';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

interface NotificationPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
    actions?: Array<{ action: string; title: string }>;
}

interface MatchEventNotification {
    matchId: string;
    homeTeamId: string;
    awayTeamId: string;
    eventType: 'MATCH_START' | 'GOAL' | 'RED_CARD' | 'YELLOW_CARD' | 'LINEUP_AVAILABLE' | 'MATCH_END' | 'HALF_TIME';
    playerName?: string;
    teamName?: string;
    minute?: number;
    homeScore?: number;
    awayScore?: number;
}

/**
 * Send notifications to users who follow the teams in this match
 */
export async function sendMatchEventNotification(event: MatchEventNotification): Promise<{
    success: boolean;
    sentCount: number;
    totalSubscriptions: number;
    errors?: string[];
}> {
    try {
        console.log('[MatchNotificationService] Sending notification for event:', event.eventType);

        // Get users who follow either team in this match
        const teamFollowers = await db
            .select({
                userId: userFollows.userId,
                followId: userFollows.followId,
            })
            .from(userFollows)
            .where(
                and(
                    eq(userFollows.followType, 'team'),
                    or(
                        eq(userFollows.followId, event.homeTeamId),
                        eq(userFollows.followId, event.awayTeamId)
                    ),
                    eq(userFollows.notificationsEnabled, true)
                )
            );

        // Also get users who have favorited either team via the userFavorites table
        const teamFavorites = await db
            .select({
                userId: userFavorites.userId,
                favoriteId: userFavorites.favoriteId,
            })
            .from(userFavorites)
            .where(
                and(
                    eq(userFavorites.favoriteType, 'team'),
                    or(
                        eq(userFavorites.favoriteId, event.homeTeamId),
                        eq(userFavorites.favoriteId, event.awayTeamId)
                    )
                )
            );

        // Also get users who have either team as their primary favoriteTeamId in the users table
        const primaryTeamFans = await db
            .select({
                userId: users.id,
            })
            .from(users)
            .where(
                or(
                    eq(users.favoriteTeamId, event.homeTeamId),
                    eq(users.favoriteTeamId, event.awayTeamId)
                )
            );

        // Combine and deduplicate user IDs
        const potentialUserIds = Array.from(new Set([
            ...teamFollowers.map(f => f.userId),
            ...teamFavorites.map(f => f.userId),
            ...primaryTeamFans.map(f => f.userId)
        ]));

        if (potentialUserIds.length === 0) {
            console.log('[MatchNotificationService] No users following these teams');
            return { success: true, sentCount: 0, totalSubscriptions: 0 };
        }

        // Filter out users who have disabled matchAlerts in their preferences
        // Note: If no preference record exists, we assume TRUE as per schema default
        const disabledPrefUsers = await db
            .select({ userId: userPreferences.userId })
            .from(userPreferences)
            .where(
                and(
                    inArray(userPreferences.userId, potentialUserIds),
                    eq(userPreferences.matchAlerts, false)
                )
            );

        const disabledUserIds = new Set(disabledPrefUsers.map(p => p.userId));
        const allUserIds = potentialUserIds.filter(id => !disabledUserIds.has(id));

        if (allUserIds.length === 0) {
            console.log('[MatchNotificationService] All interested users have disabled alerts');
            return { success: true, sentCount: 0, totalSubscriptions: 0 };
        }

        // Get push subscriptions for these users
        const subscriptions = await db
            .select()
            .from(pushSubscriptions)
            .where(inArray(pushSubscriptions.userId, allUserIds));

        if (subscriptions.length === 0) {
            console.log('[MatchNotificationService] No push subscriptions found for followers');
            return { success: true, sentCount: 0, totalSubscriptions: 0 };
        }

        // Create notification payload based on event type
        const payload = createNotificationPayload(event);

        let sentCount = 0;
        const errors: string[] = [];
        const failedSubscriptions: string[] = [];

        // Send to all subscriptions
        for (const sub of subscriptions) {
            try {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                };

                await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
                sentCount++;
            } catch (error: any) {
                console.error('[MatchNotificationService] Failed to send to subscription:', error);
                errors.push(`Subscription ${sub.id}: ${error.message}`);

                // If subscription is invalid (410 Gone or 404 Not Found), mark for removal
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
            console.log(`[MatchNotificationService] Removed ${failedSubscriptions.length} invalid subscriptions`);
        }

        console.log(`[MatchNotificationService] Sent ${sentCount}/${subscriptions.length} notifications`);

        return {
            success: true,
            sentCount,
            totalSubscriptions: subscriptions.length,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error) {
        console.error('[MatchNotificationService] Error sending notifications:', error);
        return {
            success: false,
            sentCount: 0,
            totalSubscriptions: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
        };
    }
}

/**
 * Create notification payload based on event type
 */
function createNotificationPayload(event: MatchEventNotification): NotificationPayload {
    const baseData = {
        url: `/matches/${event.matchId}`,
        type: 'match_event',
        matchId: event.matchId,
        eventType: event.eventType,
    };

    const baseActions = [
        { action: 'view', title: 'View Match' },
        { action: 'close', title: 'Dismiss' },
    ];

    switch (event.eventType) {
        case 'MATCH_START':
            return {
                title: '🔴 Match Started!',
                body: `${event.teamName} match is now LIVE!`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: baseData,
                actions: baseActions,
            };

        case 'LINEUP_AVAILABLE':
            return {
                title: '📋 Lineup Available!',
                body: `Starting lineup for ${event.teamName} is now available`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: baseData,
                actions: baseActions,
            };

        case 'GOAL':
            return {
                title: '⚽ GOAL!',
                body: `${event.playerName} scores! ${event.homeScore}-${event.awayScore} (${event.minute}')`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: { ...baseData, playerName: event.playerName, minute: event.minute },
                actions: baseActions,
            };

        case 'RED_CARD':
            return {
                title: '🟥 Red Card!',
                body: `${event.playerName} has been sent off! (${event.minute}')`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: { ...baseData, playerName: event.playerName, minute: event.minute },
                actions: baseActions,
            };

        case 'YELLOW_CARD':
            return {
                title: '🟨 Yellow Card',
                body: `${event.playerName} has been booked (${event.minute}')`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: { ...baseData, playerName: event.playerName, minute: event.minute },
                actions: baseActions,
            };

        case 'HALF_TIME':
            return {
                title: '⏸️ Half Time',
                body: `Half time: ${event.homeScore}-${event.awayScore}`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: baseData,
                actions: baseActions,
            };

        case 'MATCH_END':
            return {
                title: '⏹️ Full Time!',
                body: `Match finished: ${event.homeScore}-${event.awayScore}`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: baseData,
                actions: baseActions,
            };

        default:
            return {
                title: '⚽ Match Update',
                body: `New event in ${event.teamName} match`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: baseData,
                actions: baseActions,
            };
    }
}

/**
 * Send notification for match starting soon (30 minutes, 15 minutes before)
 * Sends to ALL users with push subscriptions (not just team followers)
 */
export async function sendMatchReminderNotification(
    matchId: string,
    homeTeamId: string,
    awayTeamId: string,
    homeTeamName: string,
    awayTeamName: string,
    minutesBefore: number
): Promise<{ success: boolean; sentCount: number }> {
    try {
        console.log(`[MatchNotificationService] Sending ${minutesBefore}-minute reminder for match ${matchId}`);

        // Get ALL push subscriptions (send to everyone, not just team followers)
        const subscriptions = await db
            .select()
            .from(pushSubscriptions);

        if (subscriptions.length === 0) {
            console.log('[MatchNotificationService] No push subscriptions found');
            return { success: true, sentCount: 0 };
        }

        console.log(`[MatchNotificationService] Found ${subscriptions.length} push subscriptions`);

        const payload: NotificationPayload = {
            title: '⏰ Match Starting Soon!',
            body: `${homeTeamName} vs ${awayTeamName} starts in ${minutesBefore} minutes`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            data: {
                url: `/matches/${matchId}`,
                type: 'match_reminder',
                matchId,
                minutesBefore,
            },
            actions: [
                { action: 'view', title: 'View Match' },
                { action: 'close', title: 'Dismiss' },
            ],
        };

        let sentCount = 0;
        const failedSubscriptions: string[] = [];

        for (const sub of subscriptions) {
            try {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                };

                await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
                sentCount++;
            } catch (error: any) {
                console.error(`[MatchNotificationService] Failed to send to subscription ${sub.id}:`, error.message);

                // If subscription is invalid, mark for removal
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
            console.log(`[MatchNotificationService] Removed ${failedSubscriptions.length} invalid subscriptions`);
        }

        console.log(`[MatchNotificationService] Sent ${sentCount}/${subscriptions.length} notifications`);

        return { success: true, sentCount };
    } catch (error) {
        console.error('[MatchNotificationService] Error sending reminder:', error);
        return { success: false, sentCount: 0 };
    }
}

