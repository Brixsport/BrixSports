/**
 * Player Comparison API
 * Compare statistics between two players
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players, footballPlayerStats, basketballPlayerStats } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { enrichPlayersWithAffiliations } from '@/lib/player-data';
import { getPlayerRatingSummaries } from '@/lib/playerRatingSummary';

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
        const season = searchParams.get('season'); // BACKLOG-229

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

        const enrichedPlayers = await enrichPlayersWithAffiliations([player1, player2]);
        const enrichedPlayersById = new Map(enrichedPlayers.map((player) => [player.id, player]));
        const team1 = enrichedPlayersById.get(player1.id)?.team ?? null;
        const team2 = enrichedPlayersById.get(player2.id)?.team ?? null;

        // BACKLOG-221: no guard previously stopped a football player being compared
        // against a basketball player -- getStats() derives each sport independently,
        // so a cross-sport comparison silently produced meaningless zero-filled fields
        // for one side instead of erroring. Default to 'Football' matches getStats()'s
        // own fallback below, so a player with no team/sport data doesn't spuriously
        // block a same-sport comparison.
        const sport1 = team1?.sport || 'Football';
        const sport2 = team2?.sport || 'Football';
        if (sport1 !== sport2) {
            return NextResponse.json(
                { error: `Cannot compare players from different sports (${sport1} vs ${sport2})` },
                { status: 400 }
            );
        }

        // Helper to fetch stats based on sport
        const getStats = async (playerId: string, team: any) => {
            const sport = team?.sport || 'Football';

            if (sport === 'Basketball') {
                const conditions = [eq(basketballPlayerStats.playerId, playerId)];
                if (competition) {
                    conditions.push(eq(basketballPlayerStats.competition, competition));
                }
                if (season) {
                    conditions.push(eq(basketballPlayerStats.season, season));
                }

                const statsRows = await db
                    .select()
                    .from(basketballPlayerStats)
                    .where(and(...conditions));

                if (statsRows.length === 0) return {};

                const totals = statsRows.reduce((acc, stats) => ({
                    gamesPlayed: acc.gamesPlayed + (stats.gamesPlayed || 0),
                    minutesPlayed: acc.minutesPlayed + (stats.minutesPlayed || 0),
                    totalPoints: acc.totalPoints + (stats.totalPoints || 0),
                    assists: acc.assists + (stats.assists || 0),
                    totalRebounds: acc.totalRebounds + (stats.totalRebounds || 0),
                    steals: acc.steals + (stats.steals || 0),
                    blocks: acc.blocks + (stats.blocks || 0),
                }), {
                    gamesPlayed: 0,
                    minutesPlayed: 0,
                    totalPoints: 0,
                    assists: 0,
                    totalRebounds: 0,
                    steals: 0,
                    blocks: 0,
                });

                // Map to frontend keys
                return {
                    appearances: totals.gamesPlayed,
                    minutesPlayed: totals.minutesPlayed,
                    totalPoints: totals.totalPoints,
                    totalAssists: totals.assists,
                    rebounds: totals.totalRebounds,
                    steals: totals.steals,
                    blocks: totals.blocks,
                };
            } else {
                const conditions = [eq(footballPlayerStats.playerId, playerId)];
                if (competition) {
                    conditions.push(eq(footballPlayerStats.competition, competition));
                }
                if (season) {
                    conditions.push(eq(footballPlayerStats.season, season));
                }

                const statsRows = await db
                    .select()
                    .from(footballPlayerStats)
                    .where(and(...conditions));

                if (statsRows.length === 0) return {};

                const totals = statsRows.reduce((acc, stats) => ({
                    appearances: acc.appearances + (stats.appearances || 0),
                    starts: acc.starts + (stats.starts || 0),
                    minutesPlayed: acc.minutesPlayed + (stats.minutesPlayed || 0),
                    goals: acc.goals + (stats.goals || 0),
                    assists: acc.assists + (stats.assists || 0),
                    shotsOnTarget: acc.shotsOnTarget + (stats.shotsOnTarget || 0),
                    shotsOffTarget: acc.shotsOffTarget + (stats.shotsOffTarget || 0),
                    passesCompleted: acc.passesCompleted + (stats.passesCompleted || 0),
                    passesAttempted: acc.passesAttempted + (stats.passesAttempted || 0),
                    keyPasses: acc.keyPasses + (stats.keyPasses || 0),
                    tackles: acc.tackles + (stats.tackles || 0),
                    interceptions: acc.interceptions + (stats.interceptions || 0),
                    clearances: acc.clearances + (stats.clearances || 0),
                    yellowCards: acc.yellowCards + (stats.yellowCards || 0),
                    redCards: acc.redCards + (stats.redCards || 0),
                    foulsCommitted: acc.foulsCommitted + (stats.foulsCommitted || 0),
                    foulsDrawn: acc.foulsDrawn + (stats.foulsDrawn || 0),
                    saves: acc.saves + (stats.saves || 0),
                    cleanSheets: acc.cleanSheets + (stats.cleanSheets || 0),
                    goalsConceded: acc.goalsConceded + (stats.goalsConceded || 0),
                }), {
                    appearances: 0,
                    starts: 0,
                    minutesPlayed: 0,
                    goals: 0,
                    assists: 0,
                    shotsOnTarget: 0,
                    shotsOffTarget: 0,
                    passesCompleted: 0,
                    passesAttempted: 0,
                    keyPasses: 0,
                    tackles: 0,
                    interceptions: 0,
                    clearances: 0,
                    yellowCards: 0,
                    redCards: 0,
                    foulsCommitted: 0,
                    foulsDrawn: 0,
                    saves: 0,
                    cleanSheets: 0,
                    goalsConceded: 0,
                });

                return {
                    ...totals,
                    goalsPerGame: totals.appearances > 0 ? totals.goals / totals.appearances : 0,
                    assistsPerGame: totals.appearances > 0 ? totals.assists / totals.appearances : 0,
                    passAccuracy: totals.passesAttempted > 0 ? (totals.passesCompleted / totals.passesAttempted) * 100 : 0,
                };
            }
        };

        // BACKLOG-229: distinct seasons either player actually has a stats row
        // for, always unfiltered by the `season` param above -- lets the UI
        // build a season picker even once a filter has narrowed getStats().
        const getAvailableSeasons = async (playerId: string, team: any): Promise<string[]> => {
            const sport = team?.sport || 'Football';
            const table = sport === 'Basketball' ? basketballPlayerStats : footballPlayerStats;
            const rows = await db
                .selectDistinct({ season: table.season })
                .from(table)
                .where(eq(table.playerId, playerId));
            return rows.map((r) => r.season).filter((s): s is string => !!s);
        };

        const [stats1, stats2, seasons1, seasons2] = await Promise.all([
            getStats(player1Id, team1),
            getStats(player2Id, team2),
            getAvailableSeasons(player1Id, team1),
            getAvailableSeasons(player2Id, team2),
        ]);
        const availableSeasons = Array.from(new Set([...seasons1, ...seasons2])).sort();

        // BACKLOG-254: player1.rating/player2.rating below come from the raw
        // `...player1`/`...player2` spread -- players.rating, the frozen legacy
        // column (BACKLOG-253). Override with the real career accessor so
        // PlayerComparison.tsx's "Overall Rating" tile isn't showing the same
        // stale default for every player.
        const ratingSummaries = await getPlayerRatingSummaries([player1Id, player2Id]);
        const rating1 = ratingSummaries.get(player1Id)?.averageRating ?? null;
        const rating2 = ratingSummaries.get(player2Id)?.averageRating ?? null;

        // Determine comparison summary based on primary sport
        const primarySport = team1?.sport || 'Football';
        let summary: any = {};

        // Cast to any to avoid TS union type errors since we know the sport matches the stats structure
        const s1 = stats1 as any;
        const s2 = stats2 as any;

        // BACKLOG-221: "Higher Rated" used to read players.rating, a field that
        // defaults to 7.0 and is never live-updated (.agents/dev/BACKSCOPE.md:287) --
        // dropped rather than shipping a tile that isn't showing real data.
        if (primarySport === 'Basketball') {
            summary = {
                betterScorer: (s1.totalPoints || 0) > (s2.totalPoints || 0) ? player1.name : player2.name,
                betterPlaymaker: (s1.totalAssists || 0) > (s2.totalAssists || 0) ? player1.name : player2.name,
                betterRebounder: (s1.rebounds || 0) > (s2.rebounds || 0) ? player1.name : player2.name,
            };
        } else {
            summary = {
                betterGoalScorer: (s1.goals || 0) > (s2.goals || 0) ? player1.name : player2.name,
                betterPlaymaker: (s1.assists || 0) > (s2.assists || 0) ? player1.name : player2.name,
                moreExperienced: (s1.appearances || 0) > (s2.appearances || 0) ? player1.name : player2.name,
            };
        }

        // Construct response
        const comparison = {
            player1: {
                ...player1,
                rating: rating1,
                team: team1,
                stats: stats1,
            },
            player2: {
                ...player2,
                rating: rating2,
                team: team2,
                stats: stats2,
            },
            summary,
            availableSeasons,
            season: season || null,
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
