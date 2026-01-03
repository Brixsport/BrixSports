/**
 * Team Detail API
 * GET /api/teams/[id] - Get complete team information
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, players, matches, basketballPlayerStats } from '@/db/schema';
import { eq, or, desc, and, sql, inArray } from 'drizzle-orm';

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const { id } = params;

        // Get team details
        const [team] = await db
            .select()
            .from(teams)
            .where(eq(teams.id, id));

        if (!team) {
            return NextResponse.json(
                { error: 'Team not found' },
                { status: 404 }
            );
        }

        // Get team players
        const teamPlayers = await db
            .select()
            .from(players)
            .where(eq(players.teamId, id))
            .orderBy(desc(players.rating));

        // Get player stats (Basketball)
        let playersWithStats = teamPlayers;
        if (team.sport === 'Basketball' && teamPlayers.length > 0) {
            const playerIds = teamPlayers.map(p => p.id);
            const statsData = await db
                .select()
                .from(basketballPlayerStats)
                .where(inArray(basketballPlayerStats.playerId, playerIds));

            playersWithStats = teamPlayers.map(p => {
                const s = statsData.find(sd => sd.playerId === p.id);
                return { ...p, stats: s || null };
            });
        }

        // Get recent matches (last 10)
        const recentMatches = await db
            .select()
            .from(matches)
            .where(
                or(
                    eq(matches.homeTeamId, id),
                    eq(matches.awayTeamId, id)
                )
            )
            .orderBy(desc(matches.startTime))
            .limit(10);

        // Get upcoming matches (next 10)
        const upcomingMatches = await db
            .select()
            .from(matches)
            .where(
                and(
                    or(
                        eq(matches.homeTeamId, id),
                        eq(matches.awayTeamId, id)
                    ),
                    eq(matches.status, 'UPCOMING')
                )
            )
            .orderBy(matches.startTime)
            .limit(10);

        // Fetch opponent details for matches
        const enrichMatches = async (matchList: any[]) => {
            return Promise.all(
                matchList.map(async (match) => {
                    const isHome = match.homeTeamId === id;
                    const opponentId = isHome ? match.awayTeamId : match.homeTeamId;

                    const [opponent] = await db
                        .select()
                        .from(teams)
                        .where(eq(teams.id, opponentId));

                    return {
                        ...match,
                        isHome,
                        opponent,
                    };
                })
            );
        };

        const enrichedRecent = await enrichMatches(recentMatches);
        const enrichedUpcoming = await enrichMatches(upcomingMatches);

        // Calculate team statistics
        // Calculate team statistics (Use DB stats if available, otherwise calculate from fetched matches)
        const finishedMatches = enrichedRecent.filter(m => m.status === 'FINISHED');

        const useStoredStats = team.played && team.played > 0;

        const stats = {
            played: useStoredStats ? (team.played ?? 0) : finishedMatches.length,
            won: useStoredStats ? (team.won ?? 0) : finishedMatches.filter(m => {
                if (m.isHome) return m.homeScore > m.awayScore;
                return m.awayScore > m.homeScore;
            }).length,
            drawn: useStoredStats ? (team.drawn ?? 0) : finishedMatches.filter(m => m.homeScore === m.awayScore).length,
            lost: useStoredStats ? (team.lost ?? 0) : finishedMatches.filter(m => {
                if (m.isHome) return m.homeScore < m.awayScore;
                return m.awayScore < m.homeScore;
            }).length,
            goalsFor: useStoredStats ? (team.goalsFor ?? 0) : finishedMatches.reduce((sum, m) => {
                return sum + (m.isHome ? m.homeScore : m.awayScore);
            }, 0),
            goalsAgainst: useStoredStats ? (team.goalsAgainst ?? 0) : finishedMatches.reduce((sum, m) => {
                return sum + (m.isHome ? m.awayScore : m.homeScore);
            }, 0),
            goalDifference: 0,
            points: useStoredStats ? (team.points ?? 0) : 0 // Add points
        };

        if (!useStoredStats) {
            // Basic points calculation if not stored
            stats.points = (stats.won * (team.sport === 'Basketball' ? 2 : 3)) + (stats.drawn * 1);
        }

        stats.goalDifference = stats.goalsFor - stats.goalsAgainst;

        // Get form (last 5 matches)
        const form = finishedMatches.slice(0, 5).map(m => {
            if (m.isHome) {
                if (m.homeScore > m.awayScore) return 'W';
                if (m.homeScore < m.awayScore) return 'L';
                return 'D';
            } else {
                if (m.awayScore > m.homeScore) return 'W';
                if (m.awayScore < m.homeScore) return 'L';
                return 'D';
            }
        });

        // Get unique competitions
        const competitions = [...new Set(recentMatches.map(m => m.competition).filter(Boolean))];

        return NextResponse.json({
            team,
            players: playersWithStats,
            recentMatches: enrichedRecent,
            upcomingMatches: enrichedUpcoming,
            stats,
            form,
            competitions,
        });
    } catch (error) {
        console.error('Error fetching team details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch team details' },
            { status: 500 }
        );
    }
}
