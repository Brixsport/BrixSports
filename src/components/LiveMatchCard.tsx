'use client';

import { motion } from 'framer-motion';
import { Clock, MapPin, TrendingUp, Zap, Eye, Video } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import MatchStatusBadge from './MatchStatusBadge';

interface LiveMatchCardProps {
    match: {
        id: string;
        sport: string;
        homeTeam: {
            id: string;
            name: string;
            shortName: string;
            logo: string;
            color: string;
        };
        awayTeam: {
            id: string;
            name: string;
            shortName: string;
            logo: string;
            color: string;
        };
        homeScore: number;
        awayScore: number;
        status: string;
        startTime: Date;
        venue: string;
        competition: {
            id: string;
            name: string;
            logo?: string;
        };
        events?: any[];
        stats?: any;
        livestreamEnabled?: boolean;
    };
}

export default function LiveMatchCard({ match }: LiveMatchCardProps) {
    const isLive = match.status === 'LIVE' || match.status === 'HALF_TIME';
    const isFinished = match.status === 'FINISHED';
    const isUpcoming = match.status === 'UPCOMING';

    // Get latest event
    const latestEvent = match.events?.[0];

    return (
        <Link href={`/matches/${match.id}`}>
            <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative overflow-hidden rounded-2xl border transition-all cursor-pointer ${isLive
                    ? 'bg-gradient-to-br from-red-500/10 via-purple-500/10 to-pink-500/10 border-red-500/30 shadow-lg shadow-red-500/20'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
            >
                {/* Live Indicator */}
                {isLive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-purple-500 to-pink-500 animate-pulse" />
                )}

                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            {match.competition.logo && (
                                <img
                                    src={match.competition.logo}
                                    alt={match.competition.name}
                                    className="w-8 h-8 rounded-lg object-cover"
                                />
                            )}
                            <div>
                                <div className="font-semibold text-white">{match.competition.name}</div>
                                <div className="text-sm text-white/60 flex items-center gap-2">
                                    <MapPin className="w-3 h-3" />
                                    {match.venue}
                                </div>
                            </div>
                        </div>

                        <MatchStatusBadge status={match.status} />
                    </div>

                    {/* Teams & Score */}
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center mb-6">
                        {/* Home Team */}
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div
                                    className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold"
                                    style={{ backgroundColor: match.homeTeam.color + '20' }}
                                >
                                    {match.homeTeam.logo ? (
                                        <img
                                            src={match.homeTeam.logo}
                                            alt={match.homeTeam.name}
                                            className="w-12 h-12 object-contain"
                                        />
                                    ) : (
                                        match.homeTeam.shortName.substring(0, 2)
                                    )}
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-lg">{match.homeTeam.name}</div>
                                <div className="text-sm text-white/60">{match.homeTeam.shortName}</div>
                            </div>
                        </div>

                        {/* Score */}
                        <div className="text-center px-6">
                            {isUpcoming ? (
                                <div className="text-white/60">
                                    <Clock className="w-6 h-6 mx-auto mb-1" />
                                    <div className="text-sm font-medium">
                                        {format(new Date(match.startTime), 'HH:mm')}
                                    </div>
                                    {match.livestreamEnabled && (
                                        <div className="flex items-center justify-center gap-1 mt-1 text-red-500 animate-pulse">
                                            <Video className="w-3 h-3" />
                                            <span className="text-xs font-bold">LIVE STREAM</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <motion.div
                                        key={`home-${match.homeScore}`}
                                        initial={{ scale: 1.5, color: '#10b981' }}
                                        animate={{ scale: 1, color: '#ffffff' }}
                                        className="text-5xl font-bold"
                                    >
                                        {match.homeScore}
                                    </motion.div>
                                    <div className="text-2xl text-white/40">-</div>
                                    <motion.div
                                        key={`away-${match.awayScore}`}
                                        initial={{ scale: 1.5, color: '#10b981' }}
                                        animate={{ scale: 1, color: '#ffffff' }}
                                        className="text-5xl font-bold"
                                    >
                                        {match.awayScore}
                                    </motion.div>
                                </div>
                            )}
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center gap-4 flex-row-reverse">
                            <div className="relative">
                                <div
                                    className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold"
                                    style={{ backgroundColor: match.awayTeam.color + '20' }}
                                >
                                    {match.awayTeam.logo ? (
                                        <img
                                            src={match.awayTeam.logo}
                                            alt={match.awayTeam.name}
                                            className="w-12 h-12 object-contain"
                                        />
                                    ) : (
                                        match.awayTeam.shortName.substring(0, 2)
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 text-right">
                                <div className="font-bold text-lg">{match.awayTeam.name}</div>
                                <div className="text-sm text-white/60">{match.awayTeam.shortName}</div>
                            </div>
                        </div>
                    </div>

                    {/* Latest Event */}
                    {latestEvent && isLive && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10"
                        >
                            <div className="flex items-center gap-2 text-sm">
                                <Zap className="w-4 h-4 text-yellow-500" />
                                <span className="font-semibold text-white/80">
                                    {latestEvent.minute}' - {latestEvent.type}
                                </span>
                                {latestEvent.isEyePoint && (
                                    <Eye className="w-4 h-4 text-purple-500" />
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Stats Preview */}
                    {match.stats && (isLive || isFinished) && (
                        <div className="mt-4 grid grid-cols-3 gap-4">
                            {match.sport === 'Football' && (
                                <>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-primary">
                                            {match.stats?.possession?.[0] || 50}%
                                        </div>
                                        <div className="text-xs text-white/60">Possession</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-500">
                                            {match.stats?.shots?.[0] || 0}
                                        </div>
                                        <div className="text-xs text-white/60">Shots</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-500">
                                            {match.stats?.shotsOnTarget?.[0] || 0}
                                        </div>
                                        <div className="text-xs text-white/60">On Target</div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* View Details */}
                    <div className="mt-4 text-center">
                        <div className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
                            <TrendingUp className="w-4 h-4" />
                            View Full Details
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
}

