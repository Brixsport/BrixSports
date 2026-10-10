import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsLikes } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getAuthUser, resolveEffectiveUserId } from '@/lib/auth';

// POST /api/news/[id]/like - Toggle like on news article
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        // Session identity only -- any userId in the body is ignored.
        const userId = await resolveEffectiveUserId(authUser);

        const { id } = await params;

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
// The like count is public; `isLiked` is only resolved for an authenticated
// session (anonymous readers always get isLiked: false). No userId param is read.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Get total like count
        const likeCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(newsLikes)
            .where(eq(newsLikes.newsId, id));

        const count = likeCount[0]?.count || 0;

        // Check if current (session) user liked
        let isLiked = false;
        const authUser = await getAuthUser(request);
        if (authUser) {
            const userId = await resolveEffectiveUserId(authUser);
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
