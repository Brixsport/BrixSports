import type { MetadataRoute } from 'next';

/**
 * Dynamic sitemap.xml generator for Brixsport
 * Includes all public pages and dynamic routes
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://brixsports.com';

    // Static pages with their priorities and change frequencies
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${baseUrl}/news`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/competitions`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/matches`,
            lastModified: new Date(),
            changeFrequency: 'hourly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/teams`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/players`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/live`,
            lastModified: new Date(),
            changeFrequency: 'always',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/livestream`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/stats`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/predictions`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/fpl`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/football`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/basketball`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/search`,
            lastModified: new Date(),
            changeFrequency: 'always',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/docs`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
    ];

    // Note: Dynamic routes (news articles, specific matches, teams, players) 
    // would be fetched from the database in a production implementation.
    // For now, we're including the main listing pages above.
    
    // Example of how to add dynamic routes when DB is available:
    // const newsArticles = await fetchNewsArticles();
    // const newsUrls = newsArticles.map(article => ({
    //     url: `${baseUrl}/news/${article.slug}`,
    //     lastModified: article.updatedAt || article.publishedAt,
    //     changeFrequency: 'weekly' as const,
    //     priority: 0.7,
    // }));
    
    // const competitions = await fetchCompetitions();
    // const competitionUrls = competitions.map(comp => ({
    //     url: `${baseUrl}/competitions/${comp.id}`,
    //     lastModified: comp.updatedAt,
    //     changeFrequency: 'daily' as const,
    //     priority: 0.8,
    // }));

    return [...staticPages];
}
