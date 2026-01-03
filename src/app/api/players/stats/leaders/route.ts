import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players, playerStats, teams, basketballPlayerStats } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

// GET /api/players/stats/leaders - Get top performing players
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'goals'; // goals, assists, rating, appearances, points, rebounds, etc.
        const competition = searchParams.get('competition');
        const sport = searchParams.get('sport');
        const limit = parseInt(searchParams.get('limit') || '10');

        // Handle Basketball Stats specifically
        if (sport === 'Basketball') {
            let orderColumn;
            switch (type) {
                case 'points':
                    orderColumn = basketballPlayerStats.totalPoints;
                    break;
                case 'rebounds':
                    orderColumn = basketballPlayerStats.totalRebounds;
                    break;
                case 'assists':
                    orderColumn = basketballPlayerStats.assists;
                    break;
                case 'steals':
                    orderColumn = basketballPlayerStats.steals;
                    break;
                case 'blocks':
                    orderColumn = basketballPlayerStats.blocks;
                    break;
                case 'rating':
                    // Map points per game to rating for now if rating not available
                    orderColumn = basketballPlayerStats.pointsPerGame;
                    break;
                default:
                    orderColumn = basketballPlayerStats.totalPoints;
            }

            const results = await db
                .select({
                    player: players,
                    team: teams,
                    stats: basketballPlayerStats,
                })
                .from(basketballPlayerStats)
                .leftJoin(players, eq(basketballPlayerStats.playerId, players.id))
                .leftJoin(teams, eq(players.teamId, teams.id))
                .orderBy(desc(orderColumn))
                .limit(limit);

            const leaders = results
                .filter(r => r.player)
                .map((r, index) => ({
                    rank: index + 1,
                    player: {
                        id: r.player!.id,
                        name: r.player!.name,
                        number: r.player!.number,
                        position: r.player!.position,
                        image: r.player!.image,
                        rating: r.player!.rating,
                    },
                    team: r.team ? {
                        id: r.team.id,
                        name: r.team.name,
                        logo: r.team.logo,
                        color: r.team.color,
                        sport: 'Basketball'
                    } : null,
                    stats: {
                        sport: 'Basketball',
                        points: r.stats.totalPoints,
                        rebounds: r.stats.totalRebounds,
                        assists: r.stats.assists,
                        steals: r.stats.steals,
                        blocks: r.stats.blocks,
                        gamesPlayed: r.stats.gamesPlayed,
                        pointsPerGame: r.stats.pointsPerGame,
                        reboundsPerGame: r.stats.reboundsPerGame,
                        assistsPerGame: r.stats.assistsPerGame,
                    },
                    highlightedStat: getBasketballHighlightedStat(r.stats, type),
                }));

            return NextResponse.json({
                type,
                sport,
                limit,
                total: leaders.length,
                leaders,
            });
        }

        // Existing Football/Generic Logic
        const conditions = [];
        if (competition) {
            conditions.push(eq(playerStats.competition, competition));
        }
        if (sport) {
            conditions.push(eq(playerStats.sport, sport));
        }

        let orderColumn;
        switch (type) {
            case 'goals':
                orderColumn = playerStats.goals;
                break;
            case 'assists':
                orderColumn = playerStats.assists;
                break;
            case 'rating':
                orderColumn = playerStats.averageRating;
                break;
            case 'appearances':
                orderColumn = playerStats.appearances;
                break;
            case 'minutes':
                orderColumn = playerStats.minutesPlayed;
                break;
            case 'cleanSheets':
                orderColumn = playerStats.cleanSheets;
                break;
            case 'saves':
                orderColumn = playerStats.saves;
                break;
            default:
                orderColumn = playerStats.goals;
        }

        const baseQuery = db
            .select({
                player: players,
                team: teams,
                stats: playerStats,
            })
            .from(playerStats)
            .leftJoin(players, eq(playerStats.playerId, players.id))
            .leftJoin(teams, eq(players.teamId, teams.id));

        const results = conditions.length > 0
            ? await baseQuery
                .where(and(...conditions))
                .orderBy(desc(orderColumn))
                .limit(limit)
            : await baseQuery
                .orderBy(desc(orderColumn))
                .limit(limit);

        const leaders = results
            .filter(r => r.player)
            .map((r, index) => ({
                rank: index + 1,
                player: {
                    id: r.player!.id,
                    name: r.player!.name,
                    number: r.player!.number,
                    position: r.player!.position,
                    image: r.player!.image,
                    rating: r.player!.rating,
                },
                team: r.team ? {
                    id: r.team.id,
                    name: r.team.name,
                    logo: r.team.logo,
                    color: r.team.color,
                } : null,
                stats: r.stats,
                highlightedStat: getHighlightedStat(r.stats, type),
            }));

        return NextResponse.json({
            type,
            competition,
            sport,
            limit,
            total: leaders.length,
            leaders,
        });

    } catch (error) {
        console.error('Error fetching player leaders:', error);
        return NextResponse.json(
            { error: 'Failed to fetch player leaders' },
            { status: 500 }
        );
    }
}

function getBasketballHighlightedStat(stats: any, type: string): number {
    switch (type) {
        case 'points': return stats.totalPoints || 0;
        case 'rebounds': return stats.totalRebounds || 0;
        case 'assists': return stats.assists || 0;
        case 'steals': return stats.steals || 0;
        case 'blocks': return stats.blocks || 0;
        case 'rating': return stats.pointsPerGame || 0;
        default: return stats.totalPoints || 0;
    }
}

function getHighlightedStat(stats: any, type: string): number {
    switch (type) {
        case 'goals': return stats.goals || 0;
        case 'assists': return stats.assists || 0;
        case 'rating': return stats.averageRating || 0;
        case 'appearances': return stats.appearances || 0;
        case 'minutes': return stats.minutesPlayed || 0;
        case 'cleanSheets': return stats.cleanSheets || 0;
        case 'saves': return stats.saves || 0;
        default: return stats.goals || 0;
    }
}
