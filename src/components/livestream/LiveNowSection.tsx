'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Radio, Users, ChevronRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import LiveMatchStatus from '@/components/LiveMatchStatus';

interface LiveStream {
    id: string;
    sport: string;
    homeTeam: {
        name: string;
        shortName: string;
        logo: string;
        color: string;
    };
    awayTeam: {
        name: string;
        shortName: string;
        logo: string;
        color: string;
    };
    homeScore: number;
    awayScore: number;
    status: string;
    venue: string;
    competition: string;
    livestreamViewers: number;
    isLive: boolean;
    matchTitle: string;
}

export function LiveNowSection() {
    const [streams, setStreams] = useState<LiveStream[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLiveStreams = async () => {
            try {
                const response = await fetch('/api/livestreams/active');
                if (response.ok) {
                    const data = await response.json();
                    setStreams(data.streams || []);
                }
            } catch (error) {
                console.error('Error fetching live streams:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLiveStreams();

        // Refresh every 30 seconds
        const interval = setInterval(fetchLiveStreams, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="animate-pulse">
                <div className="h-8 bg-gray-800 rounded w-48 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-gray-800 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (streams.length === 0) {
        return null; // Don't show section if no live streams
    }

    return (
        <section className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Radio className="w-6 h-6 text-red-500" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                        Live Now
                    </h2>
                    <span className="px-3 py-1 bg-red-500/20 text-red-500 rounded-full text-sm font-semibold">
                        {streams.filter(s => s.isLive).length} Live
                    </span>
                </div>

                {streams.length > 3 && (
                    <Link
                        href="/livestreams"
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                    >
                        <span className="text-sm font-medium">View All</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                )}
            </div>

            {/* Live Streams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {streams.slice(0, 6).map((stream) => (
                    <Link
                        key={stream.id}
                        href={`/livestream/${stream.id}`}
                        className="group relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-red-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-red-500/20"
                    >
                        {/* Background with team colors */}
                        <div
                            className="absolute inset-0 opacity-10"
                            style={{
                                background: `linear-gradient(135deg, ${stream.homeTeam.color} 0%, ${stream.awayTeam.color} 100%)`
                            }}
                        />

                        {/* Content */}
                        <div className="relative p-6 space-y-4">
                            {/* Live Badge & Viewers */}
                            <div className="flex items-center justify-between">
                                {stream.isLive ? (
                                    <LiveMatchStatus matchId={stream.id} sport={stream.sport} variant="badge" />
                                ) : (
                                    <div className="flex items-center gap-2 bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                                        <Play className="w-3 h-3" />
                                        UPCOMING
                                    </div>
                                )}

                                <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>{stream.livestreamViewers.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Teams */}
                            <div className="grid grid-cols-3 gap-3 items-center">
                                {/* Home Team */}
                                <div className="flex flex-col items-center text-center">
                                    <img
                                        src={stream.homeTeam.logo}
                                        alt={stream.homeTeam.name}
                                        className="w-12 h-12 object-contain mb-2"
                                    />
                                    <p className="text-xs font-semibold text-white truncate w-full">
                                        {stream.homeTeam.shortName}
                                    </p>
                                </div>

                                {/* Score */}
                                <div className="flex flex-col items-center">
                                    {stream.isLive ? (
                                        <div className="text-3xl font-bold text-white">
                                            {stream.homeScore} - {stream.awayScore}
                                        </div>
                                    ) : (
                                        <div className="text-2xl font-bold text-gray-500">
                                            VS
                                        </div>
                                    )}
                                </div>

                                {/* Away Team */}
                                <div className="flex flex-col items-center text-center">
                                    <img
                                        src={stream.awayTeam.logo}
                                        alt={stream.awayTeam.name}
                                        className="w-12 h-12 object-contain mb-2"
                                    />
                                    <p className="text-xs font-semibold text-white truncate w-full">
                                        {stream.awayTeam.shortName}
                                    </p>
                                </div>
                            </div>

                            {/* Match Info */}
                            <div className="pt-3 border-t border-gray-700">
                                <p className="text-xs text-gray-400 truncate">{stream.competition}</p>
                                <p className="text-xs text-gray-500 truncate">{stream.venue}</p>
                            </div>

                            {/* Watch Now Button */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold">
                                    <Play className="w-5 h-5" />
                                    Watch Now
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
