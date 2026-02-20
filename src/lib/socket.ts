/**
 * Socket.IO Helper
 * 
 * On local dev (custom server.js): Uses global.io directly
 * On Vercel (serverless): Sends HTTP requests to the standalone WS server on Railway
 */

import { Server as SocketIOServer } from 'socket.io';

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
        await fetch(broadcastUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
            },
            body: JSON.stringify({ room, event, data }),
        });
    } catch (error) {
        // Don't crash API routes if WS broadcast fails
        console.warn('[Socket] Broadcast failed (WS server may be down):', (error as Error).message);
    }
}

/**
 * Broadcast an event to a specific match room
 */
export function broadcastToMatch(matchId: string, event: string, data: any): void {
    broadcast(`match:${matchId}`, event, data);
}

/**
 * Broadcast a match event (goal, card, etc.)
 */
export function broadcastMatchEvent(matchId: string, event: any): void {
    broadcastToMatch(matchId, 'event:new', {
        matchId,
        event,
    });
}

/**
 * Broadcast a score update
 */
export function broadcastScoreUpdate(matchId: string, homeScore: number, awayScore: number): void {
    broadcastToMatch(matchId, 'match:score:updated', {
        matchId,
        homeScore,
        awayScore,
    });
}

/**
 * Broadcast a rating update
 */
export function broadcastRatingUpdate(matchId: string, playerId: string, rating: number): void {
    broadcastToMatch(matchId, 'rating:updated', {
        matchId,
        playerId,
        rating,
    });
}

/**
 * Broadcast stats update
 */
export function broadcastStatsUpdate(matchId: string, teamId: string, stats: any): void {
    broadcastToMatch(matchId, 'stats:updated', {
        matchId,
        teamId,
        stats,
    });
}

/**
 * Broadcast match status change
 */
export function broadcastMatchStatus(matchId: string, status: string): void {
    broadcastToMatch(matchId, 'match:status:changed', {
        matchId,
        status,
    });
}

/**
 * Broadcast event deletion
 */
export function broadcastEventDeleted(matchId: string, eventId: string): void {
    broadcastToMatch(matchId, 'event:deleted', {
        matchId,
        eventId,
    });
}
