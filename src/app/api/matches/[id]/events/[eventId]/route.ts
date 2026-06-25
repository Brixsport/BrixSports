import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchEvents, matches, matchLoggerAssignments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

// PATCH /api/matches/[id]/events/[eventId] - Update match event
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string; eventId: string } }
) {
    try {
        const { id: matchId, eventId } = params;

        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin' && authUser.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (authUser.role === 'logger') {
            const [assignment] = await db
                .select({ id: matchLoggerAssignments.id })
                .from(matchLoggerAssignments)
                .where(
                    and(
                        eq(matchLoggerAssignments.matchId, matchId),
                        eq(matchLoggerAssignments.loggerId, authUser.id),
                        eq(matchLoggerAssignments.status, 'active')
                    )
                )
                .limit(1);
            if (!assignment) {
                return NextResponse.json({ error: 'Forbidden — not assigned to this match' }, { status: 403 });
            }
        }

        const updates = await request.json();

        // Verify event exists
        const event = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.id, eventId))
            .get();

        if (!event) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            );
        }

        // Update event
        await db
            .update(matchEvents)
            .set({
                ...updates,
                value: updates.value ? JSON.stringify(updates.value) : event.value,
            })
            .where(eq(matchEvents.id, eventId));

        // Get updated event
        const updatedEvent = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.id, eventId))
            .get();

        return NextResponse.json({
            success: true,
            message: 'Event updated successfully',
            event: updatedEvent,
        });
    } catch (error) {
        console.error('Error updating match event:', error);
        return NextResponse.json(
            { error: 'Failed to update match event' },
            { status: 500 }
        );
    }
}

// DELETE /api/matches/[id]/events/[eventId] - Delete match event
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string; eventId: string } }
) {
    try {
        const { id: matchId, eventId } = params;

        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin' && authUser.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (authUser.role === 'logger') {
            const [assignment] = await db
                .select({ id: matchLoggerAssignments.id })
                .from(matchLoggerAssignments)
                .where(
                    and(
                        eq(matchLoggerAssignments.matchId, matchId),
                        eq(matchLoggerAssignments.loggerId, authUser.id),
                        eq(matchLoggerAssignments.status, 'active')
                    )
                )
                .limit(1);
            if (!assignment) {
                return NextResponse.json({ error: 'Forbidden — not assigned to this match' }, { status: 403 });
            }
        }

        // Verify event exists and belongs to this match
        const event = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.id, eventId))
            .get();

        if (!event || event.matchId !== matchId) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            );
        }

        const upperType = event.type.toUpperCase();
        const isOwnGoal = upperType === 'OWN GOAL';
        const isScoringEvent = upperType === 'GOAL' || upperType === 'PENALTY' || isOwnGoal;

        // Revert score if scoring event
        if (isScoringEvent) {
            const match = await db
                .select()
                .from(matches)
                .where(eq(matches.id, matchId))
                .get();

            if (match) {
                // OWN GOAL: teamId is the conceding team — the opponent was credited. Revert opponent.
                const isHomeTeam = isOwnGoal
                    ? event.teamId !== match.homeTeamId
                    : event.teamId === match.homeTeamId;

                await db
                    .update(matches)
                    .set({
                        homeScore: isHomeTeam ? Math.max(0, (match.homeScore || 0) - 1) : (match.homeScore || 0),
                        awayScore: !isHomeTeam ? Math.max(0, (match.awayScore || 0) - 1) : (match.awayScore || 0),
                        updatedAt: new Date(),
                    })
                    .where(eq(matches.id, matchId));
            }
        }

        // Delete event
        await db
            .delete(matchEvents)
            .where(eq(matchEvents.id, eventId));

        return NextResponse.json({
            success: true,
            message: 'Event deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting match event:', error);
        return NextResponse.json(
            { error: 'Failed to delete match event' },
            { status: 500 }
        );
    }
}
