import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { news } from '@/db/schema';
import { eq, ne, or, and, like, desc } from 'drizzle-orm';

// GET /api/news/[id]/related - Get related articles
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '5', 10) || 5), 100);

        // Get the current article
        const currentArticle = await db
            .select()
            .from(news)
            .where(or(eq(news.id, id), eq(news.slug, id)))
            .limit(1);

        if (!currentArticle || currentArticle.length === 0) {
            return NextResponse.json(
                { error: 'Article not found' },
                { status: 404 }
            );
        }

        const article = currentArticle[0];

        // Find related articles based on:
        // 1. Same category
        // 2. Similar tags
        // 3. Same author
        // 4. Published status

        const relatedArticles = await db
            .select()
            .from(news)
            .where(
                and(
                    ne(news.id, article.id),
                    eq(news.status, 'published'),
                    or(
                        eq(news.category, article.category),
                        // If article has tags, find articles with similar tags
                        article.tags ? like(news.tags, `%${JSON.parse(article.tags)[0]}%`) : undefined
                    )
                )
            )
            .orderBy(desc(news.publishedAt))
            .limit(limit);

        return NextResponse.json({
            related: relatedArticles,
            total: relatedArticles.length,
        });
    } catch (error) {
        console.error('[Related Articles API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch related articles' },
            { status: 500 }
        );
    }
}
