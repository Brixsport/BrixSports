'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket, useMatchEvents, useMatchTimer } from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import {
    ArrowLeft, Clock, MapPin, Users, TrendingUp, Eye,
    Activity, BarChart3, Share2, Star, Bell, Trophy, Play
} from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
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
import { getPushService } from '@/lib/notifications/push-service';
import { getDeviceId } from '@/lib/notifications/device-id';

// BACKLOG-150: which matchIds this device has an active anonymous "notify me"
// subscription for. localStorage is the right store here -- device-scoped by
// definition, no account to persist server-side preferences against.
const NOTIFY_STORAGE_KEY = 'brixsports_notify_matches';
function getNotifiedMatchIds(): Set<string> {
    try {
        return new Set(JSON.parse(localStorage.getItem(NOTIFY_STORAGE_KEY) || '[]'));
    } catch {
        return new Set();
    }
}
function setNotifiedMatchIds(ids: Set<string>) {
    localStorage.setItem(NOTIFY_STORAGE_KEY, JSON.stringify(Array.from(ids)));
}

// All status values that represent an in-progress match (WS timer overwrites match.status
// with period values like 'SECOND_HALF', so isLive must cover the full set).
const LIVE_STATES = new Set(['LIVE', 'HALF_TIME', 'FIRST_HALF', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2', 'PENALTY_SHOOTOUT']);

interface MatchData {
    match: any;
    events: any[];
    timeTracking: any[];
    eyePoints: any[];
}

export default function MatchDetailClient() {
    const params = useParams();
    const router = useRouter();
    const matchId = params.id as string;

    const [matchData, setMatchData] = useState<MatchData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'stats' | 'lineups' | 'h2h'>('overview');
    // BACKLOG-207: replaces the dead single Heart (pure local useState, no API
    // call, reset on reload) with two real per-team follow stars -- toggleTeam()
    // already works and is already the exact thing sendMatchEventNotification()
    // targets (either team followed -> match is notification-active).
    const { toggleTeam, isFavoriteTeam } = useFavorites();
    const [isNotifySubscribed, setIsNotifySubscribed] = useState(false);
    const [notifyLoading, setNotifyLoading] = useState(false);
    const [h2hData, setH2hData] = useState<any>(null);
    const [scrollY, setScrollY] = useState(0);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [headerVisible, setHeaderVisible] = useState(true);

    const { isConnected, on, off } = useWebSocket({ matchId, autoConnect: true });
    const { events: liveEvents, latestEvent } = useMatchEvents(matchId);
    const { time: matchTime, isStale: isMatchTimeStale } = useMatchTimer(matchId);
    const { addNotification } = useNotifications();
    const { toasts, warning, success, removeToast } = useToast();
    const prevConnected = useRef<boolean | null>(null);
    const disconnectToastFired = useRef(false);
    const prevConnectedForSync = useRef<boolean | null>(null);

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

    // BACKLOG-150: anonymous, no-login "notify me about this match" -- device-scoped
    // via localStorage + deviceId, no account required. Reachable by every viewer,
    // matching this project's own actor model (viewers never have a session).
    useEffect(() => {
        setIsNotifySubscribed(getNotifiedMatchIds().has(matchId));
    }, [matchId]);

    const handleNotifyToggle = async () => {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            warning('Push notifications are not supported on this browser.');
            return;
        }

        setNotifyLoading(true);
        try {
            const pushService = getPushService();
            const deviceId = getDeviceId();
            const notified = getNotifiedMatchIds();

            if (isNotifySubscribed) {
                const ok = await pushService.unsubscribe(null, { deviceId, matchId });
                if (ok) {
                    notified.delete(matchId);
                    setNotifiedMatchIds(notified);
                    setIsNotifySubscribed(false);
                    success('You will no longer be notified about this match.');
                } else {
                    warning('Could not turn off notifications for this match.');
                }
                return;
            }

            await pushService.init();
            const permission = pushService.getPermission() === 'granted'
                ? 'granted'
                : await pushService.requestPermission();

            if (permission !== 'granted') {
                warning('Notification permission was not granted.');
                return;
            }

            const subscription = await pushService.subscribe(null, { deviceId, matchId });
            if (subscription) {
                notified.add(matchId);
                setNotifiedMatchIds(notified);
                setIsNotifySubscribed(true);
                success('You will be notified about goals and key moments in this match.');
            } else {
                warning('Could not enable notifications for this match.');
            }
        } catch (err) {
            console.error('[MatchPage] Notify toggle failed:', err);
            warning('Something went wrong enabling notifications.');
        } finally {
            setNotifyLoading(false);
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

    // Update events in real-time — dedup by id OR (type+minute+playerId) to handle
    // temp-ID vs permanent-ID discrepancy from dual broadcast paths.
    useEffect(() => {
        if (matchData && latestEvent) {
            const exists = matchData.events.some(e =>
                e.id === latestEvent.id ||
                (e.type === latestEvent.type &&
                    e.minute === latestEvent.minute &&
                    e.playerId === latestEvent.playerId &&
                    e.teamId === latestEvent.teamId)
            );
            if (!exists) {
                setMatchData(prev => ({
                    ...prev!,
                    events: [latestEvent, ...prev!.events],
                }));
            }
        }
    }, [latestEvent]);

    // BUG-080: HTTP polling fallback when WS is disconnected during a live match.
    // Silent — does NOT show loading spinner, just merges fresh data into state.
    useEffect(() => {
        const isLiveStatus = LIVE_STATES.has(matchData?.match?.status ?? '');
        if (isConnected || !isLiveStatus) return;

        const interval = setInterval(() => fetchMatchData(true), 10000);
        return () => clearInterval(interval);
    }, [isConnected, matchData?.match?.status]);

    // BUG-108: low-frequency reconciliation poll, runs even while WS IS connected —
    // catches any event whose live broadcast never fired (offline-queue sync via the
    // Service Worker, or a REST write that landed while the logger's own socket happened
    // to be down). POST /api/matches/[id]/events never emits itself; the broadcast is
    // purely client-side from the logger's own tab, so a perfectly healthy viewer
    // connection is no guarantee every DB-persisted event was ever pushed. Slower than
    // BUG-080's disconnect-only poll above (25s vs 10s) since this is a defense-in-depth
    // check, not the primary recovery path — the two never run simultaneously.
    useEffect(() => {
        const isLiveStatus = LIVE_STATES.has(matchData?.match?.status ?? '');
        if (!isConnected || !isLiveStatus) return;

        const interval = setInterval(() => fetchMatchData(true), 25000);
        return () => clearInterval(interval);
    }, [isConnected, matchData?.match?.status]);

    // On WS reconnect: silently sync missed events from DB once.
    useEffect(() => {
        if (prevConnectedForSync.current === false && isConnected) {
            fetchMatchData(true);
        }
        prevConnectedForSync.current = isConnected;
    }, [isConnected]);

    // Fire a one-shot toast when WS disconnects/reconnects during a live match.
    // disconnectToastFired ref prevents toast spam if WS flaps rapidly.
    useEffect(() => {
        const isLiveStatus = LIVE_STATES.has(matchData?.match?.status ?? '');
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
    // BUG-235 (cross-session sweep, MEDIUM): this effect used to depend on the full
    // matchData object, which nearly every other effect in this component mutates --
    // every score update / event append / poll merge tore down and re-registered all
    // 4 socket listeners on the app's single highest-traffic page. Not a correctness
    // bug (off/on are synchronous, no gap), but needless churn. Each handler's
    // "is there data yet" check now lives inside its own setMatchData(prev => ...)
    // updater (which always sees the latest state regardless of closure staleness),
    // so the effect no longer needs matchData in its dependency array at all.
    useEffect(() => {
        const handleScoreUpdate = (data: any) => {
            if (data.matchId !== matchId) return;
            setMatchData(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    match: {
                        ...prev.match,
                        homeScore: data.homeScore,
                        awayScore: data.awayScore,
                        // BACKLOG-105: optional -- only present on a shootout kick broadcast,
                        // left untouched (spread from prev) for every other score update.
                        ...(data.shootoutHomeScore !== undefined ? { shootoutHomeScore: data.shootoutHomeScore } : {}),
                        ...(data.shootoutAwayScore !== undefined ? { shootoutAwayScore: data.shootoutAwayScore } : {}),
                    },
                };
            });
        };

        const handleStatusChange = (data: any) => {
            if (data.matchId !== matchId) return;
            setMatchData(prev => {
                if (!prev) return prev;
                return { ...prev, match: { ...prev.match, status: data.status } };
            });
        };

        // BUG-153: match:score:updated/match:status:changed are dead client-emit
        // paths from FootballLogger.tsx (event-name typo vs. what ws-server.js
        // actually listens for -- never fires, either sport). match:updated is
        // the real, already-firing, sport-agnostic broadcast (PATCH
        // /api/matches/[id]'s after() hook, fires on every admin/logger PATCH)
        // that this page never subscribed to. Kept the two dead-path listeners
        // above rather than removing them -- harmless no-ops today, and free
        // insurance if that emit-name bug is ever fixed at the source instead.
        const handleMatchUpdate = (data: any) => {
            if (data.matchId !== matchId) return;
            setMatchData(prev => {
                if (!prev) return prev;
                const nextMatch: any = { ...prev.match };
                if (data.status !== undefined) nextMatch.status = data.status;
                if (data.currentPeriod !== undefined) nextMatch.currentPeriod = data.currentPeriod;
                if (data.homeScore !== undefined) nextMatch.homeScore = data.homeScore;
                if (data.awayScore !== undefined) nextMatch.awayScore = data.awayScore;
                if (data.shootoutHomeScore !== undefined) nextMatch.shootoutHomeScore = data.shootoutHomeScore;
                if (data.shootoutAwayScore !== undefined) nextMatch.shootoutAwayScore = data.shootoutAwayScore;
                if (data.minute !== undefined) nextMatch.minute = data.minute;
                if (data.extraTime !== undefined) nextMatch.extraTime = data.extraTime;
                return { ...prev, match: nextMatch };
            });
        };

        // BUG-092: broadcastEventDeleted's 'event:deleted' is already received
        // correctly by useMatchEvents' own internal state (liveEvents, unused
        // here for rendering) -- but nothing was filtering it out of
        // matchData.events, the state the Timeline tab actually renders from.
        // Without this, a deleted event only vanished once the unrelated 25s
        // reconciliation poll (BUG-108) happened to refetch -- not instant.
        const handleEventDeleted = (data: { matchId: string; eventId: string }) => {
            if (data.matchId !== matchId) return;
            setMatchData(prev => {
                if (!prev) return prev;
                return { ...prev, events: prev.events.filter((e: any) => e.id !== data.eventId) };
            });
        };

        on('match:score:updated', handleScoreUpdate);
        on('match:status:changed', handleStatusChange);
        on('match:updated', handleMatchUpdate);
        on('event:deleted', handleEventDeleted);

        return () => {
            off('match:score:updated', handleScoreUpdate);
            off('match:status:changed', handleStatusChange);
            off('match:updated', handleMatchUpdate);
            off('event:deleted', handleEventDeleted);
        };
    }, [matchId, on, off]);

    const fetchMatchData = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const response = await fetch(`/api/matches/${matchId}`);
            const data = await response.json();

            // BUG-236: neither path checked response.ok or that `data` actually has the
            // shape a successful match fetch has before using it. A 404/error response
            // (e.g. the match got deleted, or any transient API error) doesn't have
            // `.events`/`.match` -- the silent-poll merge below then called `.map()` on
            // undefined and hard-crashed the ENTIRE page ("Cannot read properties of
            // undefined (reading 'map')"), and the non-silent path would have set
            // matchData to a shape without `.match`, crashing later at `match.status`.
            // Per CLAUDE.md's real-time rule ("viewer must see stale data clearly on
            // failure, not a crash"): a bad response during a silent background poll
            // should keep showing the last good state, not crash; a bad response on the
            // real initial load should fall through to the existing "Match not found" UI.
            if (!response.ok || !data?.match || !Array.isArray(data?.events)) {
                console.error('fetchMatchData: unexpected response shape', { status: response.status, silent, data });
                if (!silent) setMatchData(null);
                return;
            }

            if (silent) {
                // BUG-113: diff/merge instead of a wholesale replace on every silent poll —
                // reuses existing event objects' references when their id is unchanged, so
                // the Timeline doesn't visibly flicker/remount on every tick. Only genuinely
                // new events (by id) get a fresh object reference, which is what should
                // trigger their own enter animation. Same idea as the WS event:new handler
                // above, just applied to a full-list refresh instead of a single append.
                setMatchData(prev => {
                    if (!prev) return data;
                    const prevEventsById = new Map(prev.events.map((e: any) => [e.id, e]));
                    const mergedEvents = data.events.map((e: any) => prevEventsById.get(e.id) ?? e);
                    return { ...data, events: mergedEvents };
                });
            } else {
                setMatchData(data);
            }

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
            if (!silent) setLoading(false);
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
    const isLive = LIVE_STATES.has(match.status);

    // Red card indicators next to team names — same pattern as MatchOverlay.tsx,
    // never ported to this full detail page header.
    const homeRedCardsCount = (events || []).filter(e => e.type === 'Red Card' && e.teamId === match.homeTeamId).length;
    const awayRedCardsCount = (events || []).filter(e => e.type === 'Red Card' && e.teamId === match.awayTeamId).length;

    // BUG-197 root cause: shootoutHomeScore/shootoutAwayScore default to 0 (not
    // null) on every match, shootout or not (schema.ts), so the only thing that
    // ever hid "PEN 0-0" on a regular finished match was the `!==` inequality
    // check below -- which also hid the live score every time an in-progress
    // shootout happened to be tied (the normal case for most of a real
    // shootout: 1-1, 2-2, etc.). A tab already open when a tying kick landed
    // looked "stuck," when the state was actually updating correctly the whole
    // time -- this was misdiagnosed as a broadcast bug and filed as BUG-197.
    // While the shootout is actually live, show the running score regardless
    // of tie state (that's exactly what a live viewer is watching for). Once
    // FINISHED, fall back to the inequality check -- a shootout can never
    // legitimately end tied, so that's still the correct "did one happen at
    // all" signal for a match that's done.
    const isLiveShootout = match.currentPeriod === 'PENALTY_SHOOTOUT' || match.status === 'PENALTY_SHOOTOUT';
    const hasShootoutResult = match.shootoutHomeScore != null && match.shootoutAwayScore != null
        && (isLiveShootout || match.shootoutHomeScore !== match.shootoutAwayScore);

    // Period/clock — WS value takes priority, but only while it's actually fresh.
    // BUG-109: once useMatchTimer marks the WS value stale (socket disconnected), it
    // never gets nulled out — so without this gate a frozen matchTime would win over
    // ?? forever, even after the 10s polling fallback (BUG-080) refreshes match.* with
    // a newer DB-persisted checkpoint. DB fields (match.minute/extraTime/currentPeriod)
    // are the fallback for initial page load, no logger connected, and any stale WS value.
    const displayPeriod = (!isMatchTimeStale && matchTime?.period) ? matchTime.period : (match.currentPeriod ?? match.status);
    const liveMinute = (!isMatchTimeStale && matchTime?.minute != null) ? matchTime.minute : match.minute;
    const liveExtraTime = (!isMatchTimeStale && matchTime?.extraTime != null) ? matchTime.extraTime : match.extraTime;

    const ACTIVE_PLAY_PERIODS = ['FIRST_HALF', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2'];
    const BASKETBALL_ACTIVE_PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'];
    const PERIOD_LABELS: Record<string, string> = {
        // H1/H2 labels commented out — clock alone carries active play display (2026-06-30)
        // FIRST_HALF: 'H1',
        // SECOND_HALF: 'H2',
        HALF_TIME: 'HT',
        EXTRA_TIME_1: 'ET',
        EXTRA_TIME_2: 'ET',
        PENALTY_SHOOTOUT: 'PK',
        FINISHED: 'FT',
        SUSPENDED: 'SUSP',
    };

    // Full labels for the overview status card
    const PERIOD_LABELS_FULL: Record<string, string> = {
        FIRST_HALF: '1st Half',
        HALF_TIME: 'Half Time',
        SECOND_HALF: '2nd Half',
        EXTRA_TIME_1: 'Extra Time',
        EXTRA_TIME_2: 'Extra Time',
        PENALTY_SHOOTOUT: 'Penalties',
        FINISHED: 'Full Time',
        LIVE: 'Live',
        PENDING: 'Pending',
        UPCOMING: 'Upcoming',
        CANCELLED: 'Cancelled',
        SUSPENDED: 'Suspended',
        // Basketball -- without these, currentPeriod values written by BasketballLogger
        // (Q1-Q4/OT) fell through to the generic replace(/_/g,' ') fallback in
        // getPeriodLabel below, which happened to render tolerably ("Q1" has no
        // underscore to replace) but wasn't an explicit, intentional label the way
        // every other sport/status value here is.
        Q1: 'Q1',
        Q2: 'Q2',
        Q3: 'Q3',
        Q4: 'Q4',
        OT: 'OT',
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
                            <button
                                onClick={handleNotifyToggle}
                                disabled={notifyLoading}
                                aria-label={isNotifySubscribed ? 'Turn off notifications for this match' : 'Notify me about this match'}
                                title={isNotifySubscribed ? 'Turn off notifications for this match' : 'Notify me about this match'}
                                className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${isNotifySubscribed ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/60 hover:bg-white/10'
                                    }`}
                            >
                                <Bell className={`w-5 h-5 ${isNotifySubscribed ? 'fill-current' : ''}`} />
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
                            {/* Star sits outside the sm:block name wrapper below -- it's an
                                interactive control, not space-saving decorative text, and must
                                stay visible at every viewport width (BUG-214: was nested inside
                                "hidden sm:block", making it invisible on any real phone). */}
                            <button
                                onClick={() => toggleTeam(match.homeTeam.id)}
                                aria-label={isFavoriteTeam(match.homeTeam.id) ? `Unfollow ${match.homeTeam.name}` : `Follow ${match.homeTeam.name} — get alerts for this team's matches`}
                                title={isFavoriteTeam(match.homeTeam.id) ? 'Unfollow' : "Follow — get alerts for this team's matches"}
                                className={`transition-colors ${isFavoriteTeam(match.homeTeam.id) ? 'text-yellow-400' : 'text-white/30 hover:text-white/60'}`}
                            >
                                <Star className={`w-4 h-4 ${isFavoriteTeam(match.homeTeam.id) ? 'fill-current' : ''}`} />
                            </button>
                            <div className="hidden sm:block">
                                <div className="font-bold text-lg flex items-center gap-1.5">
                                    {match.homeTeam.name}
                                    {homeRedCardsCount > 0 && (
                                        <span className="flex gap-0.5">
                                            {Array.from({ length: homeRedCardsCount }).map((_, i) => (
                                                <div key={i} className="w-1.5 h-2.5 bg-red-600 rounded-[1px] shadow-[0_0_5px_rgba(220,38,38,0.5)]" />
                                            ))}
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-white/60">{match.homeTeam.shortName}</div>
                            </div>
                        </div>

                        {/* Score */}
                        <div className="text-center">
                            {/* BACKLOG-105/Richard's call: this is a single-match detail view, not a
                                scanned list -- the PEN X-Y line already makes the result unambiguous,
                                so no winner-color treatment here (that's a homepage/list-view thing). */}
                            <div className="flex items-center gap-4">
                                <div className="text-4xl font-black">{match.homeScore}</div>
                                <div className="text-2xl text-white/40">-</div>
                                <div className="text-4xl font-black">{match.awayScore}</div>
                            </div>
                            {hasShootoutResult && (
                                <div className="text-xs text-white/50 font-bold uppercase tracking-wider mt-0.5">
                                    PEN {match.shootoutHomeScore}-{match.shootoutAwayScore}
                                </div>
                            )}
                            <div className="text-sm text-white/60 mt-1 uppercase font-bold tracking-wider">
                                {isLive ? (
                                    <span className="flex items-center gap-1.5 justify-center">
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                        {ACTIVE_PLAY_PERIODS.includes(displayPeriod) ? (
                                            // Football active play — clock only, no H1/H2 label
                                            liveMinute != null ? (
                                                <span className="text-red-400">
                                                    {liveMinute}'{(liveExtraTime ?? 0) > 0 ? `+${liveExtraTime}` : ''}
                                                </span>
                                            ) : null
                                        ) : (BASKETBALL_ACTIVE_PERIODS.includes(displayPeriod) || displayPeriod?.startsWith('OT')) && !isMatchTimeStale && matchTime?.second != null ? (
                                            // Basketball active play — quarter label + countdown
                                            // (minute/second here are remaining-in-quarter, not
                                            // elapsed, unlike football's liveMinute above).
                                            <span className="text-red-400">
                                                {displayPeriod} {liveMinute}:{String(matchTime.second).padStart(2, '0')}
                                            </span>
                                        ) : (
                                            // HT / PK, or basketball before its first live tick — label only
                                            <span className="text-red-400">{getPeriodLabel(displayPeriod)}</span>
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
                                <div className="font-bold text-lg flex items-center justify-end gap-1.5">
                                    {awayRedCardsCount > 0 && (
                                        <span className="flex gap-0.5">
                                            {Array.from({ length: awayRedCardsCount }).map((_, i) => (
                                                <div key={i} className="w-1.5 h-2.5 bg-red-600 rounded-[1px] shadow-[0_0_5px_rgba(220,38,38,0.5)]" />
                                            ))}
                                        </span>
                                    )}
                                    {match.awayTeam.name}
                                </div>
                                <div className="text-sm text-white/60">{match.awayTeam.shortName}</div>
                            </div>
                            {/* Star sits outside the sm:block name wrapper above -- see the
                                matching comment on the home-team side (BUG-214). */}
                            <button
                                onClick={() => toggleTeam(match.awayTeam.id)}
                                aria-label={isFavoriteTeam(match.awayTeam.id) ? `Unfollow ${match.awayTeam.name}` : `Follow ${match.awayTeam.name} — get alerts for this team's matches`}
                                title={isFavoriteTeam(match.awayTeam.id) ? 'Unfollow' : "Follow — get alerts for this team's matches"}
                                className={`transition-colors ${isFavoriteTeam(match.awayTeam.id) ? 'text-yellow-400' : 'text-white/30 hover:text-white/60'}`}
                            >
                                <Star className={`w-4 h-4 ${isFavoriteTeam(match.awayTeam.id) ? 'fill-current' : ''}`} />
                            </button>
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
                                                <div className="font-bold capitalize">{PERIOD_LABELS_FULL[displayPeriod] ?? getPeriodLabel(displayPeriod)}</div>
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
