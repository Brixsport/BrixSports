/**
 * Approve Team Registration and Create Players
 * POST /api/competitions/register/approve
 * 
 * Converts a team registration into an actual team and players in the system.
 * Supports:
 * - Players with club team affiliation
 * - Players without club teams but with university affiliation
 * - Creates playerTeamAffiliations for club team members
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
    teamRegistrations,
    registeredPlayers,
    teams,
    players,
    playerTeamAffiliations,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { ensureOrganizationEntity, syncPlayerOrganizationAffiliations } from '@/lib/player-data';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { registrationId } = body;

        if (!registrationId) {
            return NextResponse.json(
                { error: 'Registration ID required' },
                { status: 400 }
            );
        }

        // Get team registration
        const registration = await db
            .select()
            .from(teamRegistrations)
            .where(eq(teamRegistrations.id, registrationId));

        if (!registration || registration.length === 0) {
            return NextResponse.json(
                { error: 'Registration not found' },
                { status: 404 }
            );
        }

        const reg = registration[0];

        // Get registered players
        const regPlayers = await db
            .select()
            .from(registeredPlayers)
            .where(eq(registeredPlayers.registrationId, registrationId));

        if (regPlayers.length === 0) {
            return NextResponse.json(
                { error: 'No players in registration' },
                { status: 400 }
            );
        }

        // Create or get team (only if registering a club team)
        let teamId = reg.createdTeamId;
        if (!teamId) {
            const newTeamId = nanoid();
            const ownerOrganization = await ensureOrganizationEntity(reg.schoolName, 'university');
            const teamValues = {
                id: newTeamId,
                name: reg.teamName,
                shortName: reg.shortName,
                logo: (reg.logo || '') as string,
                university: reg.schoolName, // Team's university
                ownerOrganizationId: ownerOrganization?.id ?? null,
                color: (reg.color || '#000000') as string,
                sport: 'Football' as string, // Default sport; can be made configurable
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                points: 0,
                createdAt: new Date(),
            };
            await db.insert(teams).values(teamValues);
            teamId = newTeamId;

            // Update registration with created team ID
            await db
                .update(teamRegistrations)
                .set({ createdTeamId: newTeamId })
                .where(eq(teamRegistrations.id, registrationId));
        }

        // Convert registered players to actual players
        const createdPlayerIds: string[] = [];
        for (const regPlayer of regPlayers) {
            const playerId = nanoid();

            // Create player with optional teamId
            // Players without a club team can still have university affiliation
            await db.insert(players).values({
                id: playerId,
                name: regPlayer.name,
                jerseyName: regPlayer.jerseyName || null,
                number: regPlayer.number,
                teamId: teamId, // Set to club team ID
                position: regPlayer.position,
                rating: 7.0,
                eyePoints: 0,
                age: regPlayer.age || null,
                height: regPlayer.height || null,
                weight: regPlayer.weight || null,
                nationality: regPlayer.nationality,
                college: regPlayer.college || null,
                department: regPlayer.department || null,
                university: regPlayer.university || reg.schoolName, // Player's institution
                isExternal: false,
                image: regPlayer.image || null,
                marketValue: null,
                profileId: null,
                email: null,
                attributes: null,
                createdAt: new Date(),
            });

            await syncPlayerOrganizationAffiliations(playerId, {
                university: regPlayer.university || reg.schoolName,
                college: regPlayer.college || null,
                department: regPlayer.department || null,
            });

            // Create affiliation with club team
            await db.insert(playerTeamAffiliations).values({
                id: nanoid(),
                playerId,
                teamId,
                affiliationType: 'club', // This is their primary club team
                role: 'player',
                status: 'active',
                isPrimary: true,
                isActive: true,
                startDate: new Date(),
                jerseyNumber: regPlayer.number,
                position: regPlayer.position,
                createdAt: new Date(),
            });

            createdPlayerIds.push(playerId);

            // Update registered player with created player ID
            await db
                .update(registeredPlayers)
                .set({ createdPlayerId: playerId })
                .where(eq(registeredPlayers.id, regPlayer.id));
        }

        // Update registration status
        await db
            .update(teamRegistrations)
            .set({ status: 'approved', playersSubmitted: true })
            .where(eq(teamRegistrations.id, registrationId));

        return NextResponse.json({
            success: true,
            message: 'Registration approved successfully',
            teamId,
            playersCreated: createdPlayerIds.length,
            playerIds: createdPlayerIds,
        });
    } catch (error) {
        console.error('Approval error:', error);
        return NextResponse.json(
            { error: 'Failed to approve registration', details: String(error) },
            { status: 500 }
        );
    }
}
