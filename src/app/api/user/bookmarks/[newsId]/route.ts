import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userBookmarks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser, resolveEffectiveUserId } from '@/lib/auth';

// DELETE /api/user/bookmarks/[newsId] - Remove a bookmark
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ newsId: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        // Session identity only -- any userId query param is ignored.
        const userId = await resolveEffectiveUserId(authUser);
        const { newsId } = await params;

        // Delete bookmark
        const deleted = await db
            .delete(userBookmarks)
            .where(
                and(
                    eq(userBookmarks.userId, userId),
                    eq(userBookmarks.newsId, newsId)
                )
            )
            .returning();

        if (!deleted || deleted.length === 0) {
            return NextResponse.json(
                { error: 'Bookmark not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Bookmark removed',
        });
    } catch (error) {
        console.error('[User Bookmarks API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to remove bookmark' },
            { status: 500 }
        );
    }
}

// GET /api/user/bookmarks/[newsId] - Check if news is bookmarked
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ newsId: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        const userId = await resolveEffectiveUserId(authUser);
        const { newsId } = await params;

        // Check if bookmarked
        const bookmark = await db
            .select()
            .from(userBookmarks)
            .where(
                and(
                    eq(userBookmarks.userId, userId),
                    eq(userBookmarks.newsId, newsId)
                )
            )
            .limit(1);

        return NextResponse.json({
            isBookmarked: bookmark && bookmark.length > 0,
        });
    } catch (error) {
        console.error('[User Bookmarks API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to check bookmark status' },
            { status: 500 }
        );
    }
}
