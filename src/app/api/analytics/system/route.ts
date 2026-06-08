/**
 * System Analytics API
 * Provides high-level overview of the entire system
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, matches, news, teams, players, matchEvents, transfers } from '@/db/schema';
import { sql, eq, count } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 1. User Stats
        const [totalUsers] = await db.select({ count: count() }).from(users);

        // 2. Match Stats
        const [totalMatches] = await db.select({ count: count() }).from(matches);
        const [liveMatches] = await db.select({ count: count() }).from(matches).where(eq(matches.status, 'LIVE'));
        const [upcomingMatches] = await db.select({ count: count() }).from(matches).where(eq(matches.status, 'UPCOMING'));
        const [finishedMatches] = await db.select({ count: count() }).from(matches).where(eq(matches.status, 'FINISHED'));

        // 3. News Stats
        const [totalNews] = await db.select({ count: count() }).from(news);
        const [publishedNews] = await db.select({ count: count() }).from(news).where(eq(news.status, 'published'));

        // 4. Entity Stats
        const [totalTeams] = await db.select({ count: count() }).from(teams);
        const [totalPlayers] = await db.select({ count: count() }).from(players);

        // 5. Activity Stats (Recent Events)
        const [totalEvents] = await db.select({ count: count() }).from(matchEvents);

        // 6. Transfer Stats
        const [totalTransfers] = await db.select({ count: count() }).from(transfers);

        // 7. Sport distribution
        const sportMatches = await db
            .select({
                sport: matches.sport,
                count: count()
            })
            .from(matches)
            .groupBy(matches.sport);

        // 8. Monthly News Growth (Last 6 months)
        // Note: SQLite doesn't have complex date functions, so we'll do basic counts or just return simple data

        const analytics = {
            users: {
                total: totalUsers?.count || 0,
            },
            matches: {
                total: totalMatches?.count || 0,
                live: liveMatches?.count || 0,
                upcoming: upcomingMatches?.count || 0,
                finished: finishedMatches?.count || 0,
                bySport: sportMatches
            },
            news: {
                total: totalNews?.count || 0,
                published: publishedNews?.count || 0
            },
            entities: {
                teams: totalTeams?.count || 0,
                players: totalPlayers?.count || 0,
                transfers: totalTransfers?.count || 0
            },
            activity: {
                totalEvents: totalEvents?.count || 0
            },
            timestamp: new Date().toISOString()
        };

        return NextResponse.json(analytics);
    } catch (error) {
        console.error('Error fetching system analytics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch system analytics' },
            { status: 500 }
        );
    }
}
