/**
 * Player Comparison API
 * Compare statistics between two players
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players, playerStats, teams } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET player comparison
 * GET /api/players/compare?player1=xxx&player2=yyy&competition=zzz
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const player1Id = searchParams.get('player1');
        const player2Id = searchParams.get('player2');
        const competition = searchParams.get('competition');

        if (!player1Id || !player2Id) {
            return NextResponse.json(
                { error: 'Both player IDs are required' },
                { status: 400 }
            );
        }

        // Get player details
        const [player1] = await db
            .select()
            .from(players)
            .where(eq(players.id, player1Id));

        const [player2] = await db
            .select()
            .from(players)
            .where(eq(players.id, player2Id));

        if (!player1 || !player2) {
            return NextResponse.json(
                { error: 'One or both players not found' },
                { status: 404 }
            );
        }

        // Get team details
        const [team1] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, player1.teamId));

        const [team2] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, player2.teamId));

        // Get player statistics
        let stats1Query = db
            .select()
            .from(playerStats);

        let stats2Query = db
            .select()
            .from(playerStats);

        if (competition) {
            stats1Query = stats1Query.where(
                and(
                    eq(playerStats.playerId, player1Id),
                    eq(playerStats.competition, competition)
                )
            ) as any;
            stats2Query = stats2Query.where(
                and(
                    eq(playerStats.playerId, player2Id),
                    eq(playerStats.competition, competition)
                )
            ) as any;
        } else {
            stats1Query = stats1Query.where(eq(playerStats.playerId, player1Id)) as any;
            stats2Query = stats2Query.where(eq(playerStats.playerId, player2Id)) as any;
        }

        const [stats1] = await stats1Query;
        const [stats2] = await stats2Query;

        // Calculate comparison metrics
        const comparison = {
            player1: {
                ...player1,
                team: team1,
                stats: stats1 || {
                    goals: 0,
                    assists: 0,
                    appearances: 0,
                    minutesPlayed: 0,
                    yellowCards: 0,
                    redCards: 0,
                    averageRating: player1.rating || 7.0,
                },
            },
            player2: {
                ...player2,
                team: team2,
                stats: stats2 || {
                    goals: 0,
                    assists: 0,
                    appearances: 0,
                    minutesPlayed: 0,
                    yellowCards: 0,
                    redCards: 0,
                    averageRating: player2.rating || 7.0,
                },
            },
            summary: {
                betterGoalScorer: (stats1?.goals || 0) > (stats2?.goals || 0) ? player1.name : player2.name,
                betterPlaymaker: (stats1?.assists || 0) > (stats2?.assists || 0) ? player1.name : player2.name,
                moreExperienced: (stats1?.appearances || 0) > (stats2?.appearances || 0) ? player1.name : player2.name,
                higherRated: (player1.rating || 0) > (player2.rating || 0) ? player1.name : player2.name,
            },
        };

        return NextResponse.json(comparison);
    } catch (error) {
        console.error('Error comparing players:', error);
        return NextResponse.json(
            { error: 'Failed to compare players' },
            { status: 500 }
        );
    }
}
