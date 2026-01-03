/**
 * Global Search API
 * GET /api/search - Search across teams, players, matches, and competitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, players, matches } from '@/db/schema';
import { like, or, and, desc, sql, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const query = searchParams.get('q') || '';
        const category = searchParams.get('category'); // 'teams', 'players', 'matches', 'competitions', 'all'
        const sport = searchParams.get('sport');
        const limit = parseInt(searchParams.get('limit') || '20');

        if (!query || query.length < 2) {
            return NextResponse.json({
                results: {
                    teams: [],
                    players: [],
                    matches: [],
                },
                total: 0,
                query,
            });
        }

        const searchPattern = `%${query.toLowerCase()}%`;
        const results: any = {
            teams: [],
            players: [],
            matches: [],
        };

        // Search Teams
        if (!category || category === 'all' || category === 'teams') {
            const teamFilters = [
                like(teams.name, searchPattern),
                like(teams.shortName, searchPattern),
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

        // Search Players
        if (!category || category === 'all' || category === 'players') {
            let queryBuilder = db
                .select({
                    player: players,
                    team: teams,
                })
                .from(players)
                .leftJoin(teams, eq(players.teamId, teams.id));

            const whereConditions = [like(players.name, searchPattern)];
            if (sport) {
                whereConditions.push(eq(teams.sport, sport));
            }

            const playerResults = await queryBuilder
                .where(and(...whereConditions))
                .limit(limit);

            results.players = playerResults.map(r => ({
                ...r.player,
                team: r.team,
            }));
        }

        // Search Matches (by team names or competition)
        if (!category || category === 'all' || category === 'matches') {
            const matchFilters = or(
                like(teams.name, searchPattern),
                like(teams.shortName, searchPattern),
                like(matches.competition, searchPattern)
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

            // Get away teams
            const matchesWithTeams = await Promise.all(
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

            results.matches = matchesWithTeams;
        }

        // Calculate total results
        const total =
            results.teams.length +
            results.players.length +
            results.matches.length;

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
