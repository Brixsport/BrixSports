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

        // Get team players (directly registered to this team)
        const teamPlayers = await db
            .select()
            .from(players)
            .where(eq(players.teamId, id))
            .orderBy(desc(players.rating));

        // UNIVERSITY POOL — all students eligible to represent this university
        // Football analogy: all Spaniards (university affiliation) who can play for Spain (University Team)
        let universityPlayers: typeof teamPlayers = [];
        if (team.university) {
            universityPlayers = await db
                .select({
                    id: players.id, name: players.name, jerseyName: players.jerseyName,
                    number: players.number, teamId: players.teamId, position: players.position,
                    rating: players.rating, eyePoints: players.eyePoints, age: players.age,
                    height: players.height, weight: players.weight, nationality: players.nationality,
                    college: players.college, department: players.department,
                    university: players.university, image: players.image,
                    marketValue: players.marketValue, profileId: players.profileId,
                    email: players.email, attributes: players.attributes,
                    createdAt: players.createdAt,
                })
                .from(players)
                .leftJoin(teams, eq(players.teamId, teams.id))
                .where(
                    or(
                        eq(players.university, team.university), // Affiliated personally
                        eq(teams.university, team.university)    // Affiliated via club
                    )
                )
                .orderBy(desc(players.rating));

            // Deduplicate by ID
            const seen = new Set<string>();
            universityPlayers = universityPlayers.filter(p => {
                if (seen.has(p.id)) return false;
                seen.add(p.id);
                return true;
            });
        }

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
        // Use stored stats from database if they exist, otherwise calculate from recent matches
        const finishedMatches = enrichedRecent.filter(m => m.status === 'FINISHED');

        // Check if team has stored stats (played field is not null/undefined)
        const useStoredStats = team.played !== null && team.played !== undefined;

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
            universityPlayers,       // all players from ALL teams under this university
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
