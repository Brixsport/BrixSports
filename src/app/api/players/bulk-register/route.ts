/**
 * Bulk Player Registration API
 * POST /api/players/bulk-register
 *
 * Creates a team (if it doesn't exist) and registers multiple players at once.
 * Designed for NPUGA Special Edition bulk registration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { playerTeamAffiliations, players, teams } from '@/db/schema';
import { getPlayerProfileId } from '@/db/utils/player-profile';
import { ensureOrganizationEntity, syncPlayerOrganizationAffiliations } from '@/lib/player-data';

interface PlayerInput {
    name: string;
    jerseyName?: string;
    number: number;
    position: string;
    age?: number;
    height?: string;
    weight?: string;
    nationality?: string;
    college?: string;
    department?: string;
    image?: string;
    email?: string;
}

interface BulkRegisterInput {
    competitionId?: string;
    teamId?: string;
    teamName?: string;
    university?: string;
    shortName?: string;
    teamColor?: string;
    sport?: string;
    gender?: string;
    players: PlayerInput[];
}

const BELLS_UNIVERSITY_ALIASES = [
    'Bells University',
    'Bells University of Technology',
];

const isBellsUniversity = (name?: string | null) =>
    !!name && BELLS_UNIVERSITY_ALIASES.includes(name);

export async function POST(request: NextRequest) {
    try {
        const body: BulkRegisterInput = await request.json();
        const {
            players: playerList,
            teamId,
            teamName,
            university,
            shortName,
            teamColor,
            sport,
            competitionId,
            gender,
        } = body;

        if (!playerList || !Array.isArray(playerList) || playerList.length === 0) {
            return NextResponse.json(
                { error: 'At least one player is required' },
                { status: 400 }
            );
        }

        for (let i = 0; i < playerList.length; i += 1) {
            const player = playerList[i];
            if (!player.name || !player.number || !player.position) {
                return NextResponse.json(
                    { error: `Player ${i + 1}: name, number, and position are required` },
                    { status: 400 }
                );
            }
        }

        const npugaCompetitionIds = ['npuga-special-edition-2026', 'npuga-special-edition'];
        const isNpugaCompetition = !!competitionId && npugaCompetitionIds.includes(competitionId);
        const normalizedSport = sport || 'Football';
        const normalizedGender =
            gender === 'M' || gender === 'male'
                ? 'male'
                : gender === 'F' || gender === 'female'
                    ? 'female'
                    : 'mixed';

        let resolvedTeamId = teamId;
        let resolvedUniversity = university ?? null;
        let isHomeInstitution = false;

        if (!resolvedTeamId) {
            if (isNpugaCompetition && university && sport && gender) {
                const existingTeam = await db.query.teams.findFirst({
                    where: (team, { and: andWhere, eq: eqWhere }) => andWhere(
                        eqWhere(team.university, university),
                        eqWhere(team.sport, normalizedSport),
                        eqWhere(team.gender, normalizedGender),
                    ),
                });

                if (existingTeam) {
                    resolvedTeamId = existingTeam.id;
                    resolvedUniversity = existingTeam.university;
                    isHomeInstitution = isBellsUniversity(existingTeam.university);
                } else {
                    const ownerOrganization = await ensureOrganizationEntity(university, 'university');
                    const generatedTeamId = nanoid();
                    const genderSuffix =
                        normalizedGender === 'male' ? 'Men' :
                            normalizedGender === 'female' ? 'Women' :
                                'Mixed';
                    const defaultTeamName = `${university} ${normalizedSport} ${genderSuffix}`;

                    await db.insert(teams).values({
                        id: generatedTeamId,
                        name: teamName || defaultTeamName,
                        shortName: shortName || `${university.slice(0, 3).toUpperCase()}-${normalizedSport[0]?.toUpperCase() || 'S'}-${genderSuffix[0]}`,
                        logo: '',
                        university,
                        ownerOrganizationId: ownerOrganization?.id ?? null,
                        gender: normalizedGender,
                        color: teamColor || '#6366F1',
                        sport: normalizedSport,
                        createdAt: new Date(),
                    });

                    resolvedTeamId = generatedTeamId;
                    resolvedUniversity = university;
                    isHomeInstitution = isBellsUniversity(university);
                }
            } else {
                if (!teamName || !university || !shortName) {
                    return NextResponse.json(
                        { error: 'Either teamId or teamName, university, and shortName are required' },
                        { status: 400 }
                    );
                }

                const existingTeam = await db.query.teams.findFirst({
                    where: (team, { and: andWhere, eq: eqWhere }) => andWhere(
                        eqWhere(team.name, teamName),
                        eqWhere(team.sport, normalizedSport)
                    ),
                });

                if (existingTeam) {
                    resolvedTeamId = existingTeam.id;
                    resolvedUniversity = existingTeam.university;
                    isHomeInstitution = isBellsUniversity(existingTeam.university);
                } else {
                    const ownerOrganization = await ensureOrganizationEntity(university, 'university');
                    resolvedTeamId = nanoid();
                    await db.insert(teams).values({
                        id: resolvedTeamId,
                        name: teamName,
                        shortName,
                        logo: '',
                        university,
                        ownerOrganizationId: ownerOrganization?.id ?? null,
                        gender: normalizedGender,
                        color: teamColor || '#6366F1',
                        sport: normalizedSport,
                        createdAt: new Date(),
                    });

                    resolvedUniversity = university;
                    isHomeInstitution = isBellsUniversity(university);
                }
            }
        } else {
            const existingTeam = await db.query.teams.findFirst({
                where: (team, { eq: eqWhere }) => eqWhere(team.id, resolvedTeamId!),
            });

            if (!existingTeam) {
                return NextResponse.json(
                    { error: 'Team not found' },
                    { status: 404 }
                );
            }

            resolvedUniversity = existingTeam.university;
            isHomeInstitution = isBellsUniversity(existingTeam.university);
        }

        const isExternalTeam = isNpugaCompetition && !isHomeInstitution;
        const createdPlayers: Array<{ id: string; name: string; number: number }> = [];
        const skippedPlayers: Array<{ name: string; number: number; reason: string }> = [];

        for (const playerInput of playerList) {
            const existingOnLegacyTeam = await db.query.players.findFirst({
                where: (player, { and: andWhere, eq: eqWhere }) => andWhere(
                    eqWhere(player.teamId, resolvedTeamId!),
                    eqWhere(player.number, playerInput.number)
                ),
            });

            if (existingOnLegacyTeam) {
                skippedPlayers.push({
                    name: playerInput.name,
                    number: playerInput.number,
                    reason: 'Jersey number already taken',
                });
                continue;
            }

            let playerId: string;
            let reusedExistingPlayer = false;

            const shouldReuseByEmail =
                isNpugaCompetition &&
                isHomeInstitution &&
                !!playerInput.email;

            if (shouldReuseByEmail) {
                const existingPlayer = await db.query.players.findFirst({
                    where: (player, { eq: eqWhere }) => eqWhere(player.email, playerInput.email!),
                });

                if (existingPlayer) {
                    playerId = existingPlayer.id;
                    reusedExistingPlayer = true;
                } else {
                    playerId = nanoid();
                    const profileId = await getPlayerProfileId(playerInput.email);

                    await db.insert(players).values({
                        id: playerId,
                        name: playerInput.name,
                        jerseyName: playerInput.jerseyName || playerInput.name.split(' ').pop()?.toUpperCase() || playerInput.name,
                        number: playerInput.number,
                        teamId: resolvedTeamId!,
                        position: playerInput.position,
                        age: playerInput.age || null,
                        height: playerInput.height || null,
                        weight: playerInput.weight || null,
                        nationality: playerInput.nationality || 'Nigeria',
                        college: isExternalTeam ? null : playerInput.college || null,
                        department: isExternalTeam ? null : playerInput.department || null,
                        university: resolvedUniversity || 'Unknown',
                        isExternal: isExternalTeam,
                        image: playerInput.image || null,
                        email: playerInput.email || null,
                        profileId,
                        rating: 7.0,
                        eyePoints: 0,
                        createdAt: new Date(),
                    });

                    await syncPlayerOrganizationAffiliations(playerId, {
                        university: resolvedUniversity || 'Unknown',
                        college: isExternalTeam ? null : playerInput.college || null,
                        department: isExternalTeam ? null : playerInput.department || null,
                    });
                }
            } else {
                playerId = nanoid();
                const profileId = await getPlayerProfileId(playerInput.email);

                await db.insert(players).values({
                    id: playerId,
                    name: playerInput.name,
                    jerseyName: playerInput.jerseyName || playerInput.name.split(' ').pop()?.toUpperCase() || playerInput.name,
                    number: playerInput.number,
                    teamId: resolvedTeamId!,
                    position: playerInput.position,
                    age: playerInput.age || null,
                    height: playerInput.height || null,
                    weight: playerInput.weight || null,
                    nationality: playerInput.nationality || 'Nigeria',
                    college: isExternalTeam ? null : playerInput.college || null,
                    department: isExternalTeam ? null : playerInput.department || null,
                    university: resolvedUniversity || 'Unknown',
                    isExternal: isExternalTeam,
                    image: playerInput.image || null,
                    email: playerInput.email || null,
                    profileId,
                    rating: 7.0,
                    eyePoints: 0,
                    createdAt: new Date(),
                });

                await syncPlayerOrganizationAffiliations(playerId, {
                    university: resolvedUniversity || 'Unknown',
                    college: isExternalTeam ? null : playerInput.college || null,
                    department: isExternalTeam ? null : playerInput.department || null,
                });
            }

            const existingAffiliation = await db
                .select()
                .from(playerTeamAffiliations)
                .where(
                    and(
                        eq(playerTeamAffiliations.playerId, playerId),
                        eq(playerTeamAffiliations.teamId, resolvedTeamId!)
                    )
                )
                .get();

            if (existingAffiliation) {
                await db
                    .update(playerTeamAffiliations)
                    .set({
                        affiliationType: isNpugaCompetition
                            ? (isHomeInstitution ? 'university' : 'external')
                            : 'club',
                        role: 'player',
                        status: 'active',
                        isActive: true,
                        jerseyNumber: playerInput.number,
                        position: playerInput.position,
                    })
                    .where(eq(playerTeamAffiliations.id, existingAffiliation.id));
            } else {
                await db.insert(playerTeamAffiliations).values({
                    id: nanoid(),
                    playerId,
                    teamId: resolvedTeamId!,
                    affiliationType: isNpugaCompetition
                        ? (isHomeInstitution ? 'university' : 'external')
                        : 'club',
                    role: 'player',
                    status: 'active',
                    isPrimary: !reusedExistingPlayer,
                    isActive: true,
                    startDate: new Date(),
                    jerseyNumber: playerInput.number,
                    position: playerInput.position,
                    createdAt: new Date(),
                });
            }

            createdPlayers.push({ id: playerId, name: playerInput.name, number: playerInput.number });
        }

        return NextResponse.json({
            success: true,
            teamId: resolvedTeamId,
            created: createdPlayers.length,
            skipped: skippedPlayers.length,
            createdPlayers,
            skippedPlayers,
            message: `Successfully registered ${createdPlayers.length} player(s)${skippedPlayers.length > 0 ? `, ${skippedPlayers.length} skipped` : ''}`,
        });
    } catch (error) {
        console.error('Bulk registration error:', error);
        return NextResponse.json(
            { error: 'Failed to process bulk registration' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sport = searchParams.get('sport') || 'Football';

        const allTeams = await db.query.teams.findMany({
            where: (team, { eq: eqWhere }) => eqWhere(team.sport, sport),
            columns: {
                id: true,
                name: true,
                shortName: true,
                university: true,
                color: true,
                sport: true,
            },
        });

        const allCompetitions = await db.query.competitions.findMany({
            where: (competition, { eq: eqWhere }) => eqWhere(competition.sport, sport),
            columns: {
                id: true,
                name: true,
                sport: true,
                playersPerSide: true,
                status: true,
            },
        });

        return NextResponse.json({
            teams: allTeams,
            competitions: allCompetitions,
        });
    } catch (error) {
        console.error('Fetch teams error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch teams' },
            { status: 500 }
        );
    }
}
