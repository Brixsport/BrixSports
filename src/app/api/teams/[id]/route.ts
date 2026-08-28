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
import { getPlayerRatingSummaries } from '@/lib/playerRatingSummary';

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
                .all();

            // BACKLOG-253: real career rating, batched -- players.rating is a
            // frozen legacy default, both for display and for the sort below
            // (previously sorted by the same frozen field).
            const squadRatingSummaries = await getPlayerRatingSummaries(
                squad.filter(s => s.player !== null).map(s => s.player!.id)
            );

            teamPlayers = squad
                .filter(s => s.player !== null)
                .map(s => ({
                    ...s.player,
                    rating: squadRatingSummaries.get(s.player!.id)?.averageRating ?? null,
                    squadRole: s.squadPlayer.role,
                    squadNumber: s.squadPlayer.squadNumber,
                }))
                .sort((a, b) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity));

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
                );

            // BACKLOG-253: real career rating, batched -- same reasoning as
            // the squad branch above.
            const affiliationRatingSummaries = await getPlayerRatingSummaries(
                teamPlayerRows.map(row => row.player.id)
            );

            teamPlayers = teamPlayerRows
                .map(row => ({
                    ...toPublicPlayer(row.player, isAdmin),
                    rating: affiliationRatingSummaries.get(row.player.id)?.averageRating ?? null,
                }))
                .sort((a: any, b: any) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity));
        }

        // UNIVERSITY POOL — all students eligible to represent this university
        // Football analogy: all Spaniards (university affiliation) who can play for Spain (University Team)
        // BACKLOG-261: NOT narrowed to a DB-level `WHERE university = X` filter,
        // deliberately -- getResolvedInstitutionalData() resolves university
        // with priority (org affiliation name > players.university column >
        // team.university fallback), which can legitimately differ from the
        // raw column. A naive DB filter on the raw column would silently drop
        // or wrongly include players. Fetch-all-then-resolve is kept exactly
        // as before for correctness; only the OUTPUT shape is narrowed below,
        // to the 4 fields TeamDetailClient.tsx:486-506 actually renders
        // (grep-confirmed against every consumer of this route).
        let universityPlayers: Array<{ id: string; name: string; number: number; position: string }> = [];
        if (team.university && !competitionId) {
            const allPlayers = await db
                .select()
                .from(players)
                .orderBy(desc(players.rating));

            const enrichedPlayers = await enrichPlayersWithAffiliations(allPlayers);
            universityPlayers = enrichedPlayers
                .filter((player) => getResolvedInstitutionalData(player, player.team).university === team.university)
                .map((player) => ({
                    id: player.id,
                    name: player.name,
                    number: player.number,
                    position: player.position,
                }));
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

        // BACKLOG-261: explicit allow-list -- every matches column except the
        // 5 CLAUDE.md-banned fields plus everything else TeamDetailClient.tsx
        // doesn't read (grep-confirmed: id, startTime, isHome (computed),
        // status, homeScore, awayScore, competition, venue, opponent.name,
        // opponent.shortName -- the only fields read across both the recent
        // and upcoming sections). homeTeamId/awayTeamId kept in the query
        // (needed to compute isHome/opponent) but dropped from the final
        // shape below.
        const TEAM_MATCH_FIELDS = {
            id: matches.id,
            homeTeamId: matches.homeTeamId,
            awayTeamId: matches.awayTeamId,
            status: matches.status,
            homeScore: matches.homeScore,
            awayScore: matches.awayScore,
            startTime: matches.startTime,
            venue: matches.venue,
            competition: matches.competition,
        };

        // Get recent matches (last 10)
        const recentMatches = await db
            .select(TEAM_MATCH_FIELDS)
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
            .select(TEAM_MATCH_FIELDS)
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

        // BACKLOG-261: batch the opponent lookup into one query instead of
        // one per match (was a real N+1 across up to 20 matches).
        const opponentIds = Array.from(new Set(
            [...recentMatches, ...upcomingMatches].map(m => m.homeTeamId === id ? m.awayTeamId : m.homeTeamId)
        ));
        const opponentTeams = opponentIds.length > 0
            ? await db
                .select({ id: teams.id, name: teams.name, shortName: teams.shortName })
                .from(teams)
                .where(inArray(teams.id, opponentIds))
            : [];
        const opponentMap = new Map(opponentTeams.map(t => [t.id, { name: t.name, shortName: t.shortName }]));

        const enrichMatches = (matchList: typeof recentMatches) =>
            matchList.map(({ homeTeamId, awayTeamId, homeScore, awayScore, ...match }) => {
                const isHome = homeTeamId === id;
                const opponentId = isHome ? awayTeamId : homeTeamId;
                return {
                    ...match,
                    // homeScore/awayScore are nullable columns; every downstream
                    // consumer (stats/form calc below, TeamDetailClient.tsx)
                    // does numeric comparisons assuming a real score.
                    homeScore: homeScore ?? 0,
                    awayScore: awayScore ?? 0,
                    isHome,
                    opponent: opponentMap.get(opponentId) ?? null,
                };
            });

        const enrichedRecent = enrichMatches(recentMatches);
        const enrichedUpcoming = enrichMatches(upcomingMatches);

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
