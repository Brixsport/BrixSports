/**
 * Match Reminder Checker API
 * Checks for pending reminders and sends notifications
 * Triggered by vercel.json's crons block (BACKLOG-208).
 *
 * Vercel Cron Jobs send a GET request to the configured path, not POST --
 * confirmed before wiring this up, since the original version of this file
 * had all the real send logic in POST and only a status summary in GET. If
 * left as-is, the cron would have hit GET, done nothing, and this would have
 * become a second silently-never-actually-triggered scheduler, the exact
 * problem BACKLOG-208 was filed to fix. GET now runs the real check (what the
 * cron calls); POST runs the identical logic for manual/admin-triggered runs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchReminders, matches, teams, pushSubscriptions } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import webpush from 'web-push';

// BACKLOG-208: cron-driven, so not attacker-facing, but still a genuine list
// query -- CLAUDE.md requires a .limit() on every one, no exceptions.
const MAX_REMINDERS_PER_RUN = 500;

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@brixsport.com';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

function isAuthorized(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-cron-secret';
    return authHeader === `Bearer ${cronSecret}`;
}

async function runReminderCheck() {
    const now = new Date();

    // Two separate joins to `teams` (aliased) rather than one, since a
    // reminder needs both the home and away team's name -- BACKLOG-208's own
    // fix for the raw-FK body text this used to send.
    const homeTeams = alias(teams, 'home_teams');
    const awayTeams = alias(teams, 'away_teams');
    const pendingReminders = await db
        .select({
            reminder: matchReminders,
            match: matches,
            homeTeamName: homeTeams.name,
            awayTeamName: awayTeams.name,
        })
        .from(matchReminders)
        .leftJoin(matches, eq(matchReminders.matchId, matches.id))
        .leftJoin(homeTeams, eq(matches.homeTeamId, homeTeams.id))
        .leftJoin(awayTeams, eq(matches.awayTeamId, awayTeams.id))
        .where(
            and(
                eq(matchReminders.notificationSent, false),
                lte(matchReminders.reminderTime, now)
            )
        )
        .limit(MAX_REMINDERS_PER_RUN);

    let sentCount = 0;
    const errors: string[] = [];

    for (const { reminder, match, homeTeamName, awayTeamName } of pendingReminders) {
        if (!reminder || !match) continue;

        try {
            const userSubscriptions = await db
                .select()
                .from(pushSubscriptions)
                .where(eq(pushSubscriptions.userId, reminder.userId));

            if (userSubscriptions.length === 0) {
                await db
                    .update(matchReminders)
                    .set({ notificationSent: true, notificationSentAt: now })
                    .where(eq(matchReminders.id, reminder.id));
                continue;
            }

            const payload = JSON.stringify({
                title: '⚽ Match Starting Soon!',
                body: `${homeTeamName || 'Home'} vs ${awayTeamName || 'Away'} starts in ${reminder.minutesBefore} minutes`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/badge-96x96.png',
                data: {
                    url: `/matches/${match.id}`,
                    type: 'match_reminder',
                    matchId: match.id,
                },
                actions: [
                    { action: 'view', title: 'View Match' },
                    { action: 'close', title: 'Dismiss' },
                ],
            });

            for (const sub of userSubscriptions) {
                try {
                    const pushSubscription = {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth },
                    };
                    await webpush.sendNotification(pushSubscription, payload);
                } catch (error: any) {
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
                    }
                }
            }

            await db
                .update(matchReminders)
                .set({ notificationSent: true, notificationSentAt: now })
                .where(eq(matchReminders.id, reminder.id));

            sentCount++;
        } catch (error: any) {
            console.error(`[Reminder Checker] Error processing reminder ${reminder.id}:`, error);
            errors.push(`Reminder ${reminder.id}: ${error.message}`);
        }
    }

    return {
        success: true,
        processed: pendingReminders.length,
        sent: sentCount,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: now.toISOString(),
    };
}

async function runStatusCheck() {
    const now = new Date();

    const pendingCount = await db
        .select()
        .from(matchReminders)
        .where(and(eq(matchReminders.notificationSent, false), lte(matchReminders.reminderTime, now)))
        .limit(MAX_REMINDERS_PER_RUN);

    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const upcomingCount = await db
        .select()
        .from(matchReminders)
        .where(and(eq(matchReminders.notificationSent, false), lte(matchReminders.reminderTime, tomorrow)))
        .limit(MAX_REMINDERS_PER_RUN);

    return {
        status: 'operational',
        pendingNow: pendingCount.length,
        upcomingNext24h: upcomingCount.length,
        timestamp: now.toISOString(),
    };
}

/**
 * GET /api/reminders/check
 * The real cron target (Vercel Cron Jobs send GET). Runs the actual reminder
 * check and send. Pass ?mode=status for the old monitoring-only summary
 * instead of running a real check (nothing currently calls this, kept for
 * an admin dashboard to use later without re-triggering sends).
 */
export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const mode = request.nextUrl.searchParams.get('mode');
        const result = mode === 'status' ? await runStatusCheck() : await runReminderCheck();
        return NextResponse.json(result);
    } catch (error) {
        console.error('[Reminder Checker] Error:', error);
        return NextResponse.json({ error: 'Failed to process reminders' }, { status: 500 });
    }
}

/**
 * POST /api/reminders/check
 * Manual/admin-triggered run of the identical check -- same auth, same
 * logic as GET. Not what the cron calls.
 */
export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await runReminderCheck();
        return NextResponse.json(result);
    } catch (error) {
        console.error('[Reminder Checker] Error:', error);
        return NextResponse.json({ error: 'Failed to process reminders' }, { status: 500 });
    }
}
