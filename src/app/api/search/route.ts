/**
 * Global Search API
 * GET /api/search - Search across teams, players, matches, and competitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { competitions, matches, players, teams } from '@/db/schema';
import { enrichPlayersWithAffiliations, toPublicPlayer } from '@/lib/player-data';
import { getPrimaryTeam, getResolvedInstitutionalData } from '@/lib/player-affiliation-utils';
import { getAuthUser } from '@/lib/auth';

function playerMatchesQuery(
    player: Awaited<ReturnType<typeof enrichPlayersWithAffiliations>>[number],
    query: string
) {
    const normalizedQuery = query.toLowerCase();
    const primaryTeam = getPrimaryTeam(player);
    const institutionalData = getResolvedInstitutionalData(player, primaryTeam);
    const searchTerms = [
        player.name,
        player.jerseyName,
        player.email,
        institutionalData.university,
        institutionalData.college,
        institutionalData.department,
        primaryTeam?.name,
        primaryTeam?.shortName,
        ...(player.memberships ?? []).flatMap((membership) => [
            membership.team.name,
            membership.team.shortName,
            membership.team.university,
        ]),
        ...(player.organizationAffiliations ?? []).flatMap((affiliation) => [
            affiliation.organization.name,
            affiliation.organization.shortName,
            affiliation.organization.displayName,
        ]),
    ].filter((value): value is string => Boolean(value));

    return searchTerms.some((term) => term.toLowerCase().includes(normalizedQuery));
}

export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request).catch(() => null);
        const isAdmin = authUser?.role === 'admin';

        const { searchParams } = new URL(request.url);

        const query = searchParams.get('q') || '';
        const category = searchParams.get('category');
        const sport = searchParams.get('sport');
        const limit = parseInt(searchParams.get('limit') || '20', 10);

        if (!query || query.length < 2) {
            return NextResponse.json({
                results: {
                    teams: [],
                    players: [],
                    matches: [],
                    competitions: [],
                },
                total: 0,
                query,
            });
        }

        const searchPattern = `%${query.toLowerCase()}%`;
        const results: Record<string, unknown[]> = {
            teams: [],
            players: [],
            matches: [],
            competitions: [],
        };

        if (!category || category === 'all' || category === 'teams') {
            const teamFilters = [
                sql`LOWER(${teams.name}) LIKE ${searchPattern}`,
                sql`LOWER(${teams.shortName}) LIKE ${searchPattern}`,
                sql`LOWER(${teams.university}) LIKE ${searchPattern}`,
            ];

            const whereClause = sport
                ? and(or(...teamFilters), eq(teams.sport, sport))
                : or(...teamFilters);

            results.teams = await db
                .select()
                .from(teams)
                .where(whereClause)
                .limit(limit);
        }

        if (!category || category === 'all' || category === 'players') {
            const candidatePlayers = await db
                .select()
                .from(players)
                .where(
                    or(
                        like(players.name, searchPattern),
                        like(players.jerseyName, searchPattern),
                        like(players.university, searchPattern),
                        like(players.college, searchPattern),
                        like(players.department, searchPattern),
                        like(players.email, searchPattern),
                    )
                )
                .orderBy(desc(players.rating))
                .limit(limit * 4);

            const enrichedPlayers = await enrichPlayersWithAffiliations(candidatePlayers);
            results.players = enrichedPlayers
                .filter((player) => {
                    const primaryTeam = getPrimaryTeam(player);
                    if (sport && primaryTeam?.sport !== sport) {
                        return false;
                    }

                    // Matched against email/memberships/etc. before the public strip
                    // below — search must still work over fields a non-admin caller
                    // never sees in the response (BACKLOG-167).
                    return playerMatchesQuery(player, query);
                })
                .slice(0, limit)
                .map((player) => toPublicPlayer({
                    ...player,
                    team: getPrimaryTeam(player),
                }, isAdmin));
        }

        if (!category || category === 'all' || category === 'matches') {
            const matchFilters = or(
                sql`LOWER(${teams.name}) LIKE ${searchPattern}`,
                sql`LOWER(${teams.shortName}) LIKE ${searchPattern}`,
                sql`LOWER(${matches.competition}) LIKE ${searchPattern}`
            );

            const matchWhere = sport
                ? and(matchFilters, eq(matches.sport, sport))
                : matchFilters;

            const matchResults = await db
                .select({
                    match: matches,
                    homeTeam: teams,
                })
                .from(matches)
                .leftJoin(teams, eq(matches.homeTeamId, teams.id))
                .where(matchWhere)
                .limit(limit);

            results.matches = await Promise.all(
                matchResults.map(async (row) => {
                    const [awayTeam] = await db
                        .select()
                        .from(teams)
                        .where(eq(teams.id, row.match.awayTeamId));

                    return {
                        ...row.match,
                        homeTeam: row.homeTeam,
                        awayTeam,
                    };
                })
            );
        }

        if (!category || category === 'all' || category === 'competitions') {
            const compFilters = [
                sql`LOWER(${competitions.name}) LIKE ${searchPattern}`,
                sql`LOWER(${competitions.season}) LIKE ${searchPattern}`,
            ];

            const compWhere = sport
                ? and(or(...compFilters), eq(competitions.sport, sport))
                : or(...compFilters);

            results.competitions = await db
                .select()
                .from(competitions)
                .where(compWhere)
                .limit(limit);
        }

        const total = Object.values(results).reduce((sum, entries) => sum + entries.length, 0);

        return NextResponse.json({
            results,
            total,
            query,
            category: category || 'all',
        });
    } catch (error) {
        console.error('Error searching:', error);
        return NextResponse.json(
            { error: 'Search failed' },
            { status: 500 }
        );
    }
}
