import type { Metadata } from 'next';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateSportsTeamSchema } from '@/lib/utils/aeo';
import TeamDetailClient from './TeamDetailClient';

// BACKLOG-189: same fix as matches/[id] -- thin server wrapper for real
// per-team metadata, original UI unchanged.
// BACKLOG-403: same crash-on-transient-DB-error fix as matches/[id] -- SEO
// enhancement path only, TeamDetailClient does its own independent fetching.
async function getTeam(id: string) {
    try {
        const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
        return team ?? null;
    } catch (error) {
        console.error('getTeam: DB error, falling back to generic metadata', error);
        Sentry.captureException(error, { tags: { area: 'team-seo-fallback' }, extra: { teamId: id } });
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const team = await getTeam(id);
    if (!team) {
        return { title: 'Team', description: 'Team profile on BRIXSPORTS.' };
    }

    const title = `${team.name} — ${team.sport}`;
    const description = `${team.name} (${team.university}) — squad, fixtures, results, and standings on BRIXSPORTS.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            images: team.logo ? [team.logo] : undefined,
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
    };
}

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const team = await getTeam(id);

    const schema = team
        ? generateSportsTeamSchema({
            name: team.name,
            sport: team.sport,
            logo: team.logo ?? undefined,
            description: `${team.name} representing ${team.university}`,
            homeLocation: { name: team.university },
            url: `https://brixsports.com/teams/${id}`,
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
            <TeamDetailClient />
        </>
    );
}
