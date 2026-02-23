/**
 * Create Individual Player (Without Team)
 * POST /api/players/create-individual
 * 
 * Creates a player with institutional affiliation (university, college, department)
 * but without requiring a team. Useful for:
 * - Individual registration in competitions
 * - Players representing their university/college/department
 * - Players who don't belong to a club team
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players } from '@/db/schema';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            position,
            university,
            college,
            department,
            age,
            height,
            weight,
            nationality = 'Nigeria',
            jerseyName,
            number,
            image,
        } = body;

        // Validate required fields
        if (!name || !position || !university) {
            return NextResponse.json(
                { error: 'name, position, and university are required' },
                { status: 400 }
            );
        }

        const playerId = nanoid();

        // Create player without team affiliation
        // They only have institutional data
        await db.insert(players).values({
            id: playerId,
            name,
            jerseyName: jerseyName || null,
            number: number || null,
            teamId: null, // NO team affiliation
            position,
            rating: 7.0,
            eyePoints: 0,
            age: age || null,
            height: height || null,
            weight: weight || null,
            nationality,
            college: college || null,
            department: department || null,
            university, // PRIMARY: University affiliation
            image: image || null,
            marketValue: null,
            profileId: null,
            email: null,
            attributes: null,
            createdAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            message: 'Player created successfully',
            playerId,
            player: {
                id: playerId,
                name,
                position,
                university,
                college,
                department,
                age,
                number,
            },
        });
    } catch (error) {
        console.error('Player creation error:', error);
        return NextResponse.json(
            { error: 'Failed to create player', details: String(error) },
            { status: 500 }
        );
    }
}
