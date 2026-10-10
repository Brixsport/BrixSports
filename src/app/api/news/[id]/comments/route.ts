import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { newsComments, news } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getAuthUser, resolveEffectiveUserId } from '@/lib/auth';

// GET /api/news/[id]/comments - Get all comments for a news article
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: slug } = await params;
        const { searchParams } = new URL(request.url);
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50), 100);
        const offset = parseInt(searchParams.get('offset') || '0');

        // Look up the news article by slug to get the actual ID
        const article = await db
            .select({ id: news.id })
            .from(news)
            .where(eq(news.slug, slug))
            .limit(1);

        if (article.length === 0) {
            return NextResponse.json(
                { error: 'Article not found' },
                { status: 404 }
            );
        }

        const newsId = article[0].id;

        // Get comments with pagination
        const comments = await db
            .select()
            .from(newsComments)
            .where(eq(newsComments.newsId, newsId))
            .orderBy(desc(newsComments.createdAt))
            .limit(limit)
            .offset(offset);

        // Get total count
        const totalCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(newsComments)
            .where(eq(newsComments.newsId, newsId));

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
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        // Identity and display name come from the session -- any userId/userName
        // in the body is ignored.
        const userId = await resolveEffectiveUserId(authUser);
        const userName = authUser.name || authUser.email;

        const { id: slug } = await params;
        const body = await request.json();
        const { content } = body;

        if (!content || typeof content !== 'string') {
            return NextResponse.json(
                { error: 'Content is required' },
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

        // Look up the news article by slug to get the actual ID
        const article = await db
            .select({ id: news.id })
            .from(news)
            .where(eq(news.slug, slug))
            .limit(1);

        if (article.length === 0) {
            return NextResponse.json(
                { error: 'Article not found' },
                { status: 404 }
            );
        }

        const newsId = article[0].id;

        // Create comment
        const newComment = await db
            .insert(newsComments)
            .values({
                id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                newsId,
                userId,
                userName,
                content: content.trim(),
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
