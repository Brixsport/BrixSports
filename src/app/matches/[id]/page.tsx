import type { Metadata } from 'next';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/db';
import { matches, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateSportsEventSchema } from '@/lib/utils/aeo';
import MatchDetailClient from './MatchDetailClient';

// BACKLOG-189: this page was a 'use client' component with no generateMetadata
// export (client components can't export one in App Router), so every match
// page inherited the exact same generic root-layout title/description/OG image
// regardless of which two teams were actually playing. This thin server wrapper
// fetches just enough for real per-match metadata + JSON-LD, then renders the
// original (unchanged, just relocated) client component for the actual UI.
//
// BACKLOG-403: this DB call had zero try/catch -- a direct violation of
// "All DB operations must be wrapped in try/catch" rule, on a
// Critical Flow C page. Any transient Turso hiccup threw straight up into
// error.tsx, hard-crashing the ENTIRE page (including the client component's
// own, much more resilient rendering) for what is only an SEO enhancement.
// This is purely an enhancement path -- MatchDetailClient does its own
// independent data fetching and doesn't depend on this succeeding -- so a
// failure here degrades to generic metadata instead of taking the page down.
async function getMatchSeoData(id: string) {
    try {
        const [match] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
        if (!match) return null;

        const [homeTeam, awayTeam] = await Promise.all([
            db.select({ name: teams.name, logo: teams.logo }).from(teams).where(eq(teams.id, match.homeTeamId)).get(),
            db.select({ name: teams.name, logo: teams.logo }).from(teams).where(eq(teams.id, match.awayTeamId)).get(),
        ]);

        return { match, homeTeam, awayTeam };
    } catch (error) {
        console.error('getMatchSeoData: DB error, falling back to generic metadata', error);
        Sentry.captureException(error, { tags: { area: 'match-seo-fallback' }, extra: { matchId: id } });
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const data = await getMatchSeoData(id);
    if (!data || !data.homeTeam || !data.awayTeam) {
        return { title: 'Match', description: 'Live match coverage on BRIXSPORTS.' };
    }

    const { match, homeTeam, awayTeam } = data;
    const title = `${homeTeam.name} vs ${awayTeam.name}`;
    const scoreLine = match.status === 'FINISHED' || match.status === 'LIVE'
        ? ` ${match.homeScore ?? 0}-${match.awayScore ?? 0}`
        : '';
    const description = `${title}${scoreLine} — ${match.competition}. Live scores, stats, and match events on BRIXSPORTS.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'article',
            images: homeTeam.logo ? [homeTeam.logo] : undefined,
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
    };
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getMatchSeoData(id);

    const schema = data && data.homeTeam && data.awayTeam
        ? generateSportsEventSchema({
            name: `${data.homeTeam.name} vs ${data.awayTeam.name}`,
            description: `${data.match.competition} match between ${data.homeTeam.name} and ${data.awayTeam.name}`,
            startDate: data.match.startTime,
            sport: data.match.sport,
            location: { name: data.match.venue },
            homeTeam: { name: data.homeTeam.name, logo: data.homeTeam.logo ?? undefined },
            awayTeam: { name: data.awayTeam.name, logo: data.awayTeam.logo ?? undefined },
            url: `https://brixsports.com/matches/${id}`,
        })
        : null;

    return (
        <>
            {schema && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
                />
            )}
            <MatchDetailClient />
        </>
    );
}
