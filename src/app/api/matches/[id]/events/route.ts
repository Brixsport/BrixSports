import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/db';
import { matchEvents, matches, matchLoggerAssignments } from '@/db/schema';
import { eq, asc, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';
import { broadcastMatchEvent, broadcastScoreUpdate } from '@/lib/socket';

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

        // Strip logger identity fields from unauthenticated (public) responses — NDPR compliance.
        // Authenticated callers (logger seeding local state, multi-logger conflict detection) receive full rows.
        const authUser = await getAuthUser(request).catch(() => null);
        const responseEvents = authUser
            ? events
            : events.map(({ loggerId, loggerName, ...rest }) => rest);

        return NextResponse.json({
            matchId,
            events: responseEvents,
            total: responseEvents.length,
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

        // Penalty shootout events must NOT write to match score or player stats —
        // shootout score is tracked separately (BACKLOG-105). Skip all writes during this period.
        const isPenaltyShootout = match.currentPeriod === 'PENALTY_SHOOTOUT';

        const upperType = type.toUpperCase().replace(/\s+/g, '_');
        const isOwnGoal = upperType === 'OWN_GOAL';
        const isScoringEvent = upperType === 'GOAL' || upperType === 'PENALTY' || isOwnGoal;

        // BUG-121: event insert + score update used to be two separate, independently
        // committed statements with no enclosing transaction — a failure after the
        // insert left a saved event with no score reflection, and a client retry on
        // that failure would insert a second, duplicate event row. The score update
        // itself also used to read the score into a JS variable, compute +points, and
        // write that computed value back — a classic read-modify-write race: two
        // scoring events for the same match in overlapping requests could both read
        // the same starting score and the second write would silently clobber the
        // first's intent. Both fixed together: the insert and the score update now
        // share one transaction, and the score update is a single atomic SQL
        // increment (`col = col + points`), not a JS-computed value — closes the race
        // regardless of how many concurrent writers there are, not just the common case.
        let newHomeScore: number | undefined;
        let newAwayScore: number | undefined;

        await db.transaction(async (tx) => {
            await tx.insert(matchEvents).values(newEvent);

            if (isScoringEvent && !isPenaltyShootout) {
                const points = typeof value === 'number' ? value : 1;
                // Own goal: teamId is the player's team (who conceded) — credit the opposing team
                const isHomeTeam = isOwnGoal
                    ? teamId !== match.homeTeamId
                    : teamId === match.homeTeamId;

                const [updated] = isHomeTeam
                    ? await tx.update(matches)
                        .set({ homeScore: sql`${matches.homeScore} + ${points}`, updatedAt: new Date() })
                        .where(eq(matches.id, matchId))
                        .returning({ homeScore: matches.homeScore, awayScore: matches.awayScore })
                    : await tx.update(matches)
                        .set({ awayScore: sql`${matches.awayScore} + ${points}`, updatedAt: new Date() })
                        .where(eq(matches.id, matchId))
                        .returning({ homeScore: matches.homeScore, awayScore: matches.awayScore });

                newHomeScore = updated.homeScore ?? 0;
                newAwayScore = updated.awayScore ?? 0;
            }
        });

        // BUG-108/BUG-116: broadcast to live viewers now that the DB write has actually
        // succeeded — previously nothing here ever broadcast at all; the only push a
        // viewer got was client-side, from the logger's own open tab emitting over its
        // own socket, which any write path with no live socket (offline-queue sync, or
        // any future write path) could never trigger. broadcastMatchEvent (src/lib/socket.ts)
        // already existed, fully built and already exercised by the chat feature — it was
        // just never called from here.
        // after() (not a bare fire-and-forget call): a plain unawaited promise has no
        // guaranteed completion once this function returns its response on Vercel's
        // serverless runtime -- traced as the root cause of BUG-108/116's observed
        // multi-second (up to 42s) broadcast latency. after() keeps the invocation
        // alive until the broadcast settles, without delaying the response itself.
        // broadcast()'s own try/catch already swallows failures, so this can't fail
        // event creation.
        after(() => broadcastMatchEvent(matchId, newEvent));

        if (newHomeScore !== undefined && newAwayScore !== undefined) {
            after(() => broadcastScoreUpdate(matchId, newHomeScore!, newAwayScore!));
        }

        // Update player stats for competitive matches only — friendlies and shootout events do not count
        if (playerId && match.matchType !== 'friendly' && !isPenaltyShootout) {
            await updatePlayerStats(match.sport, playerId, type, value);
        }

        // Penalty Saved: credit the keeper's saves stat via relatedPlayerId (null-check — keeper is optional)
        if (upperType === 'PENALTY_SAVED' && relatedPlayerId && match.matchType !== 'friendly' && !isPenaltyShootout) {
            await updatePlayerStats(match.sport, relatedPlayerId, 'Save', value);
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

            switch (eventType.toUpperCase().replace(/\s+/g, '_')) {
                case 'GOAL':
                    updates.goals = (stats?.goals || 0) + 1;
                    updates.shotsOnTarget = (stats?.shotsOnTarget || 0) + 1;
                    break;
                case 'ASSIST':
                    updates.assists = (stats?.assists || 0) + 1;
                    break;
                case 'OWN_GOAL':
                    updates.ownGoals = (stats?.ownGoals || 0) + 1;
                    break;
                case 'PENALTY':
                    updates.penaltiesScored = (stats?.penaltiesScored || 0) + 1;
                    updates.shotsOnTarget = (stats?.shotsOnTarget || 0) + 1;
                    break;
                case 'PENALTY_MISSED':
                    updates.shotsOffTarget = (stats?.shotsOffTarget || 0) + 1;
                    break;
                case 'PENALTY_SAVED':
                    updates.shotsOnTarget = (stats?.shotsOnTarget || 0) + 1;
                    break;
                case 'FOUL':
                    updates.foulsCommitted = (stats?.foulsCommitted || 0) + 1;
                    break;
                case 'YELLOW_CARD':
                    updates.yellowCards = (stats?.yellowCards || 0) + 1;
                    break;
                case 'RED_CARD':
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
