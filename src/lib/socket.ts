/**
 * Socket.IO Helper
 * Provides access to the Socket.IO instance from API routes
 */

import { Server as SocketIOServer } from 'socket.io';

// Extend global namespace to include io
declare global {
    var io: SocketIOServer | undefined;
}

/**
 * Get the Socket.IO server instance
 * @returns Socket.IO server instance or null if not initialized
 */
export function getIO(): SocketIOServer | null {
    if (typeof global.io === 'undefined') {
        console.warn('[Socket.IO] Server not initialized. Make sure you are running with the custom server (server.js)');
        return null;
    }
    return global.io;
}

/**
 * Broadcast an event to a specific match room
 * @param matchId - The match ID
 * @param event - The event name
 * @param data - The data to broadcast
 */
export function broadcastToMatch(matchId: string, event: string, data: any): void {
    const io = getIO();
    if (io) {
        io.to(`match:${matchId}`).emit(event, {
            ...data,
            timestamp: Date.now(),
        });
    }
}

/**
 * Broadcast a match event (goal, card, etc.)
 * @param matchId - The match ID
 * @param event - The match event data
 */
export function broadcastMatchEvent(matchId: string, event: any): void {
    broadcastToMatch(matchId, 'event:new', {
        matchId,
        event,
    });
}

/**
 * Broadcast a score update
 * @param matchId - The match ID
 * @param homeScore - Home team score
 * @param awayScore - Away team score
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
 * @param matchId - The match ID
 * @param playerId - The player ID
 * @param rating - The new rating
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
 * @param matchId - The match ID
 * @param teamId - The team ID
 * @param stats - The updated stats
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
 * @param matchId - The match ID
 * @param status - The new status
 */
export function broadcastMatchStatus(matchId: string, status: string): void {
    broadcastToMatch(matchId, 'match:status:changed', {
        matchId,
        status,
    });
}

/**
 * Broadcast event deletion
 * @param matchId - The match ID
 * @param eventId - The deleted event ID
 */
export function broadcastEventDeleted(matchId: string, eventId: string): void {
    broadcastToMatch(matchId, 'event:deleted', {
        matchId,
        eventId,
    });
}
