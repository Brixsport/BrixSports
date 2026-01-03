import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pollComments, pollCommentLikes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// POST /api/polls/comments/like - Like/unlike a comment
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { commentId, userId } = body;

        if (!commentId || !userId) {
            return NextResponse.json(
                { error: 'commentId and userId are required' },
                { status: 400 }
            );
        }

        // Check if already liked
        const existingLike = await db
            .select()
            .from(pollCommentLikes)
            .where(and(
                eq(pollCommentLikes.commentId, commentId),
                eq(pollCommentLikes.userId, userId)
            ))
            .get();

        if (existingLike) {
            // Unlike - remove like
            await db
                .delete(pollCommentLikes)
                .where(eq(pollCommentLikes.id, existingLike.id));

            // Decrement like count
            const comment = await db
                .select()
                .from(pollComments)
                .where(eq(pollComments.id, commentId))
                .get();

            if (comment) {
                await db
                    .update(pollComments)
                    .set({
                        likes: Math.max(0, (comment.likes || 0) - 1),
                        updatedAt: new Date()
                    })
                    .where(eq(pollComments.id, commentId));
            }

            return NextResponse.json({
                success: true,
                liked: false,
                likes: Math.max(0, (comment?.likes || 0) - 1)
            });
        } else {
            // Like - add like
            const likeId = nanoid();
            await db.insert(pollCommentLikes).values({
                id: likeId,
                commentId,
                userId,
                createdAt: new Date(),
            });

            // Increment like count
            const comment = await db
                .select()
                .from(pollComments)
                .where(eq(pollComments.id, commentId))
                .get();

            if (comment) {
                await db
                    .update(pollComments)
                    .set({
                        likes: (comment.likes || 0) + 1,
                        updatedAt: new Date()
                    })
                    .where(eq(pollComments.id, commentId));
            }

            return NextResponse.json({
                success: true,
                liked: true,
                likes: (comment?.likes || 0) + 1
            });
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
    }
}

// GET /api/polls/comments/like?commentId=xxx&userId=xxx - Check if user liked
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const commentId = searchParams.get('commentId');
        const userId = searchParams.get('userId');

        if (!commentId || !userId) {
            return NextResponse.json({ error: 'commentId and userId are required' }, { status: 400 });
        }

        const like = await db
            .select()
            .from(pollCommentLikes)
            .where(and(
                eq(pollCommentLikes.commentId, commentId),
                eq(pollCommentLikes.userId, userId)
            ))
            .get();

        return NextResponse.json({ liked: !!like });
    } catch (error) {
        console.error('Error checking like:', error);
        return NextResponse.json({ error: 'Failed to check like' }, { status: 500 });
    }
}
