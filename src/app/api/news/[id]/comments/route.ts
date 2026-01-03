import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsComments } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

// GET /api/news/[id]/comments - Get all comments for a news article
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Get comments with pagination
        const comments = await db
            .select()
            .from(newsComments)
            .where(eq(newsComments.newsId, id))
            .orderBy(desc(newsComments.createdAt))
            .limit(limit)
            .offset(offset);

        // Get total count
        const totalCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(newsComments)
            .where(eq(newsComments.newsId, id));

        return NextResponse.json({
            comments,
            total: totalCount[0]?.count || 0,
            limit,
            offset,
        });
    } catch (error) {
        console.error('[News Comments API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch comments' },
            { status: 500 }
        );
    }
}

// POST /api/news/[id]/comments - Add a comment to a news article
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { userId, userName, content } = body;

        if (!userId || !userName || !content) {
            return NextResponse.json(
                { error: 'User ID, name, and content are required' },
                { status: 400 }
            );
        }

        if (content.trim().length === 0) {
            return NextResponse.json(
                { error: 'Comment cannot be empty' },
                { status: 400 }
            );
        }

        if (content.length > 1000) {
            return NextResponse.json(
                { error: 'Comment is too long (max 1000 characters)' },
                { status: 400 }
            );
        }

        // Create comment
        const newComment = await db
            .insert(newsComments)
            .values({
                id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                newsId: id,
                userId,
                userName,
                content: content.trim(),
                createdAt: new Date(),
            })
            .returning();

        return NextResponse.json({
            success: true,
            comment: newComment[0],
        });
    } catch (error) {
        console.error('[News Comments API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create comment' },
            { status: 500 }
        );
    }
}
