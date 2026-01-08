import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players, playerStats, teams } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// GET /api/players/[id]/stats - Get player statistics
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: playerId } = await params;
        const { searchParams } = new URL(request.url);
        const competition = searchParams.get('competition');
        const season = searchParams.get('season');

        // Get player info with team
        const player = await db
            .select({
                player: players,
                team: teams,
            })
            .from(players)
            .leftJoin(teams, eq(players.teamId, teams.id))
            .where(eq(players.id, playerId))
            .get();

        if (!player) {
            return NextResponse.json(
                { error: 'Player not found' },
                { status: 404 }
            );
        }

        // Build stats query
        let statsQuery = db
            .select()
            .from(playerStats)
            .where(eq(playerStats.playerId, playerId));

        // Apply filters
        const conditions = [eq(playerStats.playerId, playerId)];

        if (competition) {
            conditions.push(eq(playerStats.competition, competition));
        }

        if (conditions.length > 1) {
            statsQuery = db
                .select()
                .from(playerStats)
                .where(and(...conditions));
        }

        const stats = await statsQuery;

        // Calculate totals across all competitions
        const totals = stats.reduce((acc, stat) => ({
            goals: acc.goals + (stat.goals || 0),
            assists: acc.assists + (stat.assists || 0),
            appearances: acc.appearances + (stat.appearances || 0),
            minutesPlayed: acc.minutesPlayed + (stat.minutesPlayed || 0),
            yellowCards: acc.yellowCards + (stat.yellowCards || 0),
            redCards: acc.redCards + (stat.redCards || 0),
            cleanSheets: acc.cleanSheets + (stat.cleanSheets || 0),
            saves: acc.saves + (stat.saves || 0),
        }), {
            goals: 0,
            assists: 0,
            appearances: 0,
            minutesPlayed: 0,
            yellowCards: 0,
            redCards: 0,
            cleanSheets: 0,
            saves: 0,
        });

        // Calculate average rating
        const avgRating = stats.length > 0
            ? stats.reduce((sum, stat) => sum + (stat.averageRating || 0), 0) / stats.length
            : 0;

        return NextResponse.json({
            player: {
                id: player.player.id,
                name: player.player.name,
                number: player.player.number,
                position: player.player.position,
                team: player.team ? {
                    id: player.team.id,
                    name: player.team.name,
                    logo: player.team.logo,
                } : null,
                image: player.player.image,
                rating: player.player.rating,
            },
            stats: stats,
            totals,
            averageRating: Number(avgRating.toFixed(2)),
        });
    } catch (error) {
        console.error('Error fetching player stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch player statistics' },
            { status: 500 }
        );
    }
}

// POST /api/players/[id]/stats - Create or update player statistics
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: playerId } = await params;
        const body = await request.json();
        const {
            competition,
            sport,
            goals = 0,
            assists = 0,
            appearances = 0,
            minutesPlayed = 0,
            yellowCards = 0,
            redCards = 0,
            cleanSheets = 0,
            saves = 0,
            averageRating = 7.0,
        } = body;

        // Validate required fields
        if (!competition || !sport) {
            return NextResponse.json(
                { error: 'Competition and sport are required' },
                { status: 400 }
            );
        }

        // Verify player exists
        const player = await db
            .select()
            .from(players)
            .where(eq(players.id, playerId))
            .get();

        if (!player) {
            return NextResponse.json(
                { error: 'Player not found' },
                { status: 404 }
            );
        }

        // Check if stats already exist for this player/competition
        const existingStats = await db
            .select()
            .from(playerStats)
            .where(
                and(
                    eq(playerStats.playerId, playerId),
                    eq(playerStats.competition, competition)
                )
            )
            .get();

        if (existingStats) {
            // Update existing stats
            await db
                .update(playerStats)
                .set({
                    goals,
                    assists,
                    appearances,
                    minutesPlayed,
                    yellowCards,
                    redCards,
                    cleanSheets,
                    saves,
                    averageRating,
                    updatedAt: new Date(),
                })
                .where(eq(playerStats.id, existingStats.id));

            return NextResponse.json({
                success: true,
                message: 'Player statistics updated successfully',
                stats: { ...existingStats, goals, assists, appearances },
            });
        } else {
            // Create new stats
            const statsId = `${playerId}_${competition}`;
            const newStats = {
                id: statsId,
                playerId,
                competition,
                sport,
                goals,
                assists,
                appearances,
                minutesPlayed,
                yellowCards,
                redCards,
                cleanSheets,
                saves,
                averageRating,
                updatedAt: new Date(),
            };

            await db.insert(playerStats).values(newStats);

            return NextResponse.json({
                success: true,
                message: 'Player statistics created successfully',
                stats: newStats,
            }, { status: 201 });
        }
    } catch (error) {
        console.error('Error creating/updating player stats:', error);
        return NextResponse.json(
            { error: 'Failed to save player statistics' },
            { status: 500 }
        );
    }
}
