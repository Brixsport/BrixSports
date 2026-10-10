import type { Metadata } from 'next';
import { Suspense } from 'react';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/db';
import { players, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateAthleteSchema } from '@/lib/utils/aeo';
import PlayerDetailClient from './PlayerDetailClient';

// BACKLOG-189: same fix as matches/[id] -- thin server wrapper for real
// per-player metadata, original UI unchanged.
// BACKLOG-403: same crash-on-transient-DB-error fix as matches/[id] -- this
// is an SEO enhancement path, PlayerDetailClient does its own independent
// fetching, so a DB hiccup here degrades to generic metadata instead of a
// hard 500 for the whole page.
async function getPlayer(id: string) {
    try {
        const [player] = await db.select().from(players).where(eq(players.id, id)).limit(1);
        if (!player) return null;
        const team = player.teamId
            ? await db.select({ name: teams.name, sport: teams.sport }).from(teams).where(eq(teams.id, player.teamId)).get()
            : null;
        return { player, team };
    } catch (error) {
        console.error('getPlayer: DB error, falling back to generic metadata', error);
        Sentry.captureException(error, { tags: { area: 'player-seo-fallback' }, extra: { playerId: id } });
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const data = await getPlayer(id);
    if (!data) {
        return { title: 'Player', description: 'Player profile on BRIXSPORTS.' };
    }

    const { player, team } = data;
    const title = team ? `${player.name} — ${team.name}` : player.name;
    const description = `${player.name}${player.position ? `, ${player.position}` : ''}${team ? ` for ${team.name}` : ''} — stats, form, and match history on BRIXSPORTS.`;

    return {
        title,
        description,
        openGraph: { title, description, type: 'profile' },
        twitter: { card: 'summary', title, description },
    };
}

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getPlayer(id);

    const schema = data
        ? generateAthleteSchema({
            name: data.player.name,
            position: data.player.position ?? undefined,
            jerseyNumber: data.player.number ? String(data.player.number) : undefined,
            team: data.team?.name,
            sport: data.team?.sport,
            nationality: data.player.nationality ?? undefined,
            url: `https://brixsports.com/players/${id}`,
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
            <Suspense
                fallback={
                    <div className="min-h-screen bg-background flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                    </div>
                }
            >
                <PlayerDetailClient />
            </Suspense>
        </>
    );
}
