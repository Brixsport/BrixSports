import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { news, newsRelations, newsLikes } from '@/db/schema';
import { eq, desc, and, like, or, sql } from 'drizzle-orm';

// GET /api/news - Get all news articles with filters
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const category = searchParams.get('category');
        const tag = searchParams.get('tag');
        const search = searchParams.get('search');
        const featured = searchParams.get('featured');
        const breaking = searchParams.get('breaking');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');
        const status = searchParams.get('status') || 'published'; // Only show published by default

        // Build query conditions
        const conditions = [];

        // Status filter (admin can see drafts)
        conditions.push(eq(news.status, status));

        if (category) {
            conditions.push(eq(news.category, category));
        }

        if (featured === 'true') {
            conditions.push(eq(news.isFeatured, true));
        }

        if (breaking === 'true') {
            conditions.push(eq(news.isBreaking, true));
        }

        if (search) {
            conditions.push(
                or(
                    like(news.title, `%${search}%`),
                    like(news.content, `%${search}%`),
                    like(news.excerpt, `%${search}%`)
                )
            );
        }

        // Fetch news articles
        const newsArticles = await db
            .select()
            .from(news)
            .where(and(...conditions))
            .orderBy(desc(news.publishedAt), desc(news.createdAt))
            .limit(limit)
            .offset(offset);

        // Get total count
        const totalCount = await db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(news)
            .where(and(...conditions));

        return NextResponse.json({
            news: newsArticles,
            pagination: {
                total: totalCount[0]?.count || 0,
                limit,
                offset,
                hasMore: (offset + limit) < (totalCount[0]?.count || 0),
            },
        });
    } catch (error) {
        console.error('[News API] Error fetching news:', error);
        return NextResponse.json(
            { error: 'Failed to fetch news articles', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

// POST /api/news - Create new news article (Admin only)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            title,
            content,
            excerpt,
            imageUrl,
            category,
            tags,
            isBreaking,
            isFeatured,
            authorId,
            authorName,
            sendPushNotification,
            status,
        } = body;

        // Validate required fields
        if (!title || !content || !category || !authorId) {
            return NextResponse.json(
                { error: 'Missing required fields: title, content, category, authorId' },
                { status: 400 }
            );
        }

        // Generate slug from title
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') + '-' + Date.now();

        // Create news article
        const newsId = `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newNews = await db.insert(news).values({
            id: newsId,
            title,
            slug,
            content,
            excerpt: excerpt || content.substring(0, 200) + '...',
            imageUrl: imageUrl || null,
            category,
            tags: tags ? JSON.stringify(tags) : null,
            isBreaking: isBreaking || false,
            isFeatured: isFeatured || false,
            authorId,
            authorName: authorName || 'Admin',
            sendPushNotification: sendPushNotification || false,
            status: status || 'draft',
            publishedAt: status === 'published' ? new Date() : null,
        }).returning();

        // If sendPushNotification is true and status is published, trigger notification
        if (sendPushNotification && status === 'published') {
            // Send push notification asynchronously
            fetch(`${request.nextUrl.origin}/api/notifications/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'news',
                    newsId,
                    title: isBreaking ? `🚨 BREAKING: ${title}` : title,
                    body: excerpt || content.substring(0, 100),
                    icon: imageUrl,
                    url: `/news/${slug}`,
                }),
            }).catch(err => console.error('Failed to send push notification:', err));

            // Update notification sent status
            await db.update(news)
                .set({
                    pushNotificationSent: true,
                    pushNotificationSentAt: new Date(),
                })
                .where(eq(news.id, newsId));
        }

        return NextResponse.json({
            success: true,
            news: newNews[0],
        }, { status: 201 });
    } catch (error) {
        console.error('[News API] Error creating news:', error);
        return NextResponse.json(
            { error: 'Failed to create news article', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
