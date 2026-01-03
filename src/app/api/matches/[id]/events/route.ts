import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchEvents, matches } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// GET /api/matches/[id]/events - Get all events for a match
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const matchId = params.id;

        // Verify match exists
        const match = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .get();

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Get all events for the match
        const events = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.matchId, matchId))
            .orderBy(asc(matchEvents.minute), asc(matchEvents.second));

        return NextResponse.json({
            matchId,
            events,
            total: events.length,
        });
    } catch (error) {
        console.error('Error fetching match events:', error);
        return NextResponse.json(
            { error: 'Failed to fetch match events' },
            { status: 500 }
        );
    }
}

// POST /api/matches/[id]/events - Create new match event
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const matchId = params.id;
        const body = await request.json();
        const {
            type,
            minute,
            second,
            teamId,
            playerId,
            relatedPlayerId,
            detail,
            isEyePoint = false,
            value,
            loggerId,
            loggerName,
        } = body;

        // Validate required fields
        if (!type || minute === undefined) {
            return NextResponse.json(
                { error: 'Event type and minute are required' },
                { status: 400 }
            );
        }

        // Verify match exists
        const match = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .get();

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Create event
        const eventId = nanoid();
        const newEvent = {
            id: eventId,
            matchId,
            type,
            minute,
            second: second || null,
            teamId: teamId || null,
            playerId: playerId || null,
            relatedPlayerId: relatedPlayerId || null,
            detail: detail || null,
            isEyePoint,
            value: value ? JSON.stringify(value) : null,
            loggerId: loggerId || null,
            loggerName: loggerName || null,
            createdAt: new Date(),
        };

        await db.insert(matchEvents).values(newEvent);

        // Update match score for scoring events
        if (type.toUpperCase() === 'GOAL' || value) {
            const isHomeTeam = teamId === match.homeTeamId;
            const currentHomeScore = match.homeScore || 0;
            const currentAwayScore = match.awayScore || 0;
            const points = typeof value === 'number' ? value : 1;

            await db
                .update(matches)
                .set({
                    homeScore: isHomeTeam ? currentHomeScore + points : currentHomeScore,
                    awayScore: !isHomeTeam ? currentAwayScore + points : currentAwayScore,
                    updatedAt: new Date(),
                })
                .where(eq(matches.id, matchId));
        }

        // Update player stats if applicable
        if (playerId) {
            await updatePlayerStats(match.sport, playerId, type, value);
        }

        return NextResponse.json({
            success: true,
            message: 'Event created successfully',
            event: newEvent,
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating match event:', error);
        return NextResponse.json(
            { error: 'Failed to create match event' },
            { status: 500 }
        );
    }
}

// DELETE /api/matches/[id]/events - Delete an event (undo)
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const matchId = params.id;
        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get('eventId');

        if (!eventId) {
            return NextResponse.json(
                { error: 'Event ID is required' },
                { status: 400 }
            );
        }

        // Get event before deleting
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

        // Delete the event
        await db.delete(matchEvents).where(eq(matchEvents.id, eventId));

        // Revert score if it was a scoring event
        if (event.value || event.type.toUpperCase() === 'GOAL') {
            const match = await db
                .select()
                .from(matches)
                .where(eq(matches.id, matchId))
                .get();

            if (match) {
                const parsedValue = event.value ? JSON.parse(event.value) : 1;
                const points = typeof parsedValue === 'number' ? parsedValue : 1;
                const isHomeTeam = event.teamId === match.homeTeamId;

                await db
                    .update(matches)
                    .set({
                        homeScore: isHomeTeam ? Math.max(0, (match.homeScore || 0) - points) : match.homeScore,
                        awayScore: !isHomeTeam ? Math.max(0, (match.awayScore || 0) - points) : match.awayScore,
                        updatedAt: new Date(),
                    })
                    .where(eq(matches.id, matchId));
            }
        }

        return NextResponse.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        return NextResponse.json(
            { error: 'Failed to delete event' },
            { status: 500 }
        );
    }
}

// Helper function to update player stats
async function updatePlayerStats(
    sport: string,
    playerId: string,
    eventType: string,
    value?: any
) {
    try {
        const { basketballPlayerStats, footballPlayerStats, players } = await import('@/db/schema');

        if (sport === 'Basketball') {
            const stats = await db
                .select()
                .from(basketballPlayerStats)
                .where(eq(basketballPlayerStats.playerId, playerId))
                .get();

            const updates: any = {};

            switch (eventType) {
                case 'Field Goal':
                    updates.fieldGoalsMade = (stats?.fieldGoalsMade || 0) + 1;
                    updates.totalPoints = (stats?.totalPoints || 0) + (value || 2);
                    break;
                case 'Three Pointer':
                    updates.threePointersMade = (stats?.threePointersMade || 0) + 1;
                    updates.totalPoints = (stats?.totalPoints || 0) + 3;
                    break;
                case 'Free Throw':
                    updates.freeThrowsMade = (stats?.freeThrowsMade || 0) + 1;
                    updates.totalPoints = (stats?.totalPoints || 0) + 1;
                    break;
                case 'Rebound':
                    updates.totalRebounds = (stats?.totalRebounds || 0) + 1;
                    break;
                case 'Assist':
                    updates.assists = (stats?.assists || 0) + 1;
                    break;
                case 'Steal':
                    updates.steals = (stats?.steals || 0) + 1;
                    break;
                case 'Block':
                    updates.blocks = (stats?.blocks || 0) + 1;
                    break;
                case 'Turnover':
                    updates.turnovers = (stats?.turnovers || 0) + 1;
                    break;
                case 'Foul':
                    updates.personalFouls = (stats?.personalFouls || 0) + 1;
                    break;
            }

            if (Object.keys(updates).length > 0) {
                if (stats) {
                    await db
                        .update(basketballPlayerStats)
                        .set(updates)
                        .where(eq(basketballPlayerStats.playerId, playerId));
                } else {
                    await db.insert(basketballPlayerStats).values({
                        id: `bstats_${nanoid()}`,
                        playerId,
                        season: '2024',
                        ...updates,
                    });
                }
            }
        } else if (sport === 'Football') {
            const stats = await db
                .select()
                .from(footballPlayerStats)
                .where(eq(footballPlayerStats.playerId, playerId))
                .get();

            const updates: any = {};

            switch (eventType.toUpperCase()) {
                case 'GOAL':
                    updates.goals = (stats?.goals || 0) + 1;
                    break;
                case 'ASSIST':
                    updates.assists = (stats?.assists || 0) + 1;
                    break;
                case 'YELLOW CARD':
                    updates.yellowCards = (stats?.yellowCards || 0) + 1;
                    break;
                case 'RED CARD':
                    updates.redCards = (stats?.redCards || 0) + 1;
                    break;
                case 'SAVE':
                    updates.saves = (stats?.saves || 0) + 1;
                    break;
            }

            if (Object.keys(updates).length > 0) {
                if (stats) {
                    await db
                        .update(footballPlayerStats)
                        .set(updates)
                        .where(eq(footballPlayerStats.playerId, playerId));
                } else {
                    await db.insert(footballPlayerStats).values({
                        id: `fstats_${nanoid()}`,
                        playerId,
                        season: '2024',
                        ...updates,
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error updating player stats:', error);
        // Don't throw - event should still be logged
    }
}
