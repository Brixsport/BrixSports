/**
 * Bulk Player Creation API
 * POST /api/players/bulk
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players } from '@/db/schema';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { players: playersToCreate } = body;

        if (!Array.isArray(playersToCreate) || playersToCreate.length === 0) {
            return NextResponse.json(
                { error: 'Invalid request: Expected an array of players' },
                { status: 400 }
            );
        }

        const newPlayers = playersToCreate.map(player => ({
            id: nanoid(),
            name: player.name,
            number: player.number,
            teamId: player.teamId,
            position: player.position,
            rating: player.rating || 7.0,
            age: player.age || null,
            height: player.height || null,
            weight: player.weight || null,
            nationality: player.nationality || null,
            image: player.image || null,
            marketValue: player.marketValue || null,
            attributes: player.attributes ? JSON.stringify(player.attributes) : null,
            createdAt: new Date(),
        }));

        // Batch insert
        const inserted = await db.insert(players).values(newPlayers).returning();

        return NextResponse.json({
            success: true,
            totalInserted: inserted.length,
            players: inserted
        }, { status: 201 });

    } catch (error) {
        console.error('Error in bulk player creation:', error);
        return NextResponse.json(
            { error: 'Failed to create players in bulk' },
            { status: 500 }
        );
    }
}
