/**
 * Eligible Players for Match API
 * GET /api/matches/[id]/eligible-players
 * 
 * Returns players eligible for a specific match based on the competition level.
 * Filters by both team affiliation and institutional eligibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, competitions, players, teams, playerTeamAffiliations } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { normalizeCompetitionLevel, isPlayerEligible } from '@/lib/competition-player-eligibility';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: matchId } = await params;
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId'); // Get eligible players for a specific team

        // Get match details
        const [match] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId));

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Get competition details if available
        let competition = null;
        if (match.competitionId) {
            [competition] = await db
                .select()
                .from(competitions)
                .where(eq(competitions.id, match.competitionId));
        } else if (match.competition) {
            [competition] = await db
                .select()
                .from(competitions)
                .where(eq(competitions.name, match.competition));
        }        
        const compLevel = normalizeCompetitionLevel(competition?.level || match.competitionLevel);

        let eligiblePlayers = [];

        if (teamId) {
            // Get eligible players for a specific team
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

            // Get all players (with affiliations)
            const teamAssociatedPlayers = await db
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
                        eq(players.teamId, teamId), // Primary team members
                        eq(playerTeamAffiliations.teamId, teamId) // Affiliated players
                    )
                );

            // Filter by institutional eligibility
            eligiblePlayers = teamAssociatedPlayers
                .map(row => row.player)
                .filter(p => isPlayerEligible(p, selectedTeam, compLevel));
        } else {
            // Get all eligible players for both teams
            const homeTeamPlayers = await db
                .select()
                .from(players)
                .where(eq(players.teamId, match.homeTeamId));

            const awayTeamPlayers = await db
                .select()
                .from(players)
                .where(eq(players.teamId, match.awayTeamId));

            const [homeTeam] = await db.select().from(teams).where(eq(teams.id, match.homeTeamId));
            const [awayTeam] = await db.select().from(teams).where(eq(teams.id, match.awayTeamId));

            // Filter eligible players by institutional eligibility
            const eligibleHome = homeTeamPlayers.filter(p =>
                isPlayerEligible(p, homeTeam, compLevel)
            );
            const eligibleAway = awayTeamPlayers.filter(p =>
                isPlayerEligible(p, awayTeam, compLevel)
            );

            eligiblePlayers = [...eligibleHome, ...eligibleAway];
        }

        return NextResponse.json({
            success: true,
            match: {
                id: match.id,
                homeTeamId: match.homeTeamId,
                awayTeamId: match.awayTeamId,
                competition: match.competition,
                competitionLevel: match.competitionLevel,
            },
            competitionLevel: compLevel,
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
