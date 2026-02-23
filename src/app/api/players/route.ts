import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players } from '@/db/schema';
import { eq, inArray, or, like } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const ids = searchParams.get('ids');
        const search = searchParams.get('search');

        // Fetch by multiple IDs
        if (ids) {
            const playerIds = ids.split(',').map(id => id.trim()).filter(Boolean);
            if (playerIds.length === 0) {
                return NextResponse.json({ success: true, players: [] });
            }
            const foundPlayers = await db.select().from(players).where(inArray(players.id, playerIds));
            return NextResponse.json({ success: true, players: foundPlayers });
        }

        // Fetch by team ID
        if (teamId) {
            const teamPlayers = await db.select().from(players).where(eq(players.teamId, teamId));
            return NextResponse.json({ success: true, players: teamPlayers });
        }

        // Search by name
        if (search) {
            const searchResults = await db.select().from(players).where(
                or(
                    like(players.name, `%${search}%`),
                    like(players.jerseyName, `%${search}%`)
                )
            );
            return NextResponse.json({ success: true, players: searchResults });
        }

        // Fetch all players
        const allPlayers = await db.select().from(players);
        return NextResponse.json({ success: true, players: allPlayers });
    } catch (error) {
        console.error('Error fetching players:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch players' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getAuthUser(request as any);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Basic validation
        if (!body.name || !body.teamId) {
            return NextResponse.json({ error: 'Name and Team ID are required' }, { status: 400 });
        }

        const playerId = body.id || `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newPlayer = await db.insert(players).values({
            ...body,
            id: playerId,
        }).returning();

        return NextResponse.json(newPlayer[0], { status: 201 });
    } catch (error) {
        console.error('Error creating player:', error);
        return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
    }
}
