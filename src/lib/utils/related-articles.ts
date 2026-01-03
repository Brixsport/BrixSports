/**
 * Related articles algorithm
 * Finds similar articles based on category, tags, and content similarity
 */

export interface Article {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    category: string;
    tags: string | null;
    views: number;
    likes: number;
    publishedAt: string | null;
}

export interface RelatedArticle extends Article {
    relevanceScore: number;
}

/**
 * Calculate similarity score between two articles
 */
function calculateSimilarityScore(
    article1: Article,
    article2: Article
): number {
    let score = 0;

    // Same category: +50 points
    if (article1.category === article2.category) {
        score += 50;
    }

    // Shared tags: +10 points per tag
    const tags1 = article1.tags ? JSON.parse(article1.tags) : [];
    const tags2 = article2.tags ? JSON.parse(article2.tags) : [];
    const sharedTags = tags1.filter((tag: string) => tags2.includes(tag));
    score += sharedTags.length * 10;

    // Content similarity (simple keyword matching)
    const keywords1 = extractSimpleKeywords(article1.content);
    const keywords2 = extractSimpleKeywords(article2.content);
    const sharedKeywords = keywords1.filter(kw => keywords2.includes(kw));
    score += sharedKeywords.length * 2;

    // Title similarity (word overlap)
    const titleWords1 = article1.title.toLowerCase().split(/\s+/);
    const titleWords2 = article2.title.toLowerCase().split(/\s+/);
    const sharedTitleWords = titleWords1.filter(word =>
        titleWords2.includes(word) && word.length > 3
    );
    score += sharedTitleWords.length * 5;

    // Popularity bonus (views and likes)
    const popularityScore = Math.log10(article2.views + 1) + Math.log10(article2.likes + 1);
    score += popularityScore;

    // Recency bonus (newer articles get slight boost)
    if (article2.publishedAt) {
        const daysOld = (Date.now() - new Date(article2.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysOld < 7) score += 5;
        else if (daysOld < 30) score += 2;
    }

    return score;
}

/**
 * Extract simple keywords from content
 */
function extractSimpleKeywords(content: string): string[] {
    // Strip HTML
    const plainText = content.replace(/<[^>]*>/g, '').toLowerCase();

    // Common stop words
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would'
    ]);

    // Extract words longer than 4 characters
    return plainText
        .split(/\s+/)
        .filter(word => word.length > 4 && !stopWords.has(word))
        .slice(0, 20); // Top 20 keywords
}

/**
 * Find related articles
 * @param currentArticle - The article to find related content for
 * @param allArticles - Pool of articles to search from
 * @param limit - Maximum number of related articles to return (default: 5)
 */
export function findRelatedArticles(
    currentArticle: Article,
    allArticles: Article[],
    limit: number = 5
): RelatedArticle[] {
    // Filter out the current article
    const candidates = allArticles.filter(article => article.id !== currentArticle.id);

    // Calculate relevance scores
    const scoredArticles: RelatedArticle[] = candidates.map(article => ({
        ...article,
        relevanceScore: calculateSimilarityScore(currentArticle, article),
    }));

    // Sort by relevance score (descending) and return top results
    return scoredArticles
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
}

/**
 * Find trending articles
 * @param articles - Pool of articles
 * @param limit - Maximum number of trending articles (default: 5)
 * @param timeWindow - Time window in days (default: 7)
 */
export function findTrendingArticles(
    articles: Article[],
    limit: number = 5,
    timeWindow: number = 7
): Article[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeWindow);

    // Filter recent articles
    const recentArticles = articles.filter(article => {
        if (!article.publishedAt) return false;
        return new Date(article.publishedAt) >= cutoffDate;
    });

    // Calculate trending score (views + likes * 2)
    const scoredArticles = recentArticles.map(article => ({
        ...article,
        trendingScore: article.views + (article.likes * 2),
    }));

    // Sort by trending score and return top results
    return scoredArticles
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, limit);
}

/**
 * Find popular articles by category
 * @param articles - Pool of articles
 * @param category - Category to filter by
 * @param limit - Maximum number of articles (default: 5)
 */
export function findPopularByCategory(
    articles: Article[],
    category: string,
    limit: number = 5
): Article[] {
    const categoryArticles = articles.filter(article => article.category === category);

    return categoryArticles
        .sort((a, b) => {
            const scoreA = a.views + (a.likes * 2);
            const scoreB = b.views + (b.likes * 2);
            return scoreB - scoreA;
        })
        .slice(0, limit);
}

/**
 * Find articles by tag
 * @param articles - Pool of articles
 * @param tag - Tag to search for
 * @param limit - Maximum number of articles (default: 10)
 */
export function findArticlesByTag(
    articles: Article[],
    tag: string,
    limit: number = 10
): Article[] {
    const tagLower = tag.toLowerCase();

    const matchingArticles = articles.filter(article => {
        if (!article.tags) return false;
        const tags = JSON.parse(article.tags);
        return tags.some((t: string) => t.toLowerCase() === tagLower);
    });

    return matchingArticles
        .sort((a, b) => {
            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return dateB - dateA;
        })
        .slice(0, limit);
}

/**
 * Get article recommendations for a user based on their reading history
 * @param readArticles - Articles the user has read
 * @param allArticles - Pool of all articles
 * @param limit - Maximum number of recommendations (default: 10)
 */
export function getPersonalizedRecommendations(
    readArticles: Article[],
    allArticles: Article[],
    limit: number = 10
): Article[] {
    if (readArticles.length === 0) {
        // If no reading history, return trending articles
        return findTrendingArticles(allArticles, limit);
    }

    // Extract user preferences from reading history
    const categoryPreferences = new Map<string, number>();
    const tagPreferences = new Map<string, number>();

    readArticles.forEach(article => {
        // Count category preferences
        categoryPreferences.set(
            article.category,
            (categoryPreferences.get(article.category) || 0) + 1
        );

        // Count tag preferences
        if (article.tags) {
            const tags = JSON.parse(article.tags);
            tags.forEach((tag: string) => {
                tagPreferences.set(tag, (tagPreferences.get(tag) || 0) + 1);
            });
        }
    });

    // Filter out already read articles
    const readIds = new Set(readArticles.map(a => a.id));
    const candidates = allArticles.filter(article => !readIds.has(article.id));

    // Score candidates based on user preferences
    const scoredArticles = candidates.map(article => {
        let score = 0;

        // Category match
        const categoryScore = categoryPreferences.get(article.category) || 0;
        score += categoryScore * 20;

        // Tag matches
        if (article.tags) {
            const tags = JSON.parse(article.tags);
            tags.forEach((tag: string) => {
                const tagScore = tagPreferences.get(tag) || 0;
                score += tagScore * 10;
            });
        }

        // Popularity bonus
        score += Math.log10(article.views + 1) + Math.log10(article.likes + 1);

        return { ...article, recommendationScore: score };
    });

    return scoredArticles
        .sort((a, b) => b.recommendationScore - a.recommendationScore)
        .slice(0, limit);
}
