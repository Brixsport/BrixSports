/**
 * Match Event Notification API
 * POST /api/notifications/match-event - Send push notifications for match events
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendMatchEventNotification } from '@/lib/notifications/match-notification-service';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            matchId,
            homeTeamId,
            awayTeamId,
            eventType,
            playerName,
            teamName,
            minute,
            homeScore,
            awayScore,
        } = body;

        // Validate required fields
        if (!matchId || !homeTeamId || !awayTeamId || !eventType) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Validate event type
        const validEventTypes = [
            'MATCH_START',
            'GOAL',
            'RED_CARD',
            'YELLOW_CARD',
            'LINEUP_AVAILABLE',
            'MATCH_END',
            'HALF_TIME',
        ];

        if (!validEventTypes.includes(eventType)) {
            return NextResponse.json(
                { error: 'Invalid event type' },
                { status: 400 }
            );
        }

        console.log('[MatchEventNotification] Sending notification:', {
            matchId,
            eventType,
            playerName,
            teamName,
        });

        // Send notification to followers
        const result = await sendMatchEventNotification({
            matchId,
            homeTeamId,
            awayTeamId,
            eventType,
            playerName,
            teamName,
            minute,
            homeScore,
            awayScore,
        });

        return NextResponse.json({
            success: result.success,
            sentCount: result.sentCount,
            totalSubscriptions: result.totalSubscriptions,
            errors: result.errors,
        });
    } catch (error) {
        console.error('[MatchEventNotification] Error:', error);
        return NextResponse.json(
            { error: 'Failed to send notification' },
            { status: 500 }
        );
    }
}
