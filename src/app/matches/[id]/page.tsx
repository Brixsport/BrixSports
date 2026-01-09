'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
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

// Collapsing header constants
const HEADER_EXPANDED_HEIGHT = 200;
const HEADER_COLLAPSED_HEIGHT = 72;
const SCROLL_THRESHOLD = 150; // Distance to scroll before fully collapsed

export default function MatchDetailPage() {
    const params = useParams();
    const router = useRouter();
    const matchId = params.id as string;
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [matchData, setMatchData] = useState<MatchData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'stats' | 'lineups' | 'h2h' | 'polls' | 'predictions'>('overview');
    const [isFavorited, setIsFavorited] = useState(false);
    const [h2hData, setH2hData] = useState<any>(null);
    const [scrollY, setScrollY] = useState(0);

    const { isConnected, on, off } = useWebSocket({ matchId, autoConnect: true });
    const { events: liveEvents, latestEvent } = useMatchEvents(matchId);

    // Handle scroll for collapsing header
    useEffect(() => {
        const handleScroll = () => {
            if (scrollContainerRef.current) {
                setScrollY(scrollContainerRef.current.scrollTop);
            }
        };

        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, []);

    // Calculate header animation values based on scroll
    const scrollProgress = Math.min(scrollY / SCROLL_THRESHOLD, 1);
    const headerHeight = HEADER_EXPANDED_HEIGHT - (HEADER_EXPANDED_HEIGHT - HEADER_COLLAPSED_HEIGHT) * scrollProgress;
    const expandedContentOpacity = 1 - scrollProgress;
    const collapsedContentOpacity = scrollProgress;
    const scoreScale = 1 - (scrollProgress * 0.3); // Scale down score slightly

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

    useEffect(() => {
        if (isUpcoming && activeTab === 'timeline') {
            setActiveTab('predictions');
        }
    }, [isUpcoming]);

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col">
            {/* Collapsing Header - Absolute positioned, sticky */}
            <div
                className="sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-xl border-b border-white/10 transition-all duration-200"
                style={{ height: `${headerHeight}px` }}
            >
                <div className="max-w-7xl mx-auto px-4 h-full flex flex-col">
                    {/* Top bar - always visible */}
                    <div className="flex items-center justify-between py-4">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span style={{ opacity: expandedContentOpacity }}>Back</span>
                        </button>

                        <div className="flex items-center gap-3">
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

                    {/* Expanded content - fades out on scroll */}
                    <div
                        className="flex-1 overflow-hidden"
                        style={{ opacity: expandedContentOpacity, pointerEvents: scrollProgress > 0.5 ? 'none' : 'auto' }}
                    >
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

                        {/* Match Score - Expanded */}
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center">
                            {/* Home Team */}
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                    style={{ backgroundColor: match.homeTeam.color + '20' }}
                                >
                                    {match.homeTeam.logo ? (
                                        <img
                                            src={match.homeTeam.logo}
                                            alt={match.homeTeam.name}
                                            className="w-14 h-14 object-contain"
                                        />
                                    ) : (
                                        <span className="text-2xl font-bold">
                                            {match.homeTeam.shortName.substring(0, 2)}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-xl">{match.homeTeam.name}</div>
                                    <div className="text-white/60 text-sm">{match.homeTeam.shortName}</div>
                                </div>
                            </div>

                            {/* Score */}
                            <div className="text-center px-8">
                                <MatchStatusBadge status={match.status} className="mb-2" />
                                <div className="flex items-center gap-4">
                                    <motion.div
                                        key={`home-${match.homeScore}`}
                                        initial={{ scale: 1.3, color: '#10b981' }}
                                        animate={{ scale: scoreScale, color: '#ffffff' }}
                                        className="text-5xl font-bold"
                                    >
                                        {match.homeScore}
                                    </motion.div>
                                    <div className="text-2xl text-white/40">-</div>
                                    <motion.div
                                        key={`away-${match.awayScore}`}
                                        initial={{ scale: 1.3, color: '#10b981' }}
                                        animate={{ scale: scoreScale, color: '#ffffff' }}
                                        className="text-5xl font-bold"
                                    >
                                        {match.awayScore}
                                    </motion.div>
                                </div>
                            </div>

                            {/* Away Team */}
                            <div className="flex items-center gap-4 flex-row-reverse">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                    style={{ backgroundColor: match.awayTeam.color + '20' }}
                                >
                                    {match.awayTeam.logo ? (
                                        <img
                                            src={match.awayTeam.logo}
                                            alt={match.awayTeam.name}
                                            className="w-14 h-14 object-contain"
                                        />
                                    ) : (
                                        <span className="text-2xl font-bold">
                                            {match.awayTeam.shortName.substring(0, 2)}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 text-right">
                                    <div className="font-bold text-xl">{match.awayTeam.name}</div>
                                    <div className="text-white/60 text-sm">{match.awayTeam.shortName}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Collapsed content - fades in on scroll */}
                    <div
                        className="absolute top-0 left-0 right-0 h-[72px] flex items-center justify-between px-4 max-w-7xl mx-auto"
                        style={{ opacity: collapsedContentOpacity, pointerEvents: scrollProgress < 0.5 ? 'none' : 'auto' }}
                    >
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        {/* Collapsed score display */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-8 h-8 object-contain" />
                                <span className="font-bold">{match.homeTeam.shortName}</span>
                            </div>
                            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-lg">
                                <span className="text-2xl font-bold">{match.homeScore}</span>
                                <span className="text-white/40">-</span>
                                <span className="text-2xl font-bold">{match.awayScore}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{match.awayTeam.shortName}</span>
                                <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-8 h-8 object-contain" />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsFavorited(!isFavorited)}
                                className={`p-2 rounded-lg transition-colors ${isFavorited ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white/60 hover:bg-white/10'
                                    }`}
                            >
                                <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Tabs - always at bottom of header */}
                    <div className="flex gap-2 border-t border-white/10 overflow-x-auto">
                        {/* Overview Tab */}
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-6 py-3 font-medium transition-all relative whitespace-nowrap ${activeTab === 'overview'
                                ? 'text-primary'
                                : 'text-white/60 hover:text-white'
                                }`}
                        >
                            <Eye className="w-4 h-4 inline mr-2" />
                            Overview
                            {activeTab === 'overview' && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                />
                            )}
                        </button>

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

            {/* Scrollable Content */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto"
            >
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <AnimatePresence mode="wait">
                        {activeTab === 'overview' && (
                            <motion.div
                                key="overview"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                {/* Livestream Embedded View */}
                                {match.livestreamEnabled && match.livestreamUrl ? (
                                    <div className="space-y-6">
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
                                        />
                                    </div>
                                ) : (
                                    <div className="bg-white/5 border border-white/10 rounded-[24px] p-8">
                                        <div className="text-center">
                                            <Eye className="w-16 h-16 mx-auto mb-4 text-white/20" />
                                            <h3 className="text-xl font-bold mb-2">Match Overview</h3>
                                            <p className="text-white/60 mb-6">
                                                {isLive ? 'Match is currently live!' : isUpcoming ? 'Match starts soon' : 'Match has ended'}
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                                                <div className="bg-white/5 rounded-xl p-4">
                                                    <div className="text-sm text-white/40 mb-1">Venue</div>
                                                    <div className="font-bold">{match.venue}</div>
                                                </div>
                                                <div className="bg-white/5 rounded-xl p-4">
                                                    <div className="text-sm text-white/40 mb-1">Competition</div>
                                                    <div className="font-bold">{match.competition}</div>
                                                </div>
                                                <div className="bg-white/5 rounded-xl p-4">
                                                    <div className="text-sm text-white/40 mb-1">Status</div>
                                                    <div className="font-bold capitalize">{match.status.replace('_', ' ')}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

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
                                {match.stats && Object.keys(match.stats).length > 0 ? (
                                    <LiveStats
                                        stats={match.stats}
                                        sport={match.sport}
                                        homeTeam={match.homeTeam}
                                        awayTeam={match.awayTeam}
                                    />
                                ) : (
                                    <div className="bg-white/5 border border-white/10 rounded-[24px] p-12 text-center">
                                        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-white/20" />
                                        <h3 className="text-xl font-bold mb-2">Match Statistics Unavailable</h3>
                                        <p className="text-white/60">
                                            Statistics will be available once the match starts and events are logged.
                                        </p>
                                    </div>
                                )}
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

                        {activeTab === 'h2h' && (
                            <motion.div
                                key="h2h"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                {h2hData ? (
                                    <HeadToHeadComparison
                                        data={{
                                            team1: h2hData.team1,
                                            team2: h2hData.team2,
                                            headToHead: h2hData.headToHead,
                                            recentMatches: h2hData.recentMatches,
                                        }}
                                        showRecentMatches={true}
                                    />
                                ) : (
                                    <div className="bg-white/5 border border-white/10 rounded-[24px] p-12 text-center">
                                        <Trophy className="w-16 h-16 mx-auto mb-4 text-white/20" />
                                        <h3 className="text-xl font-bold mb-2">Head-to-Head Data Unavailable</h3>
                                        <p className="text-white/60">
                                            No historical data available for these teams yet.
                                        </p>
                                    </div>
                                )}
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
        </div>
    );
}
