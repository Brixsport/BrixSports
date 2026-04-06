import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players, playerTeamAffiliations, competitions, teams, squadPlayers } from '@/db/schema';
import { eq, and, inArray, not } from 'drizzle-orm';

// GET /api/squads/eligible?teamId=xxx&competitionId=xxx
// Returns all players eligible to be selected for the squad
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const competitionId = searchParams.get('competitionId');

        if (!teamId || !competitionId) {
            return NextResponse.json(
                { error: 'teamId and competitionId are required' },
                { status: 400 }
            );
        }

        // Get team details
        const team = await db
            .select()
            .from(teams)
            .where(eq(teams.id, teamId))
            .all();

        if (team.length === 0) {
            return NextResponse.json(
                { error: 'Team not found' },
                { status: 404 }
            );
        }

        const teamData = team[0];

        // Get competition details
        const competition = await db
            .select()
            .from(competitions)
            .where(eq(competitions.id, competitionId))
            .all();

        if (competition.length === 0) {
            return NextResponse.json(
                { error: 'Competition not found' },
                { status: 404 }
            );
        }

        const compData = competition[0];

        // Find all players already in squad
        const squadMembers = await db
            .select({ playerId: squadPlayers.playerId })
            .from(squadPlayers)
            .where(
                and(
                    eq(squadPlayers.teamId, teamId),
                    eq(squadPlayers.competitionId, competitionId)
                )
            )
            .all();

        const squadPlayerIds = new Set(squadMembers.map(s => s.playerId));

        // For external competitions (like NPUGA):
        // - Players from the university (team.university) are eligible
        // - Players with affiliation to this team are eligible
        let eligiblePlayers: any[] = [];

        if (teamData.university) {
            // Get all players from this university
            const universityPlayers = await db
                .select({
                    id: players.id,
                    name: players.name,
                    number: players.number,
                    position: players.position,
                    avatar: players.avatar,
                    nationality: players.nationality,
                    university: players.university,
                    college: players.college,
                    department: players.department,
                    level: players.level,
                })
                .from(players)
                .where(eq(players.university, teamData.university))
                .all();

            // Get players with direct affiliation to this team
            const affiliatedPlayers = await db
                .select({
                    player: {
                        id: players.id,
                        name: players.name,
                        number: players.number,
                        position: players.position,
                        avatar: players.avatar,
                        nationality: players.nationality,
                        university: players.university,
                        college: players.college,
                        department: players.department,
                        level: players.level,
                    },
                    affiliation: playerTeamAffiliations,
                })
                .from(playerTeamAffiliations)
                .where(
                    and(
                        eq(playerTeamAffiliations.teamId, teamId),
                        eq(playerTeamAffiliations.isActive, true)
                    )
                )
                .leftJoin(players, eq(playerTeamAffiliations.playerId, players.id))
                .all();

            // Combine and deduplicate
            const playerMap = new Map();
            
            universityPlayers.forEach(p => {
                playerMap.set(p.id, { ...p, inSquad: squadPlayerIds.has(p.id) });
            });

            affiliatedPlayers.forEach(({ player, affiliation }) => {
                if (player) {
                    playerMap.set(player.id, { 
                        ...player, 
                        affiliation,
                        inSquad: squadPlayerIds.has(player.id)
                    });
                }
            });

            eligiblePlayers = Array.from(playerMap.values());
        } else {
            // For teams without university (external clubs), get affiliated players
            const affiliatedPlayers = await db
                .select({
                    player: {
                        id: players.id,
                        name: players.name,
                        number: players.number,
                        position: players.position,
                        avatar: players.avatar,
                        nationality: players.nationality,
                        university: players.university,
                        college: players.college,
                        department: players.department,
                        level: players.level,
                    },
                    affiliation: playerTeamAffiliations,
                })
                .from(playerTeamAffiliations)
                .where(
                    and(
                        eq(playerTeamAffiliations.teamId, teamId),
                        eq(playerTeamAffiliations.isActive, true)
                    )
                )
                .leftJoin(players, eq(playerTeamAffiliations.playerId, players.id))
                .all();

            eligiblePlayers = affiliatedPlayers
                .filter(({ player }) => player !== null)
                .map(({ player, affiliation }) => ({
                    ...player,
                    affiliation,
                    inSquad: squadPlayerIds.has(player!.id),
                }));
        }

        return NextResponse.json({
            success: true,
            team: {
                id: teamData.id,
                name: teamData.name,
                university: teamData.university,
            },
            competition: {
                id: compData.id,
                name: compData.name,
                requireSquad: compData.requireSquad,
                maxSquadSize: compData.maxSquadSize,
            },
            eligiblePlayers,
            eligibleCount: eligiblePlayers.length,
            squadSize: squadPlayerIds.size,
            remainingSlots: Math.max(0, (compData.maxSquadSize || 25) - squadPlayerIds.size),
        });
    } catch (error) {
        console.error('[Eligible] Error fetching eligible players:', error);
        return NextResponse.json(
            { error: 'Failed to fetch eligible players' },
            { status: 500 }
        );
    }
}
