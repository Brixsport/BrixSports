/**
 * Socket.IO Helper
 * 
 * On local dev (custom server.js): Uses global.io directly
 * On Vercel (serverless): Sends HTTP requests to the standalone WS server on Railway
 */

import { Server as SocketIOServer } from 'socket.io';
import { env as appEnv } from './env';

// Extend global namespace to include io
declare global {
    var io: SocketIOServer | undefined;
}

/**
 * Get the Socket.IO server instance (local dev only)
 */
export function getIO(): SocketIOServer | null {
    if (typeof global.io === 'undefined') {
        return null;
    }
    return global.io;
}

/**
 * Broadcast an event via the WS server.
 * - Local dev: uses global.io directly
 * - Production (Vercel): sends HTTP request to the standalone WS server
 */
async function broadcast(room: string | null, event: string, data: any): Promise<void> {
    // Try local Socket.IO first (custom server.js in dev)
    const io = getIO();
    if (io) {
        if (room) {
            io.to(room).emit(event, { ...data, timestamp: Date.now() });
        } else {
            io.emit(event, { ...data, timestamp: Date.now() });
        }
        return;
    }

    // Fall back to HTTP broadcast via the standalone WS server
    const wsServerUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.WS_SERVER_URL;
    const apiKey = process.env.WS_API_KEY;

    if (!wsServerUrl || !apiKey) {
        // Silently skip - WS server not configured
        return;
    }

    try {
        const broadcastUrl = wsServerUrl.replace(/\/+$/, '') + '/broadcast';
        // BUG-074: ws-server/index.js shares one Railway instance across staging and
        // prod, with no browser Origin header on this server-to-server call to read
        // env from — tell it explicitly so it can room-scope the broadcast the same
        // way it scopes browser socket connections. Deliberately NOT appEnv.isStaging:
        // NEXT_PUBLIC_ENV is currently kept off 'staging' on the staging deployment
        // on purpose, to bypass middleware.ts's staging-wide JWT gate — so it can't be
        // trusted here. Match on the deployment's own URL instead, using the exact same
        // hostname patterns the socket connection handlers already check on the
        // incoming browser Origin, so both sides always agree on the room name. Same
        // default-to-'prod' direction as the rest of BUG-074's fix either way.
        const wsEnv = (appEnv.appUrl.includes('staging.brixsports.com') || appEnv.appUrl.includes('brixsports-staging.vercel.app'))
            ? 'staging'
            : 'prod';
        await fetch(broadcastUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
            },
            body: JSON.stringify({ room, event, data, env: wsEnv }),
        });
    } catch (error) {
        // Don't crash API routes if WS broadcast fails
        console.warn('[Socket] Broadcast failed (WS server may be down):', (error as Error).message);
    }
}

/**
 * Broadcast an event to a specific match room.
 * Returns the underlying promise (rather than firing-and-forgetting it) so
 * callers on Vercel can hand it to next/server's after() -- an unresolved,
 * un-awaited promise has no guaranteed completion once a serverless function
 * returns its response, which is the root cause traced for BUG-108/116's
 * multi-second (up to 42s observed) broadcast delivery latency.
 */
export function broadcastToMatch(matchId: string, event: string, data: any): Promise<void> {
    return broadcast(`match:${matchId}`, event, data);
}

/**
 * Broadcast a match event (goal, card, etc.)
 */
export function broadcastMatchEvent(matchId: string, event: any): Promise<void> {
    return broadcastToMatch(matchId, 'event:new', {
        matchId,
        event,
    });
}

/**
 * Broadcast a score update
 */
export function broadcastScoreUpdate(
    matchId: string,
    homeScore: number,
    awayScore: number,
    // BACKLOG-105: optional shootout score, backward compatible -- existing
    // listeners that don't know about these fields simply ignore them.
    shootoutHomeScore?: number,
    shootoutAwayScore?: number
): Promise<void> {
    return broadcastToMatch(matchId, 'match:score:updated', {
        matchId,
        homeScore,
        awayScore,
        ...(shootoutHomeScore !== undefined ? { shootoutHomeScore } : {}),
        ...(shootoutAwayScore !== undefined ? { shootoutAwayScore } : {}),
    });
}

/**
 * Broadcast a rating update
 */
export function broadcastRatingUpdate(matchId: string, playerId: string, rating: number): Promise<void> {
    return broadcastToMatch(matchId, 'rating:updated', {
        matchId,
        playerId,
        rating,
    });
}

/**
 * Broadcast stats update
 */
export function broadcastStatsUpdate(matchId: string, teamId: string, stats: any): Promise<void> {
    return broadcastToMatch(matchId, 'stats:updated', {
        matchId,
        teamId,
        stats,
    });
}

/**
 * Broadcast match status change
 */
export function broadcastMatchStatus(matchId: string, status: string): Promise<void> {
    return broadcastToMatch(matchId, 'match:status:changed', {
        matchId,
        status,
    });
}

/**
 * Broadcast event deletion
 */
export function broadcastEventDeleted(matchId: string, eventId: string): Promise<void> {
    return broadcastToMatch(matchId, 'event:deleted', {
        matchId,
        eventId,
    });
}
