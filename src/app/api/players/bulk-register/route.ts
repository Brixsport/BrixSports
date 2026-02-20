/**
 * Bulk Player Registration API
 * POST /api/players/bulk-register
 * 
 * Creates a team (if it doesn't exist) and registers multiple players at once.
 * Designed for NPUGA Special Edition bulk registration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, players, competitions } from '@/db/schema';
import { eq } from 'drizzle-orm';
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
    // Players
    players: PlayerInput[];
}

export async function POST(request: NextRequest) {
    try {
        const body: BulkRegisterInput = await request.json();
        const { players: playerList, teamId, teamName, university, shortName, teamColor, sport, competitionId } = body;

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

        let resolvedTeamId = teamId;

        // If no teamId, create a new team
        if (!resolvedTeamId) {
            if (!teamName || !university || !shortName) {
                return NextResponse.json(
                    { error: 'Either teamId or teamName, university, and shortName are required' },
                    { status: 400 }
                );
            }

            // Check if team already exists for this university
            const existingTeam = await db.query.teams.findFirst({
                where: (t, { eq, and }) => and(
                    eq(t.name, teamName),
                    eq(t.sport, sport || 'Football')
                ),
            });

            if (existingTeam) {
                resolvedTeamId = existingTeam.id;
            } else {
                resolvedTeamId = nanoid();
                await db.insert(teams).values({
                    id: resolvedTeamId,
                    name: teamName,
                    shortName: shortName,
                    logo: '',
                    university: university,
                    color: teamColor || '#6366F1',
                    sport: sport || 'Football',
                    createdAt: new Date(),
                });
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
        }

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

            const playerId = nanoid();
            // Get or create profileId for multi-sport linking
            const profileId = await getPlayerProfileId(p.email);

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
                college: p.college || null,
                department: p.department || null,
                image: p.image || null,
                email: p.email || null,
                profileId: profileId,
                rating: 7.0,
                eyePoints: 0,
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
