/**
 * Infrastructure Monitoring API
 * Provides system health, database status, and performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, matches, news, teams, players, loggers, competitions, advertisements, transfers, polls } from '@/db/schema';
import { count, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

// Core API endpoints to monitor (includes all major feature endpoints)
const ENDPOINTS_TO_CHECK = [
    // Core data APIs
    { path: '/api/matches', name: 'Matches API' },
    { path: '/api/teams', name: 'Teams API' },
    { path: '/api/players', name: 'Players API' },
    { path: '/api/competitions', name: 'Competitions API' },
    { path: '/api/fixtures', name: 'Fixtures API' },
    // Content APIs
    { path: '/api/news', name: 'News API' },
    { path: '/api/transfers', name: 'Transfers API' },
    { path: '/api/polls', name: 'Polls API' },
    { path: '/api/events', name: 'Events API' },
    { path: '/api/brackets', name: 'Brackets API' },
    // Admin APIs
    { path: '/api/admin/ads', name: 'Admin Ads API' },
    { path: '/api/admin/users', name: 'Admin Users API' },
    { path: '/api/admin/organizations', name: 'Admin Organizations API' },
    { path: '/api/admin/settings', name: 'Admin Settings API' },
    { path: '/api/admin/infrastructure', name: 'Infrastructure API' },
    // Feature APIs
    { path: '/api/ads', name: 'Public Ads API' },
    { path: '/api/analytics/system', name: 'System Analytics API' },
    { path: '/api/notifications', name: 'Notifications API' },
    // Auth API (health check only)
    { path: '/api/auth/me', name: 'Auth API' },
    // Basketball APIs
    { path: '/api/basketball/matches', name: 'Basketball Matches API' },
    { path: '/api/basketball/teams', name: 'Basketball Teams API' },
    { path: '/api/basketball/players', name: 'Basketball Players API' },
    { path: '/api/basketball/standings', name: 'Basketball Standings API' },
];

// Check a single endpoint health
async function checkEndpointHealth(baseUrl: string, endpoint: { path: string; name: string }): Promise<{
    name: string;
    path: string;
    avgResponseTime: number;
    status: 'operational' | 'degraded' | 'down';
    statusCode: number | null;
    error: string | null;
}> {
    const startTime = Date.now();
    try {
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });
        const responseTime = Date.now() - startTime;

        let status: 'operational' | 'degraded' | 'down';
        if (response.ok) {
            status = responseTime < 500 ? 'operational' : 'degraded';
        } else if (response.status === 401 || response.status === 403) {
            // Auth protected endpoints show as operational if they respond
            status = 'operational';
        } else {
            status = 'down';
        }

        return {
            name: endpoint.name,
            path: endpoint.path,
            avgResponseTime: responseTime,
            status,
            statusCode: response.status,
            error: null,
        };
    } catch (error) {
        return {
            name: endpoint.name,
            path: endpoint.path,
            avgResponseTime: Date.now() - startTime,
            status: 'down',
            statusCode: null,
            error: error instanceof Error ? error.message : 'Connection failed',
        };
    }
}

export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const startTime = Date.now();
        const baseUrl = request.nextUrl.origin;

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

        // 2. Table Sizes - get all tables dynamically
        const [usersCount] = await db.select({ count: count() }).from(users);
        const [matchesCount] = await db.select({ count: count() }).from(matches);
        const [newsCount] = await db.select({ count: count() }).from(news);
        const [teamsCount] = await db.select({ count: count() }).from(teams);
        const [playersCount] = await db.select({ count: count() }).from(players);
        const [loggersCount] = await db.select({ count: count() }).from(loggers);
        const [competitionsCount] = await db.select({ count: count() }).from(competitions);
        
        // Optional tables - wrap in try/catch in case they don't exist yet
        let adsCount = { count: 0 };
        let transfersCount = { count: 0 };
        let pollsCount = { count: 0 };
        try {
            [adsCount] = await db.select({ count: count() }).from(advertisements);
        } catch {}
        try {
            [transfersCount] = await db.select({ count: count() }).from(transfers);
        } catch {}
        try {
            [pollsCount] = await db.select({ count: count() }).from(polls);
        } catch {}

        // 3. System Metrics (real where possible, estimated otherwise)
        const memUsage = process.memoryUsage();
        const systemMetrics = {
            cpu: process.cpuUsage ? Math.round((process.cpuUsage().user / 1000000) % 100) : 0,
            memory: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) || 0,
            memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024),
            disk: 0, // Would need OS-specific calls
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform,
            env: process.env.NODE_ENV || 'development',
        };

        // 4. API Health Checks - Actually test the endpoints
        const apiHealthResults = await Promise.allSettled(
            ENDPOINTS_TO_CHECK.map(endpoint => checkEndpointHealth(baseUrl, endpoint))
        );

        const apiEndpoints = apiHealthResults.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            return {
                name: ENDPOINTS_TO_CHECK[index].name,
                path: ENDPOINTS_TO_CHECK[index].path,
                avgResponseTime: 0,
                status: 'down' as const,
                statusCode: null,
                error: result.reason?.message || 'Health check failed',
            };
        });

        // Group endpoints by category for better organization
        const categorizedEndpoints = {
            core: apiEndpoints.filter(e => ['Matches', 'Teams', 'Players', 'Competitions', 'Fixtures'].some(t => e.name.includes(t))),
            content: apiEndpoints.filter(e => ['News', 'Transfers', 'Polls', 'Events', 'Brackets'].some(t => e.name.includes(t))),
            admin: apiEndpoints.filter(e => e.name.includes('Admin')),
            features: apiEndpoints.filter(e => ['Ads', 'Analytics', 'Notifications'].some(t => e.name.includes(t))),
            auth: apiEndpoints.filter(e => e.name.includes('Auth')),
            basketball: apiEndpoints.filter(e => e.name.includes('Basketball')),
        };

        // 5. Recent Errors (placeholder - integrate with error logging service)
        const recentErrors: Array<{
            message: string;
            timestamp: string;
            severity: string;
        }> = [];

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
                    advertisements: adsCount?.count || 0,
                    transfers: transfersCount?.count || 0,
                    polls: pollsCount?.count || 0,
                },
                totalRecords: (usersCount?.count || 0) +
                    (matchesCount?.count || 0) +
                    (newsCount?.count || 0) +
                    (teamsCount?.count || 0) +
                    (playersCount?.count || 0) +
                    (loggersCount?.count || 0) +
                    (competitionsCount?.count || 0) +
                    (adsCount?.count || 0) +
                    (transfersCount?.count || 0) +
                    (pollsCount?.count || 0),
            },
            system: systemMetrics,
            api: {
                endpoints: apiEndpoints.map(e => ({
                    name: e.name,
                    path: e.path,
                    avgResponseTime: e.avgResponseTime,
                    status: e.status,
                    error: e.error,
                })),
                categories: categorizedEndpoints,
                totalCount: apiEndpoints.length,
                avgResponseTime: apiEndpoints.length > 0
                    ? Math.round(apiEndpoints.reduce((sum, e) => sum + e.avgResponseTime, 0) / apiEndpoints.length)
                    : 0,
                operationalCount: apiEndpoints.filter(e => e.status === 'operational').length,
                degradedCount: apiEndpoints.filter(e => e.status === 'degraded').length,
                downCount: apiEndpoints.filter(e => e.status === 'down').length,
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
