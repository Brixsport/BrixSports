/**
 * Infrastructure Monitoring API
 * Provides system health, database status, and performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, matches, news, teams, players, loggers, competitions } from '@/db/schema';
import { count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
    try {
        const startTime = Date.now();

        // 1. Database Health Check
        let dbStatus = 'healthy';
        let dbLatency = 0;
        try {
            const dbStart = Date.now();
            await db.select({ count: count() }).from(users).limit(1);
            dbLatency = Date.now() - dbStart;
        } catch (error) {
            dbStatus = 'unhealthy';
            console.error('Database health check failed:', error);
        }

        // 2. Table Sizes
        const [usersCount] = await db.select({ count: count() }).from(users);
        const [matchesCount] = await db.select({ count: count() }).from(matches);
        const [newsCount] = await db.select({ count: count() }).from(news);
        const [teamsCount] = await db.select({ count: count() }).from(teams);
        const [playersCount] = await db.select({ count: count() }).from(players);
        const [loggersCount] = await db.select({ count: count() }).from(loggers);
        const [competitionsCount] = await db.select({ count: count() }).from(competitions);

        // 3. System Metrics (simulated - in production, use actual monitoring)
        const systemMetrics = {
            cpu: Math.random() * 30 + 10, // 10-40% usage
            memory: Math.random() * 40 + 30, // 30-70% usage
            disk: Math.random() * 20 + 15, // 15-35% usage
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform,
        };

        // 4. API Response Times (sample)
        const apiEndpoints = [
            { name: '/api/matches', avgResponseTime: Math.random() * 100 + 50, status: 'operational' },
            { name: '/api/teams', avgResponseTime: Math.random() * 100 + 50, status: 'operational' },
            { name: '/api/players', avgResponseTime: Math.random() * 100 + 50, status: 'operational' },
            { name: '/api/news', avgResponseTime: Math.random() * 100 + 50, status: 'operational' },
            { name: '/api/loggers', avgResponseTime: Math.random() * 100 + 50, status: 'operational' },
        ];

        // 5. Recent Errors (in production, fetch from error logging service)
        const recentErrors: Array<{
            message: string;
            timestamp: string;
            severity: string;
        }> = [
                // Placeholder - integrate with actual error tracking
            ];

        const totalLatency = Date.now() - startTime;

        const infrastructure = {
            status: dbStatus === 'healthy' ? 'operational' : 'degraded',
            timestamp: new Date().toISOString(),
            database: {
                status: dbStatus,
                latency: dbLatency,
                tables: {
                    users: usersCount?.count || 0,
                    matches: matchesCount?.count || 0,
                    news: newsCount?.count || 0,
                    teams: teamsCount?.count || 0,
                    players: playersCount?.count || 0,
                    loggers: loggersCount?.count || 0,
                    competitions: competitionsCount?.count || 0,
                },
                totalRecords: (usersCount?.count || 0) +
                    (matchesCount?.count || 0) +
                    (newsCount?.count || 0) +
                    (teamsCount?.count || 0) +
                    (playersCount?.count || 0) +
                    (loggersCount?.count || 0) +
                    (competitionsCount?.count || 0),
            },
            system: systemMetrics,
            api: {
                endpoints: apiEndpoints,
                avgResponseTime: apiEndpoints.reduce((sum, e) => sum + e.avgResponseTime, 0) / apiEndpoints.length,
            },
            errors: recentErrors,
            performance: {
                requestLatency: totalLatency,
            },
        };

        return NextResponse.json(infrastructure);
    } catch (error) {
        console.error('Error fetching infrastructure data:', error);
        return NextResponse.json(
            {
                status: 'error',
                error: 'Failed to fetch infrastructure data',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}
