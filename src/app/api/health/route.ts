import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Render + UptimeRobot
 * Keeps the free tier service alive by responding to pings
 */
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'brixsports',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    }, {
        status: 200,
        headers: {
            'Cache-Control': 'no-cache, no-store',
        },
    });
}
