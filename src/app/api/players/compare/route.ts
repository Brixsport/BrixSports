/**
 * Player Comparison API
 * Compare statistics between two players
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players, playerStats, footballPlayerStats, basketballPlayerStats, teams } from '@/db/schema';
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

        // Helper to fetch stats based on sport
        const getStats = async (playerId: string, team: any) => {
            const sport = team?.sport || 'Football';

            if (sport === 'Basketball') {
                let query = db
                    .select()
                    .from(basketballPlayerStats)
                    .where(eq(basketballPlayerStats.playerId, playerId));

                const [stats] = await query;
                if (!stats) return {};

                // Map to frontend keys
                return {
                    appearances: stats.gamesPlayed || 0,
                    minutesPlayed: stats.minutesPlayed || 0,
                    totalPoints: stats.totalPoints || 0,
                    totalAssists: stats.assists || 0, // Map assists to totalAssists
                    rebounds: stats.totalRebounds || 0, // Map totalRebounds to rebounds
                    steals: stats.steals || 0,
                    blocks: stats.blocks || 0,
                    rating: player1.rating // Pass rating if needed, though usually on player object
                };
            } else {
                // Football (default)
                let query = db
                    .select()
                    .from(footballPlayerStats)
                    .where(eq(footballPlayerStats.playerId, playerId));

                // If specific competition filtering is needed, it would be added here
                // Note: current schema for footballPlayerStats doesn't strictly link to competition in the same way generic playerStats did, 
                // but usually we want total season stats.

                const [stats] = await query;
                if (!stats) return {};

                return {
                    ...stats,
                    // Ensure keys match what FootballComparison expects
                    goals: stats.goals || 0,
                    assists: stats.assists || 0,
                    appearances: stats.appearances || 0,
                    minutesPlayed: stats.minutesPlayed || 0,
                    yellowCards: stats.yellowCards || 0,
                    redCards: stats.redCards || 0,
                };
            }
        };

        const stats1 = await getStats(player1Id, team1);
        const stats2 = await getStats(player2Id, team2);

        // Determine comparison summary based on primary sport
        const primarySport = team1?.sport || 'Football';
        let summary: any = {};

        // Cast to any to avoid TS union type errors since we know the sport matches the stats structure
        const s1 = stats1 as any;
        const s2 = stats2 as any;

        if (primarySport === 'Basketball') {
            summary = {
                betterScorer: (s1.totalPoints || 0) > (s2.totalPoints || 0) ? player1.name : player2.name,
                betterPlaymaker: (s1.totalAssists || 0) > (s2.totalAssists || 0) ? player1.name : player2.name,
                betterRebounder: (s1.rebounds || 0) > (s2.rebounds || 0) ? player1.name : player2.name,
                higherRated: (player1.rating || 0) > (player2.rating || 0) ? player1.name : player2.name,
            };
        } else {
            summary = {
                betterGoalScorer: (s1.goals || 0) > (s2.goals || 0) ? player1.name : player2.name,
                betterPlaymaker: (s1.assists || 0) > (s2.assists || 0) ? player1.name : player2.name,
                moreExperienced: (s1.appearances || 0) > (s2.appearances || 0) ? player1.name : player2.name,
                higherRated: (player1.rating || 0) > (player2.rating || 0) ? player1.name : player2.name,
            };
        }

        // Construct response
        const comparison = {
            player1: {
                ...player1,
                team: team1,
                stats: stats1,
            },
            player2: {
                ...player2,
                team: team2,
                stats: stats2,
            },
            summary,
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
