/**
 * Player Detail API
 * GET /api/players/[id] - Get complete player information
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players, teams, matchEvents, matches, playerStats, basketballPlayerStats, footballPlayerStats } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

interface RouteParams {
    params: {
        id: string;
    };
}

export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const { id } = await params;

        // Get player details
        const [player] = await db
            .select()
            .from(players)
            .where(eq(players.id, id));

        if (!player) {
            return NextResponse.json(
                { error: 'Player not found' },
                { status: 404 }
            );
        }

        // Get player's team
        let team = null;
        if (player.teamId) {
            [team] = await db
                .select()
                .from(teams)
                .where(eq(teams.id, player.teamId));
        }

        // Get player's match events (goals, assists, cards, etc.)
        const playerEvents = await db
            .select({
                event: matchEvents,
                match: matches,
            })
            .from(matchEvents)
            .leftJoin(matches, eq(matchEvents.matchId, matches.id))
            .where(eq(matchEvents.playerId, id))
            .orderBy(desc(matches.startTime))
            .limit(50);

        // Calculate player statistics
        const goals = playerEvents.filter(e => e.event.type === 'GOAL').length;
        const assists = playerEvents.filter(e => e.event.type === 'ASSIST').length;
        const yellowCards = playerEvents.filter(e => e.event.type === 'YELLOW_CARD').length;
        const redCards = playerEvents.filter(e => e.event.type === 'RED_CARD').length;

        // Get matches the player participated in
        const playerMatches = await db
            .select()
            .from(matches)
            .where(
                and(
                    eq(matches.homeTeamId, player.teamId),
                    eq(matches.status, 'FINISHED')
                )
            )
            .orderBy(desc(matches.startTime))
            .limit(10);

        // Get recent form (last 5 matches with events)
        const recentMatchesWithEvents = playerEvents
            .slice(0, 5)
            .map(pe => ({
                match: pe.match,
                events: playerEvents
                    .filter(e => e.match?.id === pe.match?.id)
                    .map(e => e.event),
            }));

        // Get player stats from specialized tables or generic table
        // Determine sport from team or matches
        const basketballTeamNames = ['TBK', 'Titans', 'Storm', 'Rim Reapers', 'Vikings', 'Siberia'];
        let playerSport = (team && basketballTeamNames.includes(team.name)) ? 'Basketball' : (team?.sport || 'Football');

        if (!playerSport || (playerSport === 'Football' && !team?.sport)) {
            if (playerEvents.length > 0 && playerEvents[0].match) {
                playerSport = playerEvents[0].match.sport || 'Football';
            }
        }

        // Basketball-specific stats from specialized table
        let basketballSeasonStats: any = null;
        if (playerSport === 'Basketball') {
            const result = await db
                .select()
                .from(basketballPlayerStats)
                .where(eq(basketballPlayerStats.playerId, id))
                .get();
            if (result) {
                basketballSeasonStats = result;
            }
        }

        // Football-specific stats from specialized table
        let footballSeasonStats: any = null;
        if (playerSport === 'Football') {
            const result = await db
                .select()
                .from(footballPlayerStats)
                .where(eq(footballPlayerStats.playerId, id))
                .get();
            if (result) {
                footballSeasonStats = result;
            }
        }

        // Get player stats from generic player_stats table (for fallback/legacy)
        const dbPlayerStats = await db
            .select()
            .from(playerStats)
            .where(eq(playerStats.playerId, id));

        // Calculate total stats across all competitions from legacy table
        const totalStats = dbPlayerStats.reduce((acc, stat) => ({
            totalPoints: acc.totalPoints + (stat.goals || 0),
            totalAssists: acc.totalAssists + (stat.assists || 0),
            totalAppearances: acc.totalAppearances + (stat.appearances || 0),
            totalMinutes: acc.totalMinutes + (stat.minutesPlayed || 0),
        }), { totalPoints: 0, totalAssists: 0, totalAppearances: 0, totalMinutes: 0 });

        // Basketball-specific stats from events (secondary source)
        const basketballEventsStats = {
            twoPointers: playerEvents.filter(e => e.event.type === 'BASKET_2PT').length,
            threePointers: playerEvents.filter(e => e.event.type === 'BASKET_3PT').length,
            freeThrows: playerEvents.filter(e => e.event.type === 'FREE_THROW').length,
            steals: playerEvents.filter(e => e.event.type === 'STEAL').length,
            blocks: playerEvents.filter(e => e.event.type === 'BLOCK').length,
            rebounds: playerEvents.filter(e => e.event.type === 'REBOUND').length,
            assists: playerEvents.filter(e => e.event.type === 'ASSIST').length,
        };

        // Combine all possible sources for the most accurate season stats
        const seasonStats = {
            // Priority 1: Basketball Specialized table
            totalPoints: basketballSeasonStats ? (basketballSeasonStats.totalPoints || 0) : (footballSeasonStats ? (footballSeasonStats.goals || 0) : totalStats.totalPoints),
            totalAssists: basketballSeasonStats ? (basketballSeasonStats.assists || 0) : (footballSeasonStats ? (footballSeasonStats.assists || 0) : totalStats.totalAssists),
            appearances: basketballSeasonStats ? (basketballSeasonStats.gamesPlayed || 0) : (footballSeasonStats ? (footballSeasonStats.appearances || 0) : (totalStats.totalAppearances || playerMatches.length)),
            minutesPlayed: basketballSeasonStats ? (basketballSeasonStats.minutesPlayed || 0) : (footballSeasonStats ? (footballSeasonStats.minutesPlayed || 0) : totalStats.totalMinutes),

            // Basketball-specific breakdown
            twoPointers: basketballSeasonStats ? ((basketballSeasonStats.fieldGoalsMade || 0) - (basketballSeasonStats.threePointersMade || 0)) : basketballEventsStats.twoPointers,
            threePointers: basketballSeasonStats ? (basketballSeasonStats.threePointersMade || 0) : basketballEventsStats.threePointers,
            freeThrows: basketballSeasonStats ? (basketballSeasonStats.freeThrowsMade || 0) : basketballEventsStats.freeThrows,
            steals: basketballSeasonStats ? (basketballSeasonStats.steals || 0) : basketballEventsStats.steals,
            blocks: basketballSeasonStats ? (basketballSeasonStats.blocks || 0) : basketballEventsStats.blocks,
            rebounds: basketballSeasonStats ? (basketballSeasonStats.totalRebounds || 0) : basketballEventsStats.rebounds,
            offensiveRebounds: basketballSeasonStats ? (basketballSeasonStats.offensiveRebounds || 0) : 0,
            defensiveRebounds: basketballSeasonStats ? (basketballSeasonStats.defensiveRebounds || 0) : 0,
            turnovers: basketballSeasonStats ? (basketballSeasonStats.turnovers || 0) : 0,
            personalFouls: basketballSeasonStats ? (basketballSeasonStats.personalFouls || 0) : 0,

            // Football-specific
            goals: playerSport === 'Basketball' ? (basketballSeasonStats?.totalPoints || totalStats.totalPoints) : (footballSeasonStats ? (footballSeasonStats.goals || 0) : goals),
            assists: playerSport === 'Basketball' ? (basketballSeasonStats?.assists || totalStats.totalAssists) : (footballSeasonStats ? (footballSeasonStats.assists || 0) : assists),
            yellowCards: footballSeasonStats ? (footballSeasonStats.yellowCards || 0) : yellowCards,
            redCards: footballSeasonStats ? (footballSeasonStats.redCards || 0) : redCards,

            // Calculated averages
            rating: player.rating || 0,
            pointsPerGame: basketballSeasonStats
                ? ((basketballSeasonStats.gamesPlayed || 0) > 0 ? ((basketballSeasonStats.totalPoints || 0) / basketballSeasonStats.gamesPlayed).toFixed(1) : '0.0')
                : (totalStats.totalAppearances > 0 ? (totalStats.totalPoints / totalStats.totalAppearances).toFixed(1) : '0.0'),
            assistsPerGame: basketballSeasonStats
                ? ((basketballSeasonStats.gamesPlayed || 0) > 0 ? ((basketballSeasonStats.assists || 0) / basketballSeasonStats.gamesPlayed).toFixed(1) : '0.0')
                : (totalStats.totalAppearances > 0 ? (totalStats.totalAssists / totalStats.totalAppearances).toFixed(1) : '0.0'),
        };

        // Competition-specific stats
        const competitionStats = dbPlayerStats.map(stat => ({
            competition: stat.competition,
            sport: stat.sport,
            points: stat.goals || 0,
            assists: stat.assists || 0,
            appearances: stat.appearances || 0,
            minutesPlayed: stat.minutesPlayed || 0,
            averageRating: stat.averageRating || 0,
            pointsPerGame: stat.appearances ? ((stat.goals || 0) / stat.appearances).toFixed(1) : '0.0',
            assistsPerGame: stat.appearances ? ((stat.assists || 0) / stat.appearances).toFixed(1) : '0.0',
        }));

        // Group events by type for timeline
        const eventsByType = {
            goals: playerEvents.filter(e => e.event.type === 'GOAL'),
            assists: playerEvents.filter(e => e.event.type === 'ASSIST'),
            cards: playerEvents.filter(e =>
                e.event.type === 'YELLOW_CARD' ||
                e.event.type === 'RED_CARD'
            ),
        };

        return NextResponse.json({
            player: {
                ...player,
                team: {
                    ...team,
                    sport: playerSport, // Add sport to team object
                },
            },
            stats: seasonStats,
            competitionStats,
            recentMatches: recentMatchesWithEvents,
            events: eventsByType,
            allEvents: playerEvents.slice(0, 20).map(pe => ({
                ...pe.event,
                match: pe.match,
            })),
        });
    } catch (error) {
        console.error('Error fetching player details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch player details' },
            { status: 500 }
        );
    }
}
