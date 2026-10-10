/**
 * Match Reminders API
 * Handles creating, retrieving, and managing match reminders
 *
 * All verbs are scoped to the authenticated session user. Any userId sent in the
 * query string or body is ignored.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchReminders, matches, pushSubscriptions } from '@/db/schema';
import { eq, and, lt, gte } from 'drizzle-orm';
import { getAuthUser, resolveEffectiveUserId } from '@/lib/auth';

/**
 * GET /api/reminders
 * Get all reminders for the authenticated user
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        const userId = await resolveEffectiveUserId(authUser);

        // Get all reminders for the user with a shaped subset of match details
        const userReminders = await db
            .select({
                reminder: matchReminders,
                match: {
                    id: matches.id,
                    sport: matches.sport,
                    homeTeamId: matches.homeTeamId,
                    awayTeamId: matches.awayTeamId,
                    homeScore: matches.homeScore,
                    awayScore: matches.awayScore,
                    status: matches.status,
                    startTime: matches.startTime,
                    venue: matches.venue,
                    competition: matches.competition,
                },
            })
            .from(matchReminders)
            .leftJoin(matches, eq(matchReminders.matchId, matches.id))
            .where(eq(matchReminders.userId, userId))
            .limit(200);

        return NextResponse.json({
            reminders: userReminders,
            count: userReminders.length,
        });
    } catch (error) {
        console.error('[Reminders API] Error fetching reminders:', error);
        return NextResponse.json(
            { error: 'Failed to fetch reminders' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/reminders
 * Create a new match reminder
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        const userId = await resolveEffectiveUserId(authUser);

        const body = await request.json();
        const { matchId, minutesBefore = 15 } = body;

        if (!matchId) {
            return NextResponse.json(
                { error: 'matchId is required' },
                { status: 400 }
            );
        }

        // Get match details
        const [match] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .limit(1);

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Check if reminder already exists
        const existing = await db
            .select()
            .from(matchReminders)
            .where(
                and(
                    eq(matchReminders.userId, userId),
                    eq(matchReminders.matchId, matchId)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json(
                { error: 'Reminder already exists for this match' },
                { status: 409 }
            );
        }

        // Calculate reminder time
        const matchStartTime = new Date(match.startTime);
        const reminderTime = new Date(matchStartTime.getTime() - minutesBefore * 60 * 1000);

        // Create reminder
        const reminderId = `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await db.insert(matchReminders).values({
            id: reminderId,
            userId,
            matchId,
            reminderTime,
            minutesBefore,
            notificationSent: false,
        });

        return NextResponse.json(
            {
                success: true,
                reminderId,
                reminderTime: reminderTime.toISOString(),
                message: `Reminder set for ${minutesBefore} minutes before match`,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('[Reminders API] Error creating reminder:', error);
        return NextResponse.json(
            { error: 'Failed to create reminder' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/reminders
 * Delete one of the authenticated user's reminders
 */
export async function DELETE(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        const userId = await resolveEffectiveUserId(authUser);

        const { searchParams } = new URL(request.url);
        const reminderId = searchParams.get('reminderId');
        const matchId = searchParams.get('matchId');

        if (reminderId) {
            // Delete by reminder ID -- only if it belongs to the session user
            await db
                .delete(matchReminders)
                .where(
                    and(
                        eq(matchReminders.id, reminderId),
                        eq(matchReminders.userId, userId)
                    )
                );
        } else if (matchId) {
            // Delete by (session user, match)
            await db
                .delete(matchReminders)
                .where(
                    and(
                        eq(matchReminders.userId, userId),
                        eq(matchReminders.matchId, matchId)
                    )
                );
        } else {
            return NextResponse.json(
                { error: 'Either reminderId or matchId is required' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Reminder deleted successfully',
        });
    } catch (error) {
        console.error('[Reminders API] Error deleting reminder:', error);
        return NextResponse.json(
            { error: 'Failed to delete reminder' },
            { status: 500 }
        );
    }
}
