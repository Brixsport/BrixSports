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
    competitions,
} from '@/db/schema';
import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { ensureOrganizationEntity, syncPlayerOrganizationAffiliations } from '@/lib/player-data';
import { getAuthUser } from '@/lib/auth';
import { getCurrentSeason } from '@/lib/rosterService';

class AlreadyApprovedError extends Error {}

export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

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

        // Cheap early exit; the claim inside the transaction below is what
        // actually prevents a concurrent double approval.
        if (reg.status === 'approved') {
            return NextResponse.json(
                { error: 'Registration already approved' },
                { status: 409 }
            );
        }

        // Derive the real season from the competition being registered for, same
        // pattern as updatePlayerStats()/bulk-register -- competitionId is NOT NULL
        // on teamRegistrations, so this is always available.
        let registrationSeason = await getCurrentSeason();
        const competition = await db
            .select({ season: competitions.season })
            .from(competitions)
            .where(eq(competitions.id, reg.competitionId))
            .get();
        if (competition?.season) registrationSeason = competition.season;

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

        // Resolve the owning organization up front (find-or-create, idempotent)
        // so the transaction below only holds writes to the registration, team,
        // players and affiliations.
        const ownerOrganization = reg.createdTeamId
            ? null
            : await ensureOrganizationEntity(reg.schoolName, 'university');

        let result: {
            teamId: string;
            createdPlayers: { id: string; university: string; college: string | null; department: string | null }[];
        };
        try {
            result = await db.transaction(async (tx) => {
                // Claim the registration: only one request can flip it to approved.
                const claimed = await tx
                    .update(teamRegistrations)
                    .set({
                        status: 'approved',
                        playersSubmitted: true,
                        approvedBy: authUser.id,
                        approvedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(and(
                        eq(teamRegistrations.id, registrationId),
                        or(isNull(teamRegistrations.status), ne(teamRegistrations.status, 'approved'))
                    ))
                    .returning({ createdTeamId: teamRegistrations.createdTeamId });

                if (claimed.length === 0) {
                    throw new AlreadyApprovedError();
                }

                // Create or get team (only if registering a club team)
                let teamId = claimed[0].createdTeamId;
                if (!teamId) {
                    const newTeamId = nanoid();
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
                    await tx.insert(teams).values(teamValues);
                    teamId = newTeamId;

                    // Update registration with created team ID
                    await tx
                        .update(teamRegistrations)
                        .set({ createdTeamId: newTeamId })
                        .where(eq(teamRegistrations.id, registrationId));
                }

                // Convert registered players to actual players. Rows that already
                // carry a createdPlayerId were converted by an earlier attempt.
                const createdPlayers: { id: string; university: string; college: string | null; department: string | null }[] = [];
                for (const regPlayer of regPlayers) {
                    if (regPlayer.createdPlayerId) continue;

                    const playerId = nanoid();

                    // Create player with optional teamId
                    // Players without a club team can still have university affiliation
                    await tx.insert(players).values({
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

                    // Create affiliation with club team
                    await tx.insert(playerTeamAffiliations).values({
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
                        season: registrationSeason,
                        createdAt: new Date(),
                    });

                    createdPlayers.push({
                        id: playerId,
                        university: regPlayer.university || reg.schoolName,
                        college: regPlayer.college || null,
                        department: regPlayer.department || null,
                    });

                    // Update registered player with created player ID
                    await tx
                        .update(registeredPlayers)
                        .set({ createdPlayerId: playerId })
                        .where(eq(registeredPlayers.id, regPlayer.id));
                }

                return { teamId, createdPlayers };
            });
        } catch (error) {
            if (error instanceof AlreadyApprovedError) {
                return NextResponse.json(
                    { error: 'Registration already approved' },
                    { status: 409 }
                );
            }
            throw error;
        }

        const { teamId, createdPlayers } = result;

        // University/college/department links are find-or-create and replace-by-
        // player, so they run after the commit; a failure is logged and reported
        // without undoing the approval.
        let affiliationSyncFailures = 0;
        for (const created of createdPlayers) {
            try {
                await syncPlayerOrganizationAffiliations(created.id, {
                    university: created.university,
                    college: created.college,
                    department: created.department,
                });
            } catch (syncError) {
                affiliationSyncFailures += 1;
                console.error('Approval organization affiliation sync failed:', created.id, syncError);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Registration approved successfully',
            teamId,
            playersCreated: createdPlayers.length,
            playerIds: createdPlayers.map((p) => p.id),
            ...(affiliationSyncFailures > 0 ? { affiliationSyncFailures } : {}),
        });
    } catch (error) {
        console.error('Approval error:', error);
        return NextResponse.json(
            { error: 'Failed to approve registration' },
            { status: 500 }
        );
    }
}
