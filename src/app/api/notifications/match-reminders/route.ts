/**
 * Match Reminder Scheduler API
 * Checks for upcoming matches and sends notifications 30 and 15 minutes before
 * This should be called by a cron job every 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { sendMatchReminderNotification } from '@/lib/notifications/match-notification-service';

export async function POST(request: NextRequest) {
    try {
        // Verify this is a cron job or authorized request
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET || 'dev-cron-secret';

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const now = new Date();

        // Check for matches starting in 30 minutes (±2 minutes window)
        const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
        const thirtyMinutesWindow = {
            start: new Date(now.getTime() + 28 * 60 * 1000),
            end: new Date(now.getTime() + 32 * 60 * 1000),
        };

        // Check for matches starting in 15 minutes (±2 minutes window)
        const fifteenMinutesWindow = {
            start: new Date(now.getTime() + 13 * 60 * 1000),
            end: new Date(now.getTime() + 17 * 60 * 1000),
        };

        let totalSent = 0;
        const errors: string[] = [];

        // Process 30-minute reminders
        const matches30Min = await db
            .select({
                match: matches,
                homeTeam: teams,
            })
            .from(matches)
            .leftJoin(teams, eq(matches.homeTeamId, teams.id))
            .where(
                and(
                    eq(matches.status, 'UPCOMING'),
                    gte(matches.startTime, thirtyMinutesWindow.start.toISOString()),
                    lte(matches.startTime, thirtyMinutesWindow.end.toISOString())
                )
            );

        for (const { match, homeTeam } of matches30Min) {
            try {
                // Get away team
                const awayTeamResult = await db
                    .select()
                    .from(teams)
                    .where(eq(teams.id, match.awayTeamId))
                    .limit(1);

                const awayTeam = awayTeamResult[0];

                if (!homeTeam || !awayTeam) continue;

                const result = await sendMatchReminderNotification(
                    match.id,
                    match.homeTeamId,
                    match.awayTeamId,
                    homeTeam.name,
                    awayTeam.name,
                    30
                );

                totalSent += result.sentCount;
                console.log(`[MatchReminder] Sent 30-min reminder for match ${match.id}: ${result.sentCount} notifications`);
            } catch (error: any) {
                console.error(`[MatchReminder] Error processing 30-min reminder for match ${match.id}:`, error);
                errors.push(`Match ${match.id} (30min): ${error.message}`);
            }
        }

        // Process 15-minute reminders
        const matches15Min = await db
            .select({
                match: matches,
                homeTeam: teams,
            })
            .from(matches)
            .leftJoin(teams, eq(matches.homeTeamId, teams.id))
            .where(
                and(
                    eq(matches.status, 'UPCOMING'),
                    gte(matches.startTime, fifteenMinutesWindow.start.toISOString()),
                    lte(matches.startTime, fifteenMinutesWindow.end.toISOString())
                )
            );

        for (const { match, homeTeam } of matches15Min) {
            try {
                // Get away team
                const awayTeamResult = await db
                    .select()
                    .from(teams)
                    .where(eq(teams.id, match.awayTeamId))
                    .limit(1);

                const awayTeam = awayTeamResult[0];

                if (!homeTeam || !awayTeam) continue;

                const result = await sendMatchReminderNotification(
                    match.id,
                    match.homeTeamId,
                    match.awayTeamId,
                    homeTeam.name,
                    awayTeam.name,
                    15
                );

                totalSent += result.sentCount;
                console.log(`[MatchReminder] Sent 15-min reminder for match ${match.id}: ${result.sentCount} notifications`);
            } catch (error: any) {
                console.error(`[MatchReminder] Error processing 15-min reminder for match ${match.id}:`, error);
                errors.push(`Match ${match.id} (15min): ${error.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            totalSent,
            matches30Min: matches30Min.length,
            matches15Min: matches15Min.length,
            errors: errors.length > 0 ? errors : undefined,
            timestamp: now.toISOString(),
        });
    } catch (error) {
        console.error('[MatchReminder] Error:', error);
        return NextResponse.json(
            { error: 'Failed to process match reminders' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/notifications/match-reminders
 * Get status of upcoming match reminders (for monitoring)
 */
export async function GET(request: NextRequest) {
    try {
        const now = new Date();
        const next60Minutes = new Date(now.getTime() + 60 * 60 * 1000);

        // Count upcoming matches in the next hour
        const upcomingMatches = await db
            .select()
            .from(matches)
            .where(
                and(
                    eq(matches.status, 'UPCOMING'),
                    gte(matches.startTime, now.toISOString()),
                    lte(matches.startTime, next60Minutes.toISOString())
                )
            );

        return NextResponse.json({
            status: 'operational',
            upcomingMatchesNextHour: upcomingMatches.length,
            matches: upcomingMatches.map(m => ({
                id: m.id,
                startTime: m.startTime,
                minutesUntilStart: Math.round((new Date(m.startTime).getTime() - now.getTime()) / (60 * 1000)),
            })),
            timestamp: now.toISOString(),
        });
    } catch (error) {
        console.error('[MatchReminder] Error getting status:', error);
        return NextResponse.json(
            { error: 'Failed to get status' },
            { status: 500 }
        );
    }
}
