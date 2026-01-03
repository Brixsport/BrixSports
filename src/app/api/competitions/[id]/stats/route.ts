/**
 * Player Statistics API
 * Get top scorers, assists, and disciplinary records
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { playerStats, players, teams } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

/**
 * GET player statistics
 * GET /api/competitions/[id]/stats?type=scorers&limit=10
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const competitionId = params.id;
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'scorers'; // 'scorers' | 'assists' | 'discipline'
        const limit = parseInt(searchParams.get('limit') || '10');

        let query;

        switch (type) {
            case 'scorers':
                query = db
                    .select({
                        stat: playerStats,
                        player: players,
                        team: teams,
                    })
                    .from(playerStats)
                    .leftJoin(players, eq(playerStats.playerId, players.id))
                    .leftJoin(teams, eq(players.teamId, teams.id))
                    .where(eq(playerStats.competition, competitionId))
                    .orderBy(desc(playerStats.goals), desc(playerStats.assists))
                    .limit(limit);
                break;

            case 'assists':
                query = db
                    .select({
                        stat: playerStats,
                        player: players,
                        team: teams,
                    })
                    .from(playerStats)
                    .leftJoin(players, eq(playerStats.playerId, players.id))
                    .leftJoin(teams, eq(players.teamId, teams.id))
                    .where(eq(playerStats.competition, competitionId))
                    .orderBy(desc(playerStats.assists), desc(playerStats.goals))
                    .limit(limit);
                break;

            case 'discipline':
                query = db
                    .select({
                        stat: playerStats,
                        player: players,
                        team: teams,
                    })
                    .from(playerStats)
                    .leftJoin(players, eq(playerStats.playerId, players.id))
                    .leftJoin(teams, eq(players.teamId, teams.id))
                    .where(eq(playerStats.competition, competitionId))
                    .orderBy(desc(playerStats.redCards), desc(playerStats.yellowCards))
                    .limit(limit);
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid type parameter' },
                    { status: 400 }
                );
        }

        const results = await query;

        return NextResponse.json({
            type,
            stats: results.map((r) => ({
                ...r.stat,
                player: r.player,
                team: r.team,
            })),
        });
    } catch (error) {
        console.error('Error fetching player stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch player statistics' },
            { status: 500 }
        );
    }
}

/**
 * UPDATE player statistics
 * POST /api/competitions/[id]/stats
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const competitionId = params.id;
        const body = await request.json();
        const { playerId, goals, assists, yellowCards, redCards, appearances, minutesPlayed } = body;

        if (!playerId) {
            return NextResponse.json(
                { error: 'Player ID is required' },
                { status: 400 }
            );
        }

        // Check if stats exist for this player in this competition
        const [existing] = await db
            .select()
            .from(playerStats)
            .where(
                and(
                    eq(playerStats.playerId, playerId),
                    eq(playerStats.competition, competitionId)
                )
            );

        if (existing) {
            // Update existing stats
            await db
                .update(playerStats)
                .set({
                    goals: goals !== undefined ? existing.goals + goals : existing.goals,
                    assists: assists !== undefined ? existing.assists + assists : existing.assists,
                    yellowCards: yellowCards !== undefined ? existing.yellowCards + yellowCards : existing.yellowCards,
                    redCards: redCards !== undefined ? existing.redCards + redCards : existing.redCards,
                    appearances: appearances !== undefined ? existing.appearances + appearances : existing.appearances,
                    minutesPlayed: minutesPlayed !== undefined ? existing.minutesPlayed + minutesPlayed : existing.minutesPlayed,
                    updatedAt: new Date(),
                })
                .where(eq(playerStats.id, existing.id));

            return NextResponse.json({
                success: true,
                message: 'Player stats updated',
            });
        } else {
            // Create new stats
            const [player] = await db
                .select()
                .from(players)
                .where(eq(players.id, playerId));

            if (!player) {
                return NextResponse.json(
                    { error: 'Player not found' },
                    { status: 404 }
                );
            }

            const statId = `stat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            await db.insert(playerStats).values({
                id: statId,
                playerId,
                competition: competitionId,
                sport: 'Football', // Get from competition
                goals: goals || 0,
                assists: assists || 0,
                yellowCards: yellowCards || 0,
                redCards: redCards || 0,
                appearances: appearances || 0,
                minutesPlayed: minutesPlayed || 0,
            });

            return NextResponse.json(
                {
                    success: true,
                    statId,
                    message: 'Player stats created',
                },
                { status: 201 }
            );
        }
    } catch (error) {
        console.error('Error updating player stats:', error);
        return NextResponse.json(
            { error: 'Failed to update player statistics' },
            { status: 500 }
        );
    }
}
