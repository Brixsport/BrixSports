import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchEvents, matches } from '@/db/schema';
import { eq } from 'drizzle-orm';

// PATCH /api/matches/[id]/events/[eventId] - Update match event
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string; eventId: string } }
) {
    try {
        const { eventId } = params;
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

        // If it's a goal, update the match score
        if (event.type.toUpperCase() === 'GOAL') {
            const match = await db
                .select()
                .from(matches)
                .where(eq(matches.id, matchId))
                .get();

            if (match) {
                const isHomeTeam = event.teamId === match.homeTeamId;
                const currentHomeScore = match.homeScore || 0;
                const currentAwayScore = match.awayScore || 0;

                await db
                    .update(matches)
                    .set({
                        homeScore: isHomeTeam ? Math.max(0, currentHomeScore - 1) : currentHomeScore,
                        awayScore: !isHomeTeam ? Math.max(0, currentAwayScore - 1) : currentAwayScore,
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
