import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bracketNodes, teams, matches } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// GET /api/brackets - Get bracket structure for a competition
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const competition = searchParams.get('competition');
        const sport = searchParams.get('sport');

        if (!competition) {
            return NextResponse.json(
                { error: 'Competition parameter is required' },
                { status: 400 }
            );
        }

        // Build query conditions
        const conditions = [eq(bracketNodes.competition, competition)];
        if (sport) {
            conditions.push(eq(bracketNodes.sport, sport));
        }

        // Get all bracket nodes for the competition
        const nodes = await db
            .select()
            .from(bracketNodes)
            .where(and(...conditions));

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

        // Sort rounds by typical tournament order
        const roundOrder = ['FINAL', 'SEMI_FINAL', 'QUARTER_FINAL', 'ROUND_16', 'ROUND_32'];
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
        const body = await request.json();
        const { competition, sport, rounds } = body;

        if (!competition || !sport || !rounds || !Array.isArray(rounds)) {
            return NextResponse.json(
                { error: 'Competition, sport, and rounds array are required' },
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
                    competition,
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
