'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Star, Edit, Calendar, Trophy, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { getClientErrorMessage } from '@/lib/client-error';

interface Match {
    id: string;
    homeTeam: {
        id: string;
        name: string;
        logo: string;
        shortName: string;
    };
    awayTeam: {
        id: string;
        name: string;
        logo: string;
        shortName: string;
    };
    homeScore: number;
    awayScore: number;
    status: string;
    startTime: string;
    competition: string;
    hasRatings: boolean;
    ratingsCount: number;
}

export default function MatchRatingsListPage() {
    const router = useRouter();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchMatches();
    }, []);

    const fetchMatches = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/matches?status=FINISHED&limit=50&includeRatingsStatus=1');

            if (!response.ok) {
                throw new Error('Failed to fetch matches');
            }

            const data = await response.json();
            // BACKLOG-254: /api/matches returns a bare array, not { matches: [...] } --
            // this was reading data.matches (always undefined), so the list was
            // silently empty regardless of how many finished matches existed.
            setMatches(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(getClientErrorMessage(err, 'Failed to load matches'));
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/60">Loading matches...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-3">Error Loading Matches</h2>
                    <p className="text-white/60 mb-6">{error}</p>
                    <button
                        onClick={fetchMatches}
                        className="px-6 py-3 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl transition-all"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-6">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/2"></div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        Match Ratings
                    </h1>
                    <p className="text-white/60">Manage and adjust player ratings for finished matches</p>
                </div>

                {/* Matches Grid */}
                {matches.length === 0 ? (
                    <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
                        <Trophy className="w-16 h-16 text-white/40 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">No Finished Matches</h3>
                        <p className="text-white/60">Finished matches will appear here for rating adjustment</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {matches.map((match) => (
                            <motion.div
                                key={match.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                whileHover={{ scale: 1.02 }}
                                className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-primary/50 transition-all cursor-pointer overflow-hidden"
                                onClick={() => router.push(`/admin/match-ratings/${match.id}`)}
                            >
                                {/* Competition Badge */}
                                <div className="bg-gradient-to-r from-primary/20 to-purple-500/20 px-4 py-2 border-b border-white/10">
                                    <p className="text-xs font-bold text-primary uppercase tracking-wider">
                                        {match.competition}
                                    </p>
                                </div>

                                {/* Match Info */}
                                <div className="p-6">
                                    {/* Teams */}
                                    <div className="flex items-center justify-between mb-4">
                                        {/* Home Team */}
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="w-12 h-12 relative rounded-lg overflow-hidden bg-white/5">
                                                <Image
                                                    src={match.homeTeam.logo}
                                                    alt={match.homeTeam.name}
                                                    fill
                                                    className="object-contain p-1"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm truncate">{match.homeTeam.shortName}</p>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div className="px-4">
                                            <div className="flex items-center gap-2 text-2xl font-black">
                                                <span className={match.homeScore > match.awayScore ? 'text-primary' : 'text-white/60'}>
                                                    {match.homeScore}
                                                </span>
                                                <span className="text-white/20">-</span>
                                                <span className={match.awayScore > match.homeScore ? 'text-primary' : 'text-white/60'}>
                                                    {match.awayScore}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Away Team */}
                                        <div className="flex items-center gap-3 flex-1 flex-row-reverse">
                                            <div className="w-12 h-12 relative rounded-lg overflow-hidden bg-white/5">
                                                <Image
                                                    src={match.awayTeam.logo}
                                                    alt={match.awayTeam.name}
                                                    fill
                                                    className="object-contain p-1"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 text-right">
                                                <p className="font-bold text-sm truncate">{match.awayTeam.shortName}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Match Date */}
                                    <div className="flex items-center justify-center gap-2 text-xs text-white/40 mb-4">
                                        <Calendar className="w-3 h-3" />
                                        <span>{new Date(match.startTime).toLocaleDateString()}</span>
                                    </div>

                                    {/* Ratings Status */}
                                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                        {match.hasRatings ? (
                                            <div className="flex items-center gap-2 text-xs">
                                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                <span className="text-white/60">
                                                    {match.ratingsCount} ratings published
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-xs text-white/40">
                                                <AlertCircle className="w-4 h-4" />
                                                <span>No ratings yet</span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1 text-xs text-primary font-bold">
                                            <Edit className="w-3 h-3" />
                                            <span>Adjust</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
