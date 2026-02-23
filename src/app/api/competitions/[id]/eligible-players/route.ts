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
import { db } from '@/db';
import { competitions, players, teams, playerTeamAffiliations } from '@/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { normalizeCompetitionLevel, isPlayerEligible } from '@/lib/competition-player-eligibility';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const competitionId = params.id;
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId'); // Optional: filter for specific team only
        const sport = searchParams.get('sport'); // Optional: filter by sport

        // Get competition details
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

        // Determine filtering logic based on competition level
        const compLevel = normalizeCompetitionLevel(competition.level);
        let eligiblePlayers: typeof players | any[] = [];

        if (teamId) {
            // If filtering for a specific team, get that team's details first
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

            // Get players affiliated with this team
            const teamPlayers = await db
                .select({
                    player: players,
                    team: teams,
                    affiliation: playerTeamAffiliations,
                })
                .from(players)
                .leftJoin(teams, eq(players.teamId, teams.id))
                .leftJoin(
                    playerTeamAffiliations,
                    and(
                        eq(playerTeamAffiliations.playerId, players.id),
                        eq(playerTeamAffiliations.teamId, teamId),
                        eq(playerTeamAffiliations.isActive, true)
                    )
                )
                .where(
                    or(
                        eq(players.teamId, teamId), // Players with primary team = this team
                        eq(playerTeamAffiliations.teamId, teamId) // Players affiliated with this team
                    )
                );

            // Filter by institutional data based on competition level
            eligiblePlayers = teamPlayers
                .map(row => row.player)
                .filter(p => isPlayerEligible(p, selectedTeam, compLevel));
        } else {
            // Get all players eligible for this competition
            const allPlayers = await db.select().from(players);

            // For each player, check if eligible based on competition level and institutional data
            eligiblePlayers = allPlayers.filter(player => isPlayerEligible(player, null, compLevel));
        }

        // Filter by sport if provided
        if (sport) {
            // Get teams with matching sport
            const sportTeams = await db
                .select({ id: teams.id })
                .from(teams)
                .where(eq(teams.sport, sport));

            const sportTeamIds = sportTeams.map(t => t.id);

            if (sportTeamIds.length > 0) {
                eligiblePlayers = eligiblePlayers.filter(p =>
                    p.teamId && sportTeamIds.includes(p.teamId)
                );
            } else {
                eligiblePlayers = [];
            }
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

/**
 * Determines if a player is eligible for a competition based on level and institutional data
 * (Now imported from helper function - kept for reference)
 */
