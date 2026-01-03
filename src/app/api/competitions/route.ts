/**
 * Competitions API - GET all competitions & POST new competition
 * GET /api/competitions
 * POST /api/competitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { competitions, matches, standings } from '@/db/schema';
import { sql, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Query parameters
        const sport = searchParams.get('sport'); // Filter by sport
        const includeStats = searchParams.get('includeStats') === 'true';

        // Get competitions from database
        let query = db.select().from(competitions);

        const allCompetitions = await query;

        // Filter by sport if provided
        let filteredCompetitions = allCompetitions;
        if (sport) {
            filteredCompetitions = filteredCompetitions.filter(c => c.sport === sport);
        }

        // If includeStats, fetch additional data
        if (includeStats) {
            const competitionsWithStats = await Promise.all(
                filteredCompetitions.map(async (comp) => {
                    // Get match count
                    const matchCount = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(matches)
                        .where(eq(matches.competition, comp.name));

                    // Get unique teams count
                    const allMatches = await db
                        .select({
                            homeTeamId: matches.homeTeamId,
                            awayTeamId: matches.awayTeamId,
                        })
                        .from(matches)
                        .where(eq(matches.competition, comp.name));

                    const teamIds = new Set<string>();
                    allMatches.forEach(m => {
                        teamIds.add(m.homeTeamId);
                        teamIds.add(m.awayTeamId);
                    });

                    // Get standings count
                    const standingsCount = await db
                        .select({ count: sql<number>`count(*)` })
                        .from(standings)
                        .where(eq(standings.competition, comp.name));

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
                competitions: competitionsWithStats,
                total: competitionsWithStats.length,
            });
        }

        return NextResponse.json({
            competitions: filteredCompetitions,
            total: filteredCompetitions.length,
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
        const body = await request.json();
        const {
            name, sport, format, season, status,
            numberOfTeams, numberOfGroups, teamsPerGroup,
            level, scope, rules, description
        } = body;

        if (!name || !sport || !format || !season) {
            return NextResponse.json(
                { error: 'Missing required fields: name, sport, format, season' },
                { status: 400 }
            );
        }

        const newCompetition = {
            id: nanoid(),
            name,
            sport,
            format,
            season,
            status: status || 'upcoming',
            numberOfTeams: numberOfTeams || 0,
            numberOfGroups: numberOfGroups || 0,
            teamsPerGroup: teamsPerGroup || 0,
            level: level || null,
            scope: scope || 'internal',
            rules: rules ? JSON.stringify(rules) : null,
            description: description || null,
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
