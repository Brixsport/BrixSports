import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

// GET /api/matches/[id]/livestream - Get livestream info
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: matchId } = await params;

        const match = await db.query.matches.findFirst({
            where: eq(matches.id, matchId),
            columns: {
                id: true,
                livestreamUrl: true,
                livestreamType: true,
                livestreamEnabled: true,
                livestreamStartTime: true,
                livestreamEndTime: true,
                livestreamViewers: true,
                livestreamChatEnabled: true,
                livestreamChatUrl: true,
                status: true,
            }
        });

        if (!match) {
            return NextResponse.json(
                { error: 'Match not found' },
                { status: 404 }
            );
        }

        // Check if livestream is currently active
        const now = new Date();
        const isActive = match.livestreamEnabled &&
            match.livestreamUrl &&
            (!match.livestreamStartTime || new Date(match.livestreamStartTime) <= now) &&
            (!match.livestreamEndTime || new Date(match.livestreamEndTime) >= now);

        return NextResponse.json({
            ...match,
            isActive,
            livestreamStartTime: match.livestreamStartTime ? new Date(match.livestreamStartTime).toISOString() : null,
            livestreamEndTime: match.livestreamEndTime ? new Date(match.livestreamEndTime).toISOString() : null,
        });
    } catch (error) {
        console.error('Error fetching livestream:', error);
        return NextResponse.json(
            { error: 'Failed to fetch livestream information' },
            { status: 500 }
        );
    }
}

// PATCH /api/matches/[id]/livestream - Update livestream settings (Admin only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: matchId } = await params;
        const body = await request.json();

        // Admin authentication check
        const token = request.cookies.get('authToken')?.value;

        if (!token) {
            return NextResponse.json(
                { error: 'Unauthorized - No authentication token' },
                { status: 401 }
            );
        }

        try {
            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET || 'your-secret-key-change-in-production'
            ) as { id: string; email: string; role: string };

            if (decoded.role !== 'admin') {
                return NextResponse.json(
                    { error: 'Forbidden - Admin access required' },
                    { status: 403 }
                );
            }
        } catch (error) {
            return NextResponse.json(
                { error: 'Unauthorized - Invalid token' },
                { status: 401 }
            );
        }

        const {
            livestreamUrl,
            livestreamType,
            livestreamEnabled,
            livestreamStartTime,
            livestreamEndTime,
            livestreamChatEnabled,
            livestreamChatUrl,
        } = body;

        // Validate livestream type
        const validTypes = ['youtube', 'twitch', 'facebook', 'hls', 'dash', 'custom'];
        if (livestreamType && !validTypes.includes(livestreamType)) {
            return NextResponse.json(
                { error: 'Invalid livestream type' },
                { status: 400 }
            );
        }

        // Validate URL format
        if (livestreamUrl && !isValidUrl(livestreamUrl)) {
            return NextResponse.json(
                { error: 'Invalid livestream URL' },
                { status: 400 }
            );
        }

        // Update match
        const updateData: any = {
            updatedAt: new Date(),
        };

        if (livestreamUrl !== undefined) updateData.livestreamUrl = livestreamUrl;
        if (livestreamType !== undefined) updateData.livestreamType = livestreamType;
        if (livestreamEnabled !== undefined) updateData.livestreamEnabled = livestreamEnabled;
        if (livestreamStartTime !== undefined) updateData.livestreamStartTime = livestreamStartTime ? new Date(livestreamStartTime) : null;
        if (livestreamEndTime !== undefined) updateData.livestreamEndTime = livestreamEndTime ? new Date(livestreamEndTime) : null;
        if (livestreamChatEnabled !== undefined) updateData.livestreamChatEnabled = livestreamChatEnabled;
        if (livestreamChatUrl !== undefined) updateData.livestreamChatUrl = livestreamChatUrl;

        await db.update(matches)
            .set(updateData)
            .where(eq(matches.id, matchId));

        const updatedMatch = await db.query.matches.findFirst({
            where: eq(matches.id, matchId),
            columns: {
                id: true,
                livestreamUrl: true,
                livestreamType: true,
                livestreamEnabled: true,
                livestreamStartTime: true,
                livestreamEndTime: true,
                livestreamViewers: true,
                livestreamChatEnabled: true,
                livestreamChatUrl: true,
            }
        });

        return NextResponse.json({
            message: 'Livestream settings updated successfully',
            livestream: updatedMatch
        });
    } catch (error) {
        console.error('Error updating livestream:', error);
        return NextResponse.json(
            { error: 'Failed to update livestream settings' },
            { status: 500 }
        );
    }
}

// Helper function to validate URLs
function isValidUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}
