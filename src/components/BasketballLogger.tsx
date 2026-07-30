'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Save, Undo2, Clock, Users, TrendingUp, Target, Play, Settings } from 'lucide-react';
import { useMultiLogger } from '@/hooks/useMultiLogger';
import { useWebSocket } from '@/hooks/useWebSocket';
import { queueOfflineEvent, jwtSecondsRemaining } from '@/lib/admin-offline-queue';
import { MultiLoggerStatus } from '@/components/MultiLoggerStatus';
import type { SyncEvent } from '@/lib/multiLogger';
import { getPrimaryTeam } from '@/lib/player-affiliation-utils';


import { MatchEvent } from '@/types';
import { Match, Logger, Player, Team } from '@/db/schema';

interface BasketballLoggerProps {
    match: Match;
    onExit: () => void;
    currentLogger: Logger | null;
}

type BasketballEventType = 'Field Goal' | 'Three Pointer' | 'Free Throw' | 'Rebound' | 'Assist' | 'Steal' | 'Block' | 'Turnover' | 'Foul' | 'Substitution' | 'Timeout';

export function BasketballLogger({ match, onExit, currentLogger }: BasketballLoggerProps) {
    const [homeScore, setHomeScore] = useState(match.homeScore || 0);
    const [awayScore, setAwayScore] = useState(match.awayScore || 0);

    // Determine if it's a 3x3 match
    const is3x3 = (match.sport as string) === '3x3 Basketball' ||
        (match.sport as string) === 'Basketball 3x3' ||
        match.competition?.toLowerCase().includes('3x3');

    const STARTER_COUNT = is3x3 ? 3 : 5;
    const [quarter, setQuarter] = useState(1);
    const [time, setTime] = useState('12:00');
    // Wall-clock timestamp of when the current quarter/OT began. `time` is a manual,
    // static display value (never auto-decrements -- no ticking clock exists here,
    // by design, see the minute/second comment below) -- using it for event
    // timestamps meant every event logged within the same quarter got an identical
    // (minute, second) pair, since `time` only changes at quarter-reset points.
    // quarterStartedAt gives each event a real, distinct, monotonically increasing
    // timestamp within the quarter, without building a live-ticking clock display
    // (deliberately out of scope -- minimal fix, not football-parity live clock).
    const [quarterStartedAt, setQuarterStartedAt] = useState<number>(Date.now());
    const [events, setEvents] = useState<any[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
    const [homeTeam, setHomeTeam] = useState<Team | null>(null);
    const [awayTeam, setAwayTeam] = useState<Team | null>(null);
    const [homePlayers, setHomePlayers] = useState<Player[]>([]);
    const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
    const getPlayerTeam = (player?: Player | null) =>
        player ? (getPrimaryTeam(player as Player & Record<string, unknown>) as Team | null) : null;
    const [isLoading, setIsLoading] = useState(true);
    const [matchStarted, setMatchStarted] = useState(match.status === 'LIVE');
    const [matchEnded, setMatchEnded] = useState(match.status === 'FINISHED');
    const [viewMode, setViewMode] = useState<'logger' | 'stats' | 'history'>('logger');
    const [isSaving, setIsSaving] = useState(false);
    const [isUndoing, setIsUndoing] = useState(false);
    // BACKLOG-134: scoring buttons were only disabled by !matchStarted || matchEnded --
    // a rapid double-tap (most reachable via the player-select modal, which every
    // scoring action routes through) fired two independently-atomic recordEvent()
    // calls, double-logging the same action server-side. Guards recordEvent itself so
    // it holds regardless of which UI entry point triggers it.
    const [isRecording, setIsRecording] = useState(false);
    // A useState guard alone is not sufficient here -- confirmed live, not a
    // hypothetical: a true simultaneous double-click can fire two click handler
    // invocations against the SAME render's closure before React commits the
    // setIsRecording(true) update, so both invocations read the same stale
    // `isRecording === false` and both proceed. A ref mutation is synchronous and
    // visible immediately to any closure holding the same ref object, regardless of
    // which render created it -- this is the actual guard; `isRecording` state is
    // kept only to drive the buttons' visual disabled state.
    const isRecordingRef = useRef(false);
    // Visible failure signal for event-save failures -- recordEvent used to only
    // console.error on failure, with no on-screen indication the event never saved.
    const [eventSaveError, setEventSaveError] = useState<string | null>(null);



    // Modal-based player selection
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [pendingEvent, setPendingEvent] = useState<{ type: BasketballEventType; points?: number } | null>(null);
    const [selectedEventPlayer, setSelectedEventPlayer] = useState<string | null>(null);
    const [showAssistModal, setShowAssistModal] = useState(false);


    // Settings
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [quarterDuration, setQuarterDuration] = useState(12); // minutes per quarter — overwritten by match config on mount
    // BUG-134 (minimal scope): foul-out disqualification only. Sport-level default
    // (config/route.ts's SPORT_DEFAULTS.basketball.foulDisqualifyAt, FIBA-style, "not
    // confirmed against BUSA's actual rulebook") -- no competition-level override yet,
    // no team-foul bonus tracking. Both filed as follow-up scope, not built here.
    const [foulDisqualifyAt, setFoulDisqualifyAt] = useState(5);
    const [periodCount, setPeriodCount] = useState(4); // quarters — overwritten by match config on mount
    const [overtimeDurationMinutes, setOvertimeDurationMinutes] = useState(5); // overwritten by match config on mount

    // Lineup Management
    const [showLineupModal, setShowLineupModal] = useState(false);
    const [homeStarters, setHomeStarters] = useState<string[]>([]);
    const [awayStarters, setAwayStarters] = useState<string[]>([]);
    const [homeSubs, setHomeSubs] = useState<string[]>([]);
    const [awaySubs, setAwaySubs] = useState<string[]>([]);
    const [lineupSet, setLineupSet] = useState(false);

    // Substitution process
    const [showSubInModal, setShowSubInModal] = useState(false);
    const [playerComingOut, setPlayerComingOut] = useState<string | null>(null);

    // Period Transitions
    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [isSemiFinal, setIsSemiFinal] = useState(true); // Matches are semi-finals
    const [isOT, setIsOT] = useState(false);
    // BUG-135: quarter number alone can't distinguish OT1 from OT2 -- both the
    // tie-check branch and "Add Extra Time" button used to call the identical
    // setQuarter(periodCount + 1) every time, so a genuine second overtime never
    // advanced past the first, and both would be stored with the same flat 'OT'
    // period string in match_events. Tracked separately so the period label can be
    // `OT${otNumber}` instead.
    const [otNumber, setOtNumber] = useState(0);


    // Quarter End Handling
    const [quarterEnded, setQuarterEnded] = useState(false);
    const [showQuarterBreak, setShowQuarterBreak] = useState(false);

    // Multi-logger support
    const {
        activeLoggers,
        conflicts,
        isConnected,
        syncStatus,
        syncEvents,
        broadcastEvent,
        resolveConflict,
    } = useMultiLogger({
        matchId: match.id,
        loggerId: currentLogger?.id || 'unknown',
        loggerName: currentLogger?.name || 'Unknown Logger',
        enabled: !!currentLogger,
    });

    // WebSocket -- BasketballLogger never had this at all before (BUG-153's audit
    // note: "no WS emit wired for basketball at all"). Mirrors FootballLogger's own
    // setup exactly, same shared-socket singleton, so this doesn't open a second
    // connection alongside useMultiLogger's (which is polling-based, not socket-based).
    const { emit, isConnected: isSocketConnected } = useWebSocket({
        matchId: match.id,
        autoConnect: true,
    });

    // Debug: Monitor lineup modal state
    useEffect(() => {
        console.log('🎭 Lineup Modal State Changed:', showLineupModal);
        console.log('📊 Current State:', {
            showLineupModal,
            lineupSet,
            homePlayersCount: homePlayers.length,
            awayPlayersCount: awayPlayers.length,
            homeStartersCount: homeStarters.length,
            awayStartersCount: awayStarters.length
        });
    }, [showLineupModal, lineupSet, homePlayers.length, awayPlayers.length, homeStarters.length, awayStarters.length]);

    // BUG-140: AuthContext wipes localStorage.authToken when /api/auth/me returns
    // 401 for logger roles. FootballLogger re-seeds it on mount via /api/auth/refresh
    // (BUG-058b) -- basketball had no equivalent, so any session hitting that 401-wipe
    // path lost its token permanently with no recovery.
    useEffect(() => {
        const ensureLocalToken = async () => {
            try {
                const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.token) localStorage.setItem('authToken', data.token);
                }
            } catch {
                // offline at mount -- silently ignore, token may already be in localStorage
            }
        };
        ensureLocalToken();
    }, []);

    // BUG-142: basketball had no offline-queue/retry mechanism at all -- a failed
    // event write during a network drop was visible (BACKLOG-134's error banner)
    // but never recoverable. Ports FootballLogger's own proven mechanism
    // (BACKLOG-058, live-tested on staging) rather than building a new one --
    // same IndexedDB store sw-admin.js already drains, so no service-worker
    // change is needed, only the write side.
    const [queuedOfflineCount, setQueuedOfflineCount] = useState(0);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        const handleMessage = (e: MessageEvent) => {
            if (e.data?.type === 'SYNC_COMPLETE' && e.data?.tag === 'sync-match-events') {
                setQueuedOfflineCount(0);
            }
        };
        navigator.serviceWorker.addEventListener('message', handleMessage);
        return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }, []);

    // iOS drain fallback -- Background Sync API is a no-op on iOS (BACKLOG-107).
    // When the page comes online or becomes visible, trigger a drain directly:
    // Android/desktop: re-register the sync tag (idempotent).
    // iOS: postMessage DRAIN_MATCH_EVENTS to the SW, which calls syncMatchEvents().
    useEffect(() => {
        const triggerDrain = () => {
            if (!('serviceWorker' in navigator)) return;
            navigator.serviceWorker.ready.then((reg) => {
                if ('sync' in reg) {
                    (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
                        .sync.register('sync-match-events').catch(() => {});
                } else if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'DRAIN_MATCH_EVENTS' });
                }
            }).catch(() => {});
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') triggerDrain();
        };
        window.addEventListener('online', triggerDrain);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('online', triggerDrain);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    // Dynamic Player Rating Calculation
    const calculatePlayerRating = (playerId: string, currentEvents: any[] = events) => {
        const playerEvents = currentEvents.filter(e => e.playerId === playerId || e.assistPlayerId === playerId);
        let rating = 0;

        playerEvents.forEach(event => {
            // Main player rating
            if (event.playerId === playerId) {
                switch (event.type) {
                    case 'Field Goal':
                    case 'Three Pointer':
                    case 'Free Throw': {
                        // event.value can arrive as a string (match_events.value is a
                        // TEXT column) via useMultiLogger's periodic sync -- coerce
                        // defensively here too, mirroring FootballLogger's equivalent
                        // rating calc, so a future un-coerced read path can't silently
                        // turn `rating` into a string and crash `.toFixed()` below.
                        const shotValue = Number(event.value);
                        if (shotValue > 0) {
                            rating += shotValue; // Made shot
                        } else {
                            rating -= 1; // Missed shot
                        }
                        break;
                    }
                    case 'Rebound':
                        rating += 1.5;
                        break;
                    case 'Assist':
                        rating += 2;
                        break;
                    case 'Steal':
                        rating += 2.5;
                        break;
                    case 'Block':
                        rating += 2.5;
                        break;
                    case 'Turnover':
                        rating -= 2;
                        break;
                    case 'Foul':
                        rating -= 1;
                        break;
                    case 'Substitution':
                        // Substitution doesn't affect rating directly
                        break;
                }
            }

            // Bonus for providing an assist
            if (event.assistPlayerId === playerId) {
                rating += 2;
            }
        });

        return rating.toFixed(1);
    };

    // Advanced Stats Calculation
    const calculateAdvancedStats = (playerId: string) => {
        const playerEvents = events.filter(e => e.playerId === playerId);

        const stats = {
            pts: 0,
            reb: 0,
            ast: events.filter(e => e.assistPlayerId === playerId).length,
            stl: 0,
            blk: 0,
            tov: 0,
            pf: 0,
            fga: 0,
            fgm: 0,
            threePa: 0,
            threePm: 0,
            fta: 0,
            ftm: 0,
        };

        playerEvents.forEach(e => {
            if (e.type === 'Field Goal') {
                stats.fga++;
                if (e.value === 2) {
                    stats.fgm++;
                    stats.pts += 2;
                }
            } else if (e.type === 'Three Pointer') {
                stats.fga++;
                stats.threePa++;
                if (e.value === 3) {
                    stats.fgm++;
                    stats.threePm++;
                    stats.pts += 3;
                }
            } else if (e.type === 'Free Throw') {
                stats.fta++;
                if (e.value === 1) {
                    stats.ftm++;
                    stats.pts += 1;
                }
            } else if (e.type === 'Rebound') stats.reb++;
            else if (e.type === 'Steal') stats.stl++;
            else if (e.type === 'Block') stats.blk++;
            else if (e.type === 'Turnover') stats.tov++;
            else if (e.type === 'Foul') stats.pf++;
        });

        // Computed Percentages
        const fgPct = stats.fga > 0 ? (stats.fgm / stats.fga * 100).toFixed(1) : '0.0';
        const threePct = stats.threePa > 0 ? (stats.threePm / stats.threePa * 100).toFixed(1) : '0.0';
        const ftPct = stats.fta > 0 ? (stats.ftm / stats.fta * 100).toFixed(1) : '0.0';

        // Effective FG% (eFG%) = (FGM + 0.5 * 3PM) / FGA
        const eFgPct = stats.fga > 0 ? ((stats.fgm + 0.5 * stats.threePm) / stats.fga * 100).toFixed(1) : '0.0';

        return { ...stats, fgPct, threePct, ftPct, eFgPct };
    };

    // Fetch teams, players, and existing events
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch teams and eligible players in parallel
                const [teamsResponse, playersResponse, eligibleResponse] = await Promise.all([
                    fetch('/api/teams'),
                    fetch('/api/players'),
                    fetch(`/api/matches/${match.id}/eligible-players`)
                ]);

                const teamsData = await teamsResponse.json();
                const playersData = await playersResponse.json();
                const eligibleData = await eligibleResponse.json();

                // Handle different response formats for teams
                const teamsArray = Array.isArray(teamsData) ? teamsData : (teamsData.teams || teamsData.data || []);

                const home = teamsArray.find((t: Team) => t.id === match.homeTeamId);
                const away = teamsArray.find((t: Team) => t.id === match.awayTeamId);

                setHomeTeam(home || null);
                setAwayTeam(away || null);

                // Use eligible players filtered by institutional data if available
                const playersArray = eligibleData.success 
                    ? eligibleData.players 
                    : (Array.isArray(playersData)
                        ? playersData
                        : (playersData.players || playersData.data || []));

                console.log('🏀 Eligible players fetched:', playersArray.length);
                console.log('🏠 Home team ID:', match.homeTeamId);
                console.log('✈️ Away team ID:', match.awayTeamId);

                // BUG-061: getPlayerTeam() alone only resolves a player's PRIMARY team
                // affiliation -- a player whose basketball-team affiliation isn't marked
                // primary (e.g. their college/department affiliation is primary instead)
                // was silently dropped from every roster, for every basketball match.
                // Confirmed live: every coleng-basketball/colnas-basketball affiliation in
                // the DB has is_primary=0, so this filter matched zero players for either
                // team on any real match -- the lineup modal always showed 0 selectable
                // players. Same fix FootballLogger.tsx already applies: check memberships
                // against the actual match team first, fall back to primary team only if
                // that's absent.
                const homePlayersList = playersArray.filter((player: Player) =>
                    (player as any).memberships?.some((m: any) => m.team?.id === match.homeTeamId)
                    || getPlayerTeam(player)?.id === match.homeTeamId
                );
                const awayPlayersList = playersArray.filter((player: Player) =>
                    (player as any).memberships?.some((m: any) => m.team?.id === match.awayTeamId)
                    || getPlayerTeam(player)?.id === match.awayTeamId
                );

                console.log('🏠 Home players:', homePlayersList.length);
                console.log('✈️ Away players:', awayPlayersList.length);

                setHomePlayers(homePlayersList);
                setAwayPlayers(awayPlayersList);

                // BACKLOG-141: real server-side lineup persistence, mirroring football's
                // GET /api/matches/[id]/lineup exactly -- that endpoint was always
                // sport-agnostic (generic team/lineup JSON on the matches row), basketball
                // just never called it. Try the real persisted lineup first; only fall
                // back to BUG-139's full-roster seed (doesn't distinguish on-court from
                // bench) if nothing was ever actually published for this match.
                let hydratedFromServer = false;
                try {
                    const lineupRes = await fetch(`/api/matches/${match.id}/lineup`);
                    if (lineupRes.ok) {
                        const lineupData = await lineupRes.json();
                        const homeLineup = lineupData?.lineups?.home;
                        const awayLineup = lineupData?.lineups?.away;
                        if (lineupData.success && (homeLineup || awayLineup)) {
                            const idsFrom = (l: any) => (l?.starters || l?.players || [])
                                .map((p: any) => p.playerId || p.id || p)
                                .filter(Boolean);
                            const subsFrom = (l: any) => (l?.substitutes || [])
                                .map((p: any) => p.playerId || p.id || p)
                                .filter(Boolean);
                            if (homeLineup) {
                                setHomeStarters(idsFrom(homeLineup));
                                setHomeSubs(subsFrom(homeLineup));
                            }
                            if (awayLineup) {
                                setAwayStarters(idsFrom(awayLineup));
                                setAwaySubs(subsFrom(awayLineup));
                            }
                            setLineupSet(true);
                            hydratedFromServer = true;
                        }
                    }
                } catch (e) {
                    console.error('Failed to fetch persisted lineup:', e);
                }

                if (!hydratedFromServer && match.status === 'LIVE') {
                    setHomeStarters(prev => prev.length > 0 ? prev : homePlayersList.map((p: Player) => p.id));
                    setAwayStarters(prev => prev.length > 0 ? prev : awayPlayersList.map((p: Player) => p.id));
                    setLineupSet(true);
                }

                // Fetch existing events for this match
                try {
                    const eventsResponse = await fetch(`/api/matches/${match.id}/events`);
                    if (eventsResponse.ok) {
                        const eventsData = await eventsResponse.json();
                        if (eventsData.events && eventsData.events.length > 0) {
                            // Transform DB events to local event format
                            const transformedEvents = eventsData.events.map((e: any) => ({
                                id: e.id,
                                type: e.type,
                                minute: e.minute,
                                second: e.second,
                                period: e.period,
                                teamId: e.teamId,
                                playerId: e.playerId,
                                assistPlayerId: e.relatedPlayerId,
                                detail: e.detail,
                                // Same falsy-zero class as BUG-126/BUG-132/BUG-133 -- `e.value ? ... : undefined`
                                // collapsed a legitimate logged-miss `value: 0` back to undefined on every
                                // page refresh/remount, discarding the make/miss distinction the DB actually holds.
                                value: e.value !== undefined && e.value !== null ? (typeof e.value === 'string' ? JSON.parse(e.value) : e.value) : undefined,
                            }));
                            setEvents(transformedEvents);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching events:', error);
                    // Continue without events
                }

                setIsLoading(false);
            } catch (error) {
                // BACKLOG-134: this outer catch only console.error'd -- a failed
                // teams/players/eligible-players fetch left the roster empty with zero
                // on-screen indication, indistinguishable from "this match genuinely has
                // no eligible players." Reuse the existing eventSaveError banner.
                console.error('Error fetching data:', error);
                setEventSaveError('Failed to load teams/roster — check connection and reload. Player lists may be empty or incomplete.');
                setIsLoading(false);
            }
        };

        fetchData();
    }, [match.homeTeamId, match.awayTeamId, match.id]);

    // Fetch match config on mount -- mirrors FootballLogger's halfDuration/
    // maxSubstitutions fetch (FootballLogger.tsx:446-453). This logger never called
    // this endpoint before; quarterDuration was a client-only hardcoded default with
    // no competition/match override ever applied.
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const configRes = await fetch(`/api/matches/${match.id}/config`);
                if (configRes.ok) {
                    const { config } = await configRes.json();
                    // config.halfDuration holds quarter length for basketball, not half
                    // length -- named for football's 2-half model, deliberately not
                    // renamed (live prod column, SQL-direct migration cost with no
                    // functional benefit). See TD-012 in BACKLOG.md.
                    setQuarterDuration(config.halfDuration);
                    setTime(`${config.halfDuration}:00`);
                    setPeriodCount(config.periodCount);
                    setOvertimeDurationMinutes(config.overtimeDurationMinutes ?? 5);
                    setFoulDisqualifyAt(config.foulDisqualifyAt ?? 5);
                } else {
                    alert('Match config failed to load — using default duration. Check settings before starting.');
                }
            } catch (e) {
                alert('Match config failed to load — using default duration. Check settings before starting.');
            }
        };
        fetchConfig();
    }, [match.id]);

    // Sync events with other loggers periodically
    useEffect(() => {
        if (!isConnected || !currentLogger) return;

        const syncInterval = setInterval(async () => {
            try {
                const syncedEvents: SyncEvent[] = events.map(e => ({
                    id: e.id,
                    type: e.type,
                    minute: e.minute,
                    second: e.second || 0,
                    teamId: e.teamId,
                    playerId: e.playerId,
                    relatedPlayerId: e.assistPlayerId,
                    detail: e.detail,
                    value: e.value,
                    loggerId: currentLogger.id,
                    loggerName: currentLogger.name,
                    timestamp: e.createdAt || new Date(),
                    synced: true,
                }));

                const merged = await syncEvents(syncedEvents);
                if (merged.length !== events.length) {
                    setEvents(merged);
                }
            } catch (error) {
                console.error('Sync error:', error);
            }
        }, 15000); // Sync every 15 seconds

        return () => clearInterval(syncInterval);
    }, [events, isConnected, syncEvents, currentLogger]);

    // Handle event button click - opens player modal
    const handleEventClick = (type: BasketballEventType, points?: number) => {
        if (!matchStarted) return;
        setPendingEvent({ type, points });
        setShowPlayerModal(true);
    };

    // Handle player selection from modal
    const handlePlayerSelect = (playerId: string) => {
        if (!pendingEvent) return;

        setSelectedEventPlayer(playerId);
        setShowPlayerModal(false);

        // Handle Substitution: phase 1 (pick player going out)
        if (pendingEvent.type === 'Substitution') {
            setPlayerComingOut(playerId);
            setShowSubInModal(true);
            return;
        }

        // Check if this is a scoring event that might have an assist
        if (pendingEvent.points && pendingEvent.points >= 2) {
            setShowAssistModal(true);
        } else {
            // Record event without assist
            recordEvent(pendingEvent.type, playerId, pendingEvent.points);
        }
    };

    // Handle incoming player for substitution
    const handleSubIn = (playerInId: string) => {
        if (!pendingEvent || !playerComingOut) return;

        // Record the event
        recordEvent('Substitution', playerComingOut, undefined, playerInId);

        // Update the active lineup (starters/subs)
        if (selectedTeam === 'home') {
            setHomeStarters(homeStarters.map(id => id === playerComingOut ? playerInId : id));
            setHomeSubs([...homeSubs.filter(id => id !== playerInId), playerComingOut]);
        } else {
            setAwayStarters(awayStarters.map(id => id === playerComingOut ? playerInId : id));
            setAwaySubs([...awaySubs.filter(id => id !== playerInId), playerComingOut]);
        }

        // Reset sub state
        setShowSubInModal(false);
        setPlayerComingOut(null);
    };

    // Handle assist selection
    const handleAssistSelect = (assistPlayerId: string | null) => {
        if (!pendingEvent || !selectedEventPlayer) return;

        recordEvent(pendingEvent.type, selectedEventPlayer, pendingEvent.points, assistPlayerId);
        setShowAssistModal(false);
    };

    // `quarter` alone used to be written into match_events.minute -- every downstream
    // renderer (public match page, LiveMatchStatus, LiveMatchTimeline) assumes minute
    // holds real elapsed match-time, not a period index, which broke period-grouping
    // and minute display for every basketball event. `period` (Q1-Q4/OT) now carries
    // which segment; `minute`/`second` carry a genuine elapsed-time value derived from
    // Date.now() - quarterStartedAt, not from the static `time` display state --
    // `time` never auto-decrements, so every event within a quarter used to get an
    // identical timestamp, breaking chronological order (all ties on minute+second,
    // the exact sort key events/route.ts's GET handler uses). Known limitation, not
    // fixed here: quarterStartedAt resets to Date.now() on component mount, so a
    // logger refreshing mid-quarter restarts that quarter's elapsed-time count --
    // basketball has no mid-match-resume seeding at all yet (unlike football's
    // BUG-115/117/118), a separate, larger gap.
    const getCurrentPeriod = () => (quarter > periodCount ? `OT${otNumber || 1}` : `Q${quarter}`);

    // BUG-135 fix: shared by both OT-entry buttons (tie-triggered "Start Extra Time"
    // and the always-available "Add Extra Time") -- previously each inlined an
    // identical setQuarter(periodCount + 1), which is why a real second overtime
    // never advanced past the first. quarter still advances by one each real OT
    // (keeps getElapsedMinute()'s prior-minutes accumulation distinct per period);
    // otNumber is the human-readable OT count the period label actually uses.
    const startNextOvertime = () => {
        const nextOtNumber = otNumber + 1;
        setIsOT(true);
        setOtNumber(nextOtNumber);
        setQuarter(prev => prev + 1);
        setTime(`${overtimeDurationMinutes}:00`);
        setQuarterStartedAt(Date.now());
        setShowPeriodModal(false);
        fetch(`/api/matches/${match.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPeriod: `OT${nextOtNumber}` }),
        }).then((res) => {
            if (!res.ok) setEventSaveError(`Failed to save OT${nextOtNumber} transition (${res.status}) — period may not persist on refresh.`);
        }).catch((e) => {
            console.error('Failed to persist OT transition:', e);
            setEventSaveError(`Failed to save OT${nextOtNumber} transition — offline or unreachable.`);
        });
    };
    const getElapsedSecondsInPeriod = () => Math.max(0, Math.floor((Date.now() - quarterStartedAt) / 1000));
    const getElapsedMinute = () => {
        const isOT = quarter > periodCount;
        const periodLengthMinutes = isOT ? overtimeDurationMinutes : quarterDuration;
        const minutesElapsedInPeriod = Math.min(periodLengthMinutes, Math.floor(getElapsedSecondsInPeriod() / 60));
        const priorMinutes = isOT ? periodCount * quarterDuration : (quarter - 1) * quarterDuration;
        return priorMinutes + minutesElapsedInPeriod;
    };

    // BUG-134 (minimal scope): personal-foul count + disqualification, derived from
    // local event state the same way every other live stat here already is. All six
    // foul button labels (Personal/Technical/Flagrant/Offensive/Shooting/Unsportsmanlike)
    // dispatch the same `type: 'Foul'` today -- no sub-type distinction exists in the
    // event model yet, so every one of them counts toward foulDisqualifyAt here, matching
    // how they already collapse into the same `personalFouls` DB column server-side.
    const getPersonalFoulCount = (playerId: string) => events.filter(e => e.type === 'Foul' && e.playerId === playerId).length;
    const isFouledOut = (playerId: string) => getPersonalFoulCount(playerId) >= foulDisqualifyAt;

    // Live-ticking quarter clock + WS broadcast (basketball's own analog of
    // FootballLogger's `match:time:update` effect, BUG-153's audit gap: "no WS
    // emit wired for basketball at all"). `time` was previously a manual display
    // string only ever set on quarter transitions, never auto-decrementing -- real
    // per-second countdown now derived from quarterStartedAt, same source the
    // event-timestamp helpers above already use. Deliberately reuses the exact
    // `match:time:update` channel football uses: ws-server's clock-authority
    // single-writer enforcement (index.js) keys off that event name generically,
    // not per-sport, so basketball gets the same dual-logger clock-collision
    // protection for free. Payload semantics differ from football on purpose --
    // minute/second here are countdown-remaining, not elapsed -- LiveMatchStatus
    // renders the two sports differently already.
    useEffect(() => {
        if (!matchStarted || matchEnded || quarterEnded) return;

        const isOT = quarter > periodCount;
        const periodLengthSeconds = (isOT ? overtimeDurationMinutes : quarterDuration) * 60;

        const tick = () => {
            const remaining = Math.max(0, periodLengthSeconds - getElapsedSecondsInPeriod());
            const mm = Math.floor(remaining / 60);
            const ss = remaining % 60;
            setTime(`${mm}:${String(ss).padStart(2, '0')}`);

            if (isSocketConnected) {
                emit('match:time:update', {
                    matchId: match.id,
                    minute: mm,
                    second: ss,
                    half: quarter,
                    extraTime: 0,
                    period: getCurrentPeriod(),
                });
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchStarted, matchEnded, quarterEnded, quarter, periodCount, quarterDuration, overtimeDurationMinutes, quarterStartedAt, isSocketConnected, emit, match.id]);

    // Record the actual event
    const recordEvent = async (type: BasketballEventType, playerId: string, points?: number, assistPlayerId?: string | null) => {
        if (isRecordingRef.current) return;
        isRecordingRef.current = true;
        setIsRecording(true);
        try {
        const allPlayers = [...homePlayers, ...awayPlayers];
        const player = allPlayers.find(p => p.id === playerId);
        const assistPlayer = assistPlayerId ? allPlayers.find(p => p.id === assistPlayerId) : null;

        // Shot-type events pass points=0 for a miss ("2PT Missed" etc. buttons). `points`
        // truthiness must never be used to tell make from miss — 0 is a real value, not an
        // absence of one. `made` carries that distinction explicitly instead.
        const isShotType = type === 'Field Goal' || type === 'Three Pointer' || type === 'Free Throw';
        const made = isShotType ? (points ?? 0) > 0 : undefined;

        const newEvent = {
            id: `e${events.length + 1}`,
            type,
            minute: getElapsedMinute(),
            second: getElapsedSecondsInPeriod(),
            period: getCurrentPeriod(),
            teamId: selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId,
            playerId,
            assistPlayerId: assistPlayerId || undefined,
            detail: type === 'Substitution' && assistPlayer
                ? `${assistPlayer.name} IN for ${player?.name || 'Unknown'}`
                : player?.name || '',
            assistDetail: type === 'Substitution' ? undefined : assistPlayer?.name,
            value: points,
            made,
            loggerId: currentLogger?.id,
            loggerName: currentLogger?.name,
            createdAt: new Date(),
        };

        // Update local state immediately for responsive UI. Functional update --
        // confirmed live that a non-functional `setEvents([...events, newEvent])`
        // here let one of two near-simultaneous recordEvent invocations silently
        // overwrite the other's local event in state (both POSTs still landed
        // server-side, creating a real duplicate row, but only one was visible
        // client-side until the next sync pulled the other back in as a "new" one).
        // The isRecordingRef guard above should make this unreachable going forward,
        // but a functional update removes the stale-closure hazard structurally
        // rather than relying solely on the guard holding.
        setEvents(prev => [...prev, newEvent]);

        // Calculate new scores
        const newHomeScore = selectedTeam === 'home' ? homeScore + (points || 0) : homeScore;
        const newAwayScore = selectedTeam === 'away' ? awayScore + (points || 0) : awayScore;

        // Update scores for scoring events
        if (points) {
            if (selectedTeam === 'home') {
                setHomeScore(newHomeScore);
            } else {
                setAwayScore(newAwayScore);
            }
        }

        // Broadcast to other loggers
        if (currentLogger) {
            broadcastEvent({
                ...newEvent,
                timestamp: newEvent.createdAt,
                synced: false,
            } as SyncEvent);
        }

        // Persist event to database. Previously only caught network-level failures
        // (fetch() rejects) and never checked res.ok, so an HTTP error response
        // (401/422/500) looked identical to a real success -- nothing was logged,
        // nothing shown, the event just sat in local state looking "saved." Violates
        // this project's own rule that logging errors must never appear to succeed
        // silently.
        const eventPayload = {
            type,
            minute: newEvent.minute,
            second: newEvent.second,
            period: newEvent.period,
            teamId: selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId,
            playerId,
            relatedPlayerId: assistPlayerId || null,
            detail: newEvent.detail,
            value: points ?? null,
            made,
            loggerId: currentLogger?.id,
            loggerName: currentLogger?.name,
        };
        try {
            const res = await fetch(`/api/matches/${match.id}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventPayload),
            });
            if (!res.ok) {
                setEventSaveError(`Failed to save "${type}" (${res.status}) — event kept locally only. Check connection and retry logging it if needed.`);
            } else {
                setEventSaveError(null);
                // BUG-129: the local temp id (`e${events.length + 1}`) must be swapped
                // for the server's real nanoid() id before the next 15s multi-logger
                // sync tick — useMultiLogger's mergeEvents() dedupes strictly by exact
                // id match, so an un-swapped temp id makes the server's copy of this
                // same event look like a brand-new entry on the very next sync,
                // double-counting it in every derived stat (rating, boxscore, event
                // history). Mirrors FootballLogger's manager.confirmEvent(tempId, serverId).
                const saved = await res.json().catch(() => null);
                if (saved?.event?.id) {
                    setEvents(prev => prev.map(e => (e.id === newEvent.id ? { ...e, id: saved.event.id } : e)));
                }
            }
        } catch (error) {
            // Network failure -- server never received the event. Queue for
            // background sync (BUG-142), mirroring FootballLogger's own mechanism
            // exactly rather than leaving this the silent-loss dead end it was.
            console.error('Failed to persist event:', error);
            const token = localStorage.getItem('authToken');
            if (!token) {
                setEventSaveError(`Failed to save "${type}" — offline and no session found. Event NOT queued; please re-login and re-log this event manually.`);
                return;
            }
            const QUEUE_MIN_TTL_SECONDS = 30 * 60;
            if (jwtSecondsRemaining(token) < QUEUE_MIN_TTL_SECONDS) {
                setEventSaveError(`Session expiring soon — "${type}" was NOT queued for offline sync. Please re-login before continuing offline, then re-log this event.`);
                return;
            }
            try {
                await queueOfflineEvent(match.id, eventPayload, token);
                setQueuedOfflineCount(prev => prev + 1);
                setEventSaveError(`"${type}" queued for offline sync — will save automatically once back online.`);
                if ('serviceWorker' in navigator) {
                    const reg = await navigator.serviceWorker.ready;
                    if ('sync' in reg) {
                        await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-match-events');
                    }
                }
                console.log('[BasketballLogger] Event queued for background sync');
            } catch (queueErr) {
                console.error('Failed to queue event:', queueErr);
                setEventSaveError(`Failed to save "${type}" — offline or unreachable, and queueing also failed. Event kept locally only.`);
            }
        }

        // Dispatch WebSocket event for live updates
        if (typeof window !== 'undefined') {
            const updatedEvents = [...events, newEvent];
            window.dispatchEvent(new CustomEvent('BASKETBALL_EVENT', {
                detail: {
                    matchId: match.id,
                    event: newEvent,
                    homeScore: newHomeScore,
                    awayScore: newAwayScore,
                    quarter,
                    time,
                    status: 'LIVE',
                    playerRating: calculatePlayerRating(playerId, updatedEvents),
                    assistPlayerRating: assistPlayerId ? calculatePlayerRating(assistPlayerId, updatedEvents) : undefined
                }
            }));
        }

        // Reset state
        setPendingEvent(null);
        setSelectedEventPlayer(null);
        } finally {
            isRecordingRef.current = false;
            setIsRecording(false);
        }
    };

    const undoLastEvent = async () => {
        if (events.length === 0 || isUndoing) return;
        const lastEvent = events[events.length - 1];

        // BUG-130: undo used to be cosmetic-only — it sliced local `events` state and
        // reverted local score state with no `fetch()` call at all. The DB event row
        // and the score it already atomically incremented (BUG-121) were both
        // untouched, so any refresh, multi-logger sync, or public viewer still saw
        // the "undone" event and its score contribution. Server-first, gated on
        // `res.ok`, same discipline as BUG-049's Start/End Match fix — never flip
        // local state before the server confirms the write. The server's own DELETE
        // handler now also reverts the score and player stats correctly for
        // basketball's types (events/[eventId]/route.ts, same BUG-130).
        setIsUndoing(true);
        try {
            const res = await fetch(`/api/matches/${match.id}/events/${lastEvent.id}`, { method: 'DELETE' });
            if (!res.ok) {
                setEventSaveError(`Failed to undo "${lastEvent.type}" (${res.status}) — event was not removed. Try again.`);
                return;
            }
            setEventSaveError(null);
        } catch (error) {
            console.error('Failed to undo event:', error);
            setEventSaveError(`Failed to undo "${lastEvent.type}" — offline or unreachable. Event was not removed.`);
            return;
        } finally {
            setIsUndoing(false);
        }

        // Revert score locally now that the server has confirmed both the delete and
        // its own score revert. Functional updates — this runs after an await, so the
        // closure-captured homeScore/awayScore may already be stale.
        if (typeof lastEvent.value === 'number' && lastEvent.value > 0) {
            if (lastEvent.teamId === match.homeTeamId) {
                setHomeScore(prev => Math.max(0, prev - (lastEvent.value as number)));
            } else {
                setAwayScore(prev => Math.max(0, prev - (lastEvent.value as number)));
            }
        }

        setEvents(prev => prev.slice(0, -1));
    };

    const finalizeMatch = async () => {
        if (!matchStarted) return;

        setIsSaving(true);
        try {
            // Update match status to FINISHED
            const response = await fetch(`/api/matches/${match.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'FINISHED',
                    currentPeriod: 'FINISHED',
                    homeScore,
                    awayScore,
                }),
            });

            if (response.ok) {
                setMatchEnded(true);
                alert('Match finalized successfully! All events have been saved.');
            } else {
                alert('Failed to finalize match. Please try again.');
            }
        } catch (error) {
            console.error('Error finalizing match:', error);
            alert('Error finalizing match. Please check your connection.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-sm font-black uppercase tracking-widest text-white/40">Loading match data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4">
            {/* Multi-Logger Status */}
            <MultiLoggerStatus
                activeLoggers={activeLoggers}
                conflicts={conflicts}
                isConnected={isConnected}
                syncStatus={syncStatus}
                currentLoggerName={currentLogger?.name || 'Unknown'}
                onResolveConflict={resolveConflict}
            />

            {/* Header - Sticky */}
            <div className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-lg border-b border-white/10 -mx-4 px-4 pb-4 mb-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onExit}
                                className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all"
                            >
                                <X size={20} />
                            </button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Basketball Logger</p>
                                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-500 border border-orange-500/30 rounded text-[8px] font-black uppercase tracking-tighter">Semi-Finals</span>
                                </div>
                                <h1 className="text-2xl font-display italic uppercase">{match.competition}</h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {!matchStarted && (
                                <button
                                    onClick={async () => {
                                        console.log('🔘 Button clicked! lineupSet:', lineupSet);
                                        console.log('📋 Home players:', homePlayers.length, 'Away players:', awayPlayers.length);
                                        if (!lineupSet) {
                                            console.log('✅ Opening lineup modal...');
                                            setShowLineupModal(true);
                                        } else {
                                            console.log('▶️ Starting match...');
                                            setMatchStarted(true);
                                            setQuarterStartedAt(Date.now());

                                            // Update match status in database to LIVE
                                            try {
                                                const response = await fetch(`/api/matches/${match.id}`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        status: 'LIVE',
                                                        // Without this, currentPeriod stays at the schema
                                                        // default ('NOT_STARTED') for the entire first quarter
                                                        // -- the End-of-Quarter modal is the only other place
                                                        // that writes currentPeriod, and it doesn't fire until
                                                        // Q1 ends.
                                                        currentPeriod: 'Q1',
                                                    }),
                                                });

                                                if (response.ok) {
                                                    console.log('✅ Match status updated to LIVE in database');
                                                } else {
                                                    console.error('❌ Failed to update match status');
                                                }
                                            } catch (error) {
                                                console.error('❌ Error updating match status:', error);
                                            }

                                            // Dispatch WebSocket event for match start
                                            if (typeof window !== 'undefined') {
                                                window.dispatchEvent(new CustomEvent('MATCH_STATUS_CHANGE', {
                                                    detail: {
                                                        matchId: match.id,
                                                        status: 'LIVE',
                                                        homeTeamId: match.homeTeamId,
                                                        awayTeamId: match.awayTeamId
                                                    }
                                                }));
                                            }
                                        }
                                    }}
                                    className="px-6 py-3 bg-green-500 text-black rounded-2xl hover:scale-105 transition-all flex items-center gap-2 font-black uppercase tracking-widest"
                                >
                                    <Play size={16} />
                                    {lineupSet ? 'Start Match' : 'Set Lineup & Start'}
                                </button>
                            )}

                            {/* View Switcher */}
                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mx-2">
                                <button
                                    onClick={() => setViewMode('logger')}
                                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'logger' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'}`}
                                >
                                    Logger
                                </button>
                                <button
                                    onClick={() => setViewMode('stats')}
                                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'stats' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'}`}
                                >
                                    Stats
                                </button>
                                <button
                                    onClick={() => setViewMode('history')}
                                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'history' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'}`}
                                >
                                    History
                                </button>
                            </div>

                            <button
                                onClick={undoLastEvent}
                                disabled={!matchStarted || matchEnded || isUndoing || events.length === 0}
                                className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Undo2 size={16} />
                                <span className="text-xs font-black uppercase tracking-widest">{isUndoing ? 'Undoing...' : 'Undo'}</span>
                            </button>
                            {matchStarted && !matchEnded && (
                                <button
                                    onClick={finalizeMatch}
                                    disabled={isSaving}
                                    className="px-6 py-3 bg-green-500 text-black rounded-2xl hover:scale-105 transition-all flex items-center gap-2 font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save size={16} />
                                    <span className="text-xs">{isSaving ? 'Saving...' : 'Finalize Match'}</span>
                                </button>
                            )}
                            <button
                                onClick={() => setShowSettingsModal(true)}
                                className="px-3 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2"
                            >
                                <Settings size={16} />
                            </button>


                        </div>
                    </div>
                </div>
            </div>

            {eventSaveError && (
                <div className="max-w-7xl mx-auto mb-4 px-4">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-red-400">{eventSaveError}</p>
                        <button
                            onClick={() => setEventSaveError(null)}
                            className="text-red-400 hover:text-red-300 text-xs font-black uppercase tracking-widest shrink-0"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto">
                {/* Scoreboard - Compact */}
                <div className="bg-gradient-to-br from-orange-900/20 to-orange-950/40 border border-orange-500/20 rounded-[24px] p-4 mb-4">
                    <div className="grid grid-cols-3 gap-4 items-center">
                        {/* Home Team */}
                        <div className="text-center">
                            {homeTeam?.logo ? (
                                <img src={homeTeam.logo} alt={homeTeam.name} className="w-16 h-16 mx-auto mb-2 object-contain" />
                            ) : (
                                <span className="text-4xl mb-2 block">🏀</span>
                            )}
                            <p className="text-sm font-black uppercase tracking-tight mb-1">{homeTeam?.shortName}</p>
                            <div className="text-5xl font-display italic text-primary">{homeScore}</div>
                        </div>

                        {/* Quarter & Time */}
                        <div className="text-center">
                            <div className="bg-white/10 rounded-xl p-3 mb-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Quarter</p>
                                <div className="flex justify-center gap-1">
                                    {[1, 2, 3, 4].map((q) => (
                                        <button
                                            key={q}
                                            onClick={() => setQuarter(q)}
                                            className={`w-12 h-12 rounded-xl font-display text-xl transition-all ${quarter === q ? 'bg-primary text-black' : 'bg-white/5 text-white/40'
                                                }`}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center justify-center gap-2 text-4xl font-display italic">
                                    <Clock size={32} className="text-primary" />
                                    {time}
                                </div>
                                <button
                                    onClick={() => setShowPeriodModal(true)}
                                    className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2 mt-1"
                                >
                                    <Activity size={10} className="text-primary" />
                                    End Quarter
                                </button>
                            </div>
                        </div>

                        {/* Away Team */}
                        <div className="text-center">
                            {awayTeam?.logo ? (
                                <img src={awayTeam.logo} alt={awayTeam.name} className="w-16 h-16 mx-auto mb-2 object-contain" />
                            ) : (
                                <span className="text-4xl mb-2 block">🏀</span>
                            )}
                            <p className="text-sm font-black uppercase tracking-tight mb-1">{awayTeam?.shortName}</p>
                            <div className="text-5xl font-display italic text-primary">{awayScore}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-7xl mx-auto">
                {viewMode === 'logger' && (
                    <>
                        <div className="space-y-4">
                            {/* Team Toggle */}
                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                                <button
                                    onClick={() => setSelectedTeam('home')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all ${selectedTeam === 'home' ? 'bg-primary text-black' : 'text-white/40'
                                        }`}
                                >
                                    {homeTeam?.logo ? (
                                        <img src={homeTeam.logo} alt={homeTeam.name} className="w-8 h-8 object-contain" />
                                    ) : (
                                        <span className="text-2xl">🏀</span>
                                    )}
                                    <span className="font-black uppercase tracking-widest">{homeTeam?.shortName}</span>
                                </button>
                                <button
                                    onClick={() => setSelectedTeam('away')}
                                    className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl transition-all ${selectedTeam === 'away' ? 'bg-primary text-black' : 'text-white/40'
                                        }`}
                                >
                                    {awayTeam?.logo ? (
                                        <img src={awayTeam.logo} alt={awayTeam.name} className="w-8 h-8 object-contain" />
                                    ) : (
                                        <span className="text-2xl">🏀</span>
                                    )}
                                    <span className="font-black uppercase tracking-widest">{awayTeam?.shortName}</span>
                                </button>
                            </div>

                            {/* Scoring Actions */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Target className="text-primary" size={16} />
                                    Scoring
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <ActionButton
                                        label="2 Points Made"
                                        value="2PT"
                                        color="bg-green-500/20 text-green-500 border-green-500/30"
                                        onClick={() => handleEventClick('Field Goal', 2)}
                                        matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording}
                                    />
                                    <ActionButton
                                        label="3 Points Made"
                                        value="3PT"
                                        color="bg-purple-500/20 text-purple-500 border-purple-500/30"
                                        onClick={() => handleEventClick('Three Pointer', 3)}
                                        matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording}
                                    />
                                    <ActionButton
                                        label="Free Throw"
                                        value="FT"
                                        color="bg-blue-500/20 text-blue-500 border-blue-500/30"
                                        onClick={() => handleEventClick('Free Throw', 1)}
                                        matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording}
                                    />
                                    <SimpleActionButton label="2PT Missed" onClick={() => handleEventClick('Field Goal', 0)} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                    <SimpleActionButton label="3PT Missed" onClick={() => handleEventClick('Three Pointer', 0)} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                    <SimpleActionButton label="FT Missed" onClick={() => handleEventClick('Free Throw', 0)} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                </div>
                            </div>

                            {/* Rebounds */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <TrendingUp className="text-primary" size={16} />
                                    Rebounds
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <SimpleActionButton label="Offensive Rebound" onClick={() => handleEventClick('Rebound')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                    <SimpleActionButton label="Defensive Rebound" onClick={() => handleEventClick('Rebound')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                </div>
                            </div>

                            {/* Defensive Actions */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Activity className="text-primary" size={16} />
                                    Defense
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <SimpleActionButton label="Steal" onClick={() => handleEventClick('Steal')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                    <SimpleActionButton label="Block" onClick={() => handleEventClick('Block')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                    <SimpleActionButton label="Deflection" onClick={() => handleEventClick('Block')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                </div>
                            </div>

                            {/* Assists & Turnovers */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Activity className="text-primary" size={16} />
                                    Playmaking
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <SimpleActionButton label="Assist" onClick={() => handleEventClick('Assist')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                    <SimpleActionButton label="Turnover" onClick={() => handleEventClick('Turnover')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                </div>
                            </div>

                            {/* Fouls */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Activity className="text-orange-500" size={16} />
                                    Fouls
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <SimpleActionButton label="Personal Foul" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                    <SimpleActionButton label="Technical Foul" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                    <SimpleActionButton label="Flagrant Foul" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                    <SimpleActionButton label="Offensive Foul" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                    <SimpleActionButton label="Shooting Foul" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                    <SimpleActionButton label="Unsportsmanlike" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                </div>
                            </div>

                            {/* Team Actions */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Users className="text-primary" size={16} />
                                    Team Actions
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <SimpleActionButton label="Substitution" onClick={() => handleEventClick('Substitution')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                    <SimpleActionButton label="Timeout" onClick={() => handleEventClick('Timeout')} matchStarted={matchStarted} matchEnded={matchEnded} disabled={isRecording} />
                                </div>
                            </div>
                        </div>

                        {/* Event Log - Full Width Below Actions */}
                        <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                    <Activity className="text-primary" size={16} />
                                    Event Log
                                </h3>
                                <span className="text-xs text-white/40 font-bold">{events.length} Events Recorded</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2">
                                {events.slice().reverse().map((event, idx) => {
                                    const allPlayers = [...homePlayers, ...awayPlayers];
                                    const team = event.teamId === match.homeTeamId ? homeTeam : awayTeam;
                                    const player = allPlayers.find(p => p.id === event.playerId);
                                    const assistPlayer = event.assistPlayerId ? allPlayers.find(p => p.id === event.assistPlayerId) : null;
                                    return (
                                        <motion.div
                                            key={event.id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                                                    {event.period ?? 'Q?'} - {Math.floor((event.second || 0) / 60)}:{String((event.second || 0) % 60).padStart(2, '0')}
                                                </span>
                                                {event.value && (
                                                    <span className="text-xs font-display italic text-primary">+{event.value}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {team?.logo ? (
                                                    <img src={team.logo} alt={team.name} className="w-6 h-6 object-contain flex-shrink-0" />
                                                ) : (
                                                    <span className="text-lg flex-shrink-0">🏀</span>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black uppercase tracking-tight truncate">{event.type}</p>
                                                    <p className="text-[10px] text-white/60 truncate">
                                                        {event.detail || player?.name || 'Unknown'}
                                                        {event.assistDetail && <span className="text-primary"> (Ast: {event.assistDetail})</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                                {events.length === 0 && (
                                    <div className="col-span-full text-center py-12 text-white/20">
                                        <Activity size={48} className="mx-auto mb-4 opacity-20" />
                                        <p className="text-sm font-black uppercase tracking-widest">No events recorded yet</p>
                                        <p className="text-xs mt-2">Start the match and record events to see them here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {viewMode === 'stats' && (
                    <div className="space-y-6">
                        {/* Team Selection for Stats */}
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 max-w-md mx-auto">
                            <button
                                onClick={() => setSelectedTeam('home')}
                                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${selectedTeam === 'home' ? 'bg-primary text-black' : 'text-white/40'}`}
                            >
                                {homeTeam?.shortName} Stats
                            </button>
                            <button
                                onClick={() => setSelectedTeam('away')}
                                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${selectedTeam === 'away' ? 'bg-primary text-black' : 'text-white/40'}`}
                            >
                                {awayTeam?.shortName} Stats
                            </button>
                        </div>

                        {/* Stats Table */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/40 border-b border-white/10">
                                            <th className="p-4">Player</th>
                                            <th className="p-4 text-center">PTS</th>
                                            <th className="p-4 text-center">REB</th>
                                            <th className="p-4 text-center">AST</th>
                                            <th className="p-4 text-center">FG%</th>
                                            <th className="p-4 text-center">eFG%</th>
                                            <th className="p-4 text-center">3P%</th>
                                            <th className="p-4 text-center">Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {(selectedTeam === 'home' ? homePlayers : awayPlayers).map(player => {
                                            const stats = calculateAdvancedStats(player.id);
                                            const rating = calculatePlayerRating(player.id);
                                            return (
                                                <tr key={player.id} className="hover:bg-white/5 transition-colors group">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-display text-sm group-hover:bg-primary group-hover:text-black transition-colors">
                                                                {player.number}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black uppercase tracking-tight">{player.name}</p>
                                                                <p className="text-[9px] text-white/40 font-bold uppercase">{player.position}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center font-display text-lg italic text-primary">{stats.pts}</td>
                                                    <td className="p-4 text-center text-xs font-bold text-white/60">{stats.reb}</td>
                                                    <td className="p-4 text-center text-xs font-bold text-white/60">{stats.ast}</td>
                                                    <td className="p-4 text-center text-xs font-bold text-white/60">{stats.fgPct}%</td>
                                                    <td className="p-4 text-center text-xs font-bold text-white/60">{stats.eFgPct}%</td>
                                                    <td className="p-4 text-center text-xs font-bold text-white/60">{stats.threePct}%</td>
                                                    <td className="p-4 text-center">
                                                        <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-black rounded uppercase">
                                                            {rating}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'history' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-display italic uppercase">Match History</h3>
                            <span className="text-xs text-white/40 font-bold">{events.length} Events Total</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {events.slice().reverse().map((event, idx) => {
                                const player = [...homePlayers, ...awayPlayers].find(p => p.id === event.playerId);
                                const team = event.teamId === match.homeTeamId ? homeTeam : awayTeam;
                                return (
                                    <div key={event.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-all">
                                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white/40 shrink-0">
                                            {event.period ?? 'Q?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <p className="text-xs font-black uppercase tracking-widest text-primary">{event.type}</p>
                                                <span className="text-[10px] text-white/20 font-bold">
                                                    {Math.floor((event.second || 0) / 60)}:{String((event.second || 0) % 60).padStart(2, '0')}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold truncate">
                                                <span className="text-white/40">[{team?.shortName}]</span> {event.detail || player?.name}
                                            </p>
                                        </div>
                                        {event.value && (
                                            <div className="text-2xl font-display italic text-primary shrink-0">
                                                +{event.value}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Player Selection Modal */}
            <AnimatePresence>
                {showPlayerModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowPlayerModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                        >
                            <h2 className="text-2xl font-display italic uppercase mb-2">Select Player</h2>
                            <p className="text-sm text-white/40 mb-6">
                                Who performed: <span className="text-primary font-bold">{pendingEvent?.type}</span>
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {(selectedTeam === 'home' ? homePlayers : awayPlayers)
                                    .filter(p => (selectedTeam === 'home' ? homeStarters : awayStarters).includes(p.id))
                                    .map((player) => {
                                        const fouledOut = isFouledOut(player.id);
                                        return (
                                        <button
                                            key={player.id}
                                            onClick={() => !fouledOut && handlePlayerSelect(player.id)}
                                            disabled={fouledOut}
                                            className={`bg-white/5 border border-white/10 rounded-xl p-4 transition-all ${fouledOut ? 'opacity-40 cursor-not-allowed' : 'hover:bg-primary/20 hover:border-primary'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-12 h-12 rounded-full flex items-center justify-center font-display text-xl font-bold border-2 border-white/30"
                                                    style={{
                                                        backgroundColor: selectedTeam === 'home' ? homeTeam?.color : awayTeam?.color,
                                                    }}
                                                >
                                                    {player.number}
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                        <p className="text-sm font-black uppercase tracking-tight truncate">{player.name}</p>
                                                        {fouledOut ? (
                                                            <span className="text-[10px] font-black bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded flex-shrink-0">
                                                                FOULED OUT
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                                                                {calculatePlayerRating(player.id)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-white/40 font-bold">{player.position}</p>
                                                </div>
                                            </div>
                                        </button>
                                        );
                                    })}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Substitution: Select Incoming Player Modal */}
            <AnimatePresence>
                {showSubInModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => {
                            setShowSubInModal(false);
                            setPlayerComingOut(null);
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                        >
                            <h2 className="text-2xl font-display italic uppercase mb-2">Substitution: Who is entering?</h2>
                            <p className="text-sm text-white/40 mb-6">
                                Select the player coming from the bench to replace <span className="text-primary font-bold">{(selectedTeam === 'home' ? homePlayers : awayPlayers).find(p => p.id === playerComingOut)?.name}</span>
                            </p>
                            {(() => {
                                // BUG-136: a fouled-out player must never re-enter -- excluded
                                // from the bench pool here, not just visually flagged, since
                                // nothing previously gated this at all.
                                const availableSubs = (selectedTeam === 'home' ? homePlayers : awayPlayers)
                                    .filter(p => (selectedTeam === 'home' ? homeSubs : awaySubs).includes(p.id) && !isFouledOut(p.id));
                                // BUG-141: an empty bench with no fallback message read as a
                                // broken app mid-game (football's equivalent modal has always
                                // had an emptyMessage prop for this exact case, see BUG-070).
                                if (availableSubs.length === 0) {
                                    return (
                                        <div className="text-center text-white/40 text-sm font-bold py-8">
                                            No available substitutes
                                        </div>
                                    );
                                }
                                return (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {availableSubs.map((player) => (
                                            <button
                                                key={player.id}
                                                onClick={() => handleSubIn(player.id)}
                                                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-primary/20 hover:border-primary transition-all"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-12 h-12 rounded-full flex items-center justify-center font-display text-xl font-bold border-2 border-white/30"
                                                        style={{
                                                            backgroundColor: selectedTeam === 'home' ? homeTeam?.color : awayTeam?.color,
                                                        }}
                                                    >
                                                        {player.number}
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-left">
                                                        <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                            <p className="text-sm font-black uppercase tracking-tight truncate">{player.name}</p>
                                                            <span className="text-[10px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                                                                {calculatePlayerRating(player.id)}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-white/40 font-bold">{player.position}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                );
                            })()}
                            <button
                                onClick={() => {
                                    setShowSubInModal(false);
                                    setPlayerComingOut(null);
                                }}
                                className="w-full mt-6 bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all text-xs font-black uppercase tracking-widest text-center"
                            >
                                Cancel Substitution
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Assist Selection Modal */}
            <AnimatePresence>
                {showAssistModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => handleAssistSelect(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                        >
                            <h2 className="text-2xl font-display italic uppercase mb-2">Assisted By?</h2>
                            <p className="text-sm text-white/40 mb-6">
                                Select the player who assisted, or skip if unassisted
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                                {(selectedTeam === 'home' ? homePlayers : awayPlayers)
                                    .filter(p => (selectedTeam === 'home' ? homeStarters : awayStarters).includes(p.id))
                                    .filter(p => p.id !== selectedEventPlayer)
                                    .map((player) => (
                                        <button
                                            key={player.id}
                                            onClick={() => handleAssistSelect(player.id)}
                                            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-primary/20 hover:border-primary transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-12 h-12 rounded-full flex items-center justify-center font-display text-xl font-bold border-2 border-white/30"
                                                    style={{
                                                        backgroundColor: selectedTeam === 'home' ? homeTeam?.color : awayTeam?.color,
                                                    }}
                                                >
                                                    {player.number}
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                        <p className="text-sm font-black uppercase tracking-tight truncate">{player.name}</p>
                                                        <span className="text-[10px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                                                            {calculatePlayerRating(player.id)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-white/40 font-bold">{player.position}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                            </div>
                            <button
                                onClick={() => handleAssistSelect(null)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all text-sm font-black uppercase tracking-widest"
                            >
                                No Assist / Skip
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Settings Modal */}
            <AnimatePresence>
                {showSettingsModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowSettingsModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 max-w-md w-full"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-display italic uppercase">Match Settings</h2>
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Quarter Duration */}
                                <div>
                                    <label className="text-sm font-black uppercase tracking-widest text-white/60 mb-3 block">
                                        Quarter Duration (Minutes)
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[8, 10, 12].map((duration) => {
                                            // Config locks once the match has started, same convention as
                                            // FootballLogger's `currentPeriod !== 'NOT_STARTED'` half-duration lock.
                                            const isLocked = matchStarted;
                                            return (
                                                <button
                                                    key={duration}
                                                    disabled={isLocked}
                                                    onClick={() => {
                                                        setQuarterDuration(duration);
                                                        setTime(`${duration}:00`);
                                                    }}
                                                    className={`py-4 rounded-xl font-display text-2xl transition-all ${quarterDuration === duration
                                                        ? 'bg-primary text-black'
                                                        : isLocked
                                                            ? 'bg-white/5 border border-white/5 text-white/60 opacity-30 cursor-not-allowed'
                                                            : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                                                        }`}
                                                >
                                                    {duration}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-white/40 mt-2">Standard: 12 min | Youth: 8-10 min</p>
                                    {matchStarted && (
                                        <p className="text-[9px] text-white/20 mt-1 uppercase tracking-tighter italic">
                                            🔒 Duration locked — match already in progress
                                        </p>
                                    )}
                                </div>

                                {/* Time Controls */}
                                <div>
                                    <label className="text-sm font-black uppercase tracking-widest text-white/60 mb-3 block">
                                        Time Controls
                                    </label>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => setTime(`${quarterDuration}:00`)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all text-sm font-black uppercase tracking-widest text-left flex items-center justify-between"
                                        >
                                            <span>Reset Quarter Time</span>
                                            <Clock size={16} className="text-primary" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setQuarter(1);
                                                setTime(`${quarterDuration}:00`);
                                            }}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all text-sm font-black uppercase tracking-widest text-left flex items-center justify-between"
                                        >
                                            <span>Reset to Q1</span>
                                            <Activity size={16} className="text-primary" />
                                        </button>
                                    </div>
                                </div>

                                {/* Current Settings Display */}
                                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                                    <p className="text-xs font-black uppercase tracking-widest text-primary mb-2">Current Settings</p>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-white/40 text-xs">Quarter Duration</p>
                                            <p className="font-bold text-white">{quarterDuration} minutes</p>
                                        </div>
                                        <div>
                                            <p className="text-white/40 text-xs">Current Time</p>
                                            <p className="font-bold text-white">{time}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowSettingsModal(false)}
                                className="w-full mt-6 bg-primary text-black py-4 rounded-xl font-black uppercase tracking-widest hover:scale-105 transition-transform"
                            >
                                Done
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Lineup Selection Modal */}
            <AnimatePresence>
                {showLineupModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
                        onClick={() => !lineupSet && setShowLineupModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-3xl font-display italic uppercase mb-2">Set Starting Lineup</h2>
                                    <p className="text-sm text-white/40">Select {STARTER_COUNT} starters for each team before starting the match</p>
                                </div>
                                {!lineupSet && (
                                    <button
                                        onClick={() => setShowLineupModal(false)}
                                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Home Team Lineup */}
                                <div className="bg-white/5 border border-white/10 rounded-[24px] p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        {homeTeam?.logo ? (
                                            <img src={homeTeam.logo} alt={homeTeam.name} className="w-12 h-12 object-contain" />
                                        ) : (
                                            <span className="text-3xl">🏀</span>
                                        )}
                                        <div>
                                            <h3 className="text-xl font-black uppercase">{homeTeam?.name}</h3>
                                            <p className="text-xs text-white/40">
                                                {homeStarters.length}/{STARTER_COUNT} Starters Selected
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {homePlayers.map((player) => {
                                            const isStarter = homeStarters.includes(player.id);
                                            const isSub = homeSubs.includes(player.id);
                                            return (
                                                <button
                                                    key={player.id}
                                                    onClick={() => {
                                                        if (isStarter) {
                                                            setHomeStarters(homeStarters.filter(id => id !== player.id));
                                                        } else if (homeStarters.length < STARTER_COUNT) {
                                                            setHomeStarters([...homeStarters, player.id]);
                                                            setHomeSubs(homeSubs.filter(id => id !== player.id));
                                                        }
                                                    }}
                                                    className={`w-full border rounded-xl p-4 transition-all text-left ${isStarter
                                                        ? 'bg-primary/20 border-primary'
                                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-10 h-10 rounded-full flex items-center justify-center font-display text-lg font-bold border-2"
                                                                style={{
                                                                    backgroundColor: homeTeam?.color,
                                                                    borderColor: isStarter ? 'var(--primary)' : 'rgba(255,255,255,0.3)',
                                                                }}
                                                            >
                                                                {player.number}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black uppercase">{player.name}</p>
                                                                <p className="text-xs text-white/40">{player.position}</p>
                                                            </div>
                                                        </div>
                                                        {isStarter && (
                                                            <span className="text-xs font-black uppercase tracking-widest text-primary">STARTER</span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Away Team Lineup */}
                                <div className="bg-white/5 border border-white/10 rounded-[24px] p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        {awayTeam?.logo ? (
                                            <img src={awayTeam.logo} alt={awayTeam.name} className="w-12 h-12 object-contain" />
                                        ) : (
                                            <span className="text-3xl">🏀</span>
                                        )}
                                        <div>
                                            <h3 className="text-xl font-black uppercase">{awayTeam?.name}</h3>
                                            <p className="text-xs text-white/40">
                                                {awayStarters.length}/{STARTER_COUNT} Starters Selected
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {awayPlayers.map((player) => {
                                            const isStarter = awayStarters.includes(player.id);
                                            const isSub = awaySubs.includes(player.id);
                                            return (
                                                <button
                                                    key={player.id}
                                                    onClick={() => {
                                                        if (isStarter) {
                                                            setAwayStarters(awayStarters.filter(id => id !== player.id));
                                                        } else if (awayStarters.length < STARTER_COUNT) {
                                                            setAwayStarters([...awayStarters, player.id]);
                                                            setAwaySubs(awaySubs.filter(id => id !== player.id));
                                                        }
                                                    }}
                                                    className={`w-full border rounded-xl p-4 transition-all text-left ${isStarter
                                                        ? 'bg-primary/20 border-primary'
                                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-10 h-10 rounded-full flex items-center justify-center font-display text-lg font-bold border-2"
                                                                style={{
                                                                    backgroundColor: awayTeam?.color,
                                                                    borderColor: isStarter ? 'var(--primary)' : 'rgba(255,255,255,0.3)',
                                                                }}
                                                            >
                                                                {player.number}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black uppercase">{player.name}</p>
                                                                <p className="text-xs text-white/40">{player.position}</p>
                                                            </div>
                                                        </div>
                                                        {isStarter && (
                                                            <span className="text-xs font-black uppercase tracking-widest text-primary">STARTER</span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center justify-between gap-4">
                                <div className="flex-1 bg-primary/10 border border-primary/20 rounded-xl p-4">
                                    <p className="text-xs font-black uppercase tracking-widest text-primary mb-2">Lineup Status</p>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-white/40 text-xs">{homeTeam?.shortName} Starters</p>
                                            <p className="font-bold text-white">{homeStarters.length}/{STARTER_COUNT}</p>
                                        </div>
                                        <div>
                                            <p className="text-white/40 text-xs">{awayTeam?.shortName} Starters</p>
                                            <p className="font-bold text-white">{awayStarters.length}/{STARTER_COUNT}</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (homeStarters.length === STARTER_COUNT && awayStarters.length === STARTER_COUNT) {
                                            const homeSubIds = homePlayers.filter(p => !homeStarters.includes(p.id)).map(p => p.id);
                                            const awaySubIds = awayPlayers.filter(p => !awayStarters.includes(p.id)).map(p => p.id);
                                            setHomeSubs(homeSubIds);
                                            setAwaySubs(awaySubIds);
                                            setLineupSet(true);
                                            setShowLineupModal(false);

                                            // BACKLOG-141: persist to the server, mirroring FootballLogger's
                                            // saveLineupDraft -- same endpoint (already sport-agnostic), same
                                            // payload shape. Fire-and-forget-with-visible-failure, not blocking
                                            // the UI: the wizard has already been completed locally, so a save
                                            // failure shouldn't trap the logger back in the modal, but it must
                                            // be surfaced, not silently lost (CLAUDE.md: no silent failures).
                                            const toLineupPayload = (starterIds: string[], subIds: string[], allPlayers: Player[]) => {
                                                const byId = new Map(allPlayers.map(p => [p.id, p]));
                                                const toEntry = (id: string) => {
                                                    const p = byId.get(id);
                                                    return { playerId: id, id, name: p?.name, number: p?.number, position: p?.position };
                                                };
                                                return {
                                                    starters: starterIds.map(toEntry),
                                                    substitutes: subIds.map(toEntry),
                                                    players: starterIds.map(toEntry), // legacy key, mirrors football
                                                    status: 'published',
                                                };
                                            };

                                            try {
                                                const [homeRes, awayRes] = await Promise.all([
                                                    fetch(`/api/matches/${match.id}/lineup`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ team: 'home', lineup: toLineupPayload(homeStarters, homeSubIds, homePlayers) }),
                                                    }),
                                                    fetch(`/api/matches/${match.id}/lineup`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ team: 'away', lineup: toLineupPayload(awayStarters, awaySubIds, awayPlayers) }),
                                                    }),
                                                ]);
                                                if (!homeRes.ok || !awayRes.ok) {
                                                    setEventSaveError('Lineup confirmed locally but failed to save to the server — it will not survive a refresh or be visible to other loggers.');
                                                }
                                            } catch (e) {
                                                console.error('Failed to persist lineup:', e);
                                                setEventSaveError('Lineup confirmed locally but failed to save to the server — offline or unreachable. It will not survive a refresh.');
                                            }
                                        }
                                    }}
                                    disabled={homeStarters.length !== STARTER_COUNT || awayStarters.length !== STARTER_COUNT}
                                    className="px-8 py-4 bg-primary text-black rounded-xl font-black uppercase tracking-widest hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    Confirm Lineup & Start
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Period Transition Modal */}
            <AnimatePresence>
                {showPeriodModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
                        onClick={() => setShowPeriodModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 max-w-xl w-full text-center"
                        >
                            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Clock size={40} className="text-primary" />
                            </div>

                            <h2 className="text-3xl font-display italic uppercase mb-2">End of Quarter {quarter}</h2>
                            <p className="text-sm text-white/40 mb-8">
                                Current Score: <span className="text-white font-bold">{homeScore} - {awayScore}</span>
                                <br />
                                Select the next action for this match.
                            </p>

                            <div className="grid grid-cols-1 gap-4">
                                {quarter < periodCount ? (
                                    <button
                                        onClick={() => {
                                            const nextQuarter = quarter + 1;
                                            setQuarter(nextQuarter);
                                            setTime(`${quarterDuration}:00`);
                                            setQuarterStartedAt(Date.now());
                                            setShowPeriodModal(false);
                                            // Persist the transition -- BasketballLogger never wrote
                                            // currentPeriod at all before this; every basketball match's
                                            // period stayed at the schema default ('NOT_STARTED') for its
                                            // entire lifetime regardless of real quarter. Fire-and-forget,
                                            // same convention football's period-transition buttons use
                                            // (TD-010) -- not the stricter PATCH-first Start/End Match
                                            // pattern, since a failed period-label PATCH here doesn't risk
                                            // silent data loss the way a failed status transition would.
                                            // BACKLOG-134: this fire-and-forget PATCH only console.error'd on
                                            // failure -- no user-facing signal if the quarter change didn't
                                            // persist. `res.ok` was never even checked (fetch only rejects on
                                            // network failure, not on a 4xx/5xx response).
                                            fetch(`/api/matches/${match.id}`, {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ currentPeriod: `Q${nextQuarter}` }),
                                            }).then((res) => {
                                                if (!res.ok) setEventSaveError(`Failed to save Q${nextQuarter} transition (${res.status}) — quarter may not persist on refresh.`);
                                            }).catch((e) => {
                                                console.error('Failed to persist period transition:', e);
                                                setEventSaveError(`Failed to save Q${nextQuarter} transition — offline or unreachable.`);
                                            });
                                        }}
                                        className="w-full bg-primary text-black py-4 rounded-xl font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-3"
                                    >
                                        <Play size={20} />
                                        Start Quarter {quarter + 1}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            // Check for tie if knockout/semi
                                            if (homeScore === awayScore) {
                                                startNextOvertime();
                                            } else {
                                                // Real match end. This used to only call setMatchEnded(true)
                                                // locally + a dead CustomEvent dispatch -- never the real
                                                // finalizeMatch() below, which is the only thing that
                                                // actually PATCHes status=FINISHED. Once matchEnded flipped
                                                // true, the header's real Finalize button (gated on
                                                // matchStarted && !matchEnded) disappeared too, making the
                                                // match permanently stuck LIVE in the DB with no UI path to
                                                // close it -- same bug class as football's already-fixed
                                                // BUG-076. Calling the real function fixes both at once.
                                                setShowPeriodModal(false);
                                                finalizeMatch();
                                            }
                                        }}
                                        className="w-full bg-primary text-black py-4 rounded-xl font-black uppercase tracking-widest hover:scale-105 transition-transform"
                                    >
                                        {homeScore === awayScore ? `Start Extra Time (OT${otNumber + 1})` : 'Finalize Match'}
                                    </button>
                                )}

                                <button
                                    onClick={startNextOvertime}
                                    className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                >
                                    Add Extra Time{otNumber > 0 ? ` (OT${otNumber + 1})` : ''}
                                </button>

                                <button
                                    onClick={() => setShowPeriodModal(false)}
                                    className="w-full py-4 text-white/40 font-black uppercase tracking-widest hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>

                            {isSemiFinal && (
                                <div className="mt-8 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                                    <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest">Semi-Final Match</p>
                                    <p className="text-[11px] text-white/60 mt-1">Stats and MVP ratings contribute immediately. No standings points awarded.</p>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}


function ActionButton({ label, value, color, onClick, matchStarted, matchEnded, disabled }: { label: string; value: string; color: string; onClick: () => void; matchStarted: boolean; matchEnded?: boolean; disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={!matchStarted || matchEnded || disabled}
            className={`border rounded-2xl p-6 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${color}`}
        >
            <p className="text-3xl font-display italic mb-2">{value}</p>
            <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
        </button>
    );
}

function SimpleActionButton({ label, onClick, matchStarted, matchEnded, disabled }: { label: string; onClick: () => void; matchStarted: boolean; matchEnded?: boolean; disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={!matchStarted || matchEnded || disabled}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <p className="text-xs font-black uppercase tracking-widest">{label}</p>
        </button>
    );
}


