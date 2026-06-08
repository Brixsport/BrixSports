import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teamRegistrations, registeredPlayers } from '@/db/schema';
import { nanoid } from 'nanoid';

// PUBLIC: intentional — teams self-register for competitions without an account. Rate limiting needed (BACKLOG).
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { competitionId, teamInfo, players } = body;

        // Validate required fields
        if (!competitionId || !teamInfo || !players) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Create team registration
        const registrationId = nanoid();
        await db.insert(teamRegistrations).values({
            id: registrationId,
            competitionId,
            teamName: teamInfo.teamName,
            schoolName: teamInfo.schoolName,
            shortName: teamInfo.shortName,
            logo: teamInfo.logo || null,
            color: teamInfo.color,
            contactName: teamInfo.contactName,
            contactEmail: teamInfo.contactEmail,
            contactPhone: teamInfo.contactPhone,
            status: 'pending',
            playersSubmitted: players.length > 0,
            numberOfPlayers: players.length,
            notes: teamInfo.notes || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Create registered players
        if (players.length > 0) {
            const playerRecords = players.map((player: any) => ({
                id: nanoid(),
                registrationId,
                name: player.name,
                jerseyName: player.jerseyName || null,
                number: player.number,
                position: player.position,
                age: player.age || null,
                height: player.height || null,
                weight: player.weight || null,
                nationality: player.nationality || 'Nigeria',
                university: player.university || teamInfo.schoolName || null, // Player's university affiliation
                college: player.college || null,
                department: player.department || null,
                image: player.image || null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            await db.insert(registeredPlayers).values(playerRecords);
        }

        return NextResponse.json({
            success: true,
            registrationId,
            message: 'Registration submitted successfully',
        });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Failed to process registration' },
            { status: 500 }
        );
    }
}

// GET endpoint to fetch registration details
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const registrationId = searchParams.get('id');

        if (!registrationId) {
            return NextResponse.json(
                { error: 'Registration ID required' },
                { status: 400 }
            );
        }

        const registration = await db.query.teamRegistrations.findFirst({
            where: (teamRegistrations, { eq }) => eq(teamRegistrations.id, registrationId),
        });

        if (!registration) {
            return NextResponse.json(
                { error: 'Registration not found' },
                { status: 404 }
            );
        }

        const players = await db.query.registeredPlayers.findMany({
            where: (registeredPlayers, { eq }) => eq(registeredPlayers.registrationId, registrationId),
        });

        // PUBLIC: intentional — teams check their own submission status via registrationId (nanoid entropy).
        // Contact fields are stripped; they must not be returned to unauthenticated callers.
        return NextResponse.json({
            registration: {
                id: registration.id,
                competitionId: registration.competitionId,
                teamName: registration.teamName,
                schoolName: registration.schoolName,
                shortName: registration.shortName,
                status: registration.status,
                numberOfPlayers: registration.numberOfPlayers,
                playersSubmitted: registration.playersSubmitted,
                createdAt: registration.createdAt,
                updatedAt: registration.updatedAt,
            },
            players,
        });
    } catch (error) {
        console.error('Fetch registration error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch registration' },
            { status: 500 }
        );
    }
}
