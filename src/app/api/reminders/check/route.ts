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
import { matchReminders, matches, teams, pushSubscriptions, users, notificationSendLog } from '@/db/schema';
import { eq, and, lte, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import webpush from 'web-push';
import { logNotificationSend, sendMatchEventNotification } from '@/lib/notifications/match-notification-service';

// Item 9: lineup-not-published reminder -- matches kicking off within this
// window with either team's lineup still not marked `status: 'published'`
// get a one-time admin push. Query-time check, no materialized reminder rows
// (same architecture as the item-2 competition-follow cascade) -- dedup is
// done against notificationSendLog rather than a new tracking column.
const LINEUP_WARNING_WINDOW_MS = 60 * 60 * 1000; // 60 minutes before kickoff

// Public "kickoff in 30 minutes" broadcast -- distinct from the user-opt-in
// matchReminders below (which require the viewer to have created a personal
// reminder). This fires automatically to every team/competition follower,
// same query-time-join audience sendMatchEventNotification() already builds
// for GOAL/MATCH_START/etc. Dedup via notificationSendLog rather than a new
// tracking column (sendMatchEventNotification always logs source:'match_event').
const STARTING_SOON_WINDOW_MS = 30 * 60 * 1000; // 30 minutes before kickoff

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

async function checkLineupNotPublished() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + LINEUP_WARNING_WINDOW_MS);

    const upcomingMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.status, 'UPCOMING'))
        .limit(MAX_REMINDERS_PER_RUN);

    // startTime is a plain text column, not a comparable timestamp -- filter
    // in JS after parsing rather than relying on lexical SQL comparison.
    const dueSoon = upcomingMatches.filter((m) => {
        const start = new Date(m.startTime);
        return !isNaN(start.getTime()) && start >= now && start <= windowEnd;
    });

    let notified = 0;
    for (const match of dueSoon) {
        let lineups: any = {};
        if (match.lineups) {
            try {
                lineups = JSON.parse(match.lineups as string);
            } catch {
                // Malformed lineups JSON -- treat as unpublished rather than crash the cron.
            }
        }
        const homePublished = lineups?.home?.status === 'published';
        const awayPublished = lineups?.away?.status === 'published';
        if (homePublished && awayPublished) continue;

        const alreadySent = await db
            .select({ id: notificationSendLog.id })
            .from(notificationSendLog)
            .where(and(eq(notificationSendLog.source, 'lineup_not_published'), eq(notificationSendLog.matchId, match.id)))
            .limit(1);
        if (alreadySent.length > 0) continue;

        const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(100);
        const adminIds = admins.map((a) => a.id);
        if (adminIds.length === 0) continue;

        const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, adminIds));

        const missing = [!homePublished ? 'home' : null, !awayPublished ? 'away' : null].filter(Boolean).join(' & ');
        const payload = JSON.stringify({
            title: '⚠️ Lineup Not Published',
            body: `${match.competition}: ${missing} lineup not published, kickoff in under 60 minutes`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-96x96.png',
            data: { url: '/admin/matches', type: 'lineup_not_published', matchId: match.id },
        });

        let sentCount = 0;
        const errors: string[] = [];
        for (const sub of subs) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload
                );
                sentCount++;
            } catch (error: any) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
                }
                errors.push(`sub ${sub.id}: ${error.message}`);
            }
        }

        await logNotificationSend({
            source: 'lineup_not_published',
            matchId: match.id,
            eventType: 'lineup_not_published',
            targetAudience: 'admin',
            totalSubscriptions: subs.length,
            sentCount,
            failedCount: subs.length - sentCount,
            errors: errors.length > 0 ? errors : undefined,
        });

        if (sentCount > 0) notified++;
    }

    return { checked: dueSoon.length, notified };
}

async function checkMatchStartingSoon() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + STARTING_SOON_WINDOW_MS);

    const upcomingMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.status, 'UPCOMING'))
        .limit(MAX_REMINDERS_PER_RUN);

    const dueSoon = upcomingMatches.filter((m) => {
        const start = new Date(m.startTime);
        return !isNaN(start.getTime()) && start >= now && start <= windowEnd;
    });

    let notified = 0;
    for (const match of dueSoon) {
        const alreadySent = await db
            .select({ id: notificationSendLog.id })
            .from(notificationSendLog)
            .where(
                and(
                    eq(notificationSendLog.source, 'match_event'),
                    eq(notificationSendLog.matchId, match.id),
                    eq(notificationSendLog.eventType, 'MATCH_STARTING_SOON')
                )
            )
            .limit(1);
        if (alreadySent.length > 0) continue;

        const [homeTeam, awayTeam] = await Promise.all([
            db.select({ name: teams.name }).from(teams).where(eq(teams.id, match.homeTeamId)).get(),
            db.select({ name: teams.name }).from(teams).where(eq(teams.id, match.awayTeamId)).get(),
        ]);

        const result = await sendMatchEventNotification({
            matchId: match.id,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            eventType: 'MATCH_STARTING_SOON',
            teamName: homeTeam && awayTeam ? `${homeTeam.name} vs ${awayTeam.name}` : undefined,
            competitionId: match.competitionId,
        });

        if (result.sentCount > 0) notified++;
    }

    return { checked: dueSoon.length, notified };
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

type CheckResult = { checked: number; notified: number } | { error: string };

// Independent try/catches -- a failure in one reminder type must never block
// the others from running in the same cron tick.
async function runAllChecks() {
    const result = await runReminderCheck();

    let lineupNotPublished: CheckResult;
    try {
        lineupNotPublished = await checkLineupNotPublished();
    } catch (error: any) {
        console.error('[Reminder Checker] Lineup check error:', error);
        lineupNotPublished = { error: error.message };
    }

    let matchStartingSoon: CheckResult;
    try {
        matchStartingSoon = await checkMatchStartingSoon();
    } catch (error: any) {
        console.error('[Reminder Checker] Match-starting-soon check error:', error);
        matchStartingSoon = { error: error.message };
    }

    return { ...result, lineupNotPublished, matchStartingSoon };
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
        if (mode === 'status') {
            return NextResponse.json(await runStatusCheck());
        }
        return NextResponse.json(await runAllChecks());
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
        return NextResponse.json(await runAllChecks());
    } catch (error) {
        console.error('[Reminder Checker] Error:', error);
        return NextResponse.json({ error: 'Failed to process reminders' }, { status: 500 });
    }
}
