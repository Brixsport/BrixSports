'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket, useMatchEvents, useMatchTimer } from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import {
    ArrowLeft, Clock, MapPin, Users, TrendingUp, Eye,
    Activity, BarChart3, Share2, Heart, Bell, Trophy, Play
} from 'lucide-react';
import MatchStatusBadge from '@/components/MatchStatusBadge';
import LiveMatchTimeline from '@/components/LiveMatchTimeline';
import LiveStats from '@/components/LiveStats';
import MatchLineups from '@/components/MatchLineups';
import { HeadToHeadComparison } from '@/components/HeadToHead';
// BACKSCOPED: 2026-06-08 — BACKLOG-028. Reinstate when: Polls + Predictions built (Phase 7)
// import MatchPoll from '@/components/MatchPoll';
// import { MatchPredictionCard, MatchVotePoll } from '@/components/predictions';
import { LivestreamView } from '@/components/livestream/LivestreamView';
import { useNotifications } from '@/components/Notifications';

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
    const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'stats' | 'lineups' | 'h2h'>('overview');
    const [isFavorited, setIsFavorited] = useState(false);
    const [h2hData, setH2hData] = useState<any>(null);
    const [scrollY, setScrollY] = useState(0);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [headerVisible, setHeaderVisible] = useState(true);

    const { isConnected, on, off } = useWebSocket({ matchId, autoConnect: true });
    const { events: liveEvents, latestEvent } = useMatchEvents(matchId);
    const matchTime = useMatchTimer(matchId);
    const { addNotification } = useNotifications();
    const { toasts, warning, success, removeToast } = useToast();
    const prevConnected = useRef<boolean | null>(null);
    const disconnectToastFired = useRef(false);

    const isUpcoming = matchData?.match?.status === 'UPCOMING';

    useEffect(() => {
        if (isUpcoming && activeTab === 'timeline') {
            setActiveTab('overview');
        }
    }, [isUpcoming]);

    const handleShare = async () => {
        const shareData = {
            title: `${matchData?.match?.homeTeam?.name} vs ${matchData?.match?.awayTeam?.name} - Brix Sports`,
            text: `Check out the live scores for ${matchData?.match?.homeTeam?.name} vs ${matchData?.match?.awayTeam?.name} on Brix Sports!`,
            url: window.location.href,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(window.location.href);
                addNotification({
                    title: 'Link Copied',
                    message: 'Match link copied to clipboard!',
                    type: 'match'
                });
            }
        } catch (err) {
            console.error('Share failed:', err);
        }
    };

    // Update match time in real-time
    useEffect(() => {
        if (matchData && matchTime) {
            setMatchData(prev => ({
                ...prev!,
                match: {
                    ...prev!.match,
                    minute: matchTime.minute,
                    extraTime: matchTime.extraTime,
                    status: matchTime.period || prev!.match.status
                },
            }));
        }
    }, [matchTime]);

    // Handle scroll for hide/show header behavior
    useEffect(() => {
        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY;

                    // Determine scroll direction
                    if (currentScrollY > lastScrollY && currentScrollY > 100) {
                        // Scrolling down & past threshold - hide header
                        setHeaderVisible(false);
                    } else if (currentScrollY < lastScrollY) {
                        // Scrolling up - show header
                        setHeaderVisible(true);
                    }

                    // Always show header at top of page
                    if (currentScrollY < 50) {
                        setHeaderVisible(true);
                    }

                    setScrollY(currentScrollY);
                    setLastScrollY(currentScrollY);
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    // Fetch match data
    useEffect(() => {
        fetchMatchData();
    }, [matchId]);

    // Update events in real-time
    useEffect(() => {
        if (matchData && latestEvent) {
            // Check if event already exists to avoid duplicates
            const exists = matchData.events.some(e => e.id === latestEvent.id);
            if (!exists) {
                setMatchData(prev => ({
                    ...prev!,
                    events: [latestEvent, ...prev!.events],
                }));
            }
        }
    }, [latestEvent]);

    // BUG-080: HTTP polling fallback when WS is disconnected during a live match.
    // Polls GET /api/matches/[id] every 10s — merges score, status, and events.
    useEffect(() => {
        const isLiveStatus = matchData?.match?.status === 'LIVE' || matchData?.match?.status === 'HALF_TIME';
        if (isConnected || !isLiveStatus) return;

        const interval = setInterval(fetchMatchData, 10000);
        return () => clearInterval(interval);
    }, [isConnected, matchData?.match?.status]);

    // Fire a one-shot toast when WS disconnects/reconnects during a live match.
    // disconnectToastFired ref prevents toast spam if WS flaps rapidly.
    useEffect(() => {
        const isLiveStatus = matchData?.match?.status === 'LIVE' || matchData?.match?.status === 'HALF_TIME';
        if (!isLiveStatus) return;
        if (prevConnected.current === null) { prevConnected.current = isConnected; return; }
        if (prevConnected.current === isConnected) return;
        prevConnected.current = isConnected;

        if (!isConnected && !disconnectToastFired.current) {
            warning('Live updates paused — refreshing automatically');
            disconnectToastFired.current = true;
        } else if (isConnected && disconnectToastFired.current) {
            success('Live updates restored');
            disconnectToastFired.current = false;
        }
    }, [isConnected, matchData?.match?.status]);

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

    // Period label — WS period (live) takes priority; DB currentPeriod is the fallback
    // for initial page load and when no logger is connected.
    const displayPeriod = matchTime?.period ?? match.currentPeriod ?? match.status;

    const ACTIVE_PLAY_PERIODS = ['FIRST_HALF', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2', 'PENALTY_SHOOTOUT'];
    const PERIOD_LABELS: Record<string, string> = {
        FIRST_HALF: '1ST HALF',
        HALF_TIME: 'HT',
        SECOND_HALF: '2ND HALF',
        EXTRA_TIME_1: 'ET1',
        EXTRA_TIME_2: 'ET2',
        PENALTY_SHOOTOUT: 'PK',
        FINISHED: 'FT',
    };

    const getPeriodLabel = (period: string) =>
        PERIOD_LABELS[period] ?? period.replace(/_/g, ' ');

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <ToastContainer toasts={toasts} onClose={removeToast} />
            {/* Sticky Header - Slides up/down based on scroll direction */}
            <div
                className="sticky top-0 z-40 bg-gradient-to-b from-[#050505] via-[#050505]/95 to-[#050505]/90 backdrop-blur-xl border-b border-white/10 transition-transform duration-300 ease-out"
                style={{
                    transform: headerVisible ? 'translateY(0)' : 'translateY(-100%)',
                }}
            >
                <div className="max-w-7xl mx-auto px-4 py-4">
                    {/* Top bar */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back</span>
                        </button>

                        <div className="flex items-center gap-3">
                            {isLive && !match.livestreamEnabled && (
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

                            <button
                                onClick={handleShare}
                                className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
                            >
                                <Share2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Match Info - Always visible */}
                    <div className="flex items-center justify-between gap-4">
                        {/* Home Team */}
                        <div className="flex items-center gap-3 flex-1">
                            <img
                                src={match.homeTeam.logo}
                                alt={match.homeTeam.name}
                                className="w-12 h-12 object-contain"
                            />
                            <div className="hidden sm:block">
                                <div className="font-bold text-lg">{match.homeTeam.name}</div>
                                <div className="text-sm text-white/60">{match.homeTeam.shortName}</div>
                            </div>
                        </div>

                        {/* Score */}
                        <div className="text-center">
                            <div className="flex items-center gap-4">
                                <div className="text-4xl font-black">{match.homeScore}</div>
                                <div className="text-2xl text-white/40">-</div>
                                <div className="text-4xl font-black">{match.awayScore}</div>
                            </div>
                            <div className="text-sm text-white/60 mt-1 uppercase font-bold tracking-wider">
                                {ACTIVE_PLAY_PERIODS.includes(displayPeriod) ? (
                                    <span className="flex items-center gap-1.5 justify-center">
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                        <span className="text-red-400">{getPeriodLabel(displayPeriod)}</span>
                                        {match.minute != null && (
                                            <span className="text-white/60">{match.minute}'{match.extraTime > 0 ? `+${match.extraTime}` : ''}</span>
                                        )}
                                    </span>
                                ) : (
                                    getPeriodLabel(displayPeriod)
                                )}
                            </div>
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center gap-3 flex-1 justify-end">
                            <div className="hidden sm:block text-right">
                                <div className="font-bold text-lg">{match.awayTeam.name}</div>
                                <div className="text-sm text-white/60">{match.awayTeam.shortName}</div>
                            </div>
                            <img
                                src={match.awayTeam.logo}
                                alt={match.awayTeam.name}
                                className="w-12 h-12 object-contain"
                            />
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 border-t border-white/10 overflow-x-auto scrollbar-hide mt-4">
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

                        {/* BACKSCOPED: 2026-06-08 — BACKLOG-028. Reinstate when: Predictions built (Phase 7) */}
                        {/* {isUpcoming && (
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
                        )} */}

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
                        {/* BACKSCOPED: 2026-06-08 — BACKLOG-028. Reinstate when: Polls built (Phase 7) */}
                        {/* <button
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
                        </button> */}
                    </div>
                </div>
            </div>

            {/* Content - Now naturally scrollable with the page */}
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
                                                <div className="font-bold capitalize">{getPeriodLabel(displayPeriod)}</div>
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
                                events={events}
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

                    {/* BACKSCOPED: 2026-06-08 — BACKLOG-028. Reinstate when: Polls + Predictions built (Phase 7) */}
                    {/* {activeTab === 'polls' && (
                        <motion.div key="polls" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <MatchPoll matchId={matchId} />
                        </motion.div>
                    )}
                    {activeTab === 'predictions' && match.status === 'UPCOMING' && (
                        <motion.div key="predictions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <MatchPredictionCard match={{ id: match.id, homeTeam: match.homeTeam, awayTeam: match.awayTeam, startTime: match.startTime, competition: match.competition, sport: match.sport }} />
                            <MatchVotePoll match={{ id: match.id, homeTeam: match.homeTeam, awayTeam: match.awayTeam, startTime: match.startTime }} />
                        </motion.div>
                    )} */}

                </AnimatePresence>
            </div>
        </div>
    );
}
