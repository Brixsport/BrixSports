/**
 * Match Reminders API
 * Handles creating, retrieving, and managing match reminders
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchReminders, matches, pushSubscriptions } from '@/db/schema';
import { eq, and, lt, gte } from 'drizzle-orm';

/**
 * GET /api/reminders
 * Get all reminders for a user
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'userId is required' },
                { status: 400 }
            );
        }

        // Get all reminders for the user with match details
        const userReminders = await db
            .select({
                reminder: matchReminders,
                match: matches,
            })
            .from(matchReminders)
            .leftJoin(matches, eq(matchReminders.matchId, matches.id))
            .where(eq(matchReminders.userId, userId));

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
        const body = await request.json();
        const { userId, matchId, minutesBefore = 15 } = body;

        if (!userId || !matchId) {
            return NextResponse.json(
                { error: 'userId and matchId are required' },
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
 * Delete a reminder
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const reminderId = searchParams.get('reminderId');
        const userId = searchParams.get('userId');
        const matchId = searchParams.get('matchId');

        if (reminderId) {
            // Delete by reminder ID
            await db
                .delete(matchReminders)
                .where(eq(matchReminders.id, reminderId));
        } else if (userId && matchId) {
            // Delete by user and match
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
                { error: 'Either reminderId or (userId and matchId) is required' },
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
