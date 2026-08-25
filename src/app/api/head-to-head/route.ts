/**
 * Head-to-Head Records API
 * Get historical matchup data between two teams
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { headToHead, teams, matches } from '@/db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

/**
 * GET head-to-head record
 * GET /api/head-to-head?team1=xxx&team2=yyy&competition=zzz
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const team1Id = searchParams.get('team1');
        const team2Id = searchParams.get('team2');
        const competition = searchParams.get('competition');

        if (!team1Id || !team2Id) {
            return NextResponse.json(
                { error: 'Both team IDs are required' },
                { status: 400 }
            );
        }

        // Get head-to-head record
        const h2hConditions = or(
            and(
                eq(headToHead.team1Id, team1Id),
                eq(headToHead.team2Id, team2Id),
                competition ? eq(headToHead.competition, competition) : undefined
            ),
            and(
                eq(headToHead.team1Id, team2Id),
                eq(headToHead.team2Id, team1Id),
                competition ? eq(headToHead.competition, competition) : undefined
            )
        );

        const [h2h] = await db
            .select()
            .from(headToHead)
            .where(h2hConditions);

        // Get team details
        const [team1] = await db.select().from(teams).where(eq(teams.id, team1Id));
        const [team2] = await db.select().from(teams).where(eq(teams.id, team2Id));

        // Get recent matches between teams
        const recentMatches = await db
            .select()
            .from(matches)
            .where(
                and(
                    or(
                        and(
                            eq(matches.homeTeamId, team1Id),
                            eq(matches.awayTeamId, team2Id)
                        ),
                        and(
                            eq(matches.homeTeamId, team2Id),
                            eq(matches.awayTeamId, team1Id)
                        )
                    ),
                    eq(matches.status, 'FINISHED')
                )
            )
            .orderBy(desc(matches.startTime))
            .limit(5);

        // Calculate stats if no H2H record exists. Two teams that have never
        // played a FINISHED match against each other is a normal, common case
        // (not an edge case) -- must still return a valid zeroed object, never
        // undefined, since the consumer (HeadToHeadComparison) divides by
        // totalMatches unconditionally.
        let stats = h2h;
        if (!h2h) {
            stats = recentMatches.length > 0
                ? calculateH2HStats(team1Id, team2Id, recentMatches)
                : {
                    id: `h2h-empty-${team1Id}-${team2Id}`,
                    team1Id,
                    team2Id,
                    competition: null,
                    competitionId: null,
                    totalMatches: 0,
                    team1Wins: 0,
                    team2Wins: 0,
                    draws: 0,
                    team1GoalsFor: 0,
                    team2GoalsFor: 0,
                    lastMatchId: null,
                    updatedAt: null,
                };
        }

        return NextResponse.json({
            team1,
            team2,
            headToHead: stats,
            recentMatches,
        });
    } catch (error) {
        console.error('Error fetching head-to-head:', error);
        return NextResponse.json(
            { error: 'Failed to fetch head-to-head record' },
            { status: 500 }
        );
    }
}

/**
 * UPDATE head-to-head record after a match
 * POST /api/head-to-head
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
        const { matchId, team1Id, team2Id, team1Score, team2Score, competition } = body;

        if (!team1Id || !team2Id || team1Score === undefined || team2Score === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Check if H2H record exists
        const [existing] = await db
            .select()
            .from(headToHead)
            .where(
                or(
                    and(
                        eq(headToHead.team1Id, team1Id),
                        eq(headToHead.team2Id, team2Id)
                    ),
                    and(
                        eq(headToHead.team1Id, team2Id),
                        eq(headToHead.team2Id, team1Id)
                    )
                )
            );

        const result = team1Score > team2Score ? 'team1' : team1Score < team2Score ? 'team2' : 'draw';

        if (existing) {
            // Determine if teams are in correct order
            const isCorrectOrder = existing.team1Id === team1Id;

            const updates: any = {
                totalMatches: (existing.totalMatches ?? 0) + 1,
                lastMatchId: matchId,
                updatedAt: new Date(),
            };

            if (isCorrectOrder) {
                updates.team1GoalsFor = (existing.team1GoalsFor ?? 0) + team1Score;
                updates.team2GoalsFor = (existing.team2GoalsFor ?? 0) + team2Score;
                if (result === 'team1') updates.team1Wins = (existing.team1Wins ?? 0) + 1;
                else if (result === 'team2') updates.team2Wins = (existing.team2Wins ?? 0) + 1;
                else updates.draws = (existing.draws ?? 0) + 1;
            } else {
                updates.team1GoalsFor = (existing.team1GoalsFor ?? 0) + team2Score;
                updates.team2GoalsFor = (existing.team2GoalsFor ?? 0) + team1Score;
                if (result === 'team2') updates.team1Wins = (existing.team1Wins ?? 0) + 1;
                else if (result === 'team1') updates.team2Wins = (existing.team2Wins ?? 0) + 1;
                else updates.draws = (existing.draws ?? 0) + 1;
            }

            await db
                .update(headToHead)
                .set(updates)
                .where(eq(headToHead.id, existing.id));

            return NextResponse.json({
                success: true,
                message: 'Head-to-head record updated',
            });
        } else {
            // Create new H2H record
            const h2hId = `h2h-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            await db.insert(headToHead).values({
                id: h2hId,
                team1Id,
                team2Id,
                competition: competition || null,
                totalMatches: 1,
                team1Wins: result === 'team1' ? 1 : 0,
                team2Wins: result === 'team2' ? 1 : 0,
                draws: result === 'draw' ? 1 : 0,
                team1GoalsFor: team1Score,
                team2GoalsFor: team2Score,
                lastMatchId: matchId,
            });

            return NextResponse.json(
                {
                    success: true,
                    h2hId,
                    message: 'Head-to-head record created',
                },
                { status: 201 }
            );
        }
    } catch (error) {
        console.error('Error updating head-to-head:', error);
        return NextResponse.json(
            { error: 'Failed to update head-to-head record' },
            { status: 500 }
        );
    }
}

// Helper function to calculate H2H stats from matches
function calculateH2HStats(team1Id: string, team2Id: string, matches: any[]) {
    let team1Wins = 0;
    let team2Wins = 0;
    let draws = 0;
    let team1GoalsFor = 0;
    let team2GoalsFor = 0;

    matches.forEach((match) => {
        const isTeam1Home = match.homeTeamId === team1Id;
        const team1Score = isTeam1Home ? match.homeScore : match.awayScore;
        const team2Score = isTeam1Home ? match.awayScore : match.homeScore;

        team1GoalsFor += team1Score;
        team2GoalsFor += team2Score;

        if (team1Score > team2Score) team1Wins++;
        else if (team2Score > team1Score) team2Wins++;
        else draws++;
    });

    return {
        id: `h2h-calc-${Date.now()}`,
        team1Id,
        team2Id,
        competition: null,
        competitionId: null,
        totalMatches: matches.length,
        team1Wins,
        team2Wins,
        draws,
        team1GoalsFor,
        team2GoalsFor,
        lastMatchId: matches.length > 0 ? matches[0].id : null,
        updatedAt: new Date(),
    };
}
