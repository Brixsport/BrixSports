/**
 * Competitions API - GET all competitions & POST new competition
 * GET /api/competitions
 * POST /api/competitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { competitions, matches, standings } from '@/db/schema';
import { sql, eq, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

// Groups season-instances of the same recurring league together (e.g. "BUSA LEAGUE
// FOOTBALL" 2025/2026 and 2026/2027 as one entity with a season history), rather
// than every season being a fully disconnected competition row. Case-insensitive
// name match, scoped by sport + hostOrganizationId so two different universities'
// leagues that happen to share a display name (or differ only in casing) never
// merge -- see BACKLOG.md's standings/comp-stats audit for the full context this
// came out of.
function getCompetitionGroupKey(comp: { sport: string | null; name: string; hostOrganizationId: string | null }): string {
    return `${comp.sport ?? 'multi'}::${comp.name.trim().toLowerCase()}::${comp.hostOrganizationId ?? 'none'}`;
}

// "Most recent season" is ordered by startDate/createdAt (real timestamps) rather
// than the free-text `season` string ("2024" vs "2025/2026" vs "2026/2027" don't
// all sort correctly the same way) -- same reasoning as the player-stats season
// fallback fix elsewhere this session.
function buildCompetitionGroups(comps: any[]) {
    const groups = new Map<string, any[]>();
    for (const c of comps) {
        const key = getCompetitionGroupKey(c);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(c);
    }

    return Array.from(groups.entries()).map(([groupKey, seasons]) => {
        const sorted = [...seasons].sort((a, b) => {
            const aTime = a.startDate ? new Date(a.startDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const bTime = b.startDate ? new Date(b.startDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return bTime - aTime;
        });
        return {
            groupKey,
            name: sorted[0].name,
            sport: sorted[0].sport,
            latest: sorted[0],
            seasons: sorted,
        };
    });
}

export async function GET(request: NextRequest) {
    try {
        const rl = checkRateLimit(request);
        if (rl.limited) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again shortly.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
            );
        }

        const { searchParams } = new URL(request.url);

        // Query parameters
        const sport = searchParams.get('sport'); // Filter by sport
        const season = searchParams.get('season'); // Filter by season (BACKLOG-229)
        const includeStats = searchParams.get('includeStats') === 'true';
        // BACKLOG-283: same clamp pattern as /api/matches (BACKLOG-276) --
        // response body/shape stays the same (`competitions`/`total`/`groups`),
        // `total` reflects the full filtered count, `competitions` is now the
        // requested page of it.
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50), 200);
        const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

        // Get competitions from database
        let query = db.select().from(competitions);

        const allCompetitions = await query.limit(500);

        // Filter by sport if provided
        let filteredCompetitions = allCompetitions;
        if (sport) {
            filteredCompetitions = filteredCompetitions.filter(c =>
                c.isMultiSport || c.sport === sport
            );
        }
        // Built from the sport-filtered set BEFORE the season filter narrows
        // `filteredCompetitions` below, so a season-scoped response still tells
        // the caller what other seasons of the same competition exist (BACKLOG-229)
        // -- needed for a season-picker UI even when the main list is filtered.
        const allSeasonsGroups = buildCompetitionGroups(filteredCompetitions);
        if (season) {
            filteredCompetitions = filteredCompetitions.filter(c => c.season === season);
        }

        const totalFiltered = filteredCompetitions.length;

        // If includeStats, fetch additional data
        if (includeStats) {
            const competitionsWithStats = await Promise.all(
                filteredCompetitions.map(async (comp) => {
                    // Get match count - prioritize ID, fallback to name for safety during transition
                    const matchCount = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(matches)
                        .where(
                            comp.id ? or(eq(matches.competitionId, comp.id), eq(matches.competition, comp.name))
                                : eq(matches.competition, comp.name)
                        );

                    // Get unique teams count
                    const allMatches = await db
                        .select({
                            homeTeamId: matches.homeTeamId,
                            awayTeamId: matches.awayTeamId,
                        })
                        .from(matches)
                        .where(
                            comp.id ? or(eq(matches.competitionId, comp.id), eq(matches.competition, comp.name))
                                : eq(matches.competition, comp.name)
                        );

                    const teamIds = new Set<string>();
                    allMatches.forEach(m => {
                        teamIds.add(m.homeTeamId);
                        teamIds.add(m.awayTeamId);
                    });

                    // Get standings count
                    const standingsCount = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(standings)
                        .where(
                            comp.id ? or(eq(standings.competitionId, comp.id), eq(standings.competition, comp.name))
                                : eq(standings.competition, comp.name)
                        );

                    return {
                        ...comp,
                        stats: {
                            matchesCount: matchCount[0]?.count || 0,
                            teamsCount: teamIds.size,
                            standingsCount: standingsCount[0]?.count || 0,
                        },
                    };
                })
            );

            return NextResponse.json({
                competitions: competitionsWithStats.slice(offset, offset + limit),
                total: totalFiltered,
                groups: buildCompetitionGroups(competitionsWithStats),
            }, {
                headers: {
                    'X-Total-Count': String(totalFiltered),
                    'X-Limit': String(limit),
                    'X-Offset': String(offset),
                },
            });
        }

        return NextResponse.json({
            competitions: filteredCompetitions.slice(offset, offset + limit),
            total: totalFiltered,
            groups: allSeasonsGroups,
        }, {
            headers: {
                'X-Total-Count': String(totalFiltered),
                'X-Limit': String(limit),
                'X-Offset': String(offset),
            },
        });
    } catch (error) {
        console.error('Error fetching competitions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch competitions' },
            { status: 500 }
        );
    }
}

/**
 * POST - Create a new competition
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const {
            name, sport, format, structure, season, status,
            numberOfTeams, numberOfGroups, teamsPerGroup,
            level, scope, rules, description, isMultiSport, logo
        } = body;

        if (!name || (!sport && !isMultiSport) || !format || !season) {
            return NextResponse.json(
                { error: 'Missing required fields: name, sport (required for single-sport), format, season' },
                { status: 400 }
            );
        }

        const newCompetition = {
            id: nanoid(),
            name,
            sport: sport || null,
            isMultiSport: !!isMultiSport,
            format,
            structure: structure || null,
            season,
            status: status || 'upcoming',
            numberOfTeams: numberOfTeams || 0,
            numberOfGroups: numberOfGroups || 0,
            teamsPerGroup: teamsPerGroup || 0,
            level: level || null,
            scope: scope || 'internal',
            rules: rules ? JSON.stringify(rules) : null,
            description: description || null,
            logo: logo || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const inserted = await db.insert(competitions).values(newCompetition).returning();

        return NextResponse.json(inserted[0], { status: 201 });
    } catch (error) {
        console.error('Error creating competition:', error);
        return NextResponse.json(
            { error: 'Failed to create competition' },
            { status: 500 }
        );
    }
}
