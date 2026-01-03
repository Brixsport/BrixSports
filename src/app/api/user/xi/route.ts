import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userXI } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/user/xi - Get all user XIs
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const isPublic = searchParams.get('public') === 'true';

        let teams;

        if (userId) {
            teams = await db
                .select()
                .from(userXI)
                .where(eq(userXI.userId, userId))
                .orderBy(desc(userXI.createdAt));
        } else if (isPublic) {
            teams = await db
                .select()
                .from(userXI)
                .where(eq(userXI.isPublic, true))
                .orderBy(desc(userXI.createdAt));
        } else {
            teams = await db
                .select()
                .from(userXI)
                .orderBy(desc(userXI.createdAt));
        }

        return NextResponse.json({
            teams,
            total: teams.length,
        });
    } catch (error) {
        console.error('[User XI API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch teams' },
            { status: 500 }
        );
    }
}

// POST /api/user/xi - Create a new XI
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, name, formation, players, isPublic } = body;

        if (!userId || !name || !formation || !players) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const newXI = await db
            .insert(userXI)
            .values({
                id: `xi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                userId,
                name,
                formation,
                players: JSON.stringify(players),
                isPublic: isPublic || false,
                likes: 0,
                views: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .returning();

        return NextResponse.json({
            success: true,
            xi: newXI[0],
        });
    } catch (error) {
        console.error('[User XI API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create XI' },
            { status: 500 }
        );
    }
}
