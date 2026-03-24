import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players, playerStats } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { enrichPlayersWithAffiliations } from '@/lib/player-data';

// GET /api/players/[id]/stats - Get player statistics
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: playerId } = await params;
        const { searchParams } = new URL(request.url);
        const competitionId = searchParams.get('competitionId');
        const competition = searchParams.get('competition');
        const season = searchParams.get('season');

        const player = await db
            .select({
                player: players,
            })
            .from(players)
            .where(eq(players.id, playerId))
            .get();

        if (!player) {
            return NextResponse.json(
                { error: 'Player not found' },
                { status: 404 }
            );
        }

        const [enrichedPlayer] = await enrichPlayersWithAffiliations([player.player]);
        const playerTeam = enrichedPlayer?.team ?? null;

        // Build stats query
        let statsQuery = db
            .select()
            .from(playerStats)
            .where(eq(playerStats.playerId, playerId));

        // Apply filters
        const conditions = [eq(playerStats.playerId, playerId)];

        if (competitionId) {
            conditions.push(eq(playerStats.competitionId, competitionId));
        }

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
                team: playerTeam ? {
                    id: playerTeam.id,
                    name: playerTeam.name,
                    logo: playerTeam.logo,
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
            competitionId,
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
        if ((!competition && !competitionId) || !sport) {
            return NextResponse.json(
                { error: 'Competition(Id) and sport are required' },
                { status: 400 }
            );
        }

        const { or } = await import('drizzle-orm');

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
                    competitionId
                        ? or(eq(playerStats.competitionId, competitionId), eq(playerStats.competition, competition || ''))
                        : eq(playerStats.competition, competition || '')
                )
            )
            .get();

        if (existingStats) {
            // Update existing stats
            await db
                .update(playerStats)
                .set({
                    competitionId: competitionId || existingStats.competitionId,
                    competition: competition || existingStats.competition,
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
            const statsId = `${playerId}_${competitionId || competition}`;
            const newStats = {
                id: statsId,
                playerId,
                competition: competition || '',
                competitionId: competitionId || null,
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

// PATCH /api/players/[id]/stats - Increment player statistics (for real-time updates)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: playerId } = await params;
        const body = await request.json();
        const {
            competitionId,
            competition,
            sport,
            incrementGoals = 0,
            incrementAssists = 0,
            incrementYellowCards = 0,
            incrementRedCards = 0,
            incrementSaves = 0,
            incrementAppearances = 0,
        } = body;

        // Validate required fields
        if ((!competition && !competitionId) || !sport) {
            return NextResponse.json(
                { error: 'Competition(Id) and sport are required' },
                { status: 400 }
            );
        }

        const { or } = await import('drizzle-orm');

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
                    competitionId
                        ? or(eq(playerStats.competitionId, competitionId), eq(playerStats.competition, competition || ''))
                        : eq(playerStats.competition, competition || '')
                )
            )
            .get();

        if (existingStats) {
            // Increment existing stats
            const updatedStats = {
                goals: (existingStats.goals || 0) + incrementGoals,
                assists: (existingStats.assists || 0) + incrementAssists,
                yellowCards: (existingStats.yellowCards || 0) + incrementYellowCards,
                redCards: (existingStats.redCards || 0) + incrementRedCards,
                saves: (existingStats.saves || 0) + incrementSaves,
                appearances: (existingStats.appearances || 0) + incrementAppearances,
                updatedAt: new Date(),
            };

            await db
                .update(playerStats)
                .set({
                    ...updatedStats,
                    competitionId: competitionId || existingStats.competitionId,
                    competition: competition || existingStats.competition
                })
                .where(eq(playerStats.id, existingStats.id));

            return NextResponse.json({
                success: true,
                message: 'Player statistics incremented successfully',
                stats: { ...existingStats, ...updatedStats },
            });
        } else {
            // Create new stats with incremented values
            const statsId = `${playerId}_${competitionId || competition}`;
            const newStats = {
                id: statsId,
                playerId,
                competition: competition || '',
                competitionId: competitionId || null,
                sport,
                goals: incrementGoals,
                assists: incrementAssists,
                appearances: incrementAppearances,
                minutesPlayed: 0,
                yellowCards: incrementYellowCards,
                redCards: incrementRedCards,
                cleanSheets: 0,
                saves: incrementSaves,
                averageRating: 7.0,
                updatedAt: new Date(),
            };

            await db.insert(playerStats).values(newStats);

            return NextResponse.json({
                success: true,
                message: 'Player statistics created and incremented successfully',
                stats: newStats,
            }, { status: 201 });
        }
    } catch (error) {
        console.error('Error incrementing player stats:', error);
        return NextResponse.json(
            { error: 'Failed to increment player statistics' },
            { status: 500 }
        );
    }
}
