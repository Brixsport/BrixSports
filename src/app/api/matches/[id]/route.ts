/**
 * Match Details API Route
 * Fetch detailed match information with events, lineups, stats, and more
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams, matchEvents, players, bracketNodes, teamForm, headToHead } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { playerRatings } from '@/db/schema-ratings';

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
                    [relatedPlayer] = await db
                        .select()
                        .from(players)
                        .where(eq(players.id, row.event.relatedPlayerId));
                }

                return {
                    ...row.event,
                    player: row.player,
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

        return NextResponse.json({
            match: {
                ...match.match,
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
        const { id: matchId } = await params;
        const body = await request.json();

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
                        currentLoggerId: existingMatch.loggerId
                    },
                    { status: 409 } // 409 Conflict
                );
            }
        }

        const updateData: any = {
            updatedAt: new Date(),
        };

        // Update allowed fields
        if (body.homeScore !== undefined) updateData.homeScore = body.homeScore;
        if (body.awayScore !== undefined) updateData.awayScore = body.awayScore;
        if (body.status) updateData.status = body.status;
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
        if (body.approvalStatus) updateData.approvalStatus = body.approvalStatus;
        if (body.managerNotes !== undefined) updateData.managerNotes = body.managerNotes;
        if (body.approvedBy) updateData.approvedBy = body.approvedBy;
        if (body.approvedAt) updateData.approvedAt = new Date(body.approvedAt);

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
