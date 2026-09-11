import { db } from '@/db';
import { competitions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import CompetitionRegistration from '@/components/CompetitionRegistration';
import { BackButton } from '@/components/ui/BackButton';

interface PageProps {
    params: {
        id: string;
    };
}

export default async function RegisterPage({ params }: PageProps) {
    const competition = await db.query.competitions.findFirst({
        where: eq(competitions.id, params.id),
    });

    if (!competition) {
        notFound();
    }

    if (!competition.registrationOpen) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <BackButton fallbackHref={`/competitions/${params.id}`} />
                        <h1 className="text-4xl font-bold text-white">Registration Closed</h1>
                    </div>
                    <p className="text-gray-300 text-lg">
                        Registration for {competition.name} is currently closed.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="max-w-5xl mx-auto px-4 pt-4">
                <BackButton fallbackHref={`/competitions/${params.id}`} />
            </div>
            <CompetitionRegistration
                competitionId={competition.id}
                competitionName={competition.name}
                playersPerSide={competition.playersPerSide || 11}
                gender={(competition.gender as 'male' | 'female' | 'mixed') || 'mixed'}
            />
        </>
    );
}
