import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { matchId, message } = body;

        if (!matchId || !message) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Forward to WebSocket server broadcast API
        const wsServerUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
        const wsApiKey = process.env.WS_API_KEY;

        if (!wsApiKey) {
            console.error('WS_API_KEY not configured for HTTP fallback');
            return NextResponse.json({ error: 'Messaging fallback not configured' }, { status: 500 });
        }

        const response = await fetch(`${wsServerUrl}/broadcast`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': wsApiKey
            },
            body: JSON.stringify({
                room: `chat:${matchId}`,
                event: 'chat:message',
                data: message
            })
        });

        if (response.ok) {
            return NextResponse.json({ success: true });
        } else {
            const error = await response.text();
            console.error('WS Broadcast failed:', error);
            return NextResponse.json({ error: 'Failed to broadcast message' }, { status: 500 });
        }
    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
