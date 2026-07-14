/**
 * Match Details API Route
 * Fetch detailed match information with events, lineups, stats, and more
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams, matchEvents, players, bracketNodes, teamForm, headToHead } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { playerRatings } from '@/db/schema-ratings';
import { getAuthUser } from '@/lib/auth';
import { isLoggerAssigned } from '@/lib/match-logger-helpers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: matchId } = await params;

        // Fetch match with team details
        const [match] = await db
            .select({
                match: matches,
                homeTeam: {
                    id: teams.id,
                    name: teams.name,
                    shortName: teams.shortName,
                    logo: teams.logo,
                    university: teams.university,
                    color: teams.color,
                },
            })
            .from(matches)
            .leftJoin(teams, eq(matches.homeTeamId, teams.id))
            .where(eq(matches.id, matchId));

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Get away team separately
        const [awayTeam] = await db
            .select({
                id: teams.id,
                name: teams.name,
                shortName: teams.shortName,
                logo: teams.logo,
                university: teams.university,
                color: teams.color,
            })
            .from(teams)
            .where(eq(teams.id, match.match.awayTeamId));

        // Competition is stored as text field in matches table
        const competition = match.match.competition;

        // Fetch match events with player and team details
        const eventsData = await db
            .select({
                event: matchEvents,
                player: players,
                team: {
                    id: teams.id,
                    name: teams.name,
                    shortName: teams.shortName,
                    logo: teams.logo,
                    color: teams.color,
                },
            })
            .from(matchEvents)
            .leftJoin(players, eq(matchEvents.playerId, players.id))
            .leftJoin(teams, eq(matchEvents.teamId, teams.id))
            .where(eq(matchEvents.matchId, matchId))
            .orderBy(desc(matchEvents.minute), desc(matchEvents.second));

        // Process events to include related player data
        const events = await Promise.all(
            eventsData.map(async (row) => {
                let relatedPlayer = null;
                if (row.event.relatedPlayerId) {
                    const [rp] = await db
                        .select({
                            id: players.id,
                            name: players.name,
                            jerseyName: players.jerseyName,
                            number: players.number,
                            position: players.position,
                        })
                        .from(players)
                        .where(eq(players.id, row.event.relatedPlayerId));
                    relatedPlayer = rp ?? null;
                }

                // BUG-018: explicit DTO — loggerId is a banned public field
                const { loggerId: _l, ...publicEvent } = row.event;
                return {
                    ...publicEvent,
                    player: row.player
                        ? {
                            id: row.player.id,
                            name: row.player.name,
                            jerseyName: (row.player as any).jerseyName ?? null,
                            number: row.player.number,
                            position: row.player.position,
                        }
                        : null,
                    relatedPlayer,
                    team: row.team,
                    value: row.event.value ? JSON.parse(row.event.value) : null,
                };
            })
        );

        // Note: Player time tracking and eye points features not yet implemented in schema

        // Parse lineups if available
        let lineups = null;
        if (match.match.lineups) {
            try {
                lineups = JSON.parse(match.match.lineups);
            } catch (e) {
                console.error('Error parsing lineups:', e);
            }
        }

        // If lineups are not available for basketball, generate from events
        if (!lineups && match.match.sport === 'Basketball' && events.length > 0) {
            console.log('🏀 Generating lineups from', events.length, 'events');
            const homePlayerStats: any = {};
            const awayPlayerStats: any = {};


            // Calculate player stats from events and track first appearance
            events.forEach((event: any) => {
                if (!event.player) return;

                const isHomeTeam = event.teamId === match.match.homeTeamId;
                const playerMap = isHomeTeam ? homePlayerStats : awayPlayerStats;

                if (!playerMap[event.playerId]) {
                    playerMap[event.playerId] = {
                        id: event.playerId,
                        name: event.player.name,
                        number: event.player.number,
                        position: event.player.position,
                        rating: event.player.rating || 7.0,
                        firstAppearance: event.minute || 0,
                        stats: {
                            points: 0,
                            rebounds: 0,
                            assists: 0,
                            steals: 0,
                            blocks: 0,
                        }
                    };
                } else {
                    // Track earliest appearance
                    if (event.minute < playerMap[event.playerId].firstAppearance) {
                        playerMap[event.playerId].firstAppearance = event.minute;
                    }
                }

                const playerStats = playerMap[event.playerId].stats;

                switch (event.type) {
                    case '2PT_MADE':
                        playerStats.points += 2;
                        break;
                    case '3PT_MADE':
                        playerStats.points += 3;
                        break;
                    case 'FREE_THROW':
                        playerStats.points += 1;
                        break;
                    case 'REBOUND':
                        playerStats.rebounds++;
                        break;
                    case 'ASSIST':
                        playerStats.assists++;
                        break;
                    case 'STEAL':
                        playerStats.steals++;
                        break;
                    case 'BLOCK':
                        playerStats.blocks++;
                        break;
                }
            });

            // Sort players: starters first (appeared in first 5 minutes), then by points
            const sortPlayers = (players: any[]) => {
                return players.sort((a: any, b: any) => {
                    const aIsStarter = a.firstAppearance <= 5;
                    const bIsStarter = b.firstAppearance <= 5;

                    if (aIsStarter && !bIsStarter) return -1;
                    if (!aIsStarter && bIsStarter) return 1;

                    // Within same group (starters or subs), sort by points
                    return b.stats.points - a.stats.points;
                });
            };

            const homePlayers = sortPlayers(Object.values(homePlayerStats).map((p: any) => ({
                ...p,
                points: p.stats.points,
                rebounds: p.stats.rebounds,
                assists: p.stats.assists,
                steals: p.stats.steals,
                blocks: p.stats.blocks,
            })));

            const awayPlayers = sortPlayers(Object.values(awayPlayerStats).map((p: any) => ({
                ...p,
                points: p.stats.points,
                rebounds: p.stats.rebounds,
                assists: p.stats.assists,
                steals: p.stats.steals,
                blocks: p.stats.blocks,
            })));

            lineups = {
                home: {
                    starters: homePlayers.filter((p: any) => p.firstAppearance <= 5),
                    bench: homePlayers.filter((p: any) => p.firstAppearance > 5),
                },
                away: {
                    starters: awayPlayers.filter((p: any) => p.firstAppearance <= 5),
                    bench: awayPlayers.filter((p: any) => p.firstAppearance > 5),
                },
            };
        }

        // Parse stats if available
        let stats: any = null;
        if (match.match.stats) {
            try {
                stats = JSON.parse(match.match.stats);
            } catch (e) {
                console.error('Error parsing stats:', e);
            }
        }

        // If stats are not available and this is a football match, calculate from events
        const isFootball = !match.match.sport || match.match.sport === 'Football' ||
            (match.match.sport as string) === '5-a-side' || (match.match.sport as string) === 'Five-a-side';
        const statsEmpty = !stats || Object.keys(stats).length === 0;
        if (statsEmpty && isFootball && events.length > 0) {
            const homeIdx = 0; // home = index 0
            const awayIdx = 1; // away = index 1
            const s: number[][] = Array.from({ length: 18 }, () => [0, 0]);

            events.forEach((event: any) => {
                const idx = event.teamId === match.match.homeTeamId ? 0 : 1;
                switch (event.type) {
                    case 'Goal': s[0][idx]++; s[2][idx]++; break; // goals, shots
                    case 'Penalty': s[0][idx]++; s[3][idx]++; break; // goals, penalties
                    case 'Own Goal': s[0][idx === 0 ? 1 : 0]++; break; // goals for opponent
                    case 'Shot on Target': s[2][idx]++; s[4][idx]++; break; // shots, shotsOnTarget
                    case 'Shot off Target': s[2][idx]++; s[5][idx]++; break; // shots, shotsOffTarget
                    case 'Corner': s[6][idx]++; break;
                    case 'Foul': case 'Push': case 'Handball': s[7][idx]++; break; // fouls
                    case 'Yellow Card': s[8][idx]++; break;
                    case 'Red Card': s[9][idx]++; break;
                    case 'Offside': s[10][idx]++; break;
                    case 'Free Kick': s[11][idx]++; break;
                    case 'Assist': s[12][idx]++; break;
                    case 'Save': s[13][idx]++; break;
                    case 'Catch': s[14][idx]++; break;
                    case 'Block': s[15][idx]++; break;
                    case 'Interception': s[16][idx]++; break;
                    case 'Clearance': s[17][idx]++; break;
                }
            });

            // Compute possession from attacking events (shots + corners + free kicks)
            const homePossession = (s[2][0] + s[6][0] + s[11][0]) || 0;
            const awayPossession = (s[2][1] + s[6][1] + s[11][1]) || 0;
            const totalPoss = homePossession + awayPossession;
            const homePct = totalPoss > 0 ? Math.round((homePossession / totalPoss) * 100) : 50;
            const awayPct = 100 - homePct;

            stats = {
                shots: [s[2][0], s[2][1]],
                shotsOnTarget: [s[4][0], s[4][1]],
                shotsOffTarget: [s[5][0], s[5][1]],
                goals: [s[0][0], s[0][1]],
                penalties: [s[3][0], s[3][1]],
                corners: [s[6][0], s[6][1]],
                fouls: [s[7][0], s[7][1]],
                yellowCards: [s[8][0], s[8][1]],
                redCards: [s[9][0], s[9][1]],
                offsides: [s[10][0], s[10][1]],
                freeKicks: [s[11][0], s[11][1]],
                assists: [s[12][0], s[12][1]],
                saves: [s[13][0], s[13][1]],
                catches: [s[14][0], s[14][1]],
                blocks: [s[15][0], s[15][1]],
                interceptions: [s[16][0], s[16][1]],
                clearances: [s[17][0], s[17][1]],
                possession: [homePct, awayPct],
                possessionEvents: [homePossession, awayPossession],
                expectedGoals: [s[0][0], s[0][1]], // xG approx from goals
                ownGoals: [s[0][1], s[0][0]], // simplified
                tackles: [0, 0],
                throwIns: [0, 0],
                goalKicks: [0, 0],
                substitutions: [0, 0],
            };
        }

        // If stats are not available and this is a basketball match, calculate from events
        if (!stats && match.match.sport === 'Basketball' && events.length > 0) {
            stats = {
                homeFieldGoals: 0,
                awayFieldGoals: 0,
                homeThreePointers: 0,
                awayThreePointers: 0,
                homeFreeThrows: 0,
                awayFreeThrows: 0,
                homeRebounds: 0,
                awayRebounds: 0,
                homeAssists: 0,
                awayAssists: 0,
                homeSteals: 0,
                awaySteals: 0,
                homeBlocks: 0,
                awayBlocks: 0,
                homeTurnovers: 0,
                awayTurnovers: 0,
            };

            // Calculate stats from events
            events.forEach((event: any) => {
                const isHomeTeam = event.teamId === match.match.homeTeamId;
                const prefix = isHomeTeam ? 'home' : 'away';

                switch (event.type) {
                    case '2PT_MADE':
                        stats[`${prefix}FieldGoals`]++;
                        break;
                    case '3PT_MADE':
                        stats[`${prefix}FieldGoals`]++;
                        stats[`${prefix}ThreePointers`]++;
                        break;
                    case 'FREE_THROW':
                        stats[`${prefix}FreeThrows`]++;
                        break;
                    case 'REBOUND':
                        stats[`${prefix}Rebounds`]++;
                        break;
                    case 'ASSIST':
                        stats[`${prefix}Assists`]++;
                        break;
                    case 'STEAL':
                        stats[`${prefix}Steals`]++;
                        break;
                    case 'BLOCK':
                        stats[`${prefix}Blocks`]++;
                        break;
                }
            });
        }

        // Note: Viewer count feature not yet implemented in schema

        // Merge updated ratings into lineups
        if (lineups) {
            try {
                const updatedRatings = await db
                    .select()
                    .from(playerRatings)
                    .where(eq(playerRatings.matchId, matchId));

                if (updatedRatings.length > 0) {
                    const ratingMap = new Map();
                    updatedRatings.forEach(r => {
                        ratingMap.set(r.playerId, r.finalRating ?? r.autoRating);
                    });

                    const updatePlayerRatings = (players: any[]) => {
                        if (!Array.isArray(players)) return players;
                        return players.map((p: any) => ({
                            ...p,
                            rating: ratingMap.has(p.id) ? ratingMap.get(p.id) : p.rating
                        }));
                    };

                    if (lineups.home) {
                        lineups.home = updatePlayerRatings(lineups.home);
                    }
                    if (lineups.away) {
                        lineups.away = updatePlayerRatings(lineups.away);
                    }
                }
            } catch (err) {
                console.error('Error merging ratings:', err);
            }
        }

        // BUG-018: shape a public DTO — banned fields (loggerId, approvalStatus,
        // managerNotes, approvedBy, approvedAt) are intentionally excluded.
        const { loggerId, approvalStatus, managerNotes, approvedBy, approvedAt, ...publicMatch } = match.match;

        return NextResponse.json({
            match: {
                ...publicMatch,
                homeTeam: match.homeTeam,
                awayTeam,
                competition,
                lineups,
                stats,
            },
            events,
        });
    } catch (error) {
        console.error('Error fetching match details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch match details' },
            { status: 500 }
        );
    }
}

/**
 * UPDATE match (Logger/Admin only)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: matchId } = await params;

        if (authUser.role === 'logger') {
            const assigned = await isLoggerAssigned(matchId, authUser.id);
            if (!assigned) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        } else if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();

        // BUG-051: validate status against allowed enum; restrict loggers to safe transitions only
        const VALID_STATUSES = ['PENDING', 'UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED'] as const;
        const LOGGER_ALLOWED_STATUSES: string[] = ['LIVE', 'FINISHED'];
        if (body.status !== undefined) {
            if (!VALID_STATUSES.includes(body.status)) {
                return NextResponse.json({ error: 'Invalid status value' }, { status: 422 });
            }
            if (authUser.role === 'logger' && !LOGGER_ALLOWED_STATUSES.includes(body.status)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // If assigning a logger, validate that the match isn't already assigned to another logger
        if (body.loggerId !== undefined && body.loggerId !== null) {
            const [existingMatch] = await db
                .select()
                .from(matches)
                .where(eq(matches.id, matchId));

            if (!existingMatch) {
                return NextResponse.json(
                    { error: 'Match not found' },
                    { status: 404 }
                );
            }

            // Check if match is already assigned to a different logger
            if (existingMatch.loggerId && existingMatch.loggerId !== body.loggerId) {
                return NextResponse.json(
                    {
                        error: 'Match is already assigned to another logger',
                        code: 'MATCH_ALREADY_ASSIGNED',
                    },
                    { status: 409 }
                );
            }
        }

        const updateData: any = {
            updatedAt: new Date(),
        };

        // Update allowed fields
        // BUG-052: score writes restricted to admin only; integer guard prevents corruption
        if (authUser.role === 'admin') {
            if (body.homeScore !== undefined) {
                const s = Number(body.homeScore);
                if (!Number.isInteger(s) || s < 0) {
                    return NextResponse.json({ error: 'Invalid homeScore' }, { status: 422 });
                }
                updateData.homeScore = s;
            }
            if (body.awayScore !== undefined) {
                const s = Number(body.awayScore);
                if (!Number.isInteger(s) || s < 0) {
                    return NextResponse.json({ error: 'Invalid awayScore' }, { status: 422 });
                }
                updateData.awayScore = s;
            }
        }
        if (body.status !== undefined) updateData.status = body.status;
        if (body.currentPeriod !== undefined) updateData.currentPeriod = body.currentPeriod;
        // BUG-109: periodic DB checkpoint of the live clock — assigned logger or admin only
        // (already gated above), same integer-guard pattern as score. null clears the value
        // (e.g. on FINISHED) without requiring a separate code path.
        if (body.minute !== undefined) {
            if (body.minute !== null) {
                const m = Number(body.minute);
                if (!Number.isInteger(m) || m < 0 || m > 200) {
                    return NextResponse.json({ error: 'Invalid minute' }, { status: 422 });
                }
                updateData.minute = m;
            } else {
                updateData.minute = null;
            }
        }
        if (body.extraTime !== undefined) {
            if (body.extraTime !== null) {
                const e = Number(body.extraTime);
                if (!Number.isInteger(e) || e < 0 || e > 60) {
                    return NextResponse.json({ error: 'Invalid extraTime' }, { status: 422 });
                }
                updateData.extraTime = e;
            } else {
                updateData.extraTime = null;
            }
        }
        if (body.loggerId !== undefined) updateData.loggerId = body.loggerId;
        if (body.stats) updateData.stats = JSON.stringify(body.stats);
        if (body.lineups) updateData.lineups = JSON.stringify(body.lineups);

        // Additional fields for match details editing
        if (body.sport) updateData.sport = body.sport;
        if (body.homeTeamId) updateData.homeTeamId = body.homeTeamId;
        if (body.awayTeamId) updateData.awayTeamId = body.awayTeamId;
        if (body.startTime) updateData.startTime = new Date(body.startTime);
        if (body.venue) updateData.venue = body.venue;
        if (body.competition) updateData.competition = body.competition;
        if (body.competitionId) updateData.competitionId = body.competitionId;
        if (body.competitionLevel) updateData.competitionLevel = body.competitionLevel;
        if (body.matchType) updateData.matchType = body.matchType;
        if (body.friendlyType) updateData.friendlyType = body.friendlyType;
        if (body.friendlyDescription !== undefined) updateData.friendlyDescription = body.friendlyDescription;
        // Approval fields are admin-only — loggers must not write these
        if (authUser.role === 'admin') {
            if (body.approvalStatus) updateData.approvalStatus = body.approvalStatus;
            if (body.managerNotes !== undefined) updateData.managerNotes = body.managerNotes;
            if (body.approvedBy) updateData.approvedBy = body.approvedBy;
            if (body.approvedAt) updateData.approvedAt = new Date(body.approvedAt);
        }

        await db
            .update(matches)
            .set(updateData)
            .where(eq(matches.id, matchId));

        // Broadcast update via Socket.IO
        if (typeof global !== 'undefined' && (global as any).io) {
            (global as any).io.to(`match:${matchId}`).emit('match:updated', {
                matchId,
                ...updateData,
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Match updated successfully',
        });
    } catch (error) {
        console.error('Error updating match:', error);
        return NextResponse.json(
            { error: 'Failed to update match' },
            { status: 500 }
        );
    }
}

/**
 * DELETE match (Admin only)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: matchId } = await params;

        // Check if match exists
        const [existing] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId));

        if (!existing) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Handle constraint: bracketNodes - clear foreign key
        await db
            .update(bracketNodes)
            .set({ matchId: null })
            .where(eq(bracketNodes.matchId, matchId));

        // Handle constraint: headToHead - clear foreign key
        await db
            .update(headToHead)
            .set({ lastMatchId: null })
            .where(eq(headToHead.lastMatchId, matchId));

        // Handle constraint: teamForm - delete related records
        await db
            .delete(teamForm)
            .where(eq(teamForm.matchId, matchId));

        // Delete match (events, reminders, ratings, poll_votes, etc. will be cascade deleted)
        await db
            .delete(matches)
            .where(eq(matches.id, matchId));

        return NextResponse.json({
            success: true,
            message: 'Match deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting match:', error);
        return NextResponse.json(
            { error: 'Failed to delete match' },
            { status: 500 }
        );
    }
}
