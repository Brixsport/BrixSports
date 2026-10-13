import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teamRegistrations, registeredPlayers, competitions } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkRegistrationOpen, parseRegistrationInput } from '@/lib/registration-input';

// PUBLIC: intentional — teams self-register for competitions without an account.
export async function POST(request: NextRequest) {
    try {
        // Tighter than the public-GET default (item 10) -- a write endpoint with no
        // account requirement, real registration-spam risk, not just a scrape target.
        const rl = await checkRateLimit(request, { max: 10, windowMs: 60 * 1000, distributed: true });
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const competitionId = body?.competitionId;
        if (typeof competitionId !== 'string' || competitionId.trim() === '') {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const parsed = parseRegistrationInput(body);
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: 422 });
        }
        const { teamInfo, players } = parsed;

        const competition = await db
            .select({
                id: competitions.id,
                sport: competitions.sport,
                registrationOpen: competitions.registrationOpen,
                registrationDeadline: competitions.registrationDeadline,
                maxTeams: competitions.maxTeams,
            })
            .from(competitions)
            .where(eq(competitions.id, competitionId))
            .get();
        if (!competition) {
            return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
        }

        const activeRows = await db
            .select({ id: teamRegistrations.id })
            .from(teamRegistrations)
            .where(and(
                eq(teamRegistrations.competitionId, competition.id),
                inArray(teamRegistrations.status, ['pending', 'approved'])
            ))
            .limit(1000);

        const closedReason = checkRegistrationOpen(competition, activeRows.length, new Date());
        if (closedReason) {
            return NextResponse.json({ error: closedReason }, { status: 422 });
        }

        // Create the registration and its players together
        const registrationId = nanoid();
        await db.transaction(async (tx) => {
            await tx.insert(teamRegistrations).values({
                id: registrationId,
                competitionId: competition.id,
                teamName: teamInfo.teamName,
                schoolName: teamInfo.schoolName,
                shortName: teamInfo.shortName,
                logo: teamInfo.logo,
                color: teamInfo.color,
                contactName: teamInfo.contactName,
                contactEmail: teamInfo.contactEmail,
                contactPhone: teamInfo.contactPhone,
                status: 'pending',
                playersSubmitted: players.length > 0,
                numberOfPlayers: players.length,
                notes: teamInfo.notes,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            if (players.length > 0) {
                await tx.insert(registeredPlayers).values(players.map((player) => ({
                    id: nanoid(),
                    registrationId,
                    name: player.name,
                    jerseyName: player.jerseyName,
                    number: player.number,
                    position: player.position,
                    sport: competition.sport || 'Football',
                    age: player.age,
                    height: player.height,
                    weight: player.weight,
                    nationality: player.nationality,
                    university: player.university || teamInfo.schoolName, // Player's university affiliation
                    college: player.college,
                    department: player.department,
                    image: player.image,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })));
            }
        });

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
