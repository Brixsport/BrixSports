import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bracketNodes, teams, matches } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';

// GET /api/brackets - Get bracket structure for a competition
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const competitionId = searchParams.get('competitionId');
        const competition = searchParams.get('competition');
        const sport = searchParams.get('sport');

        if (!competitionId && !competition) {
            return NextResponse.json(
                { error: 'Competition or Competition ID parameter is required' },
                { status: 400 }
            );
        }

        // Build query conditions
        const conditions = [];

        if (competitionId) {
            // competitionId is authoritative when present -- do NOT OR it with a
            // name fallback. Two different competitions can legitimately share
            // an exact name (e.g. two seasons both literally named "BUSA LEAGUE
            // FOOTBALL"), and OR'ing in a name match even when a real id is
            // already known silently pulls in the other competition's bracket
            // nodes too the moment that name collision exists (confirmed live
            // via the sibling standings route, session 2026-09-05, once
            // BACKLOG-291's grouping fix made two same-named seasons reachable
            // side by side for the first time).
            conditions.push(eq(bracketNodes.competitionId, competitionId));
        } else if (competition) {
            // No id available -- fall back to name matching for legacy/name-only
            // callers, only as a last resort, never alongside a real competitionId.
            // Brackets are often seeded without competitionId, and competition
            // casing may differ, so this stays case-insensitive.
            conditions.push(sql`lower(${bracketNodes.competition}) = ${competition.toLowerCase()}`);
        }

        if (sport) {
            conditions.push(eq(bracketNodes.sport, sport));
        }

        // Get all bracket nodes for the competition
        const nodes = await db
            .select()
            .from(bracketNodes)
            .where(and(...conditions))
            .limit(200);

        // Group nodes by round
        const rounds = nodes.reduce((acc, node) => {
            // Skip nodes without a round
            if (!node.round) return acc;

            if (!acc[node.round]) {
                acc[node.round] = [];
            }
            acc[node.round].push(node);
            return acc;
        }, {} as Record<string, typeof nodes>);

        // Enrich each node with team and match details
        const enrichedRounds = await Promise.all(
            Object.entries(rounds).map(async ([round, roundNodes]) => {
                const enrichedNodes = await Promise.all(
                    roundNodes.map(async (node) => {
                        // Get team details
                        const homeTeam = node.homeTeamId
                            ? await db.select().from(teams).where(eq(teams.id, node.homeTeamId)).get()
                            : null;
                        const awayTeam = node.awayTeamId
                            ? await db.select().from(teams).where(eq(teams.id, node.awayTeamId)).get()
                            : null;

                        // Get match details if exists
                        const match = node.matchId
                            ? await db.select().from(matches).where(eq(matches.id, node.matchId)).get()
                            : null;

                        return {
                            ...node,
                            homeTeam: homeTeam ? {
                                id: homeTeam.id,
                                name: homeTeam.name,
                                logo: homeTeam.logo,
                                color: homeTeam.color,
                            } : null,
                            awayTeam: awayTeam ? {
                                id: awayTeam.id,
                                name: awayTeam.name,
                                logo: awayTeam.logo,
                                color: awayTeam.color,
                            } : null,
                            match: match ? {
                                id: match.id,
                                status: match.status,
                                startTime: match.startTime,
                            } : null,
                        };
                    })
                );

                return {
                    round,
                    matches: enrichedNodes,
                };
            })
        );

        // Sort rounds by typical tournament order. THIRD_PLACE was previously
        // omitted -- indexOf returned -1, sorting it before FINAL (BACKLOG-276).
        const roundOrder = ['FINAL', 'THIRD_PLACE', 'SEMI_FINAL', 'QUARTER_FINAL', 'ROUND_16', 'ROUND_32'];
        enrichedRounds.sort((a, b) => {
            const aIndex = roundOrder.indexOf(a.round);
            const bIndex = roundOrder.indexOf(b.round);
            return aIndex - bIndex;
        });

        return NextResponse.json({
            competition,
            sport,
            rounds: enrichedRounds,
            totalMatches: nodes.length,
        });
    } catch (error) {
        console.error('Error fetching brackets:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bracket structure' },
            { status: 500 }
        );
    }
}

// POST /api/brackets - Create bracket structure
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
        const { competition, competitionId, sport, rounds } = body;

        if ((!competition && !competitionId) || !sport || !rounds || !Array.isArray(rounds)) {
            return NextResponse.json(
                { error: 'Competition (or CompetitionId), sport, and rounds array are required' },
                { status: 400 }
            );
        }

        const createdNodes = [];

        // Create bracket nodes for each round
        for (const round of rounds) {
            const { roundName, matches } = round;

            for (const match of matches) {
                const nodeId = nanoid();
                const newNode = {
                    id: nodeId,
                    competition: competition || '',
                    competitionId: competitionId || null,
                    sport,
                    title: match.title || `${roundName} Match`,
                    matchId: match.matchId || null,
                    nextMatchId: match.nextMatchId || null,
                    homeTeamId: match.homeTeamId || null,
                    awayTeamId: match.awayTeamId || null,
                    homeScore: match.homeScore || null,
                    awayScore: match.awayScore || null,
                    status: match.status || 'PENDING',
                    round: roundName,
                    position: match.position || 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                await db.insert(bracketNodes).values(newNode);
                createdNodes.push(newNode);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Bracket structure created successfully',
            nodes: createdNodes,
            total: createdNodes.length,
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating bracket:', error);
        return NextResponse.json(
            { error: 'Failed to create bracket structure' },
            { status: 500 }
        );
    }
}
