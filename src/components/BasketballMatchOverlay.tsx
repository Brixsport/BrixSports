'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { X, Trophy, BarChart3, Table, Star, MapPin, Calendar, Target, MessageSquare, Play } from 'lucide-react';
import { Match } from '@/types';
import { MatchPredictionCard } from '@/components/predictions/MatchPredictionCard';
import { MatchVotePoll } from '@/components/predictions/MatchVotePoll';
import { LivestreamChat } from '@/components/livestream/LivestreamChat';
import { LivestreamPlayer } from '@/components/livestream/LivestreamPlayer';
import { StatBar } from '@/components/StatBar';

interface BasketballMatchOverlayProps {
    match: Match;
    onClose: () => void;
    onSelectTeam?: (team: any) => void;
    onSelectPlayer?: (player: any) => void;
}

// Helper function to validate image paths
const isValidImagePath = (path: string | undefined): boolean => {
    if (!path || path.trim() === '') return false;
    return path.startsWith('/') || path.startsWith('http');
};

export function BasketballMatchOverlay({ match, onClose, onSelectTeam, onSelectPlayer }: BasketballMatchOverlayProps) {
    const [activeTab, setActiveTab] = useState(match.isStreaming ? 'watch' : 'overview');
    const [standings, setStandings] = useState<any[]>([]);
    const [mvpLeaders, setMvpLeaders] = useState<any[]>([]);
    const [matchDetails, setMatchDetails] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Fetch data when tabs change
    useEffect(() => {
        if (activeTab === 'standings') {
            fetchStandings();
        } else if (activeTab === 'scout') {
            fetchMvpLeaderboard();
        } else if (activeTab === 'lineups' || activeTab === 'stats') {
            fetchMatchDetails();
        }
    }, [activeTab]);

    const fetchMatchDetails = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/matches/${match.id}`);
            const data = await response.json();
            setMatchDetails(data);
        } catch (error) {
            console.error('Error fetching match details:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStandings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/basketball/standings');
            const data = await response.json();
            if (data.success) {
                setStandings(data.standings);
            }
        } catch (error) {
            console.error('Error fetching standings:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMvpLeaderboard = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/basketball/leaderboard/mvp');
            const data = await response.json();
            if (data.success) {
                setMvpLeaders(data.leaderboard);
            }
        } catch (error) {
            console.error('Error fetching MVP leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePlayerClick = async (playerName: string) => {
        try {
            const res = await fetch(`/api/basketball/players?search=${encodeURIComponent(playerName)}`);
            const data = await res.json();
            if (data.success && data.players && data.players.length > 0) {
                const player = data.players.find((p: any) => p.name.toUpperCase() === playerName.toUpperCase());
                if (player && onSelectPlayer) {
                    onSelectPlayer(player);
                }
            }
        } catch (error) {
            console.error('Error selecting player:', error);
        }
    };

    const tabs = [
        ...(match.isStreaming ? [{ id: 'watch', label: 'Watch Live', icon: Play }] : []),
        { id: 'overview', label: 'Overview', icon: Trophy },
        { id: 'lineups', label: 'Lineups', icon: Star },
        { id: 'stats', label: 'Stats', icon: BarChart3 },
        { id: 'standings', label: 'Standings', icon: Table },
        { id: 'scout', label: 'Scout Report', icon: Star },
        // Conditional tabs based on match status
        ...(match.status === 'UPCOMING' ? [
            { id: 'predict', label: 'Predict', icon: Target },
            { id: 'poll', label: 'Fan Poll', icon: BarChart3 },
        ] : []),
        ...(match.status === 'LIVE' ? [
            { id: 'chat', label: 'Chat', icon: MessageSquare },
        ] : []),
    ];

    const [isScrolled, setIsScrolled] = useState(false);

    // ... (tabs definition)

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md overflow-y-auto"
            onClick={onClose}
            onScroll={(e) => setIsScrolled(e.currentTarget.scrollTop > 50)}
        >
            <div className="min-h-screen flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={`sticky top-0 z-10 bg-[#0a0a0a] border-b border-white/10 transition-all duration-300 ${isScrolled ? 'py-2 shadow-xl' : 'py-4'}`}>
                    <div className="max-w-5xl mx-auto px-4">
                        <div className={`flex items-center justify-between ${isScrolled ? 'mb-2' : 'mb-4'} transition-all duration-300`}>
                            <div className="flex items-center gap-3">
                                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                                {isScrolled && (
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 relative rounded overflow-hidden bg-white/5">
                                                {isValidImagePath(match.homeTeam?.logo) && match.homeTeam && (
                                                    <Image src={match.homeTeam.logo} alt={match.homeTeam.name} fill className="object-cover" />
                                                )}
                                            </div>
                                            <span className={`text-lg font-bold ${match.homeScore > match.awayScore ? 'text-primary' : 'text-white'}`}>{match.homeScore}</span>
                                        </div>
                                        <span className="text-white/20 text-sm">-</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-lg font-bold ${match.awayScore > match.homeScore ? 'text-primary' : 'text-white'}`}>{match.awayScore}</span>
                                            <div className="w-6 h-6 relative rounded overflow-hidden bg-white/5">
                                                {isValidImagePath(match.awayTeam?.logo) && match.awayTeam && (
                                                    <Image src={match.awayTeam.logo} alt={match.awayTeam.name} fill className="object-cover" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {!isScrolled && (
                                <div className="flex flex-col items-center text-center">
                                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                                        {match.competition}
                                        {(() => {
                                            try {
                                                const stats = typeof match.stats === 'string' ? JSON.parse(match.stats) : match.stats;
                                                return stats?.round ? ` • Round ${stats.round}` : '';
                                            } catch (e) { return ''; }
                                        })()}
                                    </span>
                                    <div className="flex items-center gap-2 text-xs text-white/40 mt-1">
                                        <MapPin size={12} />
                                        <span>{match.venue}</span>
                                        <span>•</span>
                                        <Calendar size={12} />
                                        <span>{new Date(match.startTime).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            )}

                            <div className="w-10"></div>
                        </div>

                        {/* Score Display (Full Size) - Hidden when scrolled */}
                        <div className={`flex items-center justify-between overflow-hidden transition-all duration-500 ease-in-out ${isScrolled ? 'max-h-0 opacity-0 mb-0' : 'max-h-40 opacity-100 mb-6'}`}>
                            {/* Home Team */}
                            <div
                                className="flex-1 flex flex-col items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => match.homeTeam && onSelectTeam?.(match.homeTeam)}
                            >
                                <div className="w-16 h-16 relative rounded-xl overflow-hidden bg-white/5">
                                    {isValidImagePath(match.homeTeam?.logo) && (
                                        <Image
                                            src={match.homeTeam!.logo}
                                            alt={match.homeTeam!.name}
                                            fill
                                            className="object-cover"
                                        />
                                    )}
                                </div>
                                <div className="text-center">
                                    <h3 className="font-bold text-lg">{match.homeTeam?.name}</h3>
                                    <p className="text-xs text-white/40">{match.homeTeam?.shortName}</p>
                                </div>
                            </div>

                            {/* Score */}
                            <div className="px-8 flex flex-col items-center gap-2">
                                <div className="flex items-center gap-4">
                                    <span className={`text-5xl font-bold ${match.homeScore > match.awayScore ? 'text-primary' : 'text-white/60'}`}>
                                        {match.homeScore}
                                    </span>
                                    <span className="text-white/20 text-2xl">-</span>
                                    <span className={`text-5xl font-bold ${match.awayScore > match.homeScore ? 'text-primary' : 'text-white/60'}`}>
                                        {match.awayScore}
                                    </span>
                                </div>
                                <div className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold uppercase tracking-wider">
                                    {match.status === 'FINISHED' ? 'FT' : match.status}
                                </div>
                            </div>

                            {/* Away Team */}
                            <div
                                className="flex-1 flex flex-col items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => match.awayTeam && onSelectTeam?.(match.awayTeam)}
                            >
                                <div className="w-16 h-16 relative rounded-xl overflow-hidden bg-white/5">
                                    {isValidImagePath(match.awayTeam?.logo) && (
                                        <Image
                                            src={match.awayTeam!.logo}
                                            alt={match.awayTeam!.name}
                                            fill
                                            className="object-cover"
                                        />
                                    )}
                                </div>
                                <div className="text-center">
                                    <h3 className="font-bold text-lg">{match.awayTeam?.name}</h3>
                                    <p className="text-xs text-white/40">{match.awayTeam?.shortName}</p>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activeTab === tab.id
                                        ? 'bg-primary text-black'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <tab.icon size={14} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-5xl mx-auto w-full px-4 py-8">
                    <AnimatePresence mode="wait">
                        {/* Watch Tab - For Live Streaming */}
                        {activeTab === 'watch' && match.isStreaming && match.streamUrl && (
                            <motion.div
                                key="watch"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-6"
                            >
                                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                                    <LivestreamPlayer
                                        streamUrl={match.streamUrl}
                                        streamType={match.streamType || 'youtube'}
                                        matchTitle={`${match.homeTeam?.name} vs ${match.awayTeam?.name}`}
                                        isLive={match.status === 'LIVE'}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* Overview Tab */}
                        {activeTab === 'overview' && (
                            <motion.div
                                key="overview"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-6"
                            >
                                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                                    <h3 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-4">Match Summary</h3>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <p className="text-2xl font-bold text-primary">{match.homeScore}</p>
                                            <p className="text-xs text-white/40 mt-1">Points</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{match.homeScore + match.awayScore}</p>
                                            <p className="text-xs text-white/40 mt-1">Total Points</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-primary">{match.awayScore}</p>
                                            <p className="text-xs text-white/40 mt-1">Points</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                                    <h3 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-4">Match Info</h3>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Competition</span>
                                            <span className="font-semibold">{match.competition}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Venue</span>
                                            <span className="font-semibold">{match.venue}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Date</span>
                                            <span className="font-semibold">
                                                {new Date(match.startTime).toLocaleDateString('en-US', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Status</span>
                                            <span className="font-semibold">{match.status}</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Stats Tab */}
                        {activeTab === 'stats' && (
                            <motion.div
                                key="stats"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="bg-white/5 rounded-2xl border border-white/10 p-6"
                            >
                                <h3 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-6">Match Statistics</h3>
                                <div className="space-y-6">
                                    <StatBar
                                        label="Points Scored"
                                        homeValue={match.homeScore}
                                        awayValue={match.awayScore}
                                        homeTeam={match.homeTeam?.shortName || 'Home'}
                                        awayTeam={match.awayTeam?.shortName || 'Away'}
                                    />
                                    {(() => {
                                        try {
                                            const stats = typeof match.stats === 'string' ? JSON.parse(match.stats) : match.stats;
                                            return (
                                                <>
                                                    <StatBar
                                                        label="Field Goal %"
                                                        homeValue={stats.fieldGoalPercentage?.[0] || 0}
                                                        awayValue={stats.fieldGoalPercentage?.[1] || 0}
                                                        homeTeam={match.homeTeam?.shortName || 'Home'}
                                                        awayTeam={match.awayTeam?.shortName || 'Away'}
                                                        suffix="%"
                                                    />
                                                    <StatBar
                                                        label="3-Point %"
                                                        homeValue={stats.threePointPercentage?.[0] || 0}
                                                        awayValue={stats.threePointPercentage?.[1] || 0}
                                                        homeTeam={match.homeTeam?.shortName || 'Home'}
                                                        awayTeam={match.awayTeam?.shortName || 'Away'}
                                                        suffix="%"
                                                    />
                                                    <StatBar
                                                        label="Free Throw %"
                                                        homeValue={stats.freeThrowPercentage?.[0] || 0}
                                                        awayValue={stats.freeThrowPercentage?.[1] || 0}
                                                        homeTeam={match.homeTeam?.shortName || 'Home'}
                                                        awayTeam={match.awayTeam?.shortName || 'Away'}
                                                        suffix="%"
                                                    />
                                                </>
                                            );
                                        } catch (e) {
                                            return null;
                                        }
                                    })()}
                                </div>
                            </motion.div>
                        )}

                        {/* Lineups Tab */}
                        {activeTab === 'lineups' && (
                            <motion.div
                                key="lineups"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-6"
                            >
                                {loading ? (
                                    <div className="py-20 text-center">
                                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-white/40">Loading lineups...</p>
                                    </div>
                                ) : matchDetails?.match?.lineups ? (
                                    <>
                                        {/* Home Team Lineup */}
                                        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                                            <h3 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-4">
                                                {match.homeTeam?.name} Lineup
                                            </h3>

                                            {/* Starters */}
                                            {matchDetails.match.lineups.home.starters.length > 0 && (
                                                <div className="mb-6">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Starters</p>
                                                    <div className="space-y-2">
                                                        {matchDetails.match.lineups.home.starters.map((player: any) => (
                                                            <div
                                                                key={player.id}
                                                                className="bg-white/5 rounded-lg p-3 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer"
                                                                onClick={() => onSelectPlayer?.(player)}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs font-bold text-white/40 w-8">#{player.number}</span>
                                                                    <span className="font-semibold">{player.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-4 text-xs">
                                                                    <div className="text-center">
                                                                        <p className="font-bold text-primary">{player.points || 0}</p>
                                                                        <p className="text-white/40">PTS</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.rebounds || 0}</p>
                                                                        <p className="text-white/40">REB</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.assists || 0}</p>
                                                                        <p className="text-white/40">AST</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.steals || 0}</p>
                                                                        <p className="text-white/40">STL</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.blocks || 0}</p>
                                                                        <p className="text-white/40">BLK</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Bench */}
                                            {matchDetails.match.lineups.home.bench.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Bench</p>
                                                    <div className="space-y-2">
                                                        {matchDetails.match.lineups.home.bench.map((player: any) => (
                                                            <div
                                                                key={player.id}
                                                                className="bg-white/5 rounded-lg p-3 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer opacity-75"
                                                                onClick={() => onSelectPlayer?.(player)}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs font-bold text-white/40 w-8">#{player.number}</span>
                                                                    <span className="font-semibold">{player.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-4 text-xs">
                                                                    <div className="text-center">
                                                                        <p className="font-bold text-primary">{player.points || 0}</p>
                                                                        <p className="text-white/40">PTS</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.rebounds || 0}</p>
                                                                        <p className="text-white/40">REB</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.assists || 0}</p>
                                                                        <p className="text-white/40">AST</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.steals || 0}</p>
                                                                        <p className="text-white/40">STL</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.blocks || 0}</p>
                                                                        <p className="text-white/40">BLK</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Away Team Lineup */}
                                        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                                            <h3 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-4">
                                                {match.awayTeam?.name} Lineup
                                            </h3>

                                            {/* Starters */}
                                            {matchDetails.match.lineups.away.starters.length > 0 && (
                                                <div className="mb-6">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Starters</p>
                                                    <div className="space-y-2">
                                                        {matchDetails.match.lineups.away.starters.map((player: any) => (
                                                            <div
                                                                key={player.id}
                                                                className="bg-white/5 rounded-lg p-3 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer"
                                                                onClick={() => onSelectPlayer?.(player)}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs font-bold text-white/40 w-8">#{player.number}</span>
                                                                    <span className="font-semibold">{player.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-4 text-xs">
                                                                    <div className="text-center">
                                                                        <p className="font-bold text-primary">{player.points || 0}</p>
                                                                        <p className="text-white/40">PTS</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.rebounds || 0}</p>
                                                                        <p className="text-white/40">REB</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.assists || 0}</p>
                                                                        <p className="text-white/40">AST</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.steals || 0}</p>
                                                                        <p className="text-white/40">STL</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.blocks || 0}</p>
                                                                        <p className="text-white/40">BLK</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Bench */}
                                            {matchDetails.match.lineups.away.bench.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Bench</p>
                                                    <div className="space-y-2">
                                                        {matchDetails.match.lineups.away.bench.map((player: any) => (
                                                            <div
                                                                key={player.id}
                                                                className="bg-white/5 rounded-lg p-3 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer opacity-75"
                                                                onClick={() => onSelectPlayer?.(player)}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs font-bold text-white/40 w-8">#{player.number}</span>
                                                                    <span className="font-semibold">{player.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-4 text-xs">
                                                                    <div className="text-center">
                                                                        <p className="font-bold text-primary">{player.points || 0}</p>
                                                                        <p className="text-white/40">PTS</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.rebounds || 0}</p>
                                                                        <p className="text-white/40">REB</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.assists || 0}</p>
                                                                        <p className="text-white/40">AST</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.steals || 0}</p>
                                                                        <p className="text-white/40">STL</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="font-bold">{player.blocks || 0}</p>
                                                                        <p className="text-white/40">BLK</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
                                        <p className="text-white/40">No lineup data available for this match</p>
                                    </div>
                                )}
                            </motion.div>
                        )}


                        {/* Standings Tab */}
                        {activeTab === 'standings' && (
                            <motion.div
                                key="standings"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                {loading ? (
                                    <div className="py-20 text-center">
                                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-white/40">Loading standings...</p>
                                    </div>
                                ) : (
                                    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-white/5">
                                                    <tr className="text-xs font-bold uppercase tracking-wider text-white/60">
                                                        <th className="px-4 py-3 text-left">Pos</th>
                                                        <th className="px-4 py-3 text-left">Team</th>
                                                        <th className="px-4 py-3 text-center">P</th>
                                                        <th className="px-4 py-3 text-center">W</th>
                                                        <th className="px-4 py-3 text-center">L</th>
                                                        <th className="px-4 py-3 text-center">PF</th>
                                                        <th className="px-4 py-3 text-center">PA</th>
                                                        <th className="px-4 py-3 text-center">PD</th>
                                                        <th className="px-4 py-3 text-center">Pts</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {standings.map((standing, index) => {
                                                        const isHomeTeam = standing.team?.id === match.homeTeamId;
                                                        const isAwayTeam = standing.team?.id === match.awayTeamId;
                                                        const isHighlighted = isHomeTeam || isAwayTeam;

                                                        return (
                                                            <tr
                                                                key={standing.id}
                                                                className={`border-t border-white/5 ${isHighlighted ? 'bg-primary/10 border-primary/20' : 'hover:bg-white/5'
                                                                    } transition-colors`}
                                                            >
                                                                <td className="px-4 py-3">
                                                                    <span className={`font-bold ${index === 0 ? 'text-primary' : ''}`}>
                                                                        {index + 1}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div
                                                                        className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            standing.team && onSelectTeam?.(standing.team);
                                                                        }}
                                                                    >
                                                                        {isValidImagePath(standing.team?.logo) && (
                                                                            <div className="w-6 h-6 relative rounded overflow-hidden">
                                                                                <Image
                                                                                    src={standing.team.logo}
                                                                                    alt={standing.team.name}
                                                                                    fill
                                                                                    className="object-cover"
                                                                                />
                                                                            </div>
                                                                        )}
                                                                        <span className="font-semibold text-sm">{standing.team?.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center font-semibold">{standing.played}</td>
                                                                <td className="px-4 py-3 text-center font-semibold text-blue-500">{standing.won}</td>
                                                                <td className="px-4 py-3 text-center font-semibold text-red-500">{standing.lost}</td>
                                                                <td className="px-4 py-3 text-center font-semibold">{standing.goalsFor}</td>
                                                                <td className="px-4 py-3 text-center font-semibold">{standing.goalsAgainst}</td>
                                                                <td className={`px-4 py-3 text-center font-semibold ${standing.goalDifference > 0 ? 'text-blue-500' :
                                                                    standing.goalDifference < 0 ? 'text-red-500' : ''
                                                                    }`}>
                                                                    {standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className="px-2 py-1 bg-primary/20 text-primary rounded text-sm font-bold">
                                                                        {standing.points}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Scout Report Tab (MVP Leaderboard) */}
                        {activeTab === 'scout' && (
                            <motion.div
                                key="scout"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                                    <h3 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-6">
                                        MVP Leaderboard - {match.competition}
                                    </h3>
                                    <div className="space-y-2">
                                        {mvpLeaders.map((leader, index) => (
                                            <div
                                                key={leader.player}
                                                onClick={() => handlePlayerClick(leader.player)}
                                                className="bg-white/5 rounded-2xl border border-white/10 p-6 flex items-center justify-between hover:border-primary/50 transition-all cursor-pointer group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <span className={`text-lg font-bold w-8 ${index === 0 ? 'text-primary' :
                                                        index === 1 ? 'text-white' :
                                                            index === 2 ? 'text-orange-400' : 'text-white/60'
                                                        }`}>
                                                        {index + 1}
                                                    </span>
                                                    <div className="w-10 h-10 relative rounded-lg overflow-hidden bg-white/5">
                                                        <Image
                                                            src={leader.teamLogo}
                                                            alt={leader.team}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">{leader.player}</p>
                                                        <p className="text-xs text-white/40">{leader.team}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-center">
                                                        <p className="text-2xl font-bold text-primary">{leader.mvpCount}</p>
                                                        <p className="text-xs text-white/40">MVP{leader.mvpCount > 1 ? 's' : ''}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-lg font-bold">{leader.rating.toFixed(1)}</p>
                                                        <p className="text-xs text-white/40">Rating</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Predict Tab - For Upcoming Matches */}
                        {activeTab === 'predict' && match.status === 'UPCOMING' && (
                            <motion.div
                                key="predict"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Target className="text-primary" size={24} />
                                        <div>
                                            <h3 className="font-bold text-lg">Predict the Score</h3>
                                            <p className="text-sm text-white/60">Make your prediction and earn points!</p>
                                        </div>
                                    </div>
                                    <MatchPredictionCard
                                        match={{
                                            id: match.id,
                                            homeTeam: match.homeTeam || { id: '', name: 'Home', shortName: 'HOM', logo: '', color: '#000' },
                                            awayTeam: match.awayTeam || { id: '', name: 'Away', shortName: 'AWY', logo: '', color: '#000' },
                                            startTime: match.startTime,
                                            competition: match.competition,
                                            sport: 'Basketball',
                                        }}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* Fan Poll Tab - For Upcoming Matches */}
                        {activeTab === 'poll' && match.status === 'UPCOMING' && (
                            <motion.div
                                key="poll"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <BarChart3 className="text-primary" size={24} />
                                        <div>
                                            <h3 className="font-bold text-lg">Fan Poll</h3>
                                            <p className="text-sm text-white/60">Vote for your prediction!</p>
                                        </div>
                                    </div>
                                    <MatchVotePoll
                                        match={{
                                            id: match.id,
                                            homeTeam: match.homeTeam || { id: '', name: 'Home', shortName: 'HOM', logo: '', color: '#000' },
                                            awayTeam: match.awayTeam || { id: '', name: 'Away', shortName: 'AWY', logo: '', color: '#000' },
                                            startTime: match.startTime,
                                            sport: 'Basketball',
                                        }}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* Chat Tab - For Live Matches */}
                        {activeTab === 'chat' && match.status === 'LIVE' && (
                            <motion.div
                                key="chat"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="-mx-4 -my-8"
                            >
                                {/* Chat Header - Integrated */}
                                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20 px-4 py-4 flex items-center gap-3 sticky top-0 z-10 backdrop-blur-sm">
                                    <MessageSquare className="text-primary" size={20} />
                                    <div>
                                        <h3 className="font-bold">Live Chat</h3>
                                        <p className="text-xs text-white/60">Join the conversation</p>
                                    </div>
                                </div>

                                {/* Full-width Chat */}
                                <div className="h-[calc(100vh-300px)] min-h-[500px]">
                                    <LivestreamChat
                                        matchId={match.id}
                                        enabled={false}
                                        className="h-full"
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}


