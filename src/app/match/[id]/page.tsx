'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MatchOverlay } from '@/components/MatchOverlay';
import { BasketballMatchOverlay } from '@/components/BasketballMatchOverlay';
import { ArrowLeft } from 'lucide-react';
import { Match, MatchStatus } from '@/types';


export default function MatchPage() {
    const params = useParams();
    const router = useRouter();
    const matchId = params.id as string;
    const [match, setMatch] = useState<Match | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMatch = async () => {
            try {
                setLoading(true);
                setError(null);

                // Try fetching from both football and basketball APIs
                const [footballResponse, basketballResponse] = await Promise.all([
                    fetch(`/api/football/matches/${matchId}`).catch(() => null),
                    fetch(`/api/basketball/matches/${matchId}`).catch(() => null)
                ]);

                let matchData = null;
                let sport = null;

                if (footballResponse && footballResponse.ok) {
                    const data = await footballResponse.json();
                    if (data.success && data.match) {
                        matchData = data.match;
                        sport = 'Football';
                    }
                }

                if (!matchData && basketballResponse && basketballResponse.ok) {
                    const data = await basketballResponse.json();
                    if (data.success && data.match) {
                        matchData = data.match;
                        sport = 'Basketball';
                    }
                }

                if (!matchData) {
                    setError('Match not found');
                    return;
                }

                // Parse stats if needed
                let dbStats = {};
                try {
                    dbStats = typeof matchData.stats === 'string'
                        ? JSON.parse(matchData.stats)
                        : (matchData.stats || {});
                } catch (e) {
                    console.error('Error parsing match stats:', e);
                }

                setMatch({
                    id: matchData.id,
                    homeTeamId: matchData.homeTeamId,
                    awayTeamId: matchData.awayTeamId,
                    homeScore: matchData.homeScore || 0,
                    awayScore: matchData.awayScore || 0,
                    status: matchData.status as MatchStatus,
                    startTime: matchData.startTime,
                    venue: matchData.venue,
                    competition: matchData.competition,
                    sport: (sport || 'Football') as 'Football' | 'Basketball',
                    homeTeam: matchData.homeTeam,
                    awayTeam: matchData.awayTeam,
                    events: matchData.events || [],
                    stats: dbStats,
                    isStreaming: matchData.isStreaming,
                    streamUrl: matchData.streamUrl,
                    streamType: matchData.streamType
                });
            } catch (error) {
                console.error('Error fetching match:', error);
                setError('Failed to load match');
            } finally {
                setLoading(false);
            }
        };

        if (matchId) {
            fetchMatch();
        }
    }, [matchId]);

    const handleClose = () => {
        router.push('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/60">Loading match...</p>
                </div>
            </div>
        );
    }

    if (error || !match) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">⚽</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Match Not Found</h1>
                    <p className="text-white/60 mb-6">{error || 'The match you\'re looking for doesn\'t exist'}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505]">
            {/* Back Button - Desktop */}
            <div className="hidden md:block fixed top-4 left-4 z-[100]">
                <button
                    onClick={handleClose}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-semibold transition-colors"
                >
                    <ArrowLeft size={20} />
                    <span>Back</span>
                </button>
            </div>

            {/* Render appropriate overlay based on sport */}
            {match.sport === 'Basketball' ? (
                <BasketballMatchOverlay
                    match={match}
                    onClose={handleClose}
                    onSelectTeam={() => { }}
                    onSelectPlayer={() => { }}
                />
            ) : (
                <MatchOverlay
                    match={match}
                    onClose={handleClose}
                    onSelectPlayer={() => { }}
                />
            )}
        </div>
    );
}
