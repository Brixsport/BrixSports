'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Clock, MapPin, Trophy, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface MatchCardProps {
    match: {
        id: string;
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
        status: 'LIVE' | 'FINISHED' | 'UPCOMING' | 'HALF_TIME';
        startTime: string;
        venue: string;
        competition: string;
        sport: string;
    };
    variant?: 'compact' | 'detailed' | 'live';
    showCompetition?: boolean;
}

export default function MatchCard({ match, variant = 'compact', showCompetition = true }: MatchCardProps) {
    const isLive = match.status === 'LIVE' || match.status === 'HALF_TIME';
    const isFinished = match.status === 'FINISHED';
    const isUpcoming = match.status === 'UPCOMING';

    const getStatusColor = () => {
        switch (match.status) {
            case 'LIVE':
                return 'bg-red-500';
            case 'HALF_TIME':
                return 'bg-orange-500';
            case 'FINISHED':
                return 'bg-gray-600';
            default:
                return 'bg-blue-500';
        }
    };

    const getStatusText = () => {
        switch (match.status) {
            case 'LIVE':
                return 'LIVE';
            case 'HALF_TIME':
                return 'HT';
            case 'FINISHED':
                return 'FT';
            default:
                return format(new Date(match.startTime), 'HH:mm');
        }
    };

    if (variant === 'compact') {
        return (
            <Link href={`/match/${match.id}`}>
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="group bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-gray-700 hover:border-gray-600 rounded-xl p-4 transition-all cursor-pointer"
                >
                    {/* Competition Badge */}
                    {showCompetition && (
                        <div className="flex items-center gap-2 mb-3">
                            <Trophy className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-400 font-medium">{match.competition}</span>
                        </div>
                    )}

                    {/* Match Content */}
                    <div className="flex items-center justify-between">
                        {/* Home Team */}
                        <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                {match.homeTeam.logo ? (
                                    <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-6 h-6 object-contain" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: match.homeTeam.color }} />
                                )}
                            </div>
                            <span className="text-white font-medium truncate">{match.homeTeam.shortName}</span>
                        </div>

                        {/* Score/Time */}
                        <div className="flex items-center gap-3 px-4">
                            {isUpcoming ? (
                                <div className="text-center">
                                    <div className="text-gray-400 text-sm font-medium">{getStatusText()}</div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="text-2xl font-bold text-white font-mono">{match.homeScore}</div>
                                    <div className="text-gray-500">-</div>
                                    <div className="text-2xl font-bold text-white font-mono">{match.awayScore}</div>
                                </div>
                            )}
                            {isLive && (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                    <span className="text-red-400 text-xs font-semibold">{getStatusText()}</span>
                                </div>
                            )}
                            {isFinished && (
                                <span className="text-gray-500 text-xs font-medium">{getStatusText()}</span>
                            )}
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center gap-3 flex-1 justify-end">
                            <span className="text-white font-medium truncate">{match.awayTeam.shortName}</span>
                            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                {match.awayTeam.logo ? (
                                    <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-6 h-6 object-contain" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: match.awayTeam.color }} />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Venue */}
                    {!isUpcoming && (
                        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" />
                            <span>{match.venue}</span>
                        </div>
                    )}
                </motion.div>
            </Link>
        );
    }

    if (variant === 'live') {
        return (
            <Link href={`/match/${match.id}`}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative bg-gradient-to-br from-red-600/20 to-orange-600/20 backdrop-blur-sm border border-red-500/30 hover:border-red-400/50 rounded-2xl p-6 transition-all cursor-pointer overflow-hidden"
                >
                    {/* Live Indicator */}
                    <div className="absolute top-4 right-4">
                        <div className="flex items-center gap-2 bg-red-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-red-400 text-sm font-bold">LIVE</span>
                        </div>
                    </div>

                    {/* Competition */}
                    {showCompetition && (
                        <div className="flex items-center gap-2 mb-4">
                            <Trophy className="w-4 h-4 text-purple-400" />
                            <span className="text-sm text-purple-300 font-semibold">{match.competition}</span>
                        </div>
                    )}

                    {/* Teams and Score */}
                    <div className="space-y-4">
                        {/* Home Team */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    {match.homeTeam.logo ? (
                                        <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-10 h-10 object-contain" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full" style={{ backgroundColor: match.homeTeam.color }} />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">{match.homeTeam.name}</h3>
                                    <p className="text-sm text-gray-400">Home</p>
                                </div>
                            </div>
                            <div className="text-4xl font-bold text-white font-mono">{match.homeScore}</div>
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    {match.awayTeam.logo ? (
                                        <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-10 h-10 object-contain" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full" style={{ backgroundColor: match.awayTeam.color }} />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">{match.awayTeam.name}</h3>
                                    <p className="text-sm text-gray-400">Away</p>
                                </div>
                            </div>
                            <div className="text-4xl font-bold text-white font-mono">{match.awayScore}</div>
                        </div>
                    </div>

                    {/* Match Info */}
                    <div className="flex items-center gap-4 mt-6 pt-4 border-t border-gray-700">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Clock className="w-4 h-4" />
                            <span>{format(new Date(match.startTime), 'HH:mm')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <MapPin className="w-4 h-4" />
                            <span>{match.venue}</span>
                        </div>
                    </div>

                    {/* View Details */}
                    <div className="mt-4">
                        <div className="flex items-center gap-2 text-purple-400 text-sm font-semibold group-hover:text-purple-300 transition-colors">
                            <TrendingUp className="w-4 h-4" />
                            <span>View Live Stats</span>
                        </div>
                    </div>
                </motion.div>
            </Link>
        );
    }

    // Detailed variant
    return (
        <Link href={`/match/${match.id}`}>
            <motion.div
                whileHover={{ scale: 1.02 }}
                className="group bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-gray-700 hover:border-purple-500/50 rounded-2xl p-6 transition-all cursor-pointer"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    {showCompetition && (
                        <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-purple-400" />
                            <span className="text-sm text-purple-300 font-semibold">{match.competition}</span>
                        </div>
                    )}
                    <div className={`px-3 py-1 ${getStatusColor()} rounded-full`}>
                        <span className="text-white text-xs font-bold">{getStatusText()}</span>
                    </div>
                </div>

                {/* Teams */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center">
                    {/* Home Team */}
                    <div className="text-center">
                        <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                            {match.homeTeam.logo ? (
                                <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-14 h-14 object-contain" />
                            ) : (
                                <div className="w-14 h-14 rounded-full" style={{ backgroundColor: match.homeTeam.color }} />
                            )}
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">{match.homeTeam.name}</h3>
                        <p className="text-sm text-gray-400">Home</p>
                    </div>

                    {/* Score */}
                    <div className="text-center px-6">
                        {isUpcoming ? (
                            <div className="text-gray-400 text-lg font-semibold">VS</div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <div className="text-5xl font-bold text-white font-mono">{match.homeScore}</div>
                                <div className="text-3xl text-gray-600">:</div>
                                <div className="text-5xl font-bold text-white font-mono">{match.awayScore}</div>
                            </div>
                        )}
                    </div>

                    {/* Away Team */}
                    <div className="text-center">
                        <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                            {match.awayTeam.logo ? (
                                <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-14 h-14 object-contain" />
                            ) : (
                                <div className="w-14 h-14 rounded-full" style={{ backgroundColor: match.awayTeam.color }} />
                            )}
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">{match.awayTeam.name}</h3>
                        <p className="text-sm text-gray-400">Away</p>
                    </div>
                </div>

                {/* Match Info */}
                <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-gray-700">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>{format(new Date(match.startTime), 'MMM dd, HH:mm')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>{match.venue}</span>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
}
