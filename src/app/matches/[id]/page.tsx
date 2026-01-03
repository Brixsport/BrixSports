'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket, useMatchEvents } from '@/hooks/useWebSocket';
import {
    ArrowLeft, Clock, MapPin, Users, TrendingUp, Eye,
    Activity, BarChart3, Share2, Heart, Bell, Trophy, Play
} from 'lucide-react';
import MatchStatusBadge from '@/components/MatchStatusBadge';
import LiveMatchTimeline from '@/components/LiveMatchTimeline';
import LiveStats from '@/components/LiveStats';
import MatchLineups from '@/components/MatchLineups';
import { HeadToHeadComparison } from '@/components/HeadToHead';
import MatchPoll from '@/components/MatchPoll';
import { MatchPredictionCard, MatchVotePoll } from '@/components/predictions';
import { LivestreamView } from '@/components/livestream/LivestreamView';

interface MatchData {
    match: any;
    events: any[];
    timeTracking: any[];
    eyePoints: any[];
}

export default function MatchDetailPage() {
    const params = useParams();
    const router = useRouter();
    const matchId = params.id as string;

    const [matchData, setMatchData] = useState<MatchData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'timeline' | 'stats' | 'lineups' | 'h2h' | 'polls' | 'predictions'>('timeline');
    const [isFavorited, setIsFavorited] = useState(false);
    const [h2hData, setH2hData] = useState<any>(null);

    const { isConnected, on, off } = useWebSocket({ matchId, autoConnect: true });
    const { events: liveEvents, latestEvent } = useMatchEvents(matchId);

    // Fetch match data
    useEffect(() => {
        fetchMatchData();
    }, [matchId]);

    // Update events in real-time
    useEffect(() => {
        if (matchData && liveEvents.length > 0) {
            setMatchData(prev => ({
                ...prev!,
                events: [...liveEvents, ...prev!.events],
            }));
        }
    }, [liveEvents]);

    // Listen for score updates
    useEffect(() => {
        const handleScoreUpdate = (data: any) => {
            if (data.matchId === matchId && matchData) {
                setMatchData(prev => ({
                    ...prev!,
                    match: {
                        ...prev!.match,
                        homeScore: data.homeScore,
                        awayScore: data.awayScore,
                    },
                }));
            }
        };

        const handleStatusChange = (data: any) => {
            if (data.matchId === matchId && matchData) {
                setMatchData(prev => ({
                    ...prev!,
                    match: {
                        ...prev!.match,
                        status: data.status,
                    },
                }));
            }
        };

        on('match:score:updated', handleScoreUpdate);
        on('match:status:changed', handleStatusChange);

        return () => {
            off('match:score:updated', handleScoreUpdate);
            off('match:status:changed', handleStatusChange);
        };
    }, [matchId, matchData, on, off]);

    const fetchMatchData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/matches/${matchId}`);
            const data = await response.json();
            setMatchData(data);

            // Fetch head-to-head data
            if (data.match?.homeTeam && data.match?.awayTeam) {
                try {
                    const h2hRes = await fetch(
                        `/api/head-to-head?team1=${data.match.homeTeam.id}&team2=${data.match.awayTeam.id}&competition=${data.match.competition}`
                    );
                    const h2hData = await h2hRes.json();
                    setH2hData(h2hData);
                } catch (h2hError) {
                    console.error('Error fetching H2H data:', h2hError);
                }
            }
        } catch (error) {
            console.error('Error fetching match:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!matchData) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Match not found</h2>
                    <button
                        onClick={() => router.push('/live')}
                        className="text-primary hover:underline"
                    >
                        Back to live matches
                    </button>
                </div>
            </div>
        );
    }

    const { match, events, timeTracking, eyePoints } = matchData;
    const isLive = match.status === 'LIVE' || match.status === 'HALF_TIME';
    const isUpcoming = match.status === 'UPCOMING';

    // Set default tab to predictions for upcoming matches
    const [viewMode, setViewMode] = useState<'live' | 'details'>('live');

    useEffect(() => {
        if (isUpcoming && activeTab === 'timeline') {
            setActiveTab('predictions');
        }
    }, [isUpcoming]);

    // If Livestream is enabled, use the immersive player view
    if (match.livestreamEnabled && match.livestreamUrl && viewMode === 'live') {
        return (
            <LivestreamView
                match={match}
                livestream={{
                    livestreamUrl: match.livestreamUrl,
                    livestreamType: match.livestreamType,
                    livestreamEnabled: match.livestreamEnabled,
                    livestreamViewers: match.viewersCount,
                    livestreamChatEnabled: match.livestreamChatEnabled,
                    isActive: match.status === 'LIVE'
                }}
                onExit={() => setViewMode('details')}
            />
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white pb-20">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Back
                        </button>

                        <div className="flex items-center gap-3">
                            {/* Watch Live Button if stream exists */}
                            {match.livestreamEnabled && match.livestreamUrl && (
                                <button
                                    onClick={() => setViewMode('live')}
                                    className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-lg animate-pulse"
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                    <span className="text-sm font-bold">Watch Live</span>
                                </button>
                            )}

                            {isConnected && isLive && !match.livestreamEnabled && (
                                <div className="flex items-center gap-2 text-sm text-green-500">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    Live
                                </div>
                            )}

                            <button
                                onClick={() => setIsFavorited(!isFavorited)}
                                className={`p-2 rounded-lg transition-colors ${isFavorited ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white/60 hover:bg-white/10'
                                    }`}
                            >
                                <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
                            </button>

                            <button className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors">
                                <Share2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Competition Info */}
                    {match.competition && (
                        <div className="flex items-center gap-3 mb-4">
                            {match.competition.logo && (
                                <img
                                    src={match.competition.logo}
                                    alt={match.competition.name}
                                    className="w-8 h-8 rounded-lg object-cover"
                                />
                            )}
                            <div>
                                <div className="font-semibold">{match.competition.name}</div>
                                <div className="text-sm text-white/60 flex items-center gap-2">
                                    <MapPin className="w-3 h-3" />
                                    {match.venue}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Match Score */}
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center mb-4">
                        {/* Home Team */}
                        <div className="flex items-center gap-4">
                            <div
                                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                                style={{ backgroundColor: match.homeTeam.color + '20' }}
                            >
                                {match.homeTeam.logo ? (
                                    <img
                                        src={match.homeTeam.logo}
                                        alt={match.homeTeam.name}
                                        className="w-16 h-16 object-contain"
                                    />
                                ) : (
                                    <span className="text-3xl font-bold">
                                        {match.homeTeam.shortName.substring(0, 2)}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-2xl">{match.homeTeam.name}</div>
                                <div className="text-white/60">{match.homeTeam.shortName}</div>
                            </div>
                        </div>

                        {/* Score */}
                        <div className="text-center px-8">
                            <MatchStatusBadge status={match.status} className="mb-4" />
                            <div className="flex items-center gap-4">
                                <motion.div
                                    key={`home-${match.homeScore}`}
                                    initial={{ scale: 1.3, color: '#10b981' }}
                                    animate={{ scale: 1, color: '#ffffff' }}
                                    className="text-6xl font-bold"
                                >
                                    {match.homeScore}
                                </motion.div>
                                <div className="text-3xl text-white/40">-</div>
                                <motion.div
                                    key={`away-${match.awayScore}`}
                                    initial={{ scale: 1.3, color: '#10b981' }}
                                    animate={{ scale: 1, color: '#ffffff' }}
                                    className="text-6xl font-bold"
                                >
                                    {match.awayScore}
                                </motion.div>
                            </div>
                            <div className="text-sm text-white/60 mt-2 flex items-center justify-center gap-2">
                                <Users className="w-4 h-4" />
                                {match.viewersCount} watching
                            </div>
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center gap-4 flex-row-reverse">
                            <div
                                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                                style={{ backgroundColor: match.awayTeam.color + '20' }}
                            >
                                {match.awayTeam.logo ? (
                                    <img
                                        src={match.awayTeam.logo}
                                        alt={match.awayTeam.name}
                                        className="w-16 h-16 object-contain"
                                    />
                                ) : (
                                    <span className="text-3xl font-bold">
                                        {match.awayTeam.shortName.substring(0, 2)}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 text-right">
                                <div className="font-bold text-2xl">{match.awayTeam.name}</div>
                                <div className="text-white/60">{match.awayTeam.shortName}</div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-white/10 overflow-x-auto">
                        {/* Predictions Tab - First for upcoming matches */}
                        {isUpcoming && (
                            <button
                                onClick={() => setActiveTab('predictions')}
                                className={`px-6 py-3 font-medium transition-all relative whitespace-nowrap ${activeTab === 'predictions'
                                    ? 'text-primary'
                                    : 'text-white/60 hover:text-white'
                                    }`}
                            >
                                <TrendingUp className="w-4 h-4 inline mr-2" />
                                Predictions
                                {activeTab === 'predictions' && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                    />
                                )}
                            </button>
                        )}

                        {/* Timeline - Only for live/finished matches */}
                        {!isUpcoming && (
                            <button
                                onClick={() => setActiveTab('timeline')}
                                className={`px-6 py-3 font-medium transition-all relative whitespace-nowrap ${activeTab === 'timeline'
                                    ? 'text-primary'
                                    : 'text-white/60 hover:text-white'
                                    }`}
                            >
                                <Activity className="w-4 h-4 inline mr-2" />
                                Timeline
                                {activeTab === 'timeline' && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                    />
                                )}
                            </button>
                        )}

                        {/* Stats - Only for live/finished matches */}
                        {!isUpcoming && (
                            <button
                                onClick={() => setActiveTab('stats')}
                                className={`px-6 py-3 font-medium transition-all relative whitespace-nowrap ${activeTab === 'stats'
                                    ? 'text-primary'
                                    : 'text-white/60 hover:text-white'
                                    }`}
                            >
                                <BarChart3 className="w-4 h-4 inline mr-2" />
                                Stats
                                {activeTab === 'stats' && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                    />
                                )}
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('lineups')}
                            className={`px-6 py-3 font-medium transition-all relative whitespace-nowrap ${activeTab === 'lineups'
                                ? 'text-primary'
                                : 'text-white/60 hover:text-white'
                                }`}
                        >
                            <Users className="w-4 h-4 inline mr-2" />
                            Lineups
                            {activeTab === 'lineups' && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('h2h')}
                            className={`px-6 py-3 font-medium transition-all relative whitespace-nowrap ${activeTab === 'h2h'
                                ? 'text-primary'
                                : 'text-white/60 hover:text-white'
                                }`}
                        >
                            <Trophy className="w-4 h-4 inline mr-2" />
                            H2H
                            {activeTab === 'h2h' && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('polls')}
                            className={`px-6 py-3 font-medium transition-all relative whitespace-nowrap ${activeTab === 'polls'
                                ? 'text-primary'
                                : 'text-white/60 hover:text-white'
                                }`}
                        >
                            <BarChart3 className="w-4 h-4 inline mr-2" />
                            Polls
                            {activeTab === 'polls' && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <AnimatePresence mode="wait">
                    {activeTab === 'timeline' && (
                        <motion.div
                            key="timeline"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <LiveMatchTimeline
                                events={events}
                                homeTeam={match.homeTeam}
                                awayTeam={match.awayTeam}
                                eyePoints={eyePoints}
                                sport={match.sport}
                            />
                        </motion.div>
                    )}

                    {activeTab === 'stats' && (
                        <motion.div
                            key="stats"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <LiveStats
                                stats={match.stats}
                                sport={match.sport}
                                homeTeam={match.homeTeam}
                                awayTeam={match.awayTeam}
                            />
                        </motion.div>
                    )}

                    {activeTab === 'lineups' && (
                        <motion.div
                            key="lineups"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <MatchLineups
                                lineups={match.lineups}
                                sport={match.sport}
                                homeTeam={match.homeTeam}
                                awayTeam={match.awayTeam}
                            />
                        </motion.div>
                    )}

                    {activeTab === 'h2h' && h2hData && (
                        <motion.div
                            key="h2h"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <HeadToHeadComparison
                                data={{
                                    team1: h2hData.team1,
                                    team2: h2hData.team2,
                                    headToHead: h2hData.headToHead,
                                    recentMatches: h2hData.recentMatches,
                                }}
                                showRecentMatches={true}
                            />
                        </motion.div>
                    )}

                    {activeTab === 'polls' && (
                        <motion.div
                            key="polls"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <MatchPoll matchId={matchId} />
                        </motion.div>
                    )}

                    {activeTab === 'predictions' && match.status === 'UPCOMING' && (
                        <motion.div
                            key="predictions"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                        >
                            <MatchPredictionCard
                                match={{
                                    id: match.id,
                                    homeTeam: match.homeTeam,
                                    awayTeam: match.awayTeam,
                                    startTime: match.startTime,
                                    competition: match.competition,
                                    sport: match.sport,
                                }}
                            />
                            <MatchVotePoll
                                match={{
                                    id: match.id,
                                    homeTeam: match.homeTeam,
                                    awayTeam: match.awayTeam,
                                    startTime: match.startTime,
                                }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
