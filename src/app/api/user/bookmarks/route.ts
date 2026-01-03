import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userBookmarks, news } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// GET /api/user/bookmarks - Get all bookmarked news for a user
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        // Get bookmarks with news details
        const bookmarks = await db
            .select({
                id: userBookmarks.id,
                newsId: userBookmarks.newsId,
                createdAt: userBookmarks.createdAt,
                news: news,
            })
            .from(userBookmarks)
            .leftJoin(news, eq(userBookmarks.newsId, news.id))
            .where(eq(userBookmarks.userId, userId))
            .orderBy(desc(userBookmarks.createdAt));

        return NextResponse.json({
            bookmarks,
            total: bookmarks.length,
        });
    } catch (error) {
        console.error('[User Bookmarks API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bookmarks' },
            { status: 500 }
        );
    }
}

// POST /api/user/bookmarks - Add a bookmark
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, newsId } = body;

        if (!userId || !newsId) {
            return NextResponse.json(
                { error: 'User ID and News ID are required' },
                { status: 400 }
            );
        }

        // Check if already bookmarked
        const existing = await db
            .select()
            .from(userBookmarks)
            .where(
                and(
                    eq(userBookmarks.userId, userId),
                    eq(userBookmarks.newsId, newsId)
                )
            )
            .limit(1);

        if (existing && existing.length > 0) {
            return NextResponse.json(
                { error: 'Already bookmarked' },
                { status: 400 }
            );
        }

        // Create bookmark
        const bookmark = await db
            .insert(userBookmarks)
            .values({
                id: `bookmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                userId,
                newsId,
                createdAt: new Date(),
            })
            .returning();

        return NextResponse.json({
            success: true,
            bookmark: bookmark[0],
        });
    } catch (error) {
        console.error('[User Bookmarks API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create bookmark' },
            { status: 500 }
        );
    }
}
