/**
 * Team Detail API
 * GET /api/teams/[id] - Get complete team information
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, players, matches, basketballPlayerStats, footballPlayerStats, playerTeamAffiliations, squadPlayers } from '@/db/schema';
import { eq, or, desc, and, sql, inArray } from 'drizzle-orm';
import { enrichPlayersWithAffiliations, toPublicPlayer } from '@/lib/player-data';
import { getResolvedInstitutionalData } from '@/lib/player-affiliation-utils';
import { getAuthUser } from '@/lib/auth';
import { getPlayerRatingSummaries } from '@/lib/playerRatingSummary';
import { getTeamCompetitionStats, getTeamCompetitionSeasons } from '@/lib/standingsService';

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
        // BACKLOG-375: deliberately separate from `competitionId` above -- that param
        // scopes the SQUAD roster (an existing, unrelated admin feature). Reusing it
        // for the Season Stats card would silently change squad-roster behavior for
        // any caller that only meant to scope stats. 'all' spans every competition
        // (+ friendlies); a specific id gates to just that competition; omitted means
        // "resolve the default" (most recent season with real data) below.
        const statsCompetitionIdParam = searchParams.get('statsCompetitionId');

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

        // BACKLOG-375: season/competition scope for both the stats card below AND
        // the per-player stats attached here -- resolved once, shared by both, so a
        // selected season stays consistent across the whole page. Resolution order:
        // explicit `statsCompetitionId` param > most recent competition/season with a
        // real FINISHED match for this team > 'all' (team has none yet).
        const teamSeasons = await getTeamCompetitionSeasons(id, team.sport);
        const resolvedStatsCompetitionId: string | 'all' =
            statsCompetitionIdParam || teamSeasons[0]?.competitionId || 'all';

        // Get player stats -- BACKLOG-375: previously Basketball-only (football
        // players on a team roster got zero `.stats`, confirmed a real gap, not by
        // design -- no BACKLOG entry had ever called it out).
        //
        // Prefer-scoped-fallback-to-any, NOT a strict competitionId gate: a direct DB
        // check (2026-09-10) found 202 of 244 football_player_stats rows have
        // `competitionId = NULL` -- including every Joga-Bonito player's row, despite
        // real goals/appearances data existing. A strict `eq(competitionId, X)` filter
        // would silently zero out real stats for exactly the players this fix is
        // meant to surface. Filed as BACKLOG-376 (the backfill itself, not fixed
        // here) -- this read-side fallback is the same shape as
        // players/[id]/route.ts's pickEffectiveSeasonRows.
        let playersWithStats: typeof teamPlayers = teamPlayers;
        if (teamPlayers.length > 0) {
            const playerIds = teamPlayers.map((p: any) => p.id);
            const statsTable = team.sport === 'Basketball' ? basketballPlayerStats : footballPlayerStats;
            const allStatsData = await db
                .select()
                .from(statsTable)
                .where(inArray(statsTable.playerId, playerIds));

            playersWithStats = teamPlayers.map((p: any) => {
                const playerRows = allStatsData.filter((sd: any) => sd.playerId === p.id);
                const scoped = resolvedStatsCompetitionId !== 'all'
                    ? playerRows.filter((sd: any) => sd.competitionId === resolvedStatsCompetitionId)
                    : [];
                const pool = scoped.length > 0 ? scoped : playerRows;
                const s = pool.length > 0
                    ? [...pool].sort((a: any, b: any) =>
                        new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())[0]
                    : null;
                return { ...p, stats: s };
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

        // Calculate team statistics -- BACKLOG-375 (season-scoped "Season Stats" card).
        // Reads fresh from `matches` via standingsService's getTeamCompetitionStats,
        // NOT from summed `standings` rows: `standings` intentionally excludes
        // knockout-round matches (BACKLOG-275, correct for a league table), which
        // made a team's own season summary silently drop any Cup run (confirmed live,
        // Joga-Bonito: 3 group games in `standings` vs 6 real FINISHED matches
        // including a Quarter-Final/Semifinal/Final run). This card answers "what did
        // the team actually do," not "what does the group table say." teamSeasons /
        // resolvedStatsCompetitionId were already resolved above (shared with the
        // per-player stats block so both stay in sync on the same selected season).
        const stats = await getTeamCompetitionStats(id, team.sport, resolvedStatsCompetitionId);

        // "Recent form" strip is intentionally NOT scoped to resolvedStatsCompetitionId --
        // it's the team's actual last 5 games played, any competition, same as before.
        const finishedMatches = enrichedRecent.filter(m => m.status === 'FINISHED');

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
            // BACKLOG-375: drives the Season Stats card's selector. `all` is always a
            // valid choice even when `seasons` is empty (a team with no FINISHED
            // competition matches yet still gets a stats card, just all zeros).
            statsSeasons: {
                selected: resolvedStatsCompetitionId,
                seasons: teamSeasons,
            },
        });
    } catch (error) {
        console.error('Error fetching team details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch team details' },
            { status: 500 }
        );
    }
}
