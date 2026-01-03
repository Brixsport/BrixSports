import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pollComments, pollCommentLikes, users } from '@/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// GET /api/polls/comments?pollId=xxx - Get comments for a poll
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const pollId = searchParams.get('pollId');

        if (!pollId) {
            return NextResponse.json({ error: 'pollId is required' }, { status: 400 });
        }

        // Get all comments for the poll (top-level only)
        const topLevelComments = await db
            .select({
                comment: pollComments,
                user: {
                    id: users.id,
                    name: users.name,
                    avatar: users.avatar,
                },
            })
            .from(pollComments)
            .leftJoin(users, eq(pollComments.userId, users.id))
            .where(and(
                eq(pollComments.pollId, pollId),
                isNull(pollComments.parentId)
            ))
            .orderBy(desc(pollComments.createdAt));

        // Get replies for each comment
        const commentsWithReplies = await Promise.all(
            topLevelComments.map(async ({ comment, user }) => {
                const replies = await db
                    .select({
                        comment: pollComments,
                        user: {
                            id: users.id,
                            name: users.name,
                            avatar: users.avatar,
                        },
                    })
                    .from(pollComments)
                    .leftJoin(users, eq(pollComments.userId, users.id))
                    .where(eq(pollComments.parentId, comment.id))
                    .orderBy(pollComments.createdAt);

                return {
                    ...comment,
                    user,
                    replies: replies.map(r => ({ ...r.comment, user: r.user })),
                };
            })
        );

        return NextResponse.json(commentsWithReplies);
    } catch (error) {
        console.error('Error fetching comments:', error);
        return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }
}

// POST /api/polls/comments - Add a comment
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pollId, userId, content, parentId } = body;

        if (!pollId || !userId || !content) {
            return NextResponse.json(
                { error: 'pollId, userId, and content are required' },
                { status: 400 }
            );
        }

        if (content.trim().length === 0) {
            return NextResponse.json(
                { error: 'Comment cannot be empty' },
                { status: 400 }
            );
        }

        const commentId = nanoid();
        const newComment = {
            id: commentId,
            pollId,
            userId,
            content: content.trim(),
            parentId: parentId || null,
            likes: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.insert(pollComments).values(newComment);

        // Get user info for response
        const user = await db.select().from(users).where(eq(users.id, userId)).get();

        return NextResponse.json({
            ...newComment,
            user: {
                id: user?.id,
                name: user?.name,
                avatar: user?.avatar,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating comment:', error);
        return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }
}

// DELETE /api/polls/comments - Delete a comment
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const commentId = searchParams.get('commentId');
        const userId = searchParams.get('userId');

        if (!commentId || !userId) {
            return NextResponse.json(
                { error: 'commentId and userId are required' },
                { status: 400 }
            );
        }

        // Verify comment belongs to user
        const comment = await db
            .select()
            .from(pollComments)
            .where(eq(pollComments.id, commentId))
            .get();

        if (!comment) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }

        if (comment.userId !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        await db.delete(pollComments).where(eq(pollComments.id, commentId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting comment:', error);
        return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }
}
