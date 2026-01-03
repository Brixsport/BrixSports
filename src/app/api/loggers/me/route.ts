/**
 * Current Logger API
 * Returns the authenticated logger's information
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loggers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
    try {
        // In a real app, get loggerId from session/JWT
        // For now, we'll use a header or query param
        const loggerId = request.headers.get('x-logger-id') ||
            request.nextUrl.searchParams.get('loggerId');

        if (!loggerId) {
            return NextResponse.json(
                { error: 'Logger ID required' },
                { status: 401 }
            );
        }

        const [logger] = await db
            .select()
            .from(loggers)
            .where(eq(loggers.id, loggerId))
            .limit(1);

        if (!logger) {
            return NextResponse.json(
                { error: 'Logger not found' },
                { status: 404 }
            );
        }

        // Don't send password
        const { password, ...safeLogger } = logger;

        return NextResponse.json(safeLogger);
    } catch (error) {
        console.error('Error fetching logger:', error);
        return NextResponse.json(
            { error: 'Failed to fetch logger' },
            { status: 500 }
        );
    }
}
