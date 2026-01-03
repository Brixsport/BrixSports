/**
 * Event Sync API Route
 * Handles offline event synchronization
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matchEvents, matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { broadcastMatchEvent } from '@/lib/socket';

interface SyncEventRequest {
    matchId: string;
    event: {
        type: string;
        minute: number;
        second?: number;
        teamId?: string;
        playerId?: string;
        relatedPlayerId?: string;
        detail?: string;
        isEyePoint?: boolean;
        value?: any;
    };
    timestamp: number;
}

/**
 * POST /api/events/sync
 * Sync offline events
 */
export async function POST(request: NextRequest) {
    try {
        const body: SyncEventRequest = await request.json();
        const { matchId, event, timestamp } = body;

        // Validate required fields
        if (!matchId || !event || !event.type || event.minute === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Check if match exists
        const [match] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, matchId));

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Get existing events
        const existingEvents = await db
            .select()
            .from(matchEvents)
            .where(eq(matchEvents.matchId, matchId));

        // Conflict detection
        const conflicts = detectConflicts(event, existingEvents, timestamp);

        if (conflicts.length > 0) {
            // Handle conflicts based on strategy
            const resolution = resolveConflicts(conflicts, event, timestamp);

            if (!resolution.shouldInsert) {
                return NextResponse.json({
                    success: false,
                    conflicts,
                    resolution,
                    message: 'Event conflicts with existing data',
                });
            }
        }

        // Create event ID
        const eventId = `evt-sync-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

        // Insert event
        const newEvent = {
            id: eventId,
            matchId,
            type: event.type,
            minute: event.minute,
            second: event.second || 0,
            teamId: event.teamId || null,
            playerId: event.playerId || null,
            relatedPlayerId: event.relatedPlayerId || null,
            detail: event.detail || null,
            isEyePoint: event.isEyePoint || false,
            value: event.value ? JSON.stringify(event.value) : null,
        };

        await db.insert(matchEvents).values(newEvent);

        // Broadcast synced event via WebSocket
        broadcastMatchEvent(matchId, newEvent);

        // Note: Stats and ratings recalculation should be triggered
        // by a background job or scheduled task to avoid blocking the sync

        return NextResponse.json({
            success: true,
            eventId,
            conflicts: conflicts.length > 0 ? conflicts : undefined,
        });
    } catch (error) {
        console.error('Error syncing event:', error);
        return NextResponse.json(
            { error: 'Failed to sync event' },
            { status: 500 }
        );
    }
}

/**
 * Detect conflicts with existing events
 */
function detectConflicts(
    newEvent: any,
    existingEvents: any[],
    timestamp: number
): Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' }> {
    const conflicts: Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' }> = [];

    // Check for duplicate events at the same time
    const duplicates = existingEvents.filter(
        e =>
            e.type === newEvent.type &&
            e.minute === newEvent.minute &&
            e.second === (newEvent.second || 0) &&
            e.playerId === newEvent.playerId
    );

    if (duplicates.length > 0) {
        conflicts.push({
            type: 'DUPLICATE',
            description: 'Event already exists at this timestamp',
            severity: 'high',
        });
    }

    // Check for conflicting substitutions
    if (newEvent.type === 'SUBSTITUTION') {
        const conflictingSubs = existingEvents.filter(
            e =>
                e.type === 'SUBSTITUTION' &&
                e.minute === newEvent.minute &&
                (e.playerId === newEvent.playerId || e.relatedPlayerId === newEvent.relatedPlayerId)
        );

        if (conflictingSubs.length > 0) {
            conflicts.push({
                type: 'SUBSTITUTION_CONFLICT',
                description: 'Player already involved in substitution at this time',
                severity: 'high',
            });
        }
    }

    // Check for events after match end
    const matchEndEvents = existingEvents.filter(
        e => e.type === 'MATCH_END' && e.minute < newEvent.minute
    );

    if (matchEndEvents.length > 0) {
        conflicts.push({
            type: 'AFTER_MATCH_END',
            description: 'Event occurs after match has ended',
            severity: 'medium',
        });
    }

    // Check for red card conflicts
    const redCardEvents = existingEvents.filter(
        e =>
            e.type === 'RED_CARD' &&
            e.playerId === newEvent.playerId &&
            e.minute < newEvent.minute
    );

    if (redCardEvents.length > 0 && newEvent.playerId) {
        conflicts.push({
            type: 'PLAYER_SENT_OFF',
            description: 'Player was sent off before this event',
            severity: 'high',
        });
    }

    return conflicts;
}

/**
 * Resolve conflicts based on strategy
 */
function resolveConflicts(
    conflicts: Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' }>,
    newEvent: any,
    timestamp: number
): {
    shouldInsert: boolean;
    strategy: string;
    reason: string;
} {
    // High severity conflicts - reject
    const highSeverity = conflicts.filter(c => c.severity === 'high');
    if (highSeverity.length > 0) {
        return {
            shouldInsert: false,
            strategy: 'REJECT',
            reason: `High severity conflicts: ${highSeverity.map(c => c.type).join(', ')}`,
        };
    }

    // Medium severity conflicts - timestamp-based resolution
    const mediumSeverity = conflicts.filter(c => c.severity === 'medium');
    if (mediumSeverity.length > 0) {
        // Earlier timestamp wins
        return {
            shouldInsert: true,
            strategy: 'TIMESTAMP_BASED',
            reason: 'Accepting event with earlier timestamp',
        };
    }

    // Low severity conflicts - accept
    return {
        shouldInsert: true,
        strategy: 'ACCEPT',
        reason: 'No critical conflicts detected',
    };
}
