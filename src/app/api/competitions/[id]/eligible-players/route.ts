/**
 * Eligible Players for Competition API
 * GET /api/competitions/[id]/eligible-players
 *
 * Returns list of players eligible for a specific competition based on:
 * - Competition level (departmental, college, university, inter-university)
 * - Player's institutional data (university, college, department)
 * - Specific team affiliations (if filtering for a team in that competition)
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { competitions, playerTeamAffiliations, players, teams } from '@/db/schema';
import { normalizeCompetitionLevel, isPlayerEligible } from '@/lib/competition-player-eligibility';
import { enrichPlayersWithAffiliations } from '@/lib/player-data';
import { getPrimaryTeam } from '@/lib/player-affiliation-utils';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const competitionId = params.id;
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const sport = searchParams.get('sport');

        const [competition] = await db
            .select()
            .from(competitions)
            .where(eq(competitions.id, competitionId));

        if (!competition) {
            return NextResponse.json(
                { error: 'Competition not found' },
                { status: 404 }
            );
        }

        const compLevel = normalizeCompetitionLevel(competition.level);
        let eligiblePlayers = await enrichPlayersWithAffiliations([]);

        if (teamId) {
            const [selectedTeam] = await db
                .select()
                .from(teams)
                .where(eq(teams.id, teamId));

            if (!selectedTeam) {
                return NextResponse.json(
                    { error: 'Team not found' },
                    { status: 404 }
                );
            }

            const teamPlayers = await db
                .select({ player: players })
                .from(playerTeamAffiliations)
                .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
                .where(
                    and(
                        eq(playerTeamAffiliations.teamId, teamId),
                        eq(playerTeamAffiliations.isActive, true)
                    )
                );

            eligiblePlayers = (await enrichPlayersWithAffiliations(teamPlayers.map((row) => row.player)))
                .filter((player) => isPlayerEligible(player, selectedTeam, compLevel));
        } else {
            const allPlayers = await db.select().from(players);
            eligiblePlayers = (await enrichPlayersWithAffiliations(allPlayers))
                .filter((player) => isPlayerEligible(player, player.team, compLevel));
        }

        if (sport) {
            eligiblePlayers = eligiblePlayers.filter((player) => {
                const primaryTeam = getPrimaryTeam(player);
                if (primaryTeam?.sport === sport) {
                    return true;
                }

                return (player.memberships ?? []).some((membership) => membership.team.sport === sport);
            });
        }

        return NextResponse.json({
            success: true,
            competition: {
                id: competition.id,
                name: competition.name,
                level: competition.level,
            },
            players: eligiblePlayers,
            count: eligiblePlayers.length,
        });
    } catch (error) {
        console.error('Error fetching eligible players:', error);
        return NextResponse.json(
            { error: 'Failed to fetch eligible players' },
            { status: 500 }
        );
    }
}
