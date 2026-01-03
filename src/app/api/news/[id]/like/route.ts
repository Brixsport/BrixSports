import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsLikes } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// POST /api/news/[id]/like - Toggle like on news article
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        // Check if user already liked this article
        const existingLike = await db
            .select()
            .from(newsLikes)
            .where(
                and(
                    eq(newsLikes.newsId, id),
                    eq(newsLikes.userId, userId)
                )
            )
            .limit(1);

        if (existingLike && existingLike.length > 0) {
            // Unlike - remove the like
            await db
                .delete(newsLikes)
                .where(
                    and(
                        eq(newsLikes.newsId, id),
                        eq(newsLikes.userId, userId)
                    )
                );

            return NextResponse.json({
                success: true,
                liked: false,
                message: 'Article unliked',
            });
        } else {
            // Like - add the like
            await db.insert(newsLikes).values({
                id: `like-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                newsId: id,
                userId,
                createdAt: new Date(),
            });

            return NextResponse.json({
                success: true,
                liked: true,
                message: 'Article liked',
            });
        }
    } catch (error) {
        console.error('[News Like API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to toggle like' },
            { status: 500 }
        );
    }
}

// GET /api/news/[id]/like - Get like status and count
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        // Get total like count
        const likeCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(newsLikes)
            .where(eq(newsLikes.newsId, id));

        const count = likeCount[0]?.count || 0;

        // Check if current user liked
        let isLiked = false;
        if (userId) {
            const userLike = await db
                .select()
                .from(newsLikes)
                .where(
                    and(
                        eq(newsLikes.newsId, id),
                        eq(newsLikes.userId, userId)
                    )
                )
                .limit(1);

            isLiked = userLike && userLike.length > 0;
        }

        return NextResponse.json({
            count,
            isLiked,
        });
    } catch (error) {
        console.error('[News Like API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to get like status' },
            { status: 500 }
        );
    }
}
