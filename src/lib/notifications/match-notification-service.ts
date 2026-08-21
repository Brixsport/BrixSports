/**
 * Match Notification Service
 * Sends push notifications for match events to subscribed users
 */

import { db } from '@/db';
import { pushSubscriptions, pushSubscriptionMatches, userFollows, userFavorites, teams, players, users, userPreferences, notificationSendLog } from '@/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import webpush from 'web-push';
import { nanoid } from 'nanoid';
import type { NotificationKey } from './notification-rules';

// BACKLOG-211: persistent record of every send attempt -- console.log alone
// isn't reachable outside a live Vercel function invocation, which cost real
// debugging time twice in one session (BUG-200's and BACKLOG-203's own
// verification passes). Best-effort: a logging failure must never break the
// actual notification send, so this never throws into its caller.
export async function logNotificationSend(entry: {
    source: 'match_event' | 'match_reminder' | 'campaign';
    matchId?: string | null;
    eventType?: string | null;
    targetAudience?: string | null;
    totalSubscriptions: number;
    sentCount: number;
    failedCount: number;
    errors?: string[];
}): Promise<void> {
    try {
        await db.insert(notificationSendLog).values({
            id: nanoid(),
            source: entry.source,
            matchId: entry.matchId || null,
            eventType: entry.eventType || null,
            targetAudience: entry.targetAudience || null,
            totalSubscriptions: entry.totalSubscriptions,
            sentCount: entry.sentCount,
            failedCount: entry.failedCount,
            errors: entry.errors && entry.errors.length > 0 ? JSON.stringify(entry.errors) : null,
        });
    } catch (error) {
        console.error('[NotificationSendLog] Failed to write log row (non-fatal):', error);
    }
}

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
    eventType: NotificationKey;
    playerName?: string;
    teamName?: string;
    minute?: number;
    homeScore?: number;
    awayScore?: number;
    // Not yet used for targeting (roadmap item 4, NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md) --
    // added now while the call sites already have both IDs in scope, so a future
    // followed-player audience query doesn't need touching every call site again.
    playerId?: string;
    relatedPlayerId?: string;
    // Item 2, session 53: competition-follow cascade -- following a competition should
    // auto-notify for every match in it, not just matches involving a followed team.
    // Query-time join by competitionId, same architecture as the existing team-follow
    // query below (no materialized per-match rows), so it applies to future matches
    // under a followed competition automatically, with no backfill ever needed.
    competitionId?: string | null;
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

        // Item 2: users who follow this match's competition -- following a competition
        // means every match in it, not just ones involving a team you already follow.
        const competitionFollowers = event.competitionId
            ? await db
                .select({ userId: userFollows.userId })
                .from(userFollows)
                .where(
                    and(
                        eq(userFollows.followType, 'competition'),
                        eq(userFollows.followId, event.competitionId),
                        eq(userFollows.notificationsEnabled, true)
                    )
                )
            : [];

        // Combine and deduplicate user IDs
        const potentialUserIds = Array.from(new Set([
            ...teamFollowers.map(f => f.userId),
            ...teamFavorites.map(f => f.userId),
            ...primaryTeamFans.map(f => f.userId),
            ...competitionFollowers.map(f => f.userId)
        ]));

        // Filter out users who have disabled matchAlerts in their preferences
        // Note: If no preference record exists, we assume TRUE as per schema default.
        // Also excludes userPreferences.notifications === false (session 51 fix) --
        // the profile/settings page's "Push Notifications" toggle previously wrote
        // this column correctly but nothing ever read it, so it had zero effect;
        // this is the master mute this toggle was always supposed to control.
        let teamFollowerSubscriptions: (typeof pushSubscriptions.$inferSelect)[] = [];
        if (potentialUserIds.length > 0) {
            const disabledPrefUsers = await db
                .select({ userId: userPreferences.userId })
                .from(userPreferences)
                .where(
                    and(
                        inArray(userPreferences.userId, potentialUserIds),
                        or(
                            eq(userPreferences.matchAlerts, false),
                            eq(userPreferences.notifications, false)
                        )
                    )
                );

            const disabledUserIds = new Set(disabledPrefUsers.map(p => p.userId));
            const allUserIds = potentialUserIds.filter(id => !disabledUserIds.has(id));

            if (allUserIds.length > 0) {
                teamFollowerSubscriptions = await db
                    .select()
                    .from(pushSubscriptions)
                    .where(inArray(pushSubscriptions.userId, allUserIds));
            }
        }

        // BACKLOG-150: anonymous viewers have no team-follow row to be found by
        // above -- they opted into this specific match directly. Merge their
        // subscriptions in, deduped by subscription id (a device could
        // theoretically match both paths if it later creates an account on the
        // same browser, though that's not wired up here).
        const anonymousMatchSubscriptions = await db
            .select({ subscription: pushSubscriptions })
            .from(pushSubscriptionMatches)
            .innerJoin(pushSubscriptions, eq(pushSubscriptionMatches.subscriptionId, pushSubscriptions.id))
            .where(eq(pushSubscriptionMatches.matchId, event.matchId));

        const subscriptionsById = new Map<string, typeof pushSubscriptions.$inferSelect>();
        for (const s of teamFollowerSubscriptions) subscriptionsById.set(s.id, s);
        for (const { subscription: s } of anonymousMatchSubscriptions) subscriptionsById.set(s.id, s);
        const subscriptions = Array.from(subscriptionsById.values());

        if (subscriptions.length === 0) {
            console.log('[MatchNotificationService] No push subscriptions found for followers or match-specific anonymous subscribers');
            await logNotificationSend({
                source: 'match_event', matchId: event.matchId, eventType: event.eventType,
                totalSubscriptions: 0, sentCount: 0, failedCount: 0,
            });
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

        await logNotificationSend({
            source: 'match_event', matchId: event.matchId, eventType: event.eventType,
            totalSubscriptions: subscriptions.length, sentCount, failedCount: failedSubscriptions.length,
            errors,
        });

        return {
            success: true,
            sentCount,
            totalSubscriptions: subscriptions.length,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error) {
        console.error('[MatchNotificationService] Error sending notifications:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logNotificationSend({
            source: 'match_event', matchId: event.matchId, eventType: event.eventType,
            totalSubscriptions: 0, sentCount: 0, failedCount: 0, errors: [errorMessage],
        });
        return {
            success: false,
            sentCount: 0,
            totalSubscriptions: 0,
            errors: [errorMessage],
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
                body: `${event.playerName || 'A player'} scores! ${event.homeScore}-${event.awayScore} (${event.minute}')`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: { ...baseData, playerName: event.playerName, minute: event.minute },
                actions: baseActions,
            };

        case 'RED_CARD':
            return {
                title: '🟥 Red Card!',
                body: `${event.playerName || 'A player'} has been sent off! (${event.minute}')`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: { ...baseData, playerName: event.playerName, minute: event.minute },
                actions: baseActions,
            };

        case 'YELLOW_CARD':
            return {
                title: '🟨 Yellow Card',
                body: `${event.playerName || 'A player'} has been booked (${event.minute}')`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: { ...baseData, playerName: event.playerName, minute: event.minute },
                actions: baseActions,
            };

        case 'PENALTY_SAVED':
            return {
                title: '🧤 Penalty Saved!',
                body: event.playerName
                    ? `${event.playerName} denies from the spot! Still ${event.homeScore}-${event.awayScore} (${event.minute}')`
                    : `Penalty saved! Still ${event.homeScore}-${event.awayScore} (${event.minute}')`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: { ...baseData, playerName: event.playerName, minute: event.minute },
                actions: baseActions,
            };

        case 'PENALTY_MISSED':
            return {
                title: '❌ Penalty Missed!',
                body: event.playerName
                    ? `${event.playerName} fails to score from the spot. Still ${event.homeScore}-${event.awayScore} (${event.minute}')`
                    : `Penalty missed! Still ${event.homeScore}-${event.awayScore} (${event.minute}')`,
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

        case 'TECHNICAL_FOUL':
            return {
                title: '🟨 Technical Foul',
                body: event.playerName
                    ? `${event.playerName} called for a technical foul`
                    : `Technical foul called (${event.teamName || 'unknown team'})`,
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

        // Get ALL push subscriptions (send to everyone, not just team followers).
        // No current caller (BACKLOG-208 deleted the only route that called this),
        // but CLAUDE.md's .limit()-on-every-list-query rule applies regardless of
        // whether something calls it today.
        const subscriptions = await db
            .select()
            .from(pushSubscriptions)
            .limit(5000);

        if (subscriptions.length === 0) {
            console.log('[MatchNotificationService] No push subscriptions found');
            await logNotificationSend({
                source: 'match_reminder', matchId, eventType: `${minutesBefore}min`,
                totalSubscriptions: 0, sentCount: 0, failedCount: 0,
            });
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

        await logNotificationSend({
            source: 'match_reminder', matchId, eventType: `${minutesBefore}min`,
            totalSubscriptions: subscriptions.length, sentCount, failedCount: failedSubscriptions.length,
        });

        return { success: true, sentCount };
    } catch (error) {
        console.error('[MatchNotificationService] Error sending reminder:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logNotificationSend({
            source: 'match_reminder', matchId, eventType: `${minutesBefore}min`,
            totalSubscriptions: 0, sentCount: 0, failedCount: 0, errors: [errorMessage],
        });
        return { success: false, sentCount: 0 };
    }
}

