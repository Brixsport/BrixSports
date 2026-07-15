import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/db';
import { matchEvents, matches, matchLoggerAssignments, footballPlayerStats } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { broadcastEventDeleted, broadcastScoreUpdate } from '@/lib/socket';

// Reverts one stat increment for a player when an event is deleted.
// Mirrors updatePlayerStats in events/route.ts — same guards must apply at call site.
// Does NOT throw — event deletion already succeeded by the time this runs.
async function revertPlayerStat(sport: string, playerId: string, eventType: string): Promise<void> {
    if (sport !== 'Football') return;
    try {
        const stats = await db
            .select()
            .from(footballPlayerStats)
            .where(eq(footballPlayerStats.playerId, playerId))
            .get();

        if (!stats) return;

        const updates: Partial<typeof stats> = {};

        switch (eventType.toUpperCase().replace(/\s+/g, '_')) {
            case 'GOAL':
                updates.goals = Math.max(0, (stats.goals || 0) - 1);
                updates.shotsOnTarget = Math.max(0, (stats.shotsOnTarget || 0) - 1);
                break;
            case 'ASSIST':
                updates.assists = Math.max(0, (stats.assists || 0) - 1);
                break;
            case 'OWN_GOAL':
                updates.ownGoals = Math.max(0, (stats.ownGoals || 0) - 1);
                break;
            case 'PENALTY':
                updates.penaltiesScored = Math.max(0, (stats.penaltiesScored || 0) - 1);
                updates.shotsOnTarget = Math.max(0, (stats.shotsOnTarget || 0) - 1);
                break;
            case 'PENALTY_MISSED':
                updates.shotsOffTarget = Math.max(0, (stats.shotsOffTarget || 0) - 1);
                break;
            case 'PENALTY_SAVED':
                updates.shotsOnTarget = Math.max(0, (stats.shotsOnTarget || 0) - 1);
                break;
            case 'FOUL':
                updates.foulsCommitted = Math.max(0, (stats.foulsCommitted || 0) - 1);
                break;
            case 'YELLOW_CARD':
                updates.yellowCards = Math.max(0, (stats.yellowCards || 0) - 1);
                break;
            case 'RED_CARD':
                updates.redCards = Math.max(0, (stats.redCards || 0) - 1);
                break;
            case 'SAVE':
                updates.saves = Math.max(0, (stats.saves || 0) - 1);
                break;
            default:
                return;
        }

        if (Object.keys(updates).length > 0) {
            await db
                .update(footballPlayerStats)
                .set(updates)
                .where(eq(footballPlayerStats.playerId, playerId));
        }
    } catch (error) {
        console.error('[revertPlayerStat] stat reversion failed — event already deleted:', error);
        Sentry.captureException(error, { extra: { playerId, eventType, sport } });
        // Do not rethrow. Event deletion succeeded. Stat drift is recoverable; a false 500 is not.
    }
}

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

        const body = await request.json();
        const { type, minute, second, teamId, playerId, relatedPlayerId, detail, period } = body;

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

        // Update event — explicit allowlist only. matchId, loggerId, createdAt, isEyePoint, id are immutable.
        await db
            .update(matchEvents)
            .set({
                ...(type !== undefined && { type }),
                ...(minute !== undefined && { minute }),
                ...(second !== undefined && { second }),
                ...(teamId !== undefined && { teamId }),
                ...(playerId !== undefined && { playerId }),
                ...(relatedPlayerId !== undefined && { relatedPlayerId }),
                ...(detail !== undefined && { detail }),
                ...(period !== undefined && { period }),
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

        const upperType = event.type.toUpperCase().replace(/\s+/g, '_');
        const isOwnGoal = upperType === 'OWN_GOAL';
        const isScoringEvent = upperType === 'GOAL' || upperType === 'PENALTY' || isOwnGoal;

        // Fetch match — needed for score revert, stat guards, and sport
        const match = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId))
            .get();

        // Delete event first — if this fails, score revert must not run
        await db
            .delete(matchEvents)
            .where(eq(matchEvents.id, eventId));

        // BUG-108/BUG-116: broadcast the deletion now that it's actually committed — same
        // gap as the POST route, same pre-built fix (src/lib/socket.ts).
        broadcastEventDeleted(matchId, eventId);

        // Revert score — only runs if delete succeeded above
        if (isScoringEvent && match) {
            // OWN GOAL: teamId is the conceding team — the opponent was credited. Revert opponent.
            const isHomeTeam = isOwnGoal
                ? event.teamId !== match.homeTeamId
                : event.teamId === match.homeTeamId;
            const newHomeScore = isHomeTeam ? Math.max(0, (match.homeScore || 0) - 1) : (match.homeScore || 0);
            const newAwayScore = !isHomeTeam ? Math.max(0, (match.awayScore || 0) - 1) : (match.awayScore || 0);

            await db
                .update(matches)
                .set({
                    homeScore: newHomeScore,
                    awayScore: newAwayScore,
                    updatedAt: new Date(),
                })
                .where(eq(matches.id, matchId));

            broadcastScoreUpdate(matchId, newHomeScore, newAwayScore);
        }

        // Revert player stats — same guards as POST: skip friendlies and shootout events
        if (match) {
            const isPenaltyShootout = match.currentPeriod === 'PENALTY_SHOOTOUT';
            const isCompetitive = match.matchType !== 'friendly' && !isPenaltyShootout;

            if (event.playerId && isCompetitive) {
                await revertPlayerStat(match.sport, event.playerId, event.type);
            }

            // Penalty Saved: also revert the keeper's saves stat (relatedPlayerId = keeper, may be null)
            if (upperType === 'PENALTY_SAVED' && event.relatedPlayerId && isCompetitive) {
                await revertPlayerStat(match.sport, event.relatedPlayerId, 'Save');
            }
        }

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
