'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Activity, Play, Users, Clock } from 'lucide-react';

interface Match {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    status: string;
    startTime: string;
    venue: string;
    competition: string;
    sport: string;
    homeTeam?: any;
    awayTeam?: any;
}

export default function LiveCenter() {
    const [liveMatches, setLiveMatches] = useState<Match[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLiveMatches() {
            try {
                const response = await fetch('/api/matches');
                const data = await response.json();

                // Filter for live matches
                const live = data.filter((m: Match) => m.status === 'LIVE');
                setLiveMatches(live);

                if (live.length > 0) {
                    setSelectedMatch(live[0]);
                }
            } catch (error) {
                console.error('Error fetching live matches:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchLiveMatches();

        // Refresh every 30 seconds
        const interval = setInterval(fetchLiveMatches, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/60">Loading live matches...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Header */}
            <div className="border-b border-white/10 bg-[#0a0a0a] sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                                <ArrowLeft size={20} />
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <Play size={20} className="text-red-500 fill-red-500" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                        LIVE CENTER
                                    </h1>
                                    <p className="text-sm text-white/60">{liveMatches.length} matches live now</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
                            <Activity size={18} className="animate-pulse" />
                            <span className="text-xs font-bold uppercase tracking-widest">LIVE</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {liveMatches.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Match List */}
                        <div className="lg:col-span-1 space-y-3">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-4">
                                Live Matches ({liveMatches.length})
                            </h2>
                            {liveMatches.map((match) => (
                                <motion.div
                                    key={match.id}
                                    onClick={() => setSelectedMatch(match)}
                                    className={`p-4 rounded-xl cursor-pointer transition-all ${selectedMatch?.id === match.id
                                            ? 'bg-primary/10 border-2 border-primary'
                                            : 'bg-white/5 border border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-white/60">{match.competition}</span>
                                        <div className="flex items-center gap-1.5 text-red-500 text-xs font-bold">
                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                            LIVE
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm">
                                                {match.homeTeam?.name || 'Home Team'}
                                            </span>
                                            <span className={`text-lg font-bold ${match.homeScore > match.awayScore ? 'text-primary' : 'text-white/60'}`}>
                                                {match.homeScore}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-sm">
                                                {match.awayTeam?.name || 'Away Team'}
                                            </span>
                                            <span className={`text-lg font-bold ${match.awayScore > match.homeScore ? 'text-primary' : 'text-white/60'}`}>
                                                {match.awayScore}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Match Detail */}
                        {selectedMatch && (
                            <div className="lg:col-span-2">
                                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                    {/* Match Header */}
                                    <div className="bg-gradient-to-r from-red-500/10 to-primary/10 border-b border-white/10 p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm text-white/60">{selectedMatch.competition}</span>
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-500 rounded-lg text-xs font-bold">
                                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                                LIVE
                                            </div>
                                        </div>

                                        {/* Score Display */}
                                        <div className="flex items-center justify-between">
                                            {/* Home Team */}
                                            <div className="flex-1 text-center">
                                                <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl font-bold">
                                                    {selectedMatch.homeTeam?.shortName || 'HOME'}
                                                </div>
                                                <h3 className="font-bold text-lg mb-2">
                                                    {selectedMatch.homeTeam?.name || 'Home Team'}
                                                </h3>
                                                <div className={`text-5xl font-bold ${selectedMatch.homeScore > selectedMatch.awayScore ? 'text-primary' : 'text-white/60'}`}>
                                                    {selectedMatch.homeScore}
                                                </div>
                                            </div>

                                            {/* VS */}
                                            <div className="px-8">
                                                <div className="text-white/20 text-2xl font-bold">VS</div>
                                            </div>

                                            {/* Away Team */}
                                            <div className="flex-1 text-center">
                                                <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl font-bold">
                                                    {selectedMatch.awayTeam?.shortName || 'AWAY'}
                                                </div>
                                                <h3 className="font-bold text-lg mb-2">
                                                    {selectedMatch.awayTeam?.name || 'Away Team'}
                                                </h3>
                                                <div className={`text-5xl font-bold ${selectedMatch.awayScore > selectedMatch.homeScore ? 'text-primary' : 'text-white/60'}`}>
                                                    {selectedMatch.awayScore}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Match Info */}
                                    <div className="p-6 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white/5 rounded-xl p-4">
                                                <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
                                                    <Clock size={14} />
                                                    <span>Kickoff Time</span>
                                                </div>
                                                <p className="font-bold">
                                                    {new Date(selectedMatch.startTime).toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-4">
                                                <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
                                                    <Users size={14} />
                                                    <span>Venue</span>
                                                </div>
                                                <p className="font-bold">{selectedMatch.venue}</p>
                                            </div>
                                        </div>

                                        {/* Live Commentary Placeholder */}
                                        <div className="bg-white/5 rounded-xl p-6">
                                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                                <Activity size={16} className="text-primary" />
                                                Live Updates
                                            </h3>
                                            <div className="space-y-3 text-sm">
                                                <p className="text-white/60 text-center py-4">
                                                    Live commentary coming soon...
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-20 text-center">
                        <Activity size={64} className="mx-auto text-white/10 mb-4" />
                        <h2 className="text-2xl font-bold mb-2">No Live Matches</h2>
                        <p className="text-white/40">Check back later for live action!</p>
                        <Link href="/" className="inline-block mt-6 px-6 py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors">
                            Back to Home
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
