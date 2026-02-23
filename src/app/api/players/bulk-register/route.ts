/**
 * Bulk Player Registration API
 * POST /api/players/bulk-register
 * 
 * Creates a team (if it doesn't exist) and registers multiple players at once.
 * Designed for NPUGA Special Edition bulk registration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, players, competitions, playerTeamAffiliations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getPlayerProfileId } from '@/db/utils/player-profile';

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
    email?: string; // For multi-sport linking
}

interface BulkRegisterInput {
    competitionId?: string;
    teamId?: string; // If existing team
    // Team creation fields (if no teamId)
    teamName?: string;
    university?: string;
    shortName?: string;
    teamColor?: string;
    sport?: string;
    gender?: string;
    // Players
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
        const { players: playerList, teamId, teamName, university, shortName, teamColor, sport, competitionId, gender } = body;

        // Validate players
        if (!playerList || !Array.isArray(playerList) || playerList.length === 0) {
            return NextResponse.json(
                { error: 'At least one player is required' },
                { status: 400 }
            );
        }

        // Validate each player
        for (let i = 0; i < playerList.length; i++) {
            const p = playerList[i];
            if (!p.name || !p.number || !p.position) {
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
            (gender === 'M' || gender === 'male') ? 'male' :
                (gender === 'F' || gender === 'female') ? 'female' :
                    'mixed';

        let resolvedTeamId = teamId;
        let isHomeInstitution = false;

        // Resolve or create team
        if (!resolvedTeamId) {
            if (isNpugaCompetition && university && sport && gender) {
                // For NPUGA, derive the team from university + sport + gender
                const existingTeam = await db.query.teams.findFirst({
                    where: (t, { and, eq }) => and(
                        eq(t.university, university),
                        eq(t.sport, normalizedSport),
                        eq(t.gender, normalizedGender),
                    ),
                });

                if (existingTeam) {
                    resolvedTeamId = existingTeam.id;
                    isHomeInstitution =
                        existingTeam.isHomeInstitution ?? isBellsUniversity(existingTeam.university);
                } else {
                    const teamIdGenerated = nanoid();
                    const sportKey = normalizedSport;
                    const genderSuffix = normalizedGender === 'male' ? 'Men' : normalizedGender === 'female' ? 'Women' : 'Mixed';
                    const defaultTeamName = `${university} ${sportKey} ${genderSuffix}`;

                    await db.insert(teams).values({
                        id: teamIdGenerated,
                        name: teamName || defaultTeamName,
                        shortName: shortName || `${university?.slice(0, 3)?.toUpperCase() || 'TMP'}-${sportKey[0]?.toUpperCase() || 'S'}-${genderSuffix[0]}`,
                        logo: '',
                        university,
                        gender: normalizedGender,
                        isHomeInstitution: isBellsUniversity(university),
                        color: teamColor || '#6366F1',
                        sport: normalizedSport,
                        createdAt: new Date(),
                    });

                    resolvedTeamId = teamIdGenerated;
                    isHomeInstitution = isBellsUniversity(university);
                }
            } else {
                // Generic bulk registration: require explicit team data
                if (!teamName || !university || !shortName) {
                    return NextResponse.json(
                        { error: 'Either teamId or teamName, university, and shortName are required' },
                        { status: 400 }
                    );
                }

                const existingTeam = await db.query.teams.findFirst({
                    where: (t, { and, eq }) => and(
                        eq(t.name, teamName),
                        eq(t.sport, normalizedSport)
                    ),
                });

                if (existingTeam) {
                    resolvedTeamId = existingTeam.id;
                    isHomeInstitution =
                        existingTeam.isHomeInstitution ?? isBellsUniversity(existingTeam.university);
                } else {
                    resolvedTeamId = nanoid();
                    await db.insert(teams).values({
                        id: resolvedTeamId,
                        name: teamName,
                        shortName: shortName,
                        logo: '',
                        university,
                        gender: normalizedGender,
                        isHomeInstitution: isBellsUniversity(university),
                        color: teamColor || '#6366F1',
                        sport: normalizedSport,
                        createdAt: new Date(),
                    });
                    isHomeInstitution = isBellsUniversity(university);
                }
            }
        } else {
            // Verify team exists
            const existingTeam = await db.query.teams.findFirst({
                where: (t, { eq }) => eq(t.id, resolvedTeamId!),
            });
            if (!existingTeam) {
                return NextResponse.json(
                    { error: 'Team not found' },
                    { status: 404 }
                );
            }
            isHomeInstitution =
                existingTeam.isHomeInstitution ?? isBellsUniversity(existingTeam.university);
        }

        const isExternalTeam = isNpugaCompetition && !isHomeInstitution;

        // Create player records
        const createdPlayers = [];
        const skippedPlayers = [];

        for (const p of playerList) {
            // Check if player with same number already exists on this team
            const existing = await db.query.players.findFirst({
                where: (pl, { eq, and }) => and(
                    eq(pl.teamId, resolvedTeamId!),
                    eq(pl.number, p.number)
                ),
            });

            if (existing) {
                skippedPlayers.push({ name: p.name, number: p.number, reason: 'Jersey number already taken' });
                continue;
            }

            let playerId: string;
            let profileId: string | null = null;

            // For Bells players in NPUGA, try to reuse existing player profiles by email
            const isBellsHome =
                isNpugaCompetition &&
                isHomeInstitution &&
                !!p.email;

            if (isBellsHome) {
                const existingPlayer = await db.query.players.findFirst({
                    where: (pl, { eq }) => eq(pl.email, p.email!),
                });

                if (existingPlayer) {
                    playerId = existingPlayer.id;
                    profileId = existingPlayer.profileId;
                } else {
                    playerId = nanoid();
                    profileId = await getPlayerProfileId(p.email);

                    await db.insert(players).values({
                        id: playerId,
                        name: p.name,
                        jerseyName: p.jerseyName || p.name.split(' ').pop()?.toUpperCase() || p.name,
                        number: p.number,
                        teamId: resolvedTeamId!,
                        position: p.position,
                        age: p.age || null,
                        height: p.height || null,
                        weight: p.weight || null,
                        nationality: p.nationality || 'Nigeria',
                        college: isExternalTeam ? null : p.college || null,
                        department: isExternalTeam ? null : p.department || null,
                        image: p.image || null,
                        email: p.email || null,
                        profileId,
                        rating: 7.0,
                        eyePoints: 0,
                        createdAt: new Date(),
                    });
                }
            } else {
                playerId = nanoid();
                profileId = await getPlayerProfileId(p.email);

                await db.insert(players).values({
                    id: playerId,
                    name: p.name,
                    jerseyName: p.jerseyName || p.name.split(' ').pop()?.toUpperCase() || p.name,
                    number: p.number,
                    teamId: resolvedTeamId!,
                    position: p.position,
                    age: p.age || null,
                    height: p.height || null,
                    weight: p.weight || null,
                    nationality: p.nationality || 'Nigeria',
                    college: isExternalTeam ? null : p.college || null,
                    department: isExternalTeam ? null : p.department || null,
                    image: p.image || null,
                    email: p.email || null,
                    profileId,
                    rating: 7.0,
                    eyePoints: 0,
                    createdAt: new Date(),
                });
            }

            // Create affiliation to the resolved team
            await db.insert(playerTeamAffiliations).values({
                id: nanoid(),
                playerId,
                teamId: resolvedTeamId!,
                affiliationType: isNpugaCompetition
                    ? (isHomeInstitution ? 'university' : 'external')
                    : 'club',
                isActive: true,
                joinedDate: new Date(),
                leftDate: null,
                createdAt: new Date(),
            });

            createdPlayers.push({ id: playerId, name: p.name, number: p.number });
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

// GET - fetch teams for the registration dropdown
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sport = searchParams.get('sport') || 'Football';

        const allTeams = await db.query.teams.findMany({
            where: (t, { eq }) => eq(t.sport, sport),
            columns: {
                id: true,
                name: true,
                shortName: true,
                university: true,
                color: true,
                sport: true,
            },
        });

        // Also get competitions for context
        const allCompetitions = await db.query.competitions.findMany({
            where: (c, { eq }) => eq(c.sport, sport),
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
