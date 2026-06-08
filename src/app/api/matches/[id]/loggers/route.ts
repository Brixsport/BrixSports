/**
 * Logger Sessions API
 * Manages active logger sessions for multi-logger support
 * Uses SQLite database for persistent session storage (no Redis needed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { loggers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionStore } from '@/lib/sessionStore';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/matches/[id]/loggers
 * Get all active loggers for a match
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin' && authUser.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: matchId } = await params;
        const sessionStore = getSessionStore();

        // Get all sessions for this match
        const matchSessions = await sessionStore.getMatchSessions(matchId);

        return NextResponse.json({
            activeLoggers: matchSessions.length,
            loggers: matchSessions,
        });
    } catch (error) {
        console.error('Error fetching active loggers:', error);
        return NextResponse.json(
            { error: 'Failed to fetch active loggers' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/matches/[id]/loggers
 * Join a match as a logger (create session)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin' && authUser.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: matchId } = await params;
        const { loggerId } = await request.json();

        if (authUser.role === 'logger' && authUser.id !== loggerId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const sessionStore = getSessionStore();

        // Verify logger exists
        const [logger] = await db
            .select()
            .from(loggers)
            .where(eq(loggers.id, loggerId));

        if (!logger) {
            return NextResponse.json(
                { error: 'Logger not found' },
                { status: 404 }
            );
        }

        // Create or update session
        const sessionKey = `${loggerId}-${matchId}`;
        const session = {
            loggerId,
            loggerName: logger.name,
            matchId,
            joinedAt: new Date(),
            lastActivity: new Date(),
        };

        await sessionStore.set(sessionKey, session);

        // Get all active loggers for this match
        const matchSessions = await sessionStore.getMatchSessions(matchId);

        return NextResponse.json({
            session,
            activeLoggers: matchSessions.length,
            otherLoggers: matchSessions.filter(s => s.loggerId !== loggerId),
        });
    } catch (error) {
        console.error('Error creating logger session:', error);
        return NextResponse.json(
            { error: 'Failed to create session' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/matches/[id]/loggers
 * Update logger activity (heartbeat)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin' && authUser.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: matchId } = await params;
        const { loggerId } = await request.json();

        if (authUser.role === 'logger' && authUser.id !== loggerId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const sessionStore = getSessionStore();

        const sessionKey = `${loggerId}-${matchId}`;

        // Update heartbeat
        await sessionStore.heartbeat(sessionKey);

        const session = await sessionStore.get(sessionKey);

        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, session });
    } catch (error) {
        console.error('Error updating logger activity:', error);
        return NextResponse.json(
            { error: 'Failed to update activity' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/matches/[id]/loggers
 * Leave match (end session)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin' && authUser.role !== 'logger') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id: matchId } = await params;
        const { searchParams } = new URL(request.url);
        const loggerId = searchParams.get('loggerId');

        if (!loggerId) {
            return NextResponse.json(
                { error: 'Logger ID required' },
                { status: 400 }
            );
        }

        if (authUser.role === 'logger' && authUser.id !== loggerId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const sessionStore = getSessionStore();

        const sessionKey = `${loggerId}-${matchId}`;
        await sessionStore.delete(sessionKey);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting logger session:', error);
        return NextResponse.json(
            { error: 'Failed to delete session' },
            { status: 500 }
        );
    }
}
