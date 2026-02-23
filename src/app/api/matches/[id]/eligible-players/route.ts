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

            // Get all players via active affiliations
            const teamAssociatedPlayers = await db
                .select({
                    player: players,
                    team: teams,
                    affiliation: playerTeamAffiliations,
                })
                .from(playerTeamAffiliations)
                .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
                .innerJoin(teams, eq(playerTeamAffiliations.teamId, teams.id))
                .where(
                    and(
                        eq(playerTeamAffiliations.teamId, teamId),
                        eq(playerTeamAffiliations.isActive, true)
                    )
                );

            // Filter by institutional eligibility
            eligiblePlayers = teamAssociatedPlayers
                .map(row => row.player)
                .filter(p => isPlayerEligible(p, selectedTeam, compLevel));
        } else {
            // Get all eligible players for both teams via active affiliations
            const homeAffiliations = await db
                .select({
                    player: players,
                    affiliation: playerTeamAffiliations,
                })
                .from(playerTeamAffiliations)
                .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
                .where(
                    and(
                        eq(playerTeamAffiliations.teamId, match.homeTeamId),
                        eq(playerTeamAffiliations.isActive, true)
                    )
                );

            const awayAffiliations = await db
                .select({
                    player: players,
                    affiliation: playerTeamAffiliations,
                })
                .from(playerTeamAffiliations)
                .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
                .where(
                    and(
                        eq(playerTeamAffiliations.teamId, match.awayTeamId),
                        eq(playerTeamAffiliations.isActive, true)
                    )
                );

            const [homeTeam] = await db.select().from(teams).where(eq(teams.id, match.homeTeamId));
            const [awayTeam] = await db.select().from(teams).where(eq(teams.id, match.awayTeamId));

            // Filter eligible players by institutional eligibility
            const eligibleHome = homeAffiliations
                .map(row => row.player)
                .filter(p => isPlayerEligible(p, homeTeam, compLevel));
            const eligibleAway = awayAffiliations
                .map(row => row.player)
                .filter(p => isPlayerEligible(p, awayTeam, compLevel));

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
