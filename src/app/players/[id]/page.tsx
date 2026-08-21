import type { Metadata } from 'next';
import { db } from '@/db';
import { players, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateAthleteSchema } from '@/lib/utils/aeo';
import PlayerDetailClient from './PlayerDetailClient';

// BACKLOG-189: same fix as matches/[id] -- thin server wrapper for real
// per-player metadata, original UI unchanged.
async function getPlayer(id: string) {
    const [player] = await db.select().from(players).where(eq(players.id, id)).limit(1);
    if (!player) return null;
    const team = player.teamId
        ? await db.select({ name: teams.name, sport: teams.sport }).from(teams).where(eq(teams.id, player.teamId)).get()
        : null;
    return { player, team };
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
            <PlayerDetailClient />
        </>
    );
}
