/**
 * Team Detail API
 * GET /api/teams/[id] - Get complete team information
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, players, matches, basketballPlayerStats, playerTeamAffiliations, squadPlayers, standings } from '@/db/schema';
import { eq, or, desc, and, sql, inArray } from 'drizzle-orm';
import { enrichPlayersWithAffiliations, toPublicPlayer } from '@/lib/player-data';
import { getResolvedInstitutionalData } from '@/lib/player-affiliation-utils';
import { getAuthUser } from '@/lib/auth';

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request).catch(() => null);
        const isAdmin = authUser?.role === 'admin';

        const params = await props.params;
        const { id } = params;
        const { searchParams } = new URL(request.url);
        const competitionId = searchParams.get('competitionId');

        // Get team details
        const [team] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, id));

        if (!team) {
            return NextResponse.json(
                { error: 'Team not found' },
                { status: 404 }
            );
        }

        let teamPlayers: any[] = [];
        let squadInfo = null;

        // If competitionId provided, show squad players
        if (competitionId) {
            const squad = await db
                .select({
                    squadPlayer: squadPlayers,
                    player: {
                        id: players.id,
                        name: players.name,
                        number: players.number,
                        position: players.position,
                        avatar: players.image,
                        nationality: players.nationality,
                        rating: players.rating,
                    }
                })
                .from(squadPlayers)
                .where(
                    and(
                        eq(squadPlayers.teamId, id),
                        eq(squadPlayers.competitionId, competitionId),
                        eq(squadPlayers.status, 'active')
                    )
                )
                .leftJoin(players, eq(squadPlayers.playerId, players.id))
                .orderBy(desc(players.rating))
                .all();

            teamPlayers = squad
                .filter(s => s.player !== null)
                .map(s => ({
                    ...s.player,
                    squadRole: s.squadPlayer.role,
                    squadNumber: s.squadPlayer.squadNumber,
                }));

            squadInfo = {
                competitionId,
                totalSquadPlayers: teamPlayers.length,
            };
        } else {
            // Get team players via active affiliations (default behavior)
            const teamPlayerRows = await db
                .select({ player: players })
                .from(playerTeamAffiliations)
                .innerJoin(players, eq(playerTeamAffiliations.playerId, players.id))
                .where(
                    and(
                        eq(playerTeamAffiliations.teamId, id),
                        eq(playerTeamAffiliations.isActive, true)
                    )
                )
                .orderBy(desc(players.rating));

            teamPlayers = teamPlayerRows.map(row => toPublicPlayer(row.player, isAdmin));
        }

        // UNIVERSITY POOL — all students eligible to represent this university
        // Football analogy: all Spaniards (university affiliation) who can play for Spain (University Team)
        let universityPlayers: typeof teamPlayers = [];
        if (team.university && !competitionId) {
            const allPlayers = await db
                .select()
                .from(players)
                .orderBy(desc(players.rating));

            const enrichedPlayers = await enrichPlayersWithAffiliations(allPlayers);
            universityPlayers = enrichedPlayers
                .filter((player) => getResolvedInstitutionalData(player, player.team).university === team.university)
                .map(({ team: _team, ...player }) => toPublicPlayer(player, isAdmin));
        }

        // Get player stats (Basketball)
        let playersWithStats: typeof teamPlayers = teamPlayers;
        if (team.sport === 'Basketball' && teamPlayers.length > 0) {
            const playerIds = teamPlayers.map((p: any) => p.id);
            const statsData = await db
                .select()
                .from(basketballPlayerStats)
                .where(inArray(basketballPlayerStats.playerId, playerIds));

            playersWithStats = teamPlayers.map((p: any) => {
                const s = statsData.find((sd: any) => sd.playerId === p.id);
                return { ...p, stats: s || null };
            });
        }

        // Get recent matches (last 10)
        const recentMatches = await db
            .select()
            .from(matches)
            .where(
                or(
                    eq(matches.homeTeamId, id),
                    eq(matches.awayTeamId, id)
                )
            )
            .orderBy(desc(matches.startTime))
            .limit(10);

        // Get upcoming matches (next 10)
        const upcomingMatches = await db
            .select()
            .from(matches)
            .where(
                and(
                    or(
                        eq(matches.homeTeamId, id),
                        eq(matches.awayTeamId, id)
                    ),
                    eq(matches.status, 'UPCOMING')
                )
            )
            .orderBy(matches.startTime)
            .limit(10);

        // Fetch opponent details for matches
        const enrichMatches = async (matchList: any[]) => {
            return Promise.all(
                matchList.map(async (match) => {
                    const isHome = match.homeTeamId === id;
                    const opponentId = isHome ? match.awayTeamId : match.homeTeamId;

                    const [opponent] = await db
                        .select()
                        .from(teams)
                        .where(eq(teams.id, opponentId));

                    return {
                        ...match,
                        isHome,
                        opponent,
                    };
                })
            );
        };

        const enrichedRecent = await enrichMatches(recentMatches);
        const enrichedUpcoming = await enrichMatches(upcomingMatches);

        // Calculate team statistics
        // BACKLOG-097 follow-up: `teams`' own played/won/drawn/lost/goalsFor/goalsAgainst/points
        // columns are a cross-competition snapshot computed under a single hardcoded 3/1/0
        // points rule (see standingsService.ts's syncTeamOverallRecord comment), while
        // `standings` is per-competition under each competition's real points rule -- the two
        // provably disagree for any team in more than one competition. `standings` is the
        // correct source; read from it instead of `team.*`. `finishedMatches`/`enrichedRecent`
        // (last 10 matches only) remains the fallback for a team with no standings rows yet
        // (e.g. genuinely hasn't played, or a data gap before any recalc has run).
        const finishedMatches = enrichedRecent.filter(m => m.status === 'FINISHED');

        const teamStandingsRows = await db
            .select()
            .from(standings)
            .where(
                competitionId
                    ? and(eq(standings.teamId, id), eq(standings.competitionId, competitionId))
                    : eq(standings.teamId, id)
            );

        const useStoredStats = teamStandingsRows.length > 0;

        const stats = useStoredStats
            ? teamStandingsRows.reduce(
                (acc, row) => ({
                    played: acc.played + (row.played ?? 0),
                    won: acc.won + (row.won ?? 0),
                    drawn: acc.drawn + (row.drawn ?? 0),
                    lost: acc.lost + (row.lost ?? 0),
                    goalsFor: acc.goalsFor + (row.goalsFor ?? 0),
                    goalsAgainst: acc.goalsAgainst + (row.goalsAgainst ?? 0),
                    goalDifference: 0,
                    points: acc.points + (row.points ?? 0),
                }),
                { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
            )
            : {
                played: finishedMatches.length,
                won: finishedMatches.filter(m => (m.isHome ? m.homeScore > m.awayScore : m.awayScore > m.homeScore)).length,
                drawn: finishedMatches.filter(m => m.homeScore === m.awayScore).length,
                lost: finishedMatches.filter(m => (m.isHome ? m.homeScore < m.awayScore : m.awayScore < m.homeScore)).length,
                goalsFor: finishedMatches.reduce((sum, m) => sum + (m.isHome ? m.homeScore : m.awayScore), 0),
                goalsAgainst: finishedMatches.reduce((sum, m) => sum + (m.isHome ? m.awayScore : m.homeScore), 0),
                goalDifference: 0,
                points: 0,
            };

        if (!useStoredStats) {
            // Basic points calculation if not stored
            stats.points = (stats.won * (team.sport === 'Basketball' ? 2 : 3)) + (stats.drawn * 1);
        }

        stats.goalDifference = stats.goalsFor - stats.goalsAgainst;

        // Get form (last 5 matches)
        const form = finishedMatches.slice(0, 5).map(m => {
            if (m.isHome) {
                if (m.homeScore > m.awayScore) return 'W';
                if (m.homeScore < m.awayScore) return 'L';
                return 'D';
            } else {
                if (m.awayScore > m.homeScore) return 'W';
                if (m.awayScore < m.homeScore) return 'L';
                return 'D';
            }
        });

        // Get unique competitions
        const competitions = [...new Set(recentMatches.map(m => m.competition).filter(Boolean))];

        return NextResponse.json({
            team,
            players: playersWithStats,
            universityPlayers,       // all players from ALL teams under this university
            recentMatches: enrichedRecent,
            upcomingMatches: enrichedUpcoming,
            stats,
            form,
            competitions,
        });
    } catch (error) {
        console.error('Error fetching team details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch team details' },
            { status: 500 }
        );
    }
}
