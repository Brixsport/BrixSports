/**
 * Global Search API
 * GET /api/search - Search across teams, players, matches, and competitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { competitions, matches, players, teams } from '@/db/schema';
import { enrichPlayersWithAffiliations, toPublicPlayer } from '@/lib/player-data';
import { getPrimaryTeam, getResolvedInstitutionalData } from '@/lib/player-affiliation-utils';
import { getAuthUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { getPlayerRatingSummaries } from '@/lib/playerRatingSummary';

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
        // Search is the most expensive of the public GET endpoints (multiple
        // LIKE scans per request), so a tighter ceiling than the shared
        // default -- still generous enough for real campus-shared-IP traffic.
        const rl = checkRateLimit(request, { max: 60, windowMs: 60 * 1000 });
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

        const authUser = await getAuthUser(request).catch(() => null);
        const isAdmin = authUser?.role === 'admin';

        const { searchParams } = new URL(request.url);

        const query = searchParams.get('q') || '';
        const category = searchParams.get('category');
        const sport = searchParams.get('sport');
        // BACKLOG-169: was unclamped -- ?limit=999999999 bypassed the intent
        // entirely across all 4 .limit(limit) call sites below.
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20), 50);

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
            const matchedPlayers = enrichedPlayers
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
                .slice(0, limit);

            // BACKLOG-254: `rating` below is players.rating, the frozen legacy
            // column (BACKLOG-253) -- SearchOverlay.tsx's "Top Rated" sort was a
            // no-op tie against it. Attach the real career accessor alongside it.
            const ratingSummaries = await getPlayerRatingSummaries(matchedPlayers.map((p) => p.id));
            results.players = matchedPlayers.map((player) => toPublicPlayer({
                ...player,
                team: getPrimaryTeam(player),
                averageRating: ratingSummaries.get(player.id)?.averageRating ?? null,
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

            // BACKLOG-261: explicit allow-list on the matches side (was
            // `...row.match`, a full-row spread -- same banned-field leak
            // class as BACKLOG-257) traced against every real consumer
            // (GlobalSearch.tsx, src/app/search/page.tsx -- SearchOverlay.tsx
            // and the player-search callers never read `results.matches` at
            // all, grep-confirmed): id, status, homeScore, awayScore,
            // startTime, competition, plus home/away team name+shortName.
            const SEARCH_MATCH_FIELDS = {
                id: matches.id,
                awayTeamId: matches.awayTeamId,
                status: matches.status,
                homeScore: matches.homeScore,
                awayScore: matches.awayScore,
                startTime: matches.startTime,
                competition: matches.competition,
            };
            const SEARCH_TEAM_FIELDS = {
                name: teams.name,
                shortName: teams.shortName,
            };

            const matchResults = await db
                .select({
                    match: SEARCH_MATCH_FIELDS,
                    homeTeam: SEARCH_TEAM_FIELDS,
                })
                .from(matches)
                .leftJoin(teams, eq(matches.homeTeamId, teams.id))
                .where(matchWhere)
                .limit(limit);

            // BACKLOG-261: batch the away-team lookup into one query instead
            // of one per matched row (was a real N+1).
            const awayTeamIds = Array.from(new Set(matchResults.map(r => r.match.awayTeamId)));
            const awayTeamsList = awayTeamIds.length > 0
                ? await db.select({ id: teams.id, ...SEARCH_TEAM_FIELDS }).from(teams).where(inArray(teams.id, awayTeamIds))
                : [];
            const awayTeamMap = new Map(awayTeamsList.map(t => [t.id, { name: t.name, shortName: t.shortName }]));

            results.matches = matchResults.map(({ match, homeTeam }) => {
                const { awayTeamId, ...publicMatch } = match;
                return {
                    ...publicMatch,
                    homeTeam,
                    awayTeam: awayTeamMap.get(awayTeamId) ?? null,
                };
            });
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
