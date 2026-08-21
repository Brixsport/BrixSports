'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Clock, MapPin, Trophy, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import LiveMatchStatus from '@/components/LiveMatchStatus';
import { TeamLogo } from '@/lib/utils/team-logo';

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
        // BACKLOG-105: only present once a real shootout kick has landed —
        // undefined means "no shootout," never "0-0 so far."
        shootoutHomeScore?: number;
        shootoutAwayScore?: number;
        status: 'LIVE' | 'FINISHED' | 'UPCOMING' | 'HALF_TIME';
        currentPeriod?: string | null;
        startTime: string;
        venue: string;
        competition: string;
        round?: string | null;
        sport: string;
    };
    variant?: 'compact' | 'detailed' | 'live';
    showCompetition?: boolean;
}

export default function MatchCard({ match, variant = 'compact', showCompetition = true }: MatchCardProps) {
    const isLive = match.status === 'LIVE' || match.status === 'HALF_TIME';
    const isFinished = match.status === 'FINISHED';
    const isUpcoming = match.status === 'UPCOMING';

    // BUG-197: same tie-hiding bug fixed in matches/[id]/page.tsx -- shootout
    // score columns default to 0 (not null) on every match, so the `!==` guard
    // alone hid a live, in-progress, currently-tied shootout on list cards too
    // (homepage/live list), not just the detail page. Live, show regardless of
    // tie; once FINISHED, a shootout can never legitimately end tied, so the
    // inequality check is still the right "did one happen at all" signal.
    const isLiveShootout = match.currentPeriod === 'PENALTY_SHOOTOUT';
    const hasShootoutResult = match.shootoutHomeScore != null && match.shootoutAwayScore != null
        && (isLiveShootout || match.shootoutHomeScore !== match.shootoutAwayScore);
    const shootoutHomeWon = hasShootoutResult && (match.shootoutHomeScore ?? 0) > (match.shootoutAwayScore ?? 0);
    const shootoutAwayWon = hasShootoutResult && (match.shootoutAwayScore ?? 0) > (match.shootoutHomeScore ?? 0);

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
        // For real-time updates, we can't easily use a hook here if we want to keep the same function signature
        // but we can at least make it consistent with other components if they pass more data.
        switch (match.status) {
            case 'LIVE':
                return 'LIVE';
            case 'HALF_TIME':
                return 'HT';
            case 'FINISHED':
                return 'FT';
            default:
                try {
                    return format(new Date(match.startTime), 'HH:mm');
                } catch (e) {
                    return '--:--';
                }
        }
    };

    if (variant === 'compact') {
        return (
            <Link href={`/matches/${match.id}`}>
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="group bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-gray-700 hover:border-gray-600 rounded-xl p-4 transition-all cursor-pointer"
                >
                    {/* Competition Badge */}
                    {showCompetition && (
                        <div className="flex items-center gap-2 mb-3">
                            <Trophy className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-400 font-medium">{match.round ? `${match.competition} · ${match.round}` : match.competition}</span>
                        </div>
                    )}

                    {/* Match Content */}
                    <div className="flex items-center justify-between">
                        {/* Home Team */}
                        <div className="flex items-center gap-3 flex-1">
                            <TeamLogo logo={match.homeTeam.logo} name={match.homeTeam.name} color={match.homeTeam.color} size="sm" />
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
                                    <div className="text-2xl font-bold font-mono text-white">
                                        {match.homeScore}{hasShootoutResult && <span className={`text-sm ml-1 ${shootoutHomeWon ? 'text-blue-400' : ''}`}>({match.shootoutHomeScore})</span>}
                                    </div>
                                    <div className="text-gray-500">-</div>
                                    <div className="text-2xl font-bold font-mono text-white">
                                        {match.awayScore}{hasShootoutResult && <span className={`text-sm ml-1 ${shootoutAwayWon ? 'text-blue-400' : ''}`}>({match.shootoutAwayScore})</span>}
                                    </div>
                                </div>
                            )}
                            {isLive && (
                                <div className="flex items-center gap-1.5">
                                    <LiveMatchStatus matchId={match.id} sport={match.sport} fallbackPeriod={match.currentPeriod ?? undefined} />
                                </div>
                            )}
                            {isFinished && (
                                <span className="text-gray-500 text-xs font-medium">{getStatusText()}</span>
                            )}
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center gap-3 flex-1 justify-end">
                            <span className="text-white font-medium truncate">{match.awayTeam.shortName}</span>
                            <TeamLogo logo={match.awayTeam.logo} name={match.awayTeam.name} color={match.awayTeam.color} size="sm" />
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
            <Link href={`/matches/${match.id}`}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative bg-gradient-to-br from-red-600/20 to-orange-600/20 backdrop-blur-sm border border-red-500/30 hover:border-red-400/50 rounded-2xl p-6 transition-all cursor-pointer overflow-hidden"
                >
                    {/* Live Indicator */}
                    <div className="absolute top-4 right-4">
                        <LiveMatchStatus matchId={match.id} sport={match.sport} variant="badge" fallbackPeriod={match.currentPeriod ?? undefined} />
                    </div>

                    {/* Competition */}
                    {showCompetition && (
                        <div className="flex items-center gap-2 mb-4">
                            <Trophy className="w-4 h-4 text-purple-400" />
                            <span className="text-sm text-purple-300 font-semibold">{match.round ? `${match.competition} · ${match.round}` : match.competition}</span>
                        </div>
                    )}

                    {/* Teams and Score */}
                    <div className="space-y-4">
                        {/* Home Team */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                                <TeamLogo logo={match.homeTeam.logo} name={match.homeTeam.name} color={match.homeTeam.color} size="md" />
                                <div>
                                    <h3 className="text-xl font-bold text-white">{match.homeTeam.name}</h3>
                                    <p className="text-sm text-gray-400">Home</p>
                                </div>
                            </div>
                            <div className="text-4xl font-bold font-mono text-white">
                                {match.homeScore}{hasShootoutResult && <span className={`text-lg ml-1.5 ${shootoutHomeWon ? 'text-blue-400' : ''}`}>({match.shootoutHomeScore})</span>}
                            </div>
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                                <TeamLogo logo={match.awayTeam.logo} name={match.awayTeam.name} color={match.awayTeam.color} size="md" />
                                <div>
                                    <h3 className="text-xl font-bold text-white">{match.awayTeam.name}</h3>
                                    <p className="text-sm text-gray-400">Away</p>
                                </div>
                            </div>
                            <div className="text-4xl font-bold font-mono text-white">
                                {match.awayScore}{hasShootoutResult && <span className={`text-lg ml-1.5 ${shootoutAwayWon ? 'text-blue-400' : ''}`}>({match.shootoutAwayScore})</span>}
                            </div>
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
        <Link href={`/matches/${match.id}`}>
            <motion.div
                whileHover={{ scale: 1.02 }}
                className="group bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-gray-700 hover:border-purple-500/50 rounded-2xl p-6 transition-all cursor-pointer"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    {showCompetition && (
                        <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-purple-400" />
                            <span className="text-sm text-purple-300 font-semibold">{match.round ? `${match.competition} · ${match.round}` : match.competition}</span>
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
                        <div className="flex justify-center mb-3">
                            <TeamLogo logo={match.homeTeam.logo} name={match.homeTeam.name} color={match.homeTeam.color} size="lg" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">{match.homeTeam.name}</h3>
                        <p className="text-sm text-gray-400">Home</p>
                    </div>

                    {/* Score */}
                    <div className="text-center px-6">
                        {isUpcoming ? (
                            <div className="text-gray-400 text-lg font-semibold">VS</div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="text-5xl font-bold font-mono text-white">{match.homeScore}</div>
                                    <div className="text-3xl text-gray-600">:</div>
                                    <div className="text-5xl font-bold font-mono text-white">{match.awayScore}</div>
                                </div>
                                {hasShootoutResult && (
                                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                                        PEN <span className={shootoutHomeWon ? 'text-blue-400' : ''}>{match.shootoutHomeScore}</span>-<span className={shootoutAwayWon ? 'text-blue-400' : ''}>{match.shootoutAwayScore}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Away Team */}
                    <div className="text-center">
                        <div className="flex justify-center mb-3">
                            <TeamLogo logo={match.awayTeam.logo} name={match.awayTeam.name} color={match.awayTeam.color} size="lg" />
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
