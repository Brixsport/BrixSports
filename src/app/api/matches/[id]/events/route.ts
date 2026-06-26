import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchEvents, matches, matchLoggerAssignments } from '@/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';

// GET /api/matches/[id]/events - Get all events for a match
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: matchId } = await params;

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
            .orderBy(asc(matchEvents.minute), asc(matchEvents.second))
            .limit(200);

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
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: matchId } = await params;

        // Auth: admin or assigned logger only
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
            loggerName,
            period,
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
            loggerId: authUser.id,
            loggerName: loggerName || null,
            period: period || null,
            createdAt: new Date(),
        };

        await db.insert(matchEvents).values(newEvent);

        // Update match score for scoring events
        // Penalty shootout events must NOT write to match score or player stats —
        // shootout score is tracked separately (BACKLOG-105). Skip all writes during this period.
        const isPenaltyShootout = match.currentPeriod === 'PENALTY_SHOOTOUT';

        const upperType = type.toUpperCase();
        const isOwnGoal = upperType === 'OWN GOAL';
        const isScoringEvent = upperType === 'GOAL' || upperType === 'PENALTY' || isOwnGoal || value;

        if (isScoringEvent && !isPenaltyShootout) {
            const currentHomeScore = match.homeScore || 0;
            const currentAwayScore = match.awayScore || 0;
            const points = typeof value === 'number' ? value : 1;
            // Own goal: teamId is the player's team (who conceded) — credit the opposing team
            const isHomeTeam = isOwnGoal
                ? teamId !== match.homeTeamId
                : teamId === match.homeTeamId;

            await db
                .update(matches)
                .set({
                    homeScore: isHomeTeam ? currentHomeScore + points : currentHomeScore,
                    awayScore: !isHomeTeam ? currentAwayScore + points : currentAwayScore,
                    updatedAt: new Date(),
                })
                .where(eq(matches.id, matchId));
        }

        // Update player stats for competitive matches only — friendlies and shootout events do not count
        if (playerId && match.matchType !== 'friendly' && !isPenaltyShootout) {
            await updatePlayerStats(match.sport, playerId, type, value);
        }

        // Auto-calculate ratings after event (for live matches)
        if (match.status === 'LIVE') {
            try {
                await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/matches/${matchId}/ratings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('Error auto-calculating ratings:', error);
                // Don't fail event creation if rating calculation fails
            }
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
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: matchId } = await params;

        // Auth: admin or assigned logger only
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

        // Fetch match before deleting — needed for score revert and stat decrement guards
        const match = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .get();

        if (!match) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        // Delete the event
        await db.delete(matchEvents).where(eq(matchEvents.id, eventId));

        // Revert score — GOAL, PENALTY, OWN GOAL (BUG-054)
        const upperType = event.type.toUpperCase();
        const isOwnGoal = upperType === 'OWN GOAL';
        const isScoringEvent = upperType === 'GOAL' || upperType === 'PENALTY' || isOwnGoal;

        if (isScoringEvent) {
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

        // Decrement player stats — mirrors updatePlayerStats in reverse (BUG-060)
        // Same guards as POST: skip friendlies and penalty shootout events
        const isPenaltyShootout = match.currentPeriod === 'PENALTY_SHOOTOUT';
        if (event.playerId && match.matchType !== 'friendly' && !isPenaltyShootout) {
            await decrementPlayerStats(match.sport, event.playerId, event.type);
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
                    updates.shotsOnTarget = (stats?.shotsOnTarget || 0) + 1;
                    break;
                case 'ASSIST':
                    updates.assists = (stats?.assists || 0) + 1;
                    break;
                case 'OWN GOAL':
                    updates.ownGoals = (stats?.ownGoals || 0) + 1;
                    break;
                case 'PENALTY':
                    updates.penaltiesScored = (stats?.penaltiesScored || 0) + 1;
                    updates.shotsOnTarget = (stats?.shotsOnTarget || 0) + 1;
                    break;
                case 'FOUL':
                    updates.foulsCommitted = (stats?.foulsCommitted || 0) + 1;
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

// Mirror of updatePlayerStats — subtracts one stat count per event type (BUG-060)
// Math.max(0, x) floor prevents stats going negative from out-of-order deletes.
async function decrementPlayerStats(
    sport: string,
    playerId: string,
    eventType: string
) {
    try {
        const { basketballPlayerStats, footballPlayerStats } = await import('@/db/schema');

        if (sport === 'Basketball') {
            const stats = await db
                .select()
                .from(basketballPlayerStats)
                .where(eq(basketballPlayerStats.playerId, playerId))
                .get();

            if (!stats) return;

            const updates: any = {};

            switch (eventType) {
                case 'Field Goal':
                    updates.fieldGoalsMade = Math.max(0, (stats.fieldGoalsMade || 0) - 1);
                    updates.totalPoints = Math.max(0, (stats.totalPoints || 0) - 2);
                    break;
                case 'Three Pointer':
                    updates.threePointersMade = Math.max(0, (stats.threePointersMade || 0) - 1);
                    updates.totalPoints = Math.max(0, (stats.totalPoints || 0) - 3);
                    break;
                case 'Free Throw':
                    updates.freeThrowsMade = Math.max(0, (stats.freeThrowsMade || 0) - 1);
                    updates.totalPoints = Math.max(0, (stats.totalPoints || 0) - 1);
                    break;
                case 'Rebound':
                    updates.totalRebounds = Math.max(0, (stats.totalRebounds || 0) - 1);
                    break;
                case 'Assist':
                    updates.assists = Math.max(0, (stats.assists || 0) - 1);
                    break;
                case 'Steal':
                    updates.steals = Math.max(0, (stats.steals || 0) - 1);
                    break;
                case 'Block':
                    updates.blocks = Math.max(0, (stats.blocks || 0) - 1);
                    break;
                case 'Turnover':
                    updates.turnovers = Math.max(0, (stats.turnovers || 0) - 1);
                    break;
                case 'Foul':
                    updates.personalFouls = Math.max(0, (stats.personalFouls || 0) - 1);
                    break;
            }

            if (Object.keys(updates).length > 0) {
                await db
                    .update(basketballPlayerStats)
                    .set(updates)
                    .where(eq(basketballPlayerStats.playerId, playerId));
            }
        } else if (sport === 'Football') {
            const stats = await db
                .select()
                .from(footballPlayerStats)
                .where(eq(footballPlayerStats.playerId, playerId))
                .get();

            if (!stats) return;

            const updates: any = {};

            switch (eventType.toUpperCase()) {
                case 'GOAL':
                    updates.goals = Math.max(0, (stats.goals || 0) - 1);
                    updates.shotsOnTarget = Math.max(0, (stats.shotsOnTarget || 0) - 1);
                    break;
                case 'ASSIST':
                    updates.assists = Math.max(0, (stats.assists || 0) - 1);
                    break;
                case 'OWN GOAL':
                    updates.ownGoals = Math.max(0, (stats.ownGoals || 0) - 1);
                    break;
                case 'PENALTY':
                    updates.penaltiesScored = Math.max(0, (stats.penaltiesScored || 0) - 1);
                    updates.shotsOnTarget = Math.max(0, (stats.shotsOnTarget || 0) - 1);
                    break;
                case 'FOUL':
                    updates.foulsCommitted = Math.max(0, (stats.foulsCommitted || 0) - 1);
                    break;
                case 'YELLOW CARD':
                    updates.yellowCards = Math.max(0, (stats.yellowCards || 0) - 1);
                    break;
                case 'RED CARD':
                    updates.redCards = Math.max(0, (stats.redCards || 0) - 1);
                    break;
                case 'SAVE':
                    updates.saves = Math.max(0, (stats.saves || 0) - 1);
                    break;
            }

            if (Object.keys(updates).length > 0) {
                await db
                    .update(footballPlayerStats)
                    .set(updates)
                    .where(eq(footballPlayerStats.playerId, playerId));
            }
        }
    } catch (error) {
        console.error('Error decrementing player stats:', error);
        // Don't throw — event deletion already succeeded
    }
}
