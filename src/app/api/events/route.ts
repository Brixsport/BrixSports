/**
 * Events API Route
 * Handles event logging, validation, and broadcasting
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchEvents, matches, players } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { RatingCalculator } from '@/lib/services/rating-calculator';
import { TeamStatsCalculator } from '@/lib/services/team-stats-calculator';
import {
    broadcastMatchEvent,
    broadcastScoreUpdate,
    broadcastRatingUpdate,
    broadcastStatsUpdate
} from '@/lib/socket';
import { SubstitutionManager } from '@/lib/services/substitution-manager';

/**
 * GET /api/events?matchId=xxx
 * Get all events for a match
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const matchId = searchParams.get('matchId');

        if (!matchId) {
            return NextResponse.json(
                { error: 'matchId is required' },
                { status: 400 }
            );
        }

        // Fetch events for the match
        const events = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.matchId, matchId))
            .orderBy(matchEvents.minute, matchEvents.second);

        return NextResponse.json({ events });
    } catch (error) {
        console.error('Error fetching events:', error);
        return NextResponse.json(
            { error: 'Failed to fetch events' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/events
 * Log a new event
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            matchId,
            type,
            minute,
            second,
            teamId,
            playerId,
            relatedPlayerId,
            detail,
            isEyePoint,
            value,
        } = body;

        // Validate required fields
        if (!matchId || !type || minute === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Fetch match details
        const [match] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId));

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Validate substitution if applicable
        if (type === 'SUBSTITUTION') {
            if (!playerId || !relatedPlayerId || !teamId) {
                return NextResponse.json(
                    { error: 'Substitution requires playerId, relatedPlayerId, and teamId' },
                    { status: 400 }
                );
            }

            // Get existing events
            const existingEvents = await db
                .select()
                .from(matchEvents)
                .where(eq(matchEvents.matchId, matchId));

            // Get starting lineup (from match.lineups)
            const lineups = match.lineups ? JSON.parse(match.lineups) : { home: [], away: [] };
            const isHomeTeam = teamId === match.homeTeamId;
            const startingLineup = isHomeTeam ? lineups.home : lineups.away;

            // Get active players
            const activePlayers = SubstitutionManager.getActivePlayers(
                startingLineup,
                existingEvents
            );

            // Validate substitution
            const validation = SubstitutionManager.validateSubstitution(
                match.sport,
                teamId,
                playerId,
                relatedPlayerId,
                minute,
                existingEvents,
                activePlayers
            );

            if (!validation.isValid) {
                return NextResponse.json(
                    { error: 'Invalid substitution', details: validation.errors },
                    { status: 400 }
                );
            }
        }

        // Create event
        const eventId = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newEvent = {
            id: eventId,
            matchId,
            type,
            minute,
            second: second || 0,
            teamId: teamId || null,
            playerId: playerId || null,
            relatedPlayerId: relatedPlayerId || null,
            detail: detail || null,
            isEyePoint: isEyePoint || false,
            value: value ? JSON.stringify(value) : null,
        };

        await db.insert(matchEvents).values(newEvent);

        // Calculate updated ratings if player involved
        const updatedRatings: Array<{ playerId: string; newRating: number }> = [];

        if (playerId) {
            const [player] = await db
                .select()
                .from(players)
                .where(eq(players.id, playerId));

            if (player) {
                // Get all events for this player in this match
                const playerEvents = await db
                    .select()
                    .from(matchEvents)
                    .where(
                        and(
                            eq(matchEvents.matchId, matchId),
                            eq(matchEvents.playerId, playerId)
                        )
                    );

                // Calculate stats from events
                const stats = RatingCalculator.calculateStatsFromEvents(
                    playerId,
                    playerEvents,
                    match.sport
                );

                // Calculate new rating
                const ratingResult = RatingCalculator.calculateRating(
                    match.sport,
                    stats,
                    player.rating || 7.0
                );

                // Update player rating in database
                await db
                    .update(players)
                    .set({ rating: ratingResult.newRating })
                    .where(eq(players.id, playerId));

                updatedRatings.push({
                    playerId,
                    newRating: ratingResult.newRating,
                });
            }
        }

        // Handle Eye Point bonus
        if (isEyePoint && playerId) {
            const [player] = await db
                .select()
                .from(players)
                .where(eq(players.id, playerId));

            if (player) {
                const newRating = RatingCalculator.addEyePointBonus(player.rating || 7.0);
                const newEyePoints = (player.eyePoints || 0) + 1;

                await db
                    .update(players)
                    .set({
                        rating: newRating,
                        eyePoints: newEyePoints,
                    })
                    .where(eq(players.id, playerId));

                // Update or add to updatedRatings
                const existingIndex = updatedRatings.findIndex(r => r.playerId === playerId);
                if (existingIndex >= 0) {
                    updatedRatings[existingIndex].newRating = newRating;
                } else {
                    updatedRatings.push({ playerId, newRating });
                }
            }
        }

        // Calculate updated team statistics
        let updatedStats: { teamId: string; stats: any } | undefined;

        if (teamId) {
            const allEvents = await db
                .select()
                .from(matchEvents)
                .where(eq(matchEvents.matchId, matchId));

            const teamStats = TeamStatsCalculator.calculateStats(
                teamId,
                allEvents,
                match.sport
            );

            // Update match stats
            const currentStats = match.stats ? JSON.parse(match.stats) : {};
            const isHomeTeam = teamId === match.homeTeamId;
            currentStats[isHomeTeam ? 'home' : 'away'] = teamStats;

            await db
                .update(matches)
                .set({ stats: JSON.stringify(currentStats) })
                .where(eq(matches.id, matchId));

            updatedStats = { teamId, stats: teamStats };
        }

        // Update match score for scoring events
        let finalHomeScore = match.homeScore || 0;
        let finalAwayScore = match.awayScore || 0;

        if (['GOAL', 'FIELD_GOAL', 'THREE_POINTER', 'FREE_THROW'].includes(type) || type === 'UNDO_GOAL') {
            const allEvents = await db
                .select()
                .from(matchEvents)
                .where(eq(matchEvents.matchId, matchId));

            let calculatedHomeScore = 0;
            let calculatedAwayScore = 0;

            allEvents.forEach(event => {
                if (event.teamId === match.homeTeamId) {
                    if (event.type === 'GOAL') calculatedHomeScore++;
                    if (event.type === 'FIELD_GOAL') calculatedHomeScore += 2;
                    if (event.type === 'THREE_POINTER') calculatedHomeScore += 3;
                    if (event.type === 'FREE_THROW') calculatedHomeScore += 1;
                } else if (event.teamId === match.awayTeamId) {
                    if (event.type === 'GOAL') calculatedAwayScore++;
                    if (event.type === 'FIELD_GOAL') calculatedAwayScore += 2;
                    if (event.type === 'THREE_POINTER') calculatedAwayScore += 3;
                    if (event.type === 'FREE_THROW') calculatedAwayScore += 1;
                }
            });

            finalHomeScore = calculatedHomeScore;
            finalAwayScore = calculatedAwayScore;

            await db
                .update(matches)
                .set({ homeScore: finalHomeScore, awayScore: finalAwayScore })
                .where(eq(matches.id, matchId));
        }

        // Broadcast via WebSocket to all connected clients watching this match
        broadcastMatchEvent(matchId, newEvent);

        // Broadcast score update if scores changed
        if (finalHomeScore !== (match.homeScore || 0) || finalAwayScore !== (match.awayScore || 0)) {
            broadcastScoreUpdate(matchId, finalHomeScore, finalAwayScore);
        }

        // Broadcast rating updates
        if (updatedRatings && updatedRatings.length > 0) {
            updatedRatings.forEach(rating => {
                broadcastRatingUpdate(matchId, rating.playerId, rating.newRating);
            });
        }

        // Broadcast stats updates
        if (updatedStats) {
            if (updatedStats.teamId) {
                broadcastStatsUpdate(matchId, updatedStats.teamId, updatedStats);
            }
        }

        return NextResponse.json({
            success: true,
            event: newEvent,
            updatedRatings,
            updatedStats,
        });
    } catch (error) {
        console.error('Error logging event:', error);
        return NextResponse.json(
            { error: 'Failed to log event' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/events/:eventId
 * Undo/delete an event
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get('eventId');

        if (!eventId) {
            return NextResponse.json(
                { error: 'eventId is required' },
                { status: 400 }
            );
        }

        // Get event details before deleting
        const [event] = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.id, eventId));

        if (!event) {
            return NextResponse.json(
                { error: 'Event not found' },
                { status: 404 }
            );
        }

        // Delete event
        await db
            .delete(matchEvents)
            .where(eq(matchEvents.id, eventId));

        // Recalculate ratings and stats
        // (Similar logic to POST, but recalculating after deletion)

        // Broadcast event deletion via WebSocket
        const { broadcastEventDeleted } = await import('@/lib/socket');
        broadcastEventDeleted(event.matchId, eventId);

        return NextResponse.json({
            success: true,
            deletedEventId: eventId,
        });
    } catch (error) {
        console.error('Error deleting event:', error);
        return NextResponse.json(
            { error: 'Failed to delete event' },
            { status: 500 }
        );
    }
}
