/**
 * Notifications API
 * GET /api/notifications - Get user notifications based on preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, teams, players, news, matchEvents, userFavorites } from '@/db/schema';
import { eq, desc, and, gte, or, inArray } from 'drizzle-orm';
import { getAuthUser, resolveEffectiveUserId } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const effectiveId = await resolveEffectiveUserId(user);
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20');

        // Fetch user favorites to personalize notifications
        const favorites = await db
            .select()
            .from(userFavorites)
            .where(eq(userFavorites.userId, effectiveId));

        const favoriteTeamIds = favorites
            .filter(f => f.favoriteType === 'team')
            .map(f => f.favoriteId);

        const notifications: any[] = [];
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // 1. Live and upcoming matches (Prioritize favorites)
        let matchesQuery = db
            .select({
                match: matches,
                homeTeam: teams,
            })
            .from(matches)
            .leftJoin(teams, eq(matches.homeTeamId, teams.id))
            .where(gte(matches.startTime, oneDayAgo.toISOString()))
            .orderBy(desc(matches.startTime))
            .limit(20);

        const recentMatches = await matchesQuery;

        for (const { match, homeTeam } of recentMatches) {
            const isFavorite = favoriteTeamIds.includes(match.homeTeamId) || favoriteTeamIds.includes(match.awayTeamId);

            // Boost favorite matches
            if (isFavorite || match.status === 'LIVE' || match.status === 'UPCOMING') {
                if (match.status === 'LIVE') {
                    notifications.push({
                        id: `match-live-${match.id}`,
                        title: isFavorite ? '🔴 Live: Your Team' : '🔴 Live Match',
                        message: `${homeTeam?.name || 'Team'} vs opponent is live now!`,
                        type: 'match',
                        read: false,
                        createdAt: match.startTime,
                        link: `/matches/${match.id}`,
                        priority: isFavorite ? 'high' : 'normal'
                    });
                } else if (match.status === 'UPCOMING') {
                    const matchTime = new Date(match.startTime);
                    const hoursUntil = (matchTime.getTime() - now.getTime()) / (1000 * 60 * 60);

                    if (hoursUntil <= 24 && hoursUntil > 0) {
                        notifications.push({
                            id: `match-upcoming-${match.id}`,
                            title: isFavorite ? '⏰ Upcoming: Your Team' : '⏰ Match Starting Soon',
                            message: `${homeTeam?.name || 'Team'} match starts in ${Math.round(hoursUntil)} hour(s)`,
                            type: 'match',
                            read: false,
                            createdAt: new Date(now.getTime() - (24 - hoursUntil) * 60 * 60 * 1000), // Fake timestamp for sorting
                            link: `/matches/${match.id}`,
                            priority: isFavorite ? 'high' : 'normal'
                        });
                    }
                }
            }
        }

        // 2. Recent goals and events
        const recentEvents = await db
            .select({
                event: matchEvents,
                match: matches,
                player: players,
            })
            .from(matchEvents)
            .leftJoin(matches, eq(matchEvents.matchId, matches.id))
            .leftJoin(players, eq(matchEvents.playerId, players.id))
            .where(
                and(
                    gte(matchEvents.createdAt, oneDayAgo),
                    or(
                        eq(matchEvents.type, 'GOAL'),
                        eq(matchEvents.type, 'BASKET_3PT'),
                        eq(matchEvents.type, 'RED_CARD')
                    )
                )
            )
            .orderBy(desc(matchEvents.createdAt))
            .limit(10);

        for (const { event, match, player } of recentEvents) {
            let title = '';

            if (event.type === 'GOAL') {
                title = '⚽ Goal Scored!';
            } else if (event.type === 'BASKET_3PT') {
                title = '🎯 3-Pointer!';
            } else if (event.type === 'RED_CARD') {
                title = '🟥 Red Card!';
            }

            notifications.push({
                id: `event-${event.id}`,
                title,
                message: `${player?.name || 'Player'} - ${event.minute}'`,
                type: 'goal',
                read: false,
                createdAt: event.createdAt,
                link: `/matches/${match?.id}`,
            });
        }

        // 3. Recent news
        const recentNews = await db
            .select()
            .from(news)
            .where(
                and(
                    eq(news.status, 'published'),
                    gte(news.publishedAt, oneDayAgo)
                )
            )
            .orderBy(desc(news.publishedAt))
            .limit(5);

        for (const article of recentNews) {
            notifications.push({
                id: `news-${article.id}`,
                title: article.isBreaking ? '🚨 Breaking News' : '📰 New Article',
                message: article.title,
                type: 'news',
                read: false,
                createdAt: article.publishedAt,
                link: `/news/${article.slug}`,
            });
        }

        // 4. Default welcome message if empty
        if (notifications.length === 0) {
            notifications.push({
                id: 'welcome',
                title: '👋 Welcome to Brixsport!',
                message: `Hello ${user.name}! Follow teams and players to get personalized updates.`,
                type: 'general',
                read: false,
                createdAt: now,
            });
        }

        // Sort: High priority first, then by date
        const sortedNotifications = notifications
            .sort((a, b) => {
                if (a.priority === 'high' && b.priority !== 'high') return -1;
                if (a.priority !== 'high' && b.priority === 'high') return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })
            .slice(0, limit);

        return NextResponse.json({
            notifications: sortedNotifications,
            total: sortedNotifications.length,
            unreadCount: 0, // Mock for now
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notifications' },
            { status: 500 }
        );
    }
}

// Mark notification as read
export async function PATCH(request: NextRequest) {
    try {
        const user = await getAuthUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { notificationId } = body;

        if (!notificationId) {
            return NextResponse.json(
                { error: 'Notification ID is required' },
                { status: 400 }
            );
        }

        // Mock success for now as we don't have a notifications table yet
        return NextResponse.json({
            success: true,
            message: 'Notification marked as read',
        });

    } catch (error) {
        console.error('Error updating notification:', error);
        return NextResponse.json(
            { error: 'Failed to update notification' },
            { status: 500 }
        );
    }
}
