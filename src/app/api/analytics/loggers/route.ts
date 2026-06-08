/**
 * Logger Analytics API
 * Track logger performance, activity, and quality metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchEvents, matches, loggers } from '@/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/analytics/loggers
 * Get analytics for all loggers or a specific logger
 */
export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const loggerId = searchParams.get('loggerId');
        const timeframe = searchParams.get('timeframe') || '30'; // days

        // Calculate date threshold
        const daysAgo = parseInt(timeframe);
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - daysAgo);

        if (loggerId) {
            // Get analytics for specific logger
            const analytics = await getLoggerAnalytics(loggerId, thresholdDate);
            return NextResponse.json(analytics);
        } else {
            // Get analytics for all loggers
            const allLoggers = await db.select().from(loggers);
            const analyticsPromises = allLoggers.map(logger =>
                getLoggerAnalytics(logger.id, thresholdDate)
            );
            const analytics = await Promise.all(analyticsPromises);

            // Filter out null results and sort by total events (most active first)
            const validAnalytics = analytics.filter(a => a !== null);
            const sorted = validAnalytics.sort((a, b) => b!.metrics.totalEvents - a!.metrics.totalEvents);

            return NextResponse.json({
                loggers: sorted,
                total: sorted.length,
                timeframe: `${daysAgo} days`,
            });
        }
    } catch (error) {
        console.error('Error fetching logger analytics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch logger analytics' },
            { status: 500 }
        );
    }
}

/**
 * Get detailed analytics for a specific logger
 */
async function getLoggerAnalytics(loggerId: string, thresholdDate: Date) {
    // Get logger info
    const [logger] = await db
        .select()
        .from(loggers)
        .where(eq(loggers.id, loggerId))
        .limit(1);

    if (!logger) {
        return null;
    }

    // Get all events by this logger
    const events = await db
        .select()
        .from(matchEvents)
        .where(eq(matchEvents.loggerId, loggerId));

    // Get recent events (within timeframe)
    const recentEvents = events.filter(e =>
        new Date(e.createdAt!) >= thresholdDate
    );

    // Get matches logged
    const matchIds = [...new Set(events.map(e => e.matchId))];
    const recentMatchIds = [...new Set(recentEvents.map(e => e.matchId))];

    // Calculate event type distribution
    const eventTypes: Record<string, number> = {};
    events.forEach(e => {
        eventTypes[e.type] = (eventTypes[e.type] || 0) + 1;
    });

    // Calculate events per match
    const eventsPerMatch = matchIds.length > 0
        ? events.length / matchIds.length
        : 0;

    // Calculate activity by day of week
    const dayActivity: Record<string, number> = {
        'Sunday': 0,
        'Monday': 0,
        'Tuesday': 0,
        'Wednesday': 0,
        'Thursday': 0,
        'Friday': 0,
        'Saturday': 0,
    };

    events.forEach(e => {
        if (e.createdAt) {
            const day = new Date(e.createdAt).toLocaleDateString('en-US', { weekday: 'long' });
            dayActivity[day] = (dayActivity[day] || 0) + 1;
        }
    });

    // Calculate activity by hour
    const hourActivity: Record<number, number> = {};
    events.forEach(e => {
        if (e.createdAt) {
            const hour = new Date(e.createdAt).getHours();
            hourActivity[hour] = (hourActivity[hour] || 0) + 1;
        }
    });

    // Find most active match
    const matchEventCounts: Record<string, number> = {};
    events.forEach(e => {
        matchEventCounts[e.matchId] = (matchEventCounts[e.matchId] || 0) + 1;
    });

    const mostActiveMatch = Object.entries(matchEventCounts)
        .sort(([, a], [, b]) => b - a)[0];

    // Calculate average events per day
    const firstEvent = events.length > 0
        ? new Date(events[0].createdAt!)
        : new Date();
    const daysSinceFirst = Math.max(1,
        Math.floor((Date.now() - firstEvent.getTime()) / (1000 * 60 * 60 * 24))
    );
    const eventsPerDay = events.length / daysSinceFirst;

    // Get recent activity (last 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const last7DaysEvents = events.filter(e =>
        new Date(e.createdAt!) >= last7Days
    );

    // Calculate quality score (0-100)
    // Based on: consistency, activity, event diversity
    const consistencyScore = Math.min(100, eventsPerDay * 10);
    const activityScore = Math.min(100, (events.length / 100) * 100);
    const diversityScore = Math.min(100, Object.keys(eventTypes).length * 10);
    const qualityScore = Math.round(
        (consistencyScore * 0.3 + activityScore * 0.4 + diversityScore * 0.3)
    );

    return {
        logger: {
            id: logger.id,
            name: logger.name,
            email: logger.email,
            role: logger.role,
        },
        metrics: {
            totalEvents: events.length,
            recentEvents: recentEvents.length,
            matchesLogged: matchIds.length,
            recentMatches: recentMatchIds.length,
            eventsPerMatch: Math.round(eventsPerMatch * 10) / 10,
            eventsPerDay: Math.round(eventsPerDay * 10) / 10,
            last7DaysEvents: last7DaysEvents.length,
            qualityScore,
        },
        breakdown: {
            eventTypes,
            dayActivity,
            hourActivity: Object.fromEntries(
                Object.entries(hourActivity).sort(([a], [b]) => parseInt(a) - parseInt(b))
            ),
        },
        insights: {
            mostActiveMatch: mostActiveMatch ? {
                matchId: mostActiveMatch[0],
                events: mostActiveMatch[1],
            } : null,
            mostCommonEvent: Object.entries(eventTypes)
                .sort(([, a], [, b]) => b - a)[0]?.[0] || null,
            peakDay: Object.entries(dayActivity)
                .sort(([, a], [, b]) => b - a)[0]?.[0] || null,
            peakHour: Object.entries(hourActivity)
                .sort(([, a], [, b]) => b - a)[0]?.[0] || null,
        },
        timeline: {
            firstEvent: events.length > 0 ? events[0].createdAt : null,
            lastEvent: events.length > 0 ? events[events.length - 1].createdAt : null,
            daysSinceFirst,
        },
    };
}

/**
 * GET /api/analytics/loggers/leaderboard
 * Get logger leaderboard
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
        const { metric = 'totalEvents', limit = 10, timeframe = 30 } = body;

        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - timeframe);

        // Get all loggers
        const allLoggers = await db.select().from(loggers);

        // Get analytics for each
        const analyticsPromises = allLoggers.map(logger =>
            getLoggerAnalytics(logger.id, thresholdDate)
        );
        const analytics = await Promise.all(analyticsPromises);

        // Filter out nulls
        const validAnalytics = analytics.filter(a => a !== null);

        // Sort by specified metric
        const sorted = validAnalytics.sort((a, b) => {
            const aValue = a!.metrics[metric as keyof typeof a.metrics] as number;
            const bValue = b!.metrics[metric as keyof typeof b.metrics] as number;
            return bValue - aValue;
        });

        // Take top N
        const leaderboard = sorted.slice(0, limit);

        return NextResponse.json({
            leaderboard,
            metric,
            timeframe: `${timeframe} days`,
            total: validAnalytics.length,
        });
    } catch (error) {
        console.error('Error fetching logger leaderboard:', error);
        return NextResponse.json(
            { error: 'Failed to fetch logger leaderboard' },
            { status: 500 }
        );
    }
}
