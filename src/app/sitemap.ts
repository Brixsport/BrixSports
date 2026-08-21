import type { MetadataRoute } from 'next';
import { db } from '@/db';
import { matches, teams, players, news, competitions } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Sitemap protocol caps a single file at 50,000 URLs -- these limits are a safe,
// generous ceiling for this project's actual scale (dozens-to-low-hundreds of
// rows per entity today), not an attempt to paginate a truly large dataset.
const MAX_PER_ENTITY = 2000;

// This project has a known, recurring class of bug where a timestamp column
// gets an ISO-string value written into it via raw SQL by an old backfill/seed
// script (integer-timestamp columns don't error at insert time, but corrupt the
// later Drizzle read into an Invalid Date) -- see BACKLOG.md's `BACKLOG-126`
// history. Confirmed to be exactly what crashed this route in production:
// `RangeError: Invalid time value` inside Next's own sitemap serializer, which
// calls `.toISOString()` on whatever lastModified value it's given with no
// validation of its own. One bad row must not 500 the entire sitemap.
function safeDate(value: Date | null | undefined): Date {
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    return new Date();
}

// This file now does live DB queries (previously pure static data) -- without
// this, Next.js may try to execute it at BUILD time to statically generate
// sitemap.xml, which needs a reachable DB in the build environment. Forcing
// request-time rendering also means the sitemap always reflects live data
// rather than a stale build-time snapshot, which is the correct behavior for
// a sports platform where matches/teams/news change constantly.
export const dynamic = 'force-dynamic';

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
        // {
        //     url: `${baseUrl}/predictions`,
        //     lastModified: new Date(),
        //     changeFrequency: 'daily',
        //     priority: 0.7,
        // },
        // {
        //     url: `${baseUrl}/fpl`,
        //     lastModified: new Date(),
        //     changeFrequency: 'weekly',
        //     priority: 0.7,
        // },
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
            url: `${baseUrl}/about`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/docs`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/llms.txt`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.3,
        },
    ];

    // Dynamic routes -- each entity page was previously entirely absent from the
    // sitemap (BACKLOG-189), meaning no individual match/team/player/news/competition
    // page was ever discoverable by a search engine. Best-effort per entity type:
    // one query failing (e.g. a transient DB blip at build time) must not blank out
    // the entire sitemap for every other entity type.
    const dynamicPages: MetadataRoute.Sitemap = [];

    try {
        const allMatches = await db
            .select({ id: matches.id, updatedAt: matches.updatedAt })
            .from(matches)
            .limit(MAX_PER_ENTITY);
        dynamicPages.push(
            ...allMatches.map((m) => ({
                url: `${baseUrl}/matches/${m.id}`,
                lastModified: safeDate(m.updatedAt),
                changeFrequency: 'hourly' as const,
                priority: 0.7,
            }))
        );
    } catch (error) {
        console.error('[sitemap] Failed to fetch matches:', error);
    }

    try {
        const allTeams = await db
            .select({ id: teams.id, createdAt: teams.createdAt })
            .from(teams)
            .limit(MAX_PER_ENTITY);
        dynamicPages.push(
            ...allTeams.map((t) => ({
                url: `${baseUrl}/teams/${t.id}`,
                lastModified: safeDate(t.createdAt),
                changeFrequency: 'weekly' as const,
                priority: 0.6,
            }))
        );
    } catch (error) {
        console.error('[sitemap] Failed to fetch teams:', error);
    }

    try {
        const allPlayers = await db
            .select({ id: players.id, createdAt: players.createdAt })
            .from(players)
            .limit(MAX_PER_ENTITY);
        dynamicPages.push(
            ...allPlayers.map((p) => ({
                url: `${baseUrl}/players/${p.id}`,
                lastModified: safeDate(p.createdAt),
                changeFrequency: 'weekly' as const,
                priority: 0.6,
            }))
        );
    } catch (error) {
        console.error('[sitemap] Failed to fetch players:', error);
    }

    try {
        const publishedNews = await db
            .select({ slug: news.slug, updatedAt: news.updatedAt, publishedAt: news.publishedAt })
            .from(news)
            .where(eq(news.status, 'published'))
            .limit(MAX_PER_ENTITY);
        dynamicPages.push(
            ...publishedNews.map((n) => ({
                url: `${baseUrl}/news/${n.slug}`,
                lastModified: safeDate(n.updatedAt ?? n.publishedAt),
                changeFrequency: 'weekly' as const,
                priority: 0.7,
            }))
        );
    } catch (error) {
        console.error('[sitemap] Failed to fetch news:', error);
    }

    try {
        const allCompetitions = await db
            .select({ id: competitions.id, updatedAt: competitions.updatedAt })
            .from(competitions)
            .limit(MAX_PER_ENTITY);
        dynamicPages.push(
            ...allCompetitions.map((c) => ({
                // The bare /competitions/[id] route just redirects here (301) --
                // pointing the sitemap straight at the canonical destination avoids
                // an unnecessary redirect hop for crawlers.
                url: `${baseUrl}/competitions/${c.id}/standings`,
                lastModified: safeDate(c.updatedAt),
                changeFrequency: 'daily' as const,
                priority: 0.8,
            }))
        );
    } catch (error) {
        console.error('[sitemap] Failed to fetch competitions:', error);
    }

    return [...staticPages, ...dynamicPages];
}
