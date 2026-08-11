import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';
import { isAllowedLivestreamEmbedHost } from '@/lib/livestream-allowlist';

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
        // BACKLOG-168: was a hand-rolled jwt.verify() against the raw token role
        // claim -- a demoted/deactivated admin's already-issued token kept working
        // here for its full lifetime since it never re-checked the current DB row.
        // getAuthUser() re-reads the user's current role on every request, same
        // pattern used at 90+ other admin-gated call sites in this codebase.
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized - No authentication token' },
                { status: 401 }
            );
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            );
        }

        const { id: matchId } = await params;
        const body = await request.json();

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

        // BACKLOG-212 item 7: 'youtube'/'twitch'/'facebook' always embed against a
        // fixed trusted domain regardless of the pasted URL (only an ID/channel is
        // extracted). 'custom'/'hls'/'dash' pass the raw URL straight through to the
        // player's iframe src -- gate those against an explicit host allowlist so an
        // arbitrary third-party page can't be embedded to viewers. The admin UI always
        // sends both fields together, but a raw API call could update the URL alone --
        // fall back to the row's current type so the check can't be bypassed that way.
        if (livestreamUrl) {
            let effectiveType = livestreamType;
            if (effectiveType === undefined) {
                const existing = await db.query.matches.findFirst({
                    where: eq(matches.id, matchId),
                    columns: { livestreamType: true },
                });
                effectiveType = existing?.livestreamType ?? undefined;
            }
            const isPassthroughType = effectiveType === 'custom' || effectiveType === 'hls' || effectiveType === 'dash';
            if (isPassthroughType && !isAllowedLivestreamEmbedHost(livestreamUrl)) {
                return NextResponse.json(
                    { error: 'Livestream URL host is not on the approved embed list. Contact an engineer to add it.' },
                    { status: 400 }
                );
            }
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
