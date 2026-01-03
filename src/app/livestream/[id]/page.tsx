import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LivestreamView } from '@/components/livestream';

interface PageProps {
    params: {
        id: string;
    };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    // Fetch match details for metadata
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/matches/${params.id}`, {
            cache: 'no-store'
        });

        if (!response.ok) {
            return {
                title: 'Livestream - Brix Sport',
            };
        }

        const match = await response.json();
        const title = `${match.homeTeam?.name} vs ${match.awayTeam?.name} - Live`;

        return {
            title,
            description: `Watch ${match.homeTeam?.name} vs ${match.awayTeam?.name} live on Brix Sport`,
            openGraph: {
                title,
                description: `Watch ${match.homeTeam?.name} vs ${match.awayTeam?.name} live`,
                images: [match.homeTeam?.logo, match.awayTeam?.logo].filter(Boolean),
            },
        };
    } catch (error) {
        return {
            title: 'Livestream - Brix Sport',
        };
    }
}

export default async function LivestreamPage({ params }: PageProps) {
    // Fetch match and livestream data
    const matchResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/matches/${params.id}`,
        { cache: 'no-store' }
    );

    if (!matchResponse.ok) {
        notFound();
    }

    const match = await matchResponse.json();

    // Fetch livestream info
    const livestreamResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/matches/${params.id}/livestream`,
        { cache: 'no-store' }
    );

    const livestream = livestreamResponse.ok ? await livestreamResponse.json() : null;

    // If no livestream is available, redirect to match page
    if (!livestream || !livestream.isActive) {
        notFound();
    }

    return <LivestreamView match={match} livestream={livestream} />;
}
