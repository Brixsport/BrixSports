import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fplPlayerData, players, teams, playerTeamAffiliations } from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

// GET /api/fpl/players - Get FPL player data
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const season = searchParams.get('season') || '2024/2025';
        const position = searchParams.get('position'); // GK, DEF, MID, FWD
        const teamId = searchParams.get('teamId');
        const sortBy = searchParams.get('sortBy') || 'totalPoints'; // totalPoints, price, form, selectedBy
        const order = searchParams.get('order') || 'desc';
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100), 100);
        const search = searchParams.get('search');

        // Build where conditions
        const whereConditions = [eq(fplPlayerData.season, season)];

        if (position) {
            whereConditions.push(eq(fplPlayerData.position, position));
        }

        if (teamId) {
            whereConditions.push(eq(playerTeamAffiliations.teamId, teamId));
            whereConditions.push(eq(playerTeamAffiliations.isActive, true));
        }

        // Determine sort column
        const orderFn = order === 'asc' ? asc : desc;
        let orderByColumn;
        switch (sortBy) {
            case 'price':
                orderByColumn = fplPlayerData.price;
                break;
            case 'form':
                orderByColumn = fplPlayerData.form;
                break;
            case 'selectedBy':
                orderByColumn = fplPlayerData.selectedBy;
                break;
            case 'totalPoints':
            default:
                orderByColumn = fplPlayerData.totalPoints;
                break;
        }

        // Build and execute the complete query
        const results = await db
            .select({
                fplData: fplPlayerData,
                player: players,
                team: teams,
            })
            .from(fplPlayerData)
            .leftJoin(players, eq(fplPlayerData.playerId, players.id))
            .leftJoin(playerTeamAffiliations, eq(playerTeamAffiliations.playerId, players.id))
            .leftJoin(teams, eq(playerTeamAffiliations.teamId, teams.id))
            .where(and(...whereConditions))
            .orderBy(orderFn(orderByColumn))
            .limit(limit);

        // Filter by search if provided
        let filteredResults = results;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredResults = results.filter(r =>
                r.player?.name.toLowerCase().includes(searchLower) ||
                r.team?.name.toLowerCase().includes(searchLower)
            );
        }

        return NextResponse.json(filteredResults);
    } catch (error) {
        console.error('Error fetching FPL players:', error);
        return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
    }
}

// POST /api/fpl/players - Initialize or update FPL player data
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { playerId, season = '2024/2025', position, price, stats } = body;

        if (!playerId || !position || !price) {
            return NextResponse.json(
                { error: 'Player ID, position, and price are required' },
                { status: 400 }
            );
        }

        // Check if player exists
        const player = await db.query.players.findFirst({
            where: eq(players.id, playerId),
        });

        if (!player) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        // Check if FPL data already exists
        const existingData = await db.query.fplPlayerData.findFirst({
            where: and(
                eq(fplPlayerData.playerId, playerId),
                eq(fplPlayerData.season, season)
            ),
        });

        const fplDataId = existingData?.id || `fpl_player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        if (existingData) {
            // Update existing data
            await db.update(fplPlayerData)
                .set({
                    position,
                    price,
                    ...stats,
                    updatedAt: new Date(),
                })
                .where(eq(fplPlayerData.id, existingData.id));
        } else {
            // Create new data
            await db.insert(fplPlayerData).values({
                id: fplDataId,
                playerId,
                season,
                position,
                price,
                ...stats,
            });
        }

        const updatedData = await db.query.fplPlayerData.findFirst({
            where: eq(fplPlayerData.id, fplDataId),
        });

        return NextResponse.json(updatedData);
    } catch (error) {
        console.error('Error updating FPL player data:', error);
        return NextResponse.json({ error: 'Failed to update player data' }, { status: 500 });
    }
}
