'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Save, Undo2, Clock, Play, Pause, Settings, Lock as LockIcon, MessageSquare, AlertTriangle, Send } from 'lucide-react';

// BUG-194: this file used to carry its own inline copy of the offline-queue
// helpers below (openAdminDB/queueOfflineEvent/jwtSecondsRemaining) -- a third
// near-duplicate of the same contract BasketballLogger.tsx's BUG-142 fix was
// explicitly written to avoid becoming. The inline copy also predated BUG-193
// (basketball's fix for a real missing-IndexedDB-store race that could
// silently and permanently break the queue) and never got it, since it lived
// in a separate file. Importing from the shared module closes that gap here
// too, for free, and removes the duplication.
import { queueOfflineEvent, queueAdminChange, jwtSecondsRemaining } from '@/lib/admin-offline-queue';
import { useAuth } from '@/hooks/useAuth';
import { useMultiLogger } from '@/hooks/useMultiLogger';
import { useWebSocket } from '@/hooks/useWebSocket';
import { MultiLoggerStatus } from '@/components/MultiLoggerStatus';
import { getMatchStateManager, destroyMatchStateManager, MatchStateManager, MatchState, FootballEventType, MatchPeriod } from '@/lib/match-state-manager';
import type { SyncEvent } from '@/lib/multiLogger';
import { getPrimaryTeam } from '@/lib/player-affiliation-utils';
import { TeamLogo } from '@/lib/utils/team-logo';

import { Match, Logger, Player, Team } from '@/db/schema';

interface FootballLoggerProps {
    match: Match;
    onExit: () => void;
    currentLogger: Logger | null;
}

export function FootballLogger({ match, onExit, currentLogger }: FootballLoggerProps) {
    // ========== STATE MANAGEMENT ==========
    const stateManager = useRef<MatchStateManager | null>(null);
    // BUG-143: the Goal/Penalty->Assist chain schedules a delayed confirmEvent() call
    // (see "1b" below) that nothing ever cancelled -- if the logger navigated away
    // within that window, the timeout still fired and silently wrote/broadcast an
    // event for a match no longer on screen. Tracked here so the unmount cleanup can
    // clear any still-pending ones.
    const pendingAssistTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
    const [matchState, setMatchState] = useState<MatchState | null>(null);
    // BUG-109: last wall-clock time a clock checkpoint was persisted to the DB —
    // throttles the PATCH separately from the per-tick WS emit.
    const lastClockCheckpointAt = useRef<number>(0);

    // UI Local State
    const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
    const [homeTeam, setHomeTeam] = useState<Team | null>(null);
    const [awayTeam, setAwayTeam] = useState<Team | null>(null);
    const [homePlayers, setHomePlayers] = useState<Player[]>([]);
    const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUndoing, setIsUndoing] = useState(false);
    const [isStartingMatch, setIsStartingMatch] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const getPlayerTeam = (player?: Player | null) =>
        player ? (getPrimaryTeam(player as Player & Record<string, unknown>) as Team | null) : null;

    // Derived State
    const isClockRunning = matchState?.clock.isRunning ?? false;
    const currentPeriod = matchState?.clock.period ?? 'NOT_STARTED';
    const displayTime = stateManager.current ? stateManager.current.getFormattedTime() : "0'";
    const homeScore = matchState?.score.home ?? (match.homeScore || 0);
    const awayScore = matchState?.score.away ?? (match.awayScore || 0);
    const recordedEvents = matchState?.events ?? [];

    // Can events be logged right now? (only during active play periods)
    const canLogEvents = ['FIRST_HALF', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2', 'PENALTY_SHOOTOUT'].includes(currentPeriod);

    // Players who have received a red card (cannot be selected for events)
    const redCardedPlayerIds = new Set(
        recordedEvents
            .filter(e => e.type === 'Red Card' && e.playerId)
            .map(e => e.playerId!)
    );

    const homeRedCards = recordedEvents.filter(e => e.type === 'Red Card' && e.teamId === match.homeTeamId).length;
    const awayRedCards = recordedEvents.filter(e => e.type === 'Red Card' && e.teamId === match.awayTeamId).length;

    // Variant Detection — fetched from competition data or string fallback
    const [competitionPlayersPerSide, setCompetitionPlayersPerSide] = useState<number | null>(null);
    const [halfDuration, setHalfDuration] = useState<number>(45); // Will be updated in init
    const [maxSubstitutions, setMaxSubstitutions] = useState<number | null>(null); // null = no cap

    const is5Aside = competitionPlayersPerSide === 5 ||
        matchState?.halfDuration === 20 ||
        (match.sport as string) === 'Five-a-side' ||
        (match.sport as string) === '5-a-side' ||
        (match.sport as string) === '5-aside' ||
        match.competition?.toLowerCase().includes('5-a-side') ||
        match.competition?.toLowerCase().includes('5-aside') ||
        match.competition?.toLowerCase().includes('futsal') ||
        match.competition?.toLowerCase().includes('npuga');

    const STARTER_COUNT = competitionPlayersPerSide || (is5Aside ? 5 : 11);

    // WebSocket
    const { emit, isConnected: isSocketConnected } = useWebSocket({
        matchId: match.id,
        autoConnect: true,
    });

    // Modals
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [pendingEvent, setPendingEvent] = useState<{ type: FootballEventType; isGoal?: boolean } | null>(null);
    const [selectedEventPlayer, setSelectedEventPlayer] = useState<string | null>(null);
    const [showAssistModal, setShowAssistModal] = useState(false);
    const [showSubInModal, setShowSubInModal] = useState(false);
    const [playerComingOut, setPlayerComingOut] = useState<string | null>(null);
    const [showStoppageModal, setShowStoppageModal] = useState(false);
    const [showPeriodEndModal, setShowPeriodEndModal] = useState(false);
    const [pendingPeriodTransition, setPendingPeriodTransition] = useState<{ current: string; next: string } | null>(null);
    const [showPenaltyModal, setShowPenaltyModal] = useState(false);
    // BACKLOG-105: local running tally for the logger's own UI, hydrated from
    // the real server response after each kick (never client-derived) so it can
    // never drift from the DB-authoritative shootoutHomeScore/shootoutAwayScore.
    const [showShootoutModal, setShowShootoutModal] = useState(false);
    const [shootoutScore, setShootoutScore] = useState<{ home: number; away: number } | null>(null);
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [pendingReasonEvent, setPendingReasonEvent] = useState<{ type: FootballEventType; playerId: string } | null>(null);
    const [showFoulOutcomeModal, setShowFoulOutcomeModal] = useState(false);
    const [pendingFoulPlayerId, setPendingFoulPlayerId] = useState<string | null>(null);

    // Pre-match States
    const [viewState, setViewState] = useState<'loading' | 'check_lineup' | 'confirm_lineup' | 'active'>('loading');
    const [lineups, setLineups] = useState<any>({ home: null, away: null });
    const [showCommsModal, setShowCommsModal] = useState(false);
    const [comms, setComms] = useState<any[]>([]);
    const [noteContent, setNoteContent] = useState('');
    const { user } = useAuth();
    const [showLineupEditModal, setShowLineupEditModal] = useState(false);
    const [queuedOfflineCount, setQueuedOfflineCount] = useState(0);
    // BUG-194 part 2: period-transition PATCH / undo DELETE retries, via the
    // separate pendingAdminChanges queue (mirrors BasketballLogger.tsx's own
    // BUG-142 fix exactly, same admin-offline-queue.ts module).
    const [queuedAdminChangeCount, setQueuedAdminChangeCount] = useState(0);
    const [eventSaveError, setEventSaveError] = useState<string | null>(null);

    // Listen for background-sync completion from sw-admin.js
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        const handleMessage = (e: MessageEvent) => {
            if (e.data?.type === 'SYNC_COMPLETE' && e.data?.tag === 'sync-match-events') {
                setQueuedOfflineCount(0);
            } else if (e.data?.type === 'SYNC_COMPLETE' && e.data?.tag === 'sync-admin-changes') {
                setQueuedAdminChangeCount(0);
            }
        };
        navigator.serviceWorker.addEventListener('message', handleMessage);
        return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }, []);

    // iOS drain fallback — Background Sync API is a no-op on iOS (BACKLOG-107).
    // When the page comes online or becomes visible, trigger a drain directly:
    // Android/desktop: re-register the sync tag (idempotent).
    // iOS: postMessage DRAIN_MATCH_EVENTS to the SW, which calls syncMatchEvents().
    useEffect(() => {
        const triggerDrain = () => {
            if (!('serviceWorker' in navigator)) return;
            navigator.serviceWorker.ready.then((reg) => {
                if ('sync' in reg) {
                    const syncReg = reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } };
                    syncReg.sync.register('sync-match-events').catch(() => {});
                    syncReg.sync.register('sync-admin-changes').catch(() => {});
                } else if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'DRAIN_MATCH_EVENTS' });
                    navigator.serviceWorker.controller.postMessage({ type: 'DRAIN_ADMIN_CHANGES' });
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

    // Ensure localStorage.authToken is populated for the offline queue path.
    // AuthContext wipes localStorage when /api/auth/me returns 401 for logger roles.
    // On mount, refresh via cookie to re-store the token.
    useEffect(() => {
        const ensureLocalToken = async () => {
            try {
                const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.token) localStorage.setItem('authToken', data.token);
                }
            } catch {
                // offline at mount — silently ignore, token may already be in localStorage
            }
        };
        ensureLocalToken();
    }, []);
    const [editingTeam, setEditingTeam] = useState<'home' | 'away'>('home');
    const [draftLineup, setDraftLineup] = useState<{ starters: Player[], subs: Player[] }>({ starters: [], subs: [] });

    // BACKSCOPED: 2026-07-27 (session 47C) — BACKLOG-142. Reinstate when: /api/staff-comms
    // has a real auth gate (currently none in production -- unauthenticated read + a
    // spoofable userId on write) and admin/manager/page.tsx's half-built match-selection
    // flow for this panel is cleaned up. See BACKLOG-142 for the full audit.
    // // Fetch staff comms
    // useEffect(() => {
    //     const fetchComms = async () => {
    //         try {
    //             const res = await fetch(`/api/staff-comms?matchId=${match.id}`);
    //             if (res.ok) {
    //                 const data = await res.json();
    //                 setComms(data);
    //             }
    //         } catch (err) {
    //             console.error(err);
    //         }
    //     };
    //
    //     fetchComms();
    //     const interval = setInterval(fetchComms, 15000);
    //     return () => clearInterval(interval);
    // }, [match.id]);
    //
    // const handleSendNote = async (e: React.FormEvent) => {
    //     e.preventDefault();
    //     if (!noteContent || !user) return;
    //
    //     try {
    //         await fetch('/api/staff-comms', {
    //             method: 'POST',
    //             headers: { 'Content-Type': 'application/json' },
    //             body: JSON.stringify({
    //                 matchId: match.id,
    //                 userId: user.id,
    //                 content: noteContent,
    //                 type: 'note'
    //             })
    //         });
    //         setNoteContent('');
    //         const res = await fetch(`/api/staff-comms?matchId=${match.id}`);
    //         if (res.ok) setComms(await res.json());
    //     } catch (err) {
    //         console.error(err);
    //     }
    // };

    // Derive sub event sets for a team — shared by both pool functions
    const getSubSets = (teamId: string) => {
        const subEvents = (matchState?.events ?? []).filter(
            (e: any) => e.type === 'Substitution' && e.teamId === teamId
        );
        const subbedOffIds = new Set(subEvents.filter((e: any) => e.playerId).map((e: any) => e.playerId));
        const subbedOnIds = new Set(subEvents.filter((e: any) => e.relatedPlayerId).map((e: any) => e.relatedPlayerId));
        return { subbedOffIds, subbedOnIds };
    };

    // Players currently on the pitch: starters - subbed off + subbed on
    // Used by: normal event picker, sub-OUT picker, assist picker, penalty modal
    const getOnPitchPlayers = (team: 'home' | 'away') => {
        const roster = team === 'home' ? homePlayers : awayPlayers;
        const teamId = team === 'home' ? match.homeTeamId : match.awayTeamId;
        const teamLineup = lineups[team];
        const { subbedOffIds, subbedOnIds } = getSubSets(teamId);

        const subbedOnPlayers = roster.filter(p => subbedOnIds.has(p.id) && !subbedOffIds.has(p.id));
        const addSubbedOn = (base: typeof roster) => [
            ...base,
            ...subbedOnPlayers.filter(p => !base.find(b => b.id === p.id)),
        ];

        if (!teamLineup) return addSubbedOn(roster.filter(p => !subbedOffIds.has(p.id)));

        const starterIds = new Set(
            (teamLineup.starters || teamLineup.players || [])
                .map((p: any) => p.playerId || p.id || p)
                .filter(Boolean)
        );

        if (starterIds.size > 0) {
            return addSubbedOn(roster.filter(p => starterIds.has(p.id) && !subbedOffIds.has(p.id)));
        }
        return addSubbedOn(roster.filter(p => !subbedOffIds.has(p.id)));
    };

    // Players available to come on: bench - already subbed on - playerComingOut
    // Used by: sub-IN picker only
    const getAvailableBench = (team: 'home' | 'away') => {
        const roster = team === 'home' ? homePlayers : awayPlayers;
        const teamId = team === 'home' ? match.homeTeamId : match.awayTeamId;
        const teamLineup = lineups[team];
        const { subbedOnIds } = getSubSets(teamId);

        if (!teamLineup) return [];

        const benchIds = new Set(
            (teamLineup.substitutes || [])
                .map((p: any) => p.playerId || p.id || p)
                .filter(Boolean)
        );

        return roster.filter(p =>
            benchIds.has(p.id) &&
            !subbedOnIds.has(p.id) &&
            p.id !== playerComingOut
        );
    };

    // Initial Load & Manager Setup
    useEffect(() => {
        let unsubscribe: (() => void) | null = null;

        const init = async () => {
            try {
                // Fetch teams, all players, and eligible players for this match
                const [teamsRes, playersRes, lineupsRes, eligibleRes] = await Promise.all([
                    fetch('/api/teams'),
                    fetch('/api/players'),
                    fetch(`/api/matches/${match.id}/lineup`),
                    fetch(`/api/matches/${match.id}/eligible-players`)
                ]);

                const teamsData = await teamsRes.json();
                const playersData = await playersRes.json();
                const lineupsData = await lineupsRes.json();
                const eligibleData = await eligibleRes.json();

                const teams = Array.isArray(teamsData) ? teamsData : (teamsData.teams || teamsData.data || []);
                const players = Array.isArray(playersData) ? playersData : (playersData.players || playersData.data || []);
                
                // Use eligible players filtered by institutional data if available, otherwise fallback to team-based filtering
                const eligiblePlayers = eligibleData.success ? eligibleData.players : players;

                const home = teams.find((t: Team) => t.id === match.homeTeamId);
                const away = teams.find((t: Team) => t.id === match.awayTeamId);

                setHomeTeam(home || null);
                setAwayTeam(away || null);

                // Filter eligible players by team — memberships-aware so multi-affiliated players
                // (e.g. college + BUSA team) resolve against the match team, not just their primary affiliation
                const hPlayers = eligiblePlayers.filter((player: Player) =>
                    (player as any).memberships?.some((m: any) => m.team?.id === match.homeTeamId)
                    || getPlayerTeam(player)?.id === match.homeTeamId
                );
                const aPlayers = eligiblePlayers.filter((player: Player) =>
                    (player as any).memberships?.some((m: any) => m.team?.id === match.awayTeamId)
                    || getPlayerTeam(player)?.id === match.awayTeamId
                );

                setHomePlayers(hPlayers);
                setAwayPlayers(aPlayers);

                // Fetch competition data for playersPerSide and auto-determine half duration
                let detectedPlayersPerSide: number | null = null;
                let matchHalfDuration = 35; // Default for Nigerian university football
                try {
                    const compRes = await fetch(`/api/competitions`);
                    if (compRes.ok) {
                        const data = await compRes.json();
                        const comps = data.competitions || [];
                        const comp = comps.find((c: any) => c.name === match.competition);
                        if (comp?.playersPerSide) {
                            detectedPlayersPerSide = comp.playersPerSide;
                            setCompetitionPlayersPerSide(comp.playersPerSide);
                        }
                    }
                } catch (e) { console.log('Could not fetch competition data:', e); }

                // Determine half duration
                const isFiveAside = detectedPlayersPerSide === 5 ||
                    match.competition?.toLowerCase().includes('5-a-side') ||
                    match.competition?.toLowerCase().includes('5-aside') ||
                    match.competition?.toLowerCase().includes('futsal') ||
                    match.competition?.toLowerCase().includes('npuga');
                matchHalfDuration = isFiveAside ? 20 : 35;

                // Initialize Manager — seed currentPeriod from DB so period survives phone refresh
                // (DB value wins over localStorage via initial?.clock spread in initializeState)
                const VALID_PERIODS = ['NOT_STARTED','FIRST_HALF','HALF_TIME','SECOND_HALF','EXTRA_TIME_1','EXTRA_TIME_2','PENALTY_SHOOTOUT','FINISHED'] as const;
                type SeedPeriod = typeof VALID_PERIODS[number];
                // Same set matches/[id]/page.tsx uses for "should the clock be ticking" —
                // kept local here rather than shared, both files' copies are tiny and static.
                const ACTIVE_PLAY_PERIODS: readonly SeedPeriod[] = ['FIRST_HALF', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2'];
                const seedPeriod: SeedPeriod = VALID_PERIODS.includes(match.currentPeriod as SeedPeriod)
                    ? (match.currentPeriod as SeedPeriod)
                    : 'NOT_STARTED';
                // BUG-115: getMatchStateManager is a module-level singleton keyed by matchId —
                // if a manager instance already exists in memory (e.g. survived a re-auth that
                // didn't fully unmount this component), it's returned as-is and the DB seed
                // above is silently ignored, regardless of how stale the in-memory state is.
                // Destroying first guarantees every mount of this component gets a manager
                // freshly seeded from the DB, never a stale cached one. No other call site
                // in the codebase reads this registry, so nothing relies on it persisting.
                destroyMatchStateManager(match.id);
                const manager = getMatchStateManager(match.id, {
                    homeTeamId: match.homeTeamId,
                    awayTeamId: match.awayTeamId,
                    halfDuration: matchHalfDuration,
                    score: {
                        home: match.homeScore || 0,
                        away: match.awayScore || 0
                    },
                    // BUG-118 follow-up: this only ever seeded `period` — `absoluteMinute`
                    // was never read from the DB at all, so initializeState's baseClock fell
                    // through to its own default (0) or a stale localStorage value regardless
                    // of BUG-118's fix adding match.minute to the assigned-matches projection.
                    // match.minute is the BUG-109 checkpoint value — the closest real elapsed
                    // time available for a match resumed via this path.
                    // isRunning was also never seeded — every refresh mid-match came back
                    // paused (constructor only auto-starts the clock when isRunning is
                    // already true), needing a manual "Start" press even mid-second-half.
                    // Auto-resume only for periods where the clock should actually be
                    // ticking; HALF_TIME/PENALTY_SHOOTOUT/FINISHED/SUSPENDED stay paused.
                    clock: {
                        period: seedPeriod,
                        ...(match.minute != null ? { absoluteMinute: match.minute } : {}),
                        isRunning: ACTIVE_PLAY_PERIODS.includes(seedPeriod),
                    } as import('@/lib/match-state-manager').MatchClock,
                });

                manager.registerPlayers(hPlayers, 'home');
                manager.registerPlayers(aPlayers, 'away');

                stateManager.current = manager;

                // Fetch match config and apply halfDuration + maxSubstitutions
                try {
                    const configRes = await fetch(`/api/matches/${match.id}/config`);
                    if (configRes.ok) {
                        const { config } = await configRes.json();
                        stateManager.current.updateConfig({ halfDuration: config.halfDuration });
                        setHalfDuration(config.halfDuration);
                        setMaxSubstitutions(config.maxSubstitutions ?? null);
                    } else {
                        alert('Match config failed to load — using default duration. Check settings before starting.');
                    }
                } catch (e) {
                    alert('Match config failed to load — using default duration. Check settings before starting.');
                }

                unsubscribe = manager.subscribe((newState) => {
                    setMatchState({ ...newState });
                    // Sync local UI halfDuration with manager state
                    setHalfDuration(newState.halfDuration);
                });

                setMatchState(manager.getState());

                // BACKLOG-106: If match is in-progress but no events in local state (fresh session
                // after tab close, device switch, or AuthContext wipe), seed from DB so that
                // subbedOnIds/subbedOffIds derive correctly and all 11 on-pitch players are visible.
                const stateAfterInit = manager.getState();
                if (stateAfterInit.clock.period !== 'NOT_STARTED' && stateAfterInit.events.length === 0) {
                    try {
                        const eventsRes = await fetch(`/api/matches/${match.id}/events`);
                        if (eventsRes.ok) {
                            const { events: dbEvents } = await eventsRes.json();
                            if (Array.isArray(dbEvents) && dbEvents.length > 0) {
                                const seeded = dbEvents.map((e: any) => ({
                                    id: e.id,
                                    matchId: e.matchId,
                                    type: e.type as FootballEventType,
                                    absoluteMinute: e.minute ?? 0,
                                    displayMinute: e.minute ?? 0,
                                    second: e.second ?? 0,
                                    period: (e.period ?? 'FIRST_HALF') as MatchPeriod,
                                    playerId: e.playerId ?? null,
                                    playerSnapshot: null,
                                    relatedPlayerId: e.relatedPlayerId ?? null,
                                    relatedPlayerSnapshot: null,
                                    teamId: e.teamId ?? '',
                                    detail: e.detail ?? '',
                                    value: e.value != null ? Number(e.value) : undefined,
                                    createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
                                    loggerId: e.loggerId ?? '',
                                }));
                                stateManager.current?.mergeExternalEvents(seeded);
                                setMatchState(manager.getState());
                            }
                        }
                    } catch (e) {
                        console.error('[BACKLOG-106] Failed to seed events from DB:', e);
                    }
                }

                // Lineup Check
                const currentState = manager.getState();
                if (currentState.clock.period !== 'NOT_STARTED') {
                    if (lineupsData.success && lineupsData.lineups) {
                        setLineups(lineupsData.lineups);
                    }
                    setViewState('active');
                } else if (lineupsData.success && lineupsData.lineups && (lineupsData.lineups.home || lineupsData.lineups.away)) {
                    setLineups(lineupsData.lineups || { home: null, away: null });
                    setViewState('confirm_lineup');
                } else {
                    setViewState('check_lineup');
                }

                setIsLoading(false);
            } catch (err) {
                console.error("Failed to init logger:", err);
                setIsLoading(false);
            }
        };

        init();
        return () => {
            if (unsubscribe) unsubscribe();
            // BUG-143: cancel any still-pending assist-chain timeouts so they can't
            // fire (and silently write/broadcast an event) after this component --
            // and this specific match's stateManager -- is gone.
            pendingAssistTimeouts.current.forEach(clearTimeout);
            pendingAssistTimeouts.current = [];
        };
    }, [match.id, match.homeTeamId, match.awayTeamId]);

    // Listen for period end events
    useEffect(() => {
        const handlePeriodEnd = (event: any) => {
            const { currentPeriod, nextPeriod, requiresExtraTime } = event.detail;

            if (requiresExtraTime) {
                // Show extra time modal
                setPendingPeriodTransition({ current: currentPeriod, next: nextPeriod });
                setShowPeriodEndModal(true);
            } else {
                // Auto-transition (e.g., extra time periods)
                stateManager.current?.completePeriodTransition(nextPeriod);
            }
        };

        window.addEventListener('MATCH_PERIOD_END', handlePeriodEnd);
        return () => window.removeEventListener('MATCH_PERIOD_END', handlePeriodEnd);
    }, []);

    // Broadcast Time Updates for Overlay/Remote
    useEffect(() => {
        if (!matchState || !stateManager.current) return;

        // Use state directly (no getCurrentTime in manager API, use public state)
        const { absoluteMinute: minute, second, period } = matchState.clock;

        let half = 1;
        let extraTime = 0;

        if (period === 'SECOND_HALF') half = 2;
        else if (period === 'HALF_TIME') half = 1;
        else if (period === 'EXTRA_TIME_1') half = 3;
        else if (period === 'EXTRA_TIME_2') half = 4;
        else if (period === 'FINISHED') half = 2;

        if (period === 'FIRST_HALF' && minute > 45) extraTime = minute - 45;
        if (period === 'SECOND_HALF' && minute > 90) extraTime = minute - 90;

        const payload = {
            matchId: match.id,
            minute: minute > 45 && period === 'FIRST_HALF' ? 45 : (minute > 90 && period === 'SECOND_HALF' ? 90 : minute),
            extraTime,
            half,
            second,
            period, // Include period for robust clients
            announcedStoppage: matchState.clock.announcedStoppage || 0
        };

        // Local Overlay Sync
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('MATCH_TIME_UPDATE', { detail: payload }));
        }

        // Remote Sync
        if (isSocketConnected) {
            emit('match:time:update', payload);
        }

        // BUG-109: periodic DB checkpoint, throttled separately from the per-tick WS emit
        // above — this is the durable fallback a fresh page load / dead socket reads from.
        // Not gated on isSocketConnected: the DB write is the point precisely when the
        // live channel isn't reaching viewers.
        if (period !== 'NOT_STARTED') {
            const now = Date.now();
            if (now - lastClockCheckpointAt.current >= 15000) {
                lastClockCheckpointAt.current = now;
                fetch(`/api/matches/${match.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ minute: payload.minute, extraTime: payload.extraTime }),
                }).catch((e) => console.error('[BUG-109] Failed to persist clock checkpoint:', e));
            }
        }
    }, [matchState, isSocketConnected, emit, match.id]);

    // Broadcast Score/Status Updates for Overlays
    useEffect(() => {
        if (!matchState || !isSocketConnected) return;

        // Broadcast Score
        emit('match:score:updated', {
            matchId: match.id,
            homeScore: matchState.score.home,
            awayScore: matchState.score.away
        });

        // Broadcast Status (Period)
        emit('match:status:changed', {
            matchId: match.id,
            status: matchState.clock.period,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            homeTeam: homeTeam?.name,
            awayTeam: awayTeam?.name,
            homeScore: matchState.score.home,
            awayScore: matchState.score.away
        });
    }, [matchState?.score.home, matchState?.score.away, matchState?.clock.period, isSocketConnected, emit, match.id, match.homeTeamId, match.awayTeamId, homeTeam?.name, awayTeam?.name]);

    // Multi-logger Hook
    const {
        activeLoggers,
        conflicts,
        isConnected,
        resolveConflict,
        syncStatus,
        syncEvents,
        broadcastEvent
    } = useMultiLogger({
        matchId: match.id,
        loggerId: currentLogger?.id || 'unknown',
        loggerName: currentLogger?.name || 'Unknown Logger',
        enabled: !!currentLogger,
    });

    // Periodic Sync
    useEffect(() => {
        if (!isConnected || !stateManager.current) return;

        const syncInterval = setInterval(async () => {
            const manager = stateManager.current;
            if (!manager) return;

            const currentEvents = manager.getState().events;

            // Map to SyncEvent
            const syncableEvents: SyncEvent[] = currentEvents.map(e => ({
                id: e.id,
                type: e.type,
                minute: e.absoluteMinute,
                second: e.second,
                teamId: e.teamId,
                playerId: e.playerId || undefined,
                relatedPlayerId: e.relatedPlayerId || undefined,
                detail: e.detail,
                loggerId: e.loggerId,
                loggerName: 'Unknown',
                timestamp: new Date(e.createdAt),
                synced: true
            }));

            try {
                const merged = await syncEvents(syncableEvents);

                // Convert back to MatchEvent
                const externalEvents: any[] = merged.map(s => {
                    // Check if we already have it
                    const existing = currentEvents.find(ce => ce.id === s.id);
                    if (existing) return existing;

                    // Reconstruct
                    return {
                        id: s.id,
                        matchId: match.id,
                        type: s.type as any,
                        absoluteMinute: s.minute,
                        displayMinute: s.minute, // Approximation
                        second: s.second,
                        period: s.minute <= 45 ? 'FIRST_HALF' : 'SECOND_HALF', // Rough heuristic
                        playerId: s.playerId || null,
                        playerSnapshot: s.playerId ? manager.createPlayerSnapshot(s.playerId) : null,
                        relatedPlayerId: s.relatedPlayerId || null,
                        relatedPlayerSnapshot: s.relatedPlayerId ? manager.createPlayerSnapshot(s.relatedPlayerId) : null,
                        teamId: s.teamId,
                        detail: s.detail,
                        createdAt: s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp),
                        loggerId: s.loggerId
                    };
                });

                manager.mergeExternalEvents(externalEvents);
            } catch (err) {
                console.error("Sync failed:", err);
            }

        }, 10000); // 10s sync

        return () => clearInterval(syncInterval);
    }, [isConnected, syncEvents, match.id]);

    // Automated Event Propagation (Red Cards from 2nd Yellow, etc.)
    useEffect(() => {
        if (!stateManager.current || !currentLogger) return;

        const manager = stateManager.current;
        const unsubscribe = manager.subscribeToEvents(async (event) => {
            // Only propagation events generated by THIS logger to avoid loops
            if (event.loggerId !== currentLogger.id) return;

            // 1. Broadcast (Multi-Logger & Sockets)
            // Sync with other loggers
            if (isConnected) {
                console.log('[FootballLogger] Broadcasting sync-event to other loggers');
                broadcastEvent({
                    id: event.id,
                    type: event.type,
                    minute: event.absoluteMinute,
                    second: event.second,
                    teamId: event.teamId,
                    playerId: event.playerId || undefined,
                    relatedPlayerId: event.relatedPlayerId || undefined,
                    detail: event.detail,
                    loggerId: event.loggerId,
                    loggerName: currentLogger?.name || 'Unknown',
                    timestamp: event.createdAt, // This is a Date
                    synced: false
                });
            }

            // Sync with overlay clients via standard match room
            if (isSocketConnected) {
                const fullState = manager.getState();
                console.log(`[FootballLogger] Emitting event:log for match ${match.id}. Type: ${event.type}`);
                emit('event:log', {
                    matchId: match.id,
                    event: {
                        ...event,
                        minute: event.absoluteMinute // Add 'minute' for UI compatibility
                    },
                    type: event.type,
                    detail: event.detail,
                    teamId: event.teamId,
                    minute: event.absoluteMinute,
                    timestamp: Date.now(),
                    // Include full state for atomic updates on overlay
                    score: fullState.score,
                    teamRatings: fullState.teamRatings,
                    stats: fullState.stats,
                    lineups: fullState.lineups,
                    status: fullState.clock.period
                });
            } else {
                console.warn(`[FootballLogger] Socket NOT connected for match ${match.id}, skipping event:log emit`);
            }

            // 2. Persist to API
            // Hoisted so catch block can queue the same payload on network failure.
            const payload = {
                type: event.type,
                minute: event.absoluteMinute,
                second: event.second,
                teamId: event.teamId,
                playerId: event.playerId,
                relatedPlayerId: event.relatedPlayerId,
                detail: event.detail,
                loggerId: event.loggerId,
                loggerName: currentLogger?.name,
                period: event.period,
            };
            try {

                const res = await fetch(`/api/matches/${match.id}/events`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const saved = await res.json();
                    if (saved.event && saved.event.id) {
                        manager.confirmEvent(event.id, saved.event.id);
                    }
                } else {
                    // Server rejection (4xx/5xx) — real error, not a connectivity issue.
                    // Do NOT queue: the server received and rejected the event.
                    const errBody = await res.json().catch(() => ({}));
                    if (res.status === 401) {
                        alert('Session expired — please log in again to continue logging.');
                    } else if (res.status === 403) {
                        alert('Not authorised to log events for this match. Contact admin.');
                    } else {
                        alert(`Event failed to save (${res.status}) — check connection and retry.`);
                    }
                    console.error('[FootballLogger] Event POST rejected:', res.status, errBody);
                }
            } catch (e) {
                // Network failure — server never received the event. Queue for background sync.
                const token = localStorage.getItem('authToken');
                if (!token) {
                    // No token = no recovery path. Surface visibly rather than silently losing the event.
                    console.error('[FootballLogger] Network error and no token available — event cannot be queued:', e);
                    alert('Network error: could not save this event and no session found. Please re-login and re-log this event manually.');
                    return;
                }
                // JWT TTL is 7 days. Refuse to queue if < 30 min remaining —
                // a drained sync with an expired token will 401 with no recovery path.
                const QUEUE_MIN_TTL_SECONDS = 30 * 60;
                if (jwtSecondsRemaining(token) < QUEUE_MIN_TTL_SECONDS) {
                    console.warn('[FootballLogger] Token expiring soon — refusing to queue offline event');
                    alert('Your session is expiring soon. This event was NOT queued for offline sync — please re-login before continuing offline, then re-log this event.');
                    return;
                }
                try {
                    await queueOfflineEvent(match.id, payload, token);
                    setQueuedOfflineCount(prev => prev + 1);
                    if ('serviceWorker' in navigator) {
                        const reg = await navigator.serviceWorker.ready;
                        if ('sync' in reg) {
                            await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-match-events');
                        }
                    }
                    console.log('[FootballLogger] Event queued for background sync');
                } catch (queueErr) {
                    console.error('[FootballLogger] Failed to queue event:', queueErr);
                }
            }
        });

        return unsubscribe;
    }, [isConnected, isSocketConnected, emit, broadcastEvent, currentLogger, match.id, isLoading]);

    const requiresPlayerSelection = (type: FootballEventType): boolean => {
        const noPlayerEvents: FootballEventType[] = [
            'Corner', 'Free Kick', 'Throw In', 'Goal Kick', 'Offside'
        ];
        return !noPlayerEvents.includes(type);
    };

    const isGoalkeeperOnlyEvent = (type: FootballEventType): boolean => {
        return type === 'Save' || type === 'Catch';
    };

    const handleEventClick = (type: FootballEventType, isGoal: boolean = false) => {
        if (!stateManager.current || currentPeriod === 'NOT_STARTED' || currentPeriod === 'FINISHED') return;

        if (!requiresPlayerSelection(type)) {
            // Direct record without player
            confirmEvent(type, 'TEAM', null); // Use TEAM or internal handling
            return;
        }

        setPendingEvent({ type, isGoal });
        setShowPlayerModal(true);
    };

    const handlePlayerSelect = (playerId: string) => {
        if (!pendingEvent) return;
        const type = pendingEvent.type;
        setSelectedEventPlayer(playerId);
        setShowPlayerModal(false);

        if (type === 'Substitution') {
            setPlayerComingOut(playerId);
            setShowSubInModal(true);
            return;
        }

        if (pendingEvent.isGoal) {
            setShowAssistModal(true);
        } else if (type === 'Foul') {
            setPendingFoulPlayerId(playerId);
            setShowFoulOutcomeModal(true);
            setPendingEvent(null);
        } else if (type === 'Yellow Card' || type === 'Red Card') {
            setPendingReasonEvent({ type, playerId });
            setShowReasonModal(true);
            setPendingEvent(null);
        } else {
            confirmEvent(type, playerId, null);
            setPendingEvent(null);
        }
    };

    const handleAssistSelect = (assistPlayerId: string | null) => {
        if (!pendingEvent || !selectedEventPlayer) return;
        confirmEvent(pendingEvent.type, selectedEventPlayer, assistPlayerId);
        setShowAssistModal(false);
        setPendingEvent(null);
    };

    const handleSubIn = (playerInId: string) => {
        if (!playerComingOut) return;
        if (maxSubstitutions !== null) {
            const teamIndex = selectedTeam === 'home' ? 0 : 1;
            const subsMade = matchState?.stats?.substitutions[teamIndex] ?? 0;
            if (subsMade >= maxSubstitutions) {
                alert(`Maximum substitutions reached for this team (${maxSubstitutions})`);
                setShowSubInModal(false);
                setPlayerComingOut(null);
                return;
            }
        }
        confirmEvent('Substitution', playerComingOut, playerInId);
        setShowSubInModal(false);
        setPlayerComingOut(null);
    };

    const confirmEvent = async (type: FootballEventType, playerId: string, relatedPlayerId: string | null) => {
        if (!stateManager.current) return;

        const manager = stateManager.current;
        const teamId = selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId;

        // Handle direct events where playerId is 'TEAM'
        let actualPlayerId: string | null = playerId === 'TEAM' ? null : playerId;
        let playerSnapshot = actualPlayerId ? manager.createPlayerSnapshot(actualPlayerId) : null;
        const relatedSnapshot = relatedPlayerId ? manager.createPlayerSnapshot(relatedPlayerId) : null;

        let detail = playerId === 'TEAM' ? type : (playerSnapshot ? (playerSnapshot.name) : 'Unknown');

        if (type === 'Substitution' && relatedSnapshot) {
            const relatedPlayer = manager.getPlayer(relatedPlayerId!);
            const relatedName = relatedPlayer?.name || relatedSnapshot.name;
            const outName = playerSnapshot?.name || detail;
            detail = `${relatedName} IN for ${outName}`;
        }


        if (type === 'Assist' && relatedSnapshot) {
            detail = `Assist for ${relatedSnapshot.name}`;
        }

        // 1. Record Locally
        const localEvent = manager.recordEvent({
            matchId: match.id,
            type,
            teamId,
            playerId: actualPlayerId,
            playerSnapshot,
            relatedPlayerId: relatedPlayerId,
            relatedPlayerSnapshot: relatedSnapshot,
            detail,
            loggerId: currentLogger?.id || 'unknown'
        });

        // 1b. Handle Goal/Penalty + Assist chain
        // If this is a Goal/Penalty and has an assistant, record the assistant as a separate event
        if ((type === 'Goal' || type === 'Penalty') && relatedPlayerId) {
            // We give it a short delay so IDs and order are consistent
            const timeoutId = setTimeout(() => {
                confirmEvent('Assist', relatedPlayerId, playerId);
            }, 500);
            pendingAssistTimeouts.current.push(timeoutId);
        }

        // 2. Send Push Notifications for key discipline and scoring events
        const isGoalEvent = type === 'Goal' || type === 'Penalty' || type === 'Own Goal';
        const isCardEvent = type === 'Yellow Card' || type === 'Red Card';
        const isPenaltyOutcome = type === 'Penalty Saved' || type === 'Penalty Missed';
        if (isGoalEvent || isCardEvent || isPenaltyOutcome) {
            const currentState = manager.getState();
            const notifEventType = (type === 'Goal' || type === 'Penalty' || type === 'Own Goal') ? 'GOAL' :
                type === 'Red Card' ? 'RED_CARD' :
                type === 'Penalty Saved' ? 'PENALTY_SAVED' :
                type === 'Penalty Missed' ? 'PENALTY_MISSED' :
                'YELLOW_CARD';
            // For Penalty Saved: show keeper name as headline (relatedPlayerId is keeper)
            const relatedSnapshot = relatedPlayerId ? manager.createPlayerSnapshot(relatedPlayerId) : null;
            const playerName = type === 'Penalty Saved'
                ? (relatedSnapshot?.name || playerSnapshot?.name || 'Unknown')
                : (playerSnapshot?.name || 'Unknown Player');
            const teamName = selectedTeam === 'home' ? (homeTeam?.name || 'Home') : (awayTeam?.name || 'Away');

            fetch('/api/notifications/match-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId: match.id,
                    homeTeamId: match.homeTeamId,
                    awayTeamId: match.awayTeamId,
                    eventType: notifEventType,
                    playerName,
                    teamName,
                    minute: currentState.clock.displayMinute,
                    homeScore: currentState.score.home,
                    awayScore: currentState.score.away,
                })
            }).catch(e => console.warn('[FootballLogger] Push notification failed:', e));
        }
    };

    const handleSetStoppage = (minutes: number) => {
        stateManager.current?.setAnnouncedStoppage(minutes);
        setShowStoppageModal(false);
    };

    // BUG-194 part 2: shared by every period-transition PATCH (half/OT/penalty
    // starts, end-of-period transitions, including the final-whistle combined
    // patch). Was fire-and-forget (`.catch(e => console.error(...))`) at every
    // call site, same gap BasketballLogger.tsx's BUG-142 fix closed there --
    // on a network failure this now queues the PATCH via the same
    // pendingAdminChanges mechanism undo below uses, instead of silently
    // dropping the write with no recovery path. Deliberately NOT applied to
    // the 15s clock-checkpoint PATCH (BUG-109) -- that one is a frequent,
    // best-effort update where only the latest value matters, and queueing
    // every 15s tick while offline would flood the queue with superseded data.
    const persistMatchPatch = async (body: Record<string, unknown>, label: string) => {
        try {
            const res = await fetch(`/api/matches/${match.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                setEventSaveError(`Failed to save ${label} (${res.status}) — may not persist on refresh.`);
                return;
            }
            setEventSaveError(null);
        } catch (e) {
            console.error(`Failed to persist ${label}:`, e);
            const token = localStorage.getItem('authToken');
            if (!token || jwtSecondsRemaining(token) < 30 * 60) {
                setEventSaveError(`Failed to save ${label} — offline or unreachable, and could not queue a retry (${!token ? 'no session' : 'session expiring soon'}).`);
                return;
            }
            try {
                await queueAdminChange(`/api/matches/${match.id}`, 'PATCH', body, token);
                setQueuedAdminChangeCount(prev => prev + 1);
                setEventSaveError(`${label} queued — will save automatically once back online.`);
                if ('serviceWorker' in navigator) {
                    const reg = await navigator.serviceWorker.ready;
                    if ('sync' in reg) {
                        await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-admin-changes');
                    }
                }
            } catch (queueErr) {
                console.error(`Failed to queue ${label}:`, queueErr);
                setEventSaveError(`Failed to save ${label} — offline or unreachable, and queueing also failed.`);
            }
        }
    };

    const handlePeriodEndConfirm = () => {
        if (!stateManager.current || !pendingPeriodTransition) return;

        const nextPeriod = pendingPeriodTransition.next;

        // Complete the transition to next period
        stateManager.current.completePeriodTransition(nextPeriod as any);

        // When the period reaches FINISHED and scores differ, finalize the match in the same
        // PATCH — the "End Match" button is hidden once currentPeriod === 'FINISHED' so
        // handleFinalize would be unreachable after this transition (BUG-076).
        // When scores are equal we leave status as LIVE so the ET/Penalties flow can continue.
        const isFinalWhistle = nextPeriod === 'FINISHED' && homeScore !== awayScore;

        persistMatchPatch(
            isFinalWhistle
                ? { currentPeriod: nextPeriod, status: 'FINISHED', homeScore, awayScore, stats: matchState?.stats }
                : { currentPeriod: nextPeriod },
            isFinalWhistle ? 'match finalization' : `${nextPeriod} transition`
        );

        // Close modal and reset state
        setShowPeriodEndModal(false);
        setPendingPeriodTransition(null);
    };

    const toggleClock = () => {
        if (!stateManager.current) return;
        if (isClockRunning) {
            stateManager.current.stopClock();
        } else {
            stateManager.current.startClock();
        }
    };

    // BUG-194 part 2: shared by both delete calls in handleUndo below (the
    // main event, plus the preceding Yellow Card on a second-yellow undo).
    // Was previously a single try/catch around both fetches ending in a
    // blocking alert() with no recovery path -- on a genuine network failure
    // this now queues the DELETE via the same pendingAdminChanges mechanism
    // BasketballLogger.tsx's BUG-142 fix uses. Never touches local state
    // itself (BUG-130's principle: never flip local state before the server,
    // or a confirmed queue write, actually reflects it) -- the caller decides
    // what to do with each outcome.
    const deleteEventWithQueue = async (eventId: string): Promise<
        { status: 'ok' } | { status: 'rejected'; detail: string } | { status: 'queued'; detail: string } | { status: 'failed'; detail: string }
    > => {
        try {
            const res = await fetch(`/api/matches/${match.id}/events/${eventId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                return { status: 'rejected', detail: String(data.error || res.status) };
            }
            return { status: 'ok' };
        } catch (e) {
            console.error('Failed to undo event:', e);
            const token = localStorage.getItem('authToken');
            if (!token || jwtSecondsRemaining(token) < 30 * 60) {
                return { status: 'failed', detail: `offline or unreachable, and could not queue a retry (${!token ? 'no session' : 'session expiring soon'})` };
            }
            try {
                await queueAdminChange(`/api/matches/${match.id}/events/${eventId}`, 'DELETE', {}, token);
                setQueuedAdminChangeCount(prev => prev + 1);
                if ('serviceWorker' in navigator) {
                    const reg = await navigator.serviceWorker.ready;
                    if ('sync' in reg) {
                        await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-admin-changes');
                    }
                }
                return { status: 'queued', detail: 'queued — will retry automatically once back online' };
            } catch (queueErr) {
                console.error('Failed to queue undo:', queueErr);
                return { status: 'failed', detail: 'offline or unreachable, and queueing also failed' };
            }
        }
    };

    const handleUndo = async () => {
        if (!stateManager.current || isUndoing) return;
        const manager = stateManager.current;
        const currentEvents = manager.getState().events;
        if (currentEvents.length === 0) return;

        const eventToUndo = currentEvents[currentEvents.length - 1];
        const isSecondYellow = eventToUndo.detail === 'Red Card (Second Yellow)';

        // For second yellow: find the Yellow Card for the same player that triggered it
        let precedingYellow: typeof currentEvents[0] | null = null;
        if (isSecondYellow && eventToUndo.playerId) {
            for (let i = currentEvents.length - 2; i >= 0; i--) {
                if (currentEvents[i].playerId === eventToUndo.playerId && currentEvents[i].type === 'Yellow Card') {
                    precedingYellow = currentEvents[i];
                    break;
                }
            }
        }

        setIsUndoing(true);
        try {
            const redResult = await deleteEventWithQueue(eventToUndo.id);
            if (redResult.status === 'rejected') {
                alert(`Failed to undo event: ${redResult.detail}`);
                return;
            }
            if (redResult.status === 'failed') {
                setEventSaveError(`Failed to undo "${eventToUndo.type}" — ${redResult.detail}. Event was not removed; try again once back online.`);
                return;
            }
            if (redResult.status === 'queued') {
                setEventSaveError(`Undo of "${eventToUndo.type}" ${redResult.detail}. Event still shown until then.`);
                return;
            }

            // Second yellow: also delete the Yellow Card that triggered it
            if (isSecondYellow && precedingYellow) {
                const yellowResult = await deleteEventWithQueue(precedingYellow.id);
                if (yellowResult.status === 'rejected') {
                    // Red is already gone from DB — remove it from local state before surfacing error
                    manager.undoLastEvent();
                    alert(`Red card removed but yellow card could not be undone: ${yellowResult.detail}`);
                    return;
                }
                if (yellowResult.status === 'failed') {
                    manager.undoLastEvent();
                    setEventSaveError(`Red card removed, but Yellow Card undo failed — ${yellowResult.detail}. Yellow Card was not removed; try again once back online.`);
                    return;
                }
                if (yellowResult.status === 'queued') {
                    // Red confirmed gone — remove it locally. The Yellow Card's own
                    // removal stays unconfirmed, so it stays visible until the queued
                    // DELETE actually lands.
                    manager.undoLastEvent();
                    setEventSaveError(`Red card removed. Yellow Card undo ${yellowResult.detail}. Yellow Card still shown until then.`);
                    return;
                }
            }

            // DB deletes confirmed — update local state
            manager.undoLastEvent(); // removes Red Card
            if (isSecondYellow && precedingYellow) {
                manager.undoLastEvent(); // Yellow Card is now last — remove it too
            }
            setEventSaveError(null);

            if (isSocketConnected) {
                const fullState = manager.getState();
                emit('event:undo', {
                    matchId: match.id,
                    eventId: eventToUndo.id,
                    score: fullState.score,
                    stats: fullState.stats,
                    lineups: fullState.lineups,
                    teamRatings: fullState.teamRatings,
                });
                // Second yellow: broadcast Yellow Card removal separately so public
                // viewers see both cards removed from their timeline.
                if (isSecondYellow && precedingYellow) {
                    const stateAfterBoth = manager.getState();
                    emit('event:undo', {
                        matchId: match.id,
                        eventId: precedingYellow.id,
                        score: stateAfterBoth.score,
                        stats: stateAfterBoth.stats,
                        lineups: stateAfterBoth.lineups,
                        teamRatings: stateAfterBoth.teamRatings,
                    });
                }
            }
        } finally {
            setIsUndoing(false);
        }
    };

    const handleFinalize = async () => {
        if (!confirm('Are you sure you want to end the match?')) return;
        setIsSaving(true);

        try {
            const res = await fetch(`/api/matches/${match.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'FINISHED',
                    currentPeriod: 'FINISHED',
                    homeScore,
                    awayScore,
                    stats: matchState?.stats
                }),
            });
            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            // PATCH confirmed — transition local state to FINISHED
            stateManager.current?.transitionStatus('FINISHED');

            // Sync status via socket immediately
            if (isSocketConnected) {
                emit('match:status:changed', {
                    matchId: match.id,
                    status: 'FINISHED',
                    homeScore,
                    awayScore,
                });
            }

            // Send MATCH_END push notification
            try {
                await fetch('/api/notifications/match-event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        matchId: match.id,
                        homeTeamId: match.homeTeamId,
                        awayTeamId: match.awayTeamId,
                        eventType: 'MATCH_END',
                        teamName: `${homeTeam?.name || 'Home'} vs ${awayTeam?.name || 'Away'}`,
                        homeScore,
                        awayScore,
                    }),
                });
            } catch (e) { console.error('Failed to send match end notification:', e); }
            alert('Match finalized.');
        } catch (e) {
            console.error(e);
            alert('Error saving match result.');
        } finally {
            setIsSaving(false);
        }
    };

    const fetchLineups = async () => {
        setIsLoading(true);
        try {
            const lineupsRes = await fetch(`/api/matches/${match.id}/lineup`);
            const lineupsData = await lineupsRes.json();
            const isActive = viewState === 'active';
            if (lineupsData.success && lineupsData.lineups && (lineupsData.lineups.home || lineupsData.lineups.away)) {
                setLineups(lineupsData.lineups || { home: null, away: null });
                if (!isActive) setViewState('confirm_lineup');
            } else {
                if (!isActive) setViewState('check_lineup');
            }
        } catch (e) { console.error(e); }
        setIsLoading(false);
    };

    const handleConfirmLineup = () => {
        setViewState('active');
    };

    const handleEditLineup = (team: 'home' | 'away') => {
        setEditingTeam(team);
        const currentLineup = lineups[team];
        const allPlayers = team === 'home' ? homePlayers : awayPlayers;

        let starters: Player[] = [];
        let subs: Player[] = [];

        // Support both 'starters' and legacy 'players' keys
        const starterList = currentLineup ? (currentLineup.starters || currentLineup.players) : null;

        if (starterList) {
            const starterIds = new Set(starterList.map((p: any) => p.playerId || p.id || p));
            starters = allPlayers.filter(p => starterIds.has(p.id));
            subs = allPlayers.filter(p => !starterIds.has(p.id));
        } else {
            starters = allPlayers.slice(0, STARTER_COUNT);
            subs = allPlayers.slice(STARTER_COUNT);
        }

        setDraftLineup({ starters, subs });
        setShowLineupEditModal(true);
    };

    const saveLineupDraft = async () => {
        try {
            const lineupPayload = {
                starters: draftLineup.starters.map(p => ({
                    playerId: p.id,
                    id: p.id, // legacy
                    name: p.name,
                    number: p.number,
                    position: p.position
                })),
                substitutes: draftLineup.subs.map(p => ({
                    playerId: p.id,
                    id: p.id, // legacy
                    name: p.name,
                    number: p.number,
                    position: p.position
                })),
                // Legacy support
                players: draftLineup.starters.map(p => ({
                    playerId: p.id,
                    id: p.id,
                    name: p.name,
                    number: p.number,
                    position: p.position
                })),
                formation: lineups[editingTeam]?.formation || '4-4-2',
                status: 'published' // Mark as published so MatchOverlay shows it
            };

            const payload = { team: editingTeam, lineup: lineupPayload };

            await fetch(`/api/matches/${match.id}/lineup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Refresh local
            setLineups((prev: any) => ({
                ...prev,
                [editingTeam]: lineupPayload
            }));

            // Broadcast update via socket
            if (isSocketConnected) {
                emit('match:lineup:update', {
                    matchId: match.id,
                    lineups: {
                        home: editingTeam === 'home' ? lineupPayload : lineups.home,
                        away: editingTeam === 'away' ? lineupPayload : lineups.away
                    }
                });
            }

            setShowLineupEditModal(false);
        } catch (e) {
            console.error("Failed to save lineup", e);
            alert("Failed to save lineup changes");
        }
    };

    const toggleStarterStatus = (player: Player) => {
        const isStarter = draftLineup.starters.some(p => p.id === player.id);
        if (isStarter) {
            setDraftLineup(prev => ({
                starters: prev.starters.filter(p => p.id !== player.id),
                subs: [...prev.subs, player]
            }));
        } else {
            if (draftLineup.starters.length >= STARTER_COUNT) {
                alert(`Max ${STARTER_COUNT} starters allowed`);
                return;
            }
            setDraftLineup(prev => ({
                starters: [...prev.starters, player],
                subs: prev.subs.filter(p => p.id !== player.id)
            }));
        }
    };

    if (viewState === 'loading') {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (viewState === 'check_lineup') {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-8 space-y-6">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <Activity size={48} className="text-white/20" />
                </div>
                <h2 className="text-2xl font-display italic uppercase">No Lineup Available</h2>
                <p className="text-white/40 text-center max-w-sm">
                    The admin has not set a lineup for this match yet. Please wait for the lineup to be published.
                </p>
                <button
                    onClick={fetchLineups}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-black font-bold rounded-xl hover:scale-105 transition-transform"
                >
                    <Activity size={18} className={isLoading ? "animate-spin" : ""} />
                    Refresh Check
                </button>
            </div>
        );
    }

    if (viewState === 'confirm_lineup') {
        return (
            <div className="min-h-screen bg-[#050505] text-white overflow-y-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    <header className="flex items-center justify-between">
                        <h1 className="text-3xl font-display italic uppercase">Confirm Lineups</h1>
                        <button onClick={handleConfirmLineup} className="px-8 py-3 bg-green-500 text-black font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-lg shadow-green-500/20">
                            Confirm & Start Match
                        </button>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Home Team */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-xl">{homeTeam?.name || 'Home'}</h3>
                                <button onClick={() => handleEditLineup('home')} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-black uppercase tracking-widest transition-colors">
                                    Edit
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Starters</h4>
                                    <div className="space-y-1">
                                        {(lineups.home?.starters || lineups.home?.players || []).map((p: any) => {
                                            const full = homePlayers.find(pl => pl.id === (p.playerId || p.id)) || p;
                                            return (
                                                <div key={p.playerId || p.id || p} className="flex items-center gap-2 text-sm p-2 bg-black/20 rounded-lg">
                                                    <span className="font-mono text-white/40 w-6 text-right">{full.number ?? p.jerseyNumber}</span>
                                                    <span className="font-bold">{full.name ?? p.jerseyName}</span>
                                                    <span className="text-xs text-white/30 ml-auto">{full.position ?? p.position}</span>
                                                </div>
                                            );
                                        })}
                                        {(!(lineups.home?.starters || lineups.home?.players) || (lineups.home?.starters || lineups.home?.players).length === 0) && (
                                            <div className="text-white/20 text-sm italic p-2">No players set</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Away Team */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-xl">{awayTeam?.name || 'Away'}</h3>
                                <button onClick={() => handleEditLineup('away')} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-black uppercase tracking-widest transition-colors">
                                    Edit
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Starters</h4>
                                    <div className="space-y-1">
                                        {(lineups.away?.starters || lineups.away?.players || []).map((p: any) => {
                                            const full = awayPlayers.find(pl => pl.id === (p.playerId || p.id)) || p;
                                            return (
                                                <div key={p.playerId || p.id || p} className="flex items-center gap-2 text-sm p-2 bg-black/20 rounded-lg">
                                                    <span className="font-mono text-white/40 w-6 text-right">{full.number ?? p.jerseyNumber}</span>
                                                    <span className="font-bold">{full.name ?? p.jerseyName}</span>
                                                    <span className="text-xs text-white/30 ml-auto">{full.position ?? p.position}</span>
                                                </div>
                                            );
                                        })}
                                        {(!(lineups.away?.starters || lineups.away?.players) || (lineups.away?.starters || lineups.away?.players).length === 0) && (
                                            <div className="text-white/20 text-sm italic p-2">No players set</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit Modal */}
                {showLineupEditModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-zinc-900 border border-white/10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                                <div>
                                    <h3 className="font-display italic text-2xl uppercase">Edit {editingTeam === 'home' ? homeTeam?.name : awayTeam?.name}</h3>
                                    <p className="text-xs text-white/40">Select exactly {STARTER_COUNT} starters</p>
                                </div>
                                <button onClick={() => setShowLineupEditModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {[...draftLineup.starters, ...draftLineup.subs].sort((a, b) => (a.number || 99) - (b.number || 99)).map(player => {
                                        const isStarter = draftLineup.starters.some(p => p.id === player.id);
                                        return (
                                            <button
                                                key={player.id}
                                                onClick={() => toggleStarterStatus(player)}
                                                className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${isStarter
                                                    ? 'bg-primary/10 border-primary shadow-[0_0_15px_-5px_var(--primary)]'
                                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                                                    }`}
                                            >
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${isStarter ? 'bg-primary text-black border-primary' : 'bg-white/10 text-white/40 border-transparent'
                                                    }`}>
                                                    {isStarter ? (is5Aside ? '5' : 'XI') : 'SUB'}
                                                </div>
                                                <div>
                                                    <div className={`font-bold ${isStarter ? 'text-white' : 'text-white/50'}`}>{player.name}</div>
                                                    <div className="text-xs text-white/30">#{player.number} • {player.position}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="p-6 border-t border-white/10 bg-black/40 flex justify-between items-center">
                                <span className={`text-xs font-black uppercase tracking-widest ${draftLineup.starters.length === STARTER_COUNT ? 'text-green-500' : 'text-orange-500'}`}>
                                    Selected: {draftLineup.starters.length}/{STARTER_COUNT}
                                </span>
                                <button
                                    onClick={saveLineupDraft}
                                    className="px-8 py-3 bg-primary text-black font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-transform"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white pb-4">
            {/* ===== COMPACT MOBILE HEADER ===== */}
            <div className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-lg border-b border-white/10">
                <div className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <button onClick={onExit} className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 shrink-0">
                            <X size={16} />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-sm font-bold uppercase truncate">{match.competition}</h1>
                            <div className="text-[9px] text-white/40 uppercase tracking-wider">
                                {is5Aside ? '5-aside' : '11v11'} • {halfDuration} min halves
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="px-2 py-1 bg-white/5 rounded-lg border border-white/10 shrink-0 text-center min-w-[36px]">
                            <span className="text-[10px] font-black tabular-nums text-white/70">{recordedEvents.length}</span>
                            <span className="text-[8px] font-black uppercase tracking-tighter text-white/30 block leading-none">Evts</span>
                        </div>
                        <button
                            onClick={handleUndo}
                            disabled={!canLogEvents || recordedEvents.length === 0 || isUndoing}
                            className={`p-1.5 rounded-lg transition-colors ${canLogEvents && recordedEvents.length > 0 && !isUndoing ? 'bg-white/5 hover:bg-white/10' : 'opacity-20 cursor-not-allowed'}`}
                        >
                            {isUndoing ? <span className="text-[10px]">...</span> : <Undo2 size={16} />}
                        </button>
                        {/* BUG-112: this badge used to be driven entirely by isSocketConnected,
                            showing "Offline" (implying data loss) whenever just the WS dropped —
                            even though events still save fine via REST (confirmed, BUG-108).
                            isConnected (useMultiLogger, real REST reachability) now drives the
                            actual "offline" framing; a WS-only drop shows a separate, honest
                            "Sync Paused" state instead of implying anything isn't being saved. */}
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg border border-white/10 shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${!isConnected ? 'bg-red-500 animate-pulse' : isSocketConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-yellow-500 animate-pulse'}`} />
                            <span className="text-[8px] font-black uppercase tracking-tighter opacity-60">
                                {!isConnected ? 'Offline' : isSocketConnected ? 'Live Sync' : 'Sync Paused'}
                            </span>
                        </div>
                        {queuedOfflineCount > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-500/10 rounded-lg border border-orange-500/30 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                <span className="text-[8px] font-black uppercase tracking-tighter text-orange-400">
                                    {queuedOfflineCount} Queued
                                </span>
                            </div>
                        )}
                        {queuedAdminChangeCount > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-500/10 rounded-lg border border-orange-500/30 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                <span className="text-[8px] font-black uppercase tracking-tighter text-orange-400">
                                    {queuedAdminChangeCount} Pending
                                </span>
                            </div>
                        )}
                        {/* BACKSCOPED: 2026-07-27 (session 47C) — BACKLOG-142. Reinstate when: /api/staff-comms is auth-gated. */}
                        {/* <button onClick={() => setShowCommsModal(true)} className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 shrink-0 relative">
                            <MessageSquare size={16} />
                            {comms.some(c => !c.isRead) && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_5px_rgba(var(--primary-rgb),0.5)]" />
                            )}
                        </button> */}
                        <button onClick={() => setShowSettingsModal(true)} className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 shrink-0">
                            <Settings size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* BUG-194 part 2: mirrors BasketballLogger.tsx's own eventSaveError banner
                exactly -- visible, dismissible feedback for period-transition/undo
                failures and queue confirmations, instead of a blocking alert() or
                nothing at all. */}
            {eventSaveError && (
                <div className="px-3 pt-3">
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

            <div className="px-3 pt-3">
                {/* ===== SCOREBOARD ===== */}
                <div className="bg-gradient-to-b from-green-900/30 via-black/80 to-black border border-green-500/15 rounded-2xl p-4 mb-4 relative overflow-hidden">
                    {/* Live pulse indicator */}
                    {canLogEvents && isClockRunning && (
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-red-400">LIVE</span>
                        </div>
                    )}

                    {/* Scores + Teams */}
                    <div className="flex items-center justify-between">
                        {/* Home */}
                        <div className="text-center flex-1 min-w-0">
                            <TeamLogo logo={homeTeam?.logo} name={homeTeam?.name ?? ''} size="md" className="mx-auto mb-1.5" />
                            <div className="text-[10px] font-bold uppercase tracking-wider truncate px-1 flex items-center justify-center gap-1">
                                {homeTeam?.shortName || 'Home'}
                                {homeRedCards > 0 && (
                                    <span className="flex gap-0.5 shrink-0">
                                        {Array.from({ length: homeRedCards }).map((_, i) => (
                                            <div key={i} className="w-1.5 h-2.5 bg-red-600 rounded-[1px] shadow-[0_0_3px_rgba(220,38,38,0.5)]" />
                                        ))}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Score + Clock */}
                        <div className="text-center shrink-0 px-3">
                            <div className="flex items-center justify-center gap-3 mb-1">
                                <span className="text-4xl font-display italic tabular-nums">{homeScore}</span>
                                <span className="text-lg text-white/20 font-bold">:</span>
                                <span className="text-4xl font-display italic tabular-nums">{awayScore}</span>
                            </div>
                            <div className="text-2xl font-mono font-bold tracking-tight tabular-nums">
                                {displayTime}
                            </div>
                            {/* Period indicator */}
                            <div className="text-[9px] font-black uppercase tracking-widest mt-0.5">
                                {currentPeriod === 'NOT_STARTED' && <span className="text-white/30">Not Started</span>}
                                {currentPeriod === 'FIRST_HALF' && <span className="text-green-400">1st Half</span>}
                                {currentPeriod === 'HALF_TIME' && <span className="text-orange-400">Half Time</span>}
                                {currentPeriod === 'SECOND_HALF' && <span className="text-green-400">2nd Half</span>}
                                {currentPeriod === 'EXTRA_TIME_1' && <span className="text-amber-400">ET 1st Half</span>}
                                {currentPeriod === 'EXTRA_TIME_2' && <span className="text-amber-400">ET 2nd Half</span>}
                                {currentPeriod === 'PENALTY_SHOOTOUT' && <span className="text-purple-400">Penalties</span>}
                                {currentPeriod === 'FINISHED' && <span className="text-red-400">Full Time</span>}
                            </div>
                            {/* Announced stoppage */}
                            {matchState?.clock.announcedStoppage && canLogEvents && (
                                <div className="text-[9px] font-black text-amber-400 mt-0.5">
                                    +{matchState.clock.announcedStoppage} ADDED
                                </div>
                            )}
                        </div>

                        {/* Away */}
                        <div className="text-center flex-1 min-w-0">
                            <TeamLogo logo={awayTeam?.logo} name={awayTeam?.name ?? ''} size="md" className="mx-auto mb-1.5" />
                            <div className="text-[10px] font-bold uppercase tracking-wider truncate px-1 flex items-center justify-center gap-1">
                                {awayTeam?.shortName || 'Away'}
                                {awayRedCards > 0 && (
                                    <span className="flex gap-0.5 shrink-0">
                                        {Array.from({ length: awayRedCards }).map((_, i) => (
                                            <div key={i} className="w-1.5 h-2.5 bg-red-600 rounded-[1px] shadow-[0_0_3px_rgba(220,38,38,0.5)]" />
                                        ))}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Clock Controls */}
                    <div className="flex justify-center gap-2 mt-3 pt-3 border-t border-white/5">
                        <button
                            onClick={toggleClock}
                            disabled={!canLogEvents}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${canLogEvents ? 'bg-white/10 hover:bg-white/15 active:scale-95' : 'bg-white/5 opacity-30 cursor-not-allowed'}`}
                        >
                            {isClockRunning ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Start</>}
                        </button>
                        <button
                            onClick={() => setShowStoppageModal(true)}
                            disabled={!canLogEvents}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${canLogEvents ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 active:scale-95 border border-amber-500/20' : 'bg-white/5 opacity-30 cursor-not-allowed'}`}
                        >
                            +⏱
                        </button>
                    </div>
                </div>

                {/* ===== PERIOD ACTION BUTTONS ===== */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {currentPeriod === 'NOT_STARTED' && (
                        <button
                            disabled={isStartingMatch}
                            onClick={async () => {
                                if (!stateManager.current || isStartingMatch) return;
                                setIsStartingMatch(true);
                                try {
                                    const res = await fetch(`/api/matches/${match.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ status: 'LIVE' }),
                                    });
                                    if (!res.ok) throw new Error(`Server returned ${res.status}`);
                                    // PATCH confirmed — now transition local state and start the clock
                                    stateManager.current.transitionStatus('FIRST_HALF');
                                    // Persist period to DB — non-blocking
                                    persistMatchPatch({ currentPeriod: 'FIRST_HALF' }, 'First Half start');
                                    try { await fetch('/api/notifications/match-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId: match.id, homeTeamId: match.homeTeamId, awayTeamId: match.awayTeamId, eventType: 'MATCH_START', teamName: `${homeTeam?.name || 'Home'} vs ${awayTeam?.name || 'Away'}` }) }); } catch (e) { console.error('Notification failed (non-blocking):', e); }
                                } catch (e) {
                                    console.error('Failed to start match:', e);
                                    alert('Couldn\'t start match — check connection and try again.');
                                    setIsStartingMatch(false);
                                }
                            }}
                            className={`flex-1 py-3 font-black uppercase tracking-widest rounded-xl text-sm transition-all shadow-lg ${isStartingMatch ? 'bg-green-500/50 text-black/50 cursor-not-allowed' : 'bg-green-500 text-black hover:scale-[1.02] shadow-green-500/20 animate-pulse'}`}
                        >
                            {isStartingMatch ? 'Starting...' : '▶ Start Match'}
                        </button>
                    )}

                    {currentPeriod === 'FIRST_HALF' && (
                        <button onClick={() => { setPendingPeriodTransition({ current: 'FIRST_HALF', next: 'HALF_TIME' }); setShowPeriodEndModal(true); }}
                            className="flex-1 py-2.5 bg-orange-500 text-black font-bold uppercase tracking-widest rounded-xl text-xs active:scale-95 transition-transform">
                            ⏸ End 1st Half
                        </button>
                    )}

                    {currentPeriod === 'SECOND_HALF' && (
                        <button onClick={() => { setPendingPeriodTransition({ current: 'SECOND_HALF', next: 'FINISHED' }); setShowPeriodEndModal(true); }}
                            className="flex-1 py-2.5 bg-orange-500 text-black font-bold uppercase tracking-widest rounded-xl text-xs active:scale-95 transition-transform">
                            ⏸ End 2nd Half
                        </button>
                    )}

                    {currentPeriod === 'EXTRA_TIME_1' && (
                        <button onClick={() => { setPendingPeriodTransition({ current: 'EXTRA_TIME_1', next: 'EXTRA_TIME_2' }); setShowPeriodEndModal(true); }}
                            className="flex-1 py-2.5 bg-orange-500 text-black font-bold uppercase tracking-widest rounded-xl text-xs active:scale-95 transition-transform">
                            ⏸ End ET 1st Half
                        </button>
                    )}

                    {currentPeriod === 'EXTRA_TIME_2' && (
                        <button onClick={() => { setPendingPeriodTransition({ current: 'EXTRA_TIME_2', next: 'FINISHED' }); setShowPeriodEndModal(true); }}
                            className="flex-1 py-2.5 bg-orange-500 text-black font-bold uppercase tracking-widest rounded-xl text-xs active:scale-95 transition-transform">
                            ⏸ End ET 2nd Half
                        </button>
                    )}

                    {currentPeriod === 'HALF_TIME' && (
                        <button onClick={() => { stateManager.current?.transitionStatus('SECOND_HALF'); persistMatchPatch({ currentPeriod: 'SECOND_HALF' }, 'Second Half start'); }}
                            className="flex-1 py-3 bg-green-500 text-black font-black uppercase tracking-widest rounded-xl text-sm animate-pulse shadow-lg shadow-green-500/20 active:scale-95 transition-transform">
                            ▶ Start 2nd Half
                        </button>
                    )}

                    {currentPeriod === 'FINISHED' && homeScore === awayScore && (
                        <>
                            <button onClick={() => { if (confirm('Start Extra Time?')) { stateManager.current?.transitionStatus('EXTRA_TIME_1'); persistMatchPatch({ currentPeriod: 'EXTRA_TIME_1' }, 'Extra Time start'); } }}
                                className="flex-1 py-2.5 bg-amber-500 text-black font-bold uppercase tracking-widest rounded-xl text-xs active:scale-95 transition-transform">
                                ⏱ Extra Time
                            </button>
                            <button onClick={() => { if (confirm('Start Penalties?')) { stateManager.current?.transitionStatus('PENALTY_SHOOTOUT'); persistMatchPatch({ currentPeriod: 'PENALTY_SHOOTOUT' }, 'Penalties start'); } }}
                                className="flex-1 py-2.5 bg-purple-500 text-black font-bold uppercase tracking-widest rounded-xl text-xs active:scale-95 transition-transform">
                                🎯 Penalties
                            </button>
                        </>
                    )}

                    {currentPeriod !== 'NOT_STARTED' && (
                        <button onClick={handleFinalize} disabled={isSaving}
                            className="py-2.5 px-4 bg-white/5 border border-white/10 text-white/60 font-bold uppercase tracking-widest rounded-xl text-xs active:scale-95 transition-transform">
                            {isSaving ? '...' : '🏁 End'}
                        </button>
                    )}
                </div>

                {/* Team Selector */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                        onClick={() => setSelectedTeam('home')}
                        className={`py-2.5 px-3 rounded-xl border text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${selectedTeam === 'home' ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10'}`}
                    >
                        {homeTeam?.shortName || 'Home'}
                        {homeRedCards > 0 && <span className="flex gap-0.5">{Array.from({ length: homeRedCards }).map((_, i) => <div key={i} className={`w-1 h-2 rounded-sm ${selectedTeam === 'home' ? 'bg-black/40' : 'bg-red-600'}`} />)}</span>}
                    </button>
                    <button
                        onClick={() => setSelectedTeam('away')}
                        className={`py-2.5 px-3 rounded-xl border text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${selectedTeam === 'away' ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10'}`}
                    >
                        {awayTeam?.shortName || 'Away'}
                        {awayRedCards > 0 && <span className="flex gap-0.5">{Array.from({ length: awayRedCards }).map((_, i) => <div key={i} className={`w-1 h-2 rounded-sm ${selectedTeam === 'away' ? 'bg-black/40' : 'bg-red-600'}`} />)}</span>}
                    </button>
                </div>

                {/* Event Buttons - Conditional based on period */}
                {!canLogEvents ? (
                    // Show disabled state message when events can't be logged
                    <div className="mb-8">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                            <div className="text-3xl mb-3">
                                {currentPeriod === 'NOT_STARTED' ? '⏳' : currentPeriod === 'HALF_TIME' ? '☕' : currentPeriod === 'FINISHED' ? '🏁' : '⏸'}
                            </div>
                            <p className="text-white/60 text-sm font-bold uppercase tracking-widest">
                                {currentPeriod === 'NOT_STARTED' && 'Press Start Match to begin logging'}
                                {currentPeriod === 'HALF_TIME' && 'Half Time — Start 2nd Half to resume logging'}
                                {currentPeriod === 'FINISHED' && 'Match has ended'}
                                {currentPeriod === 'SUSPENDED' && 'Match suspended'}
                                {currentPeriod === 'ABANDONED' && 'Match abandoned'}
                            </p>
                        </div>
                    </div>
                ) : currentPeriod === 'PENALTY_SHOOTOUT' ? (
                    // BACKLOG-105: dedicated shootout flow — PEN_SCORED/PEN_MISSED/PEN_SAVED,
                    // never the regular Penalty/Penalty Missed/Penalty Saved types (those write
                    // career stats and the main score; shootout kicks must not).
                    <div className="space-y-4 mb-8">
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4 text-center">
                            <h3 className="text-sm font-black uppercase tracking-widest text-purple-400 mb-2">Penalty Shootout</h3>
                            {shootoutScore && (
                                <p className="text-2xl font-black text-white mb-1">{shootoutScore.home} – {shootoutScore.away}</p>
                            )}
                            <p className="text-xs text-white/60">Tap to log each kick</p>
                        </div>
                        <button
                            onClick={() => setShowShootoutModal(true)}
                            className="w-full py-6 bg-purple-500/10 border-2 border-purple-500/30 text-purple-300 font-black uppercase tracking-widest rounded-2xl hover:bg-purple-500/20 transition-colors"
                        >
                            Log Kick
                        </button>
                    </div>
                ) : (
                    // Regular Match Buttons — mobile-first 4-col grid
                    <div className="space-y-4 mb-4">
                        {/* Key Events — Scoring */}
                        <div className="grid grid-cols-3 gap-2">
                            <EventButton type="Goal" icon="⚽" variant="success" onClick={() => handleEventClick('Goal', true)} />
                            <button
                                onClick={() => setShowPenaltyModal(true)}
                                className={`aspect-square border rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-90 bg-green-500/10 border-green-500/20 text-green-400 active:bg-green-500/20`}
                            >
                                <span className="text-xl">🎯</span>
                                <span className="text-[8px] font-bold uppercase tracking-tight leading-tight text-center px-0.5">Penalty</span>
                            </button>
                            <EventButton type="Own Goal" icon="🔴" label="OG" variant="danger" onClick={() => handleEventClick('Own Goal')} />
                        </div>

                        {/* Discipline */}
                        <div className="grid grid-cols-5 gap-1.5">
                            <EventButton type="Yellow Card" icon="🟨" label="Yellow" variant="warning" onClick={() => handleEventClick('Yellow Card')} />
                            <EventButton type="Red Card" icon="🟥" label="Red" variant="danger" onClick={() => handleEventClick('Red Card')} />
                            <EventButton type="Foul" icon="⚠️" variant="warning" onClick={() => handleEventClick('Foul')} />
                            <EventButton type="Push" icon="🤚" variant="warning" onClick={() => handleEventClick('Push')} />
                            <EventButton type="Handball" icon="✋" variant="warning" onClick={() => handleEventClick('Handball')} />
                        </div>

                        {/* Defensive */}
                        <div className="grid grid-cols-5 gap-1.5">
                            <EventButton type="Save" icon="🧤" variant="info" onClick={() => handleEventClick('Save')} />
                            <EventButton type="Catch" icon="🤲" variant="info" onClick={() => handleEventClick('Catch')} />
                            <EventButton type="Block" icon="🛡️" variant="info" onClick={() => handleEventClick('Block')} />
                            <EventButton type="Interception" icon="🚫" label="Int" variant="info" onClick={() => handleEventClick('Interception')} />
                            <EventButton type="Clearance" icon="🦵" label="Clr" variant="info" onClick={() => handleEventClick('Clearance')} />
                        </div>

                        {/* Attacking/General */}
                        <div className="grid grid-cols-5 gap-1.5">
                            <EventButton type="Tackle" icon="⚡" variant="info" onClick={() => handleEventClick('Tackle')} />
                            <EventButton type="Shot on Target" icon="🎯" label="On" variant="primary" onClick={() => handleEventClick('Shot on Target')} />
                            <EventButton type="Shot off Target" icon="❌" label="Off" variant="secondary" onClick={() => handleEventClick('Shot off Target')} />
                            <EventButton type="Corner" icon="🚩" variant="primary" onClick={() => handleEventClick('Corner')} />
                            <EventButton type="Free Kick" icon="🔵" label="FK" variant="primary" onClick={() => handleEventClick('Free Kick')} />
                        </div>

                        {/* Set Pieces + Other */}
                        <div className="grid grid-cols-4 gap-1.5">
                            <EventButton type="Throw In" icon="👐" label="Throw" variant="secondary" onClick={() => handleEventClick('Throw In')} />
                            <EventButton type="Goal Kick" icon="🥅" label="GK" variant="secondary" onClick={() => handleEventClick('Goal Kick')} />
                            <EventButton type="Offside" icon="🎌" variant="secondary" onClick={() => handleEventClick('Offside')} />
                            <EventButton type="Substitution" icon="🔄" label="Sub" variant="accent" onClick={() => handleEventClick('Substitution')} />
                        </div>
                    </div>
                )}

                {/* ===== RECENT EVENTS LOG ===== */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-3 mt-4">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-[9px] font-black uppercase tracking-widest text-white/30 italic">Live Feed</h3>
                        <div className="flex items-center gap-1">
                            <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[8px] font-bold text-white/40 uppercase tracking-tighter">Live</span>
                        </div>
                    </div>
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                        {recordedEvents.slice().reverse().slice(0, 25).map((event) => (
                            <div key={event.id} className="flex items-center gap-3 py-2 px-3 bg-black/40 rounded-lg border border-white/5 group">
                                <div className="text-[10px] font-mono font-bold text-primary/70 w-6 text-right shrink-0">{event.displayMinute}'</div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-[11px] uppercase tracking-wide group-hover:text-primary transition-colors truncate">
                                        {event.type}
                                    </div>
                                    <div className="text-[9px] text-white/40 truncate mt-0.5">
                                        {event.detail}
                                    </div>
                                </div>
                                <div className="shrink-0 text-xs">
                                    {event.type.includes('Goal') && '⚽'}
                                    {event.type.includes('Card') && (event.type.includes('Yellow') ? '🟨' : '🟥')}
                                    {event.type.includes('Sub') && '🔄'}
                                </div>
                            </div>
                        ))}
                        {recordedEvents.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-6 text-white/10">
                                <span className="text-[10px] font-black uppercase tracking-widest">Waiting for events...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showPlayerModal && (
                <PlayerSelectionModal
                    players={getOnPitchPlayers(selectedTeam)}
                    onSelect={handlePlayerSelect}
                    onClose={() => setShowPlayerModal(false)}
                    title={`Select Player for ${pendingEvent?.type}`}
                    filterGoalkeepersOnly={pendingEvent ? isGoalkeeperOnlyEvent(pendingEvent.type) : false}
                    redCardedPlayerIds={redCardedPlayerIds}
                    teamLineup={lineups[selectedTeam]}
                    filterStartersOnly={pendingEvent?.type !== 'Substitution'}
                    subbedOnPlayerIds={getSubSets(selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId).subbedOnIds}
                />
            )}

            {
                showAssistModal && (
                    <PlayerSelectionModal
                        players={getOnPitchPlayers(selectedTeam).filter(p => p.id !== selectedEventPlayer)}
                        onSelect={handleAssistSelect}
                        onClose={() => { setShowAssistModal(false); handleAssistSelect(null); }}
                        title="Select Assist (Optional)"
                        redCardedPlayerIds={redCardedPlayerIds}
                        teamLineup={lineups[selectedTeam]}
                        filterStartersOnly={true}
                        subbedOnPlayerIds={getSubSets(selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId).subbedOnIds}
                    />
                )
            }

            {
                showSubInModal && (
                    <PlayerSelectionModal
                        players={getAvailableBench(selectedTeam)}
                        onSelect={handleSubIn}
                        onClose={() => setShowSubInModal(false)}
                        title="Select Player Coming IN"
                        redCardedPlayerIds={redCardedPlayerIds}
                        teamLineup={lineups[selectedTeam]}
                        filterSubsOnly={true}
                        emptyMessage={!lineups[selectedTeam] ? 'No lineup published for this team' : 'No available substitutes'}
                    />
                )
            }

            {
                showPenaltyModal && (
                    <PenaltySequenceModal
                        attackingTeam={selectedTeam}
                        homePlayers={getOnPitchPlayers('home').filter((p: Player) => !redCardedPlayerIds.has(p.id))}
                        awayPlayers={getOnPitchPlayers('away').filter((p: Player) => !redCardedPlayerIds.has(p.id))}
                        homeLineup={lineups.home}
                        awayLineup={lineups.away}
                        homeSubbedOnIds={getSubSets(match.homeTeamId).subbedOnIds}
                        awaySubbedOnIds={getSubSets(match.awayTeamId).subbedOnIds}
                        onClose={() => setShowPenaltyModal(false)}
                        onSubmit={(takerId, foulerId, outcome, keeperId) => {
                            // 1. Log the Foul/Concession for the defender
                            if (foulerId) {
                                const defendingTeamType = selectedTeam === 'home' ? 'away' : 'home';
                                const originalTeam = selectedTeam;
                                setSelectedTeam(defendingTeamType);
                                confirmEvent('Foul', foulerId, null);
                                setSelectedTeam(originalTeam);
                            }

                            // 2. Log the Penalty outcome for the taker
                            // Penalty Saved: relatedPlayerId = keeperId (null if keeper was skipped)
                            setTimeout(() => {
                                const validTakerId = takerId || 'TEAM';
                                if (outcome === 'Scored') {
                                    confirmEvent('Penalty', validTakerId, null);
                                } else if (outcome === 'Saved') {
                                    confirmEvent('Penalty Saved', validTakerId, keeperId);
                                } else {
                                    confirmEvent('Penalty Missed', validTakerId, null);
                                }
                            }, 300);

                            setShowPenaltyModal(false);
                        }}
                    />
                )
            }

            {
                showShootoutModal && (
                    <ShootoutModal
                        homeTeamName={homeTeam?.name || 'Home'}
                        awayTeamName={awayTeam?.name || 'Away'}
                        homePlayers={getOnPitchPlayers('home')}
                        awayPlayers={getOnPitchPlayers('away')}
                        onClose={() => setShowShootoutModal(false)}
                        onSubmit={async (team, takerId, outcome, keeperId) => {
                            setShowShootoutModal(false);
                            const teamId = team === 'home' ? match.homeTeamId : match.awayTeamId;
                            const type = outcome === 'Scored' ? 'PEN_SCORED' : outcome === 'Saved' ? 'PEN_SAVED' : 'PEN_MISSED';
                            try {
                                const res = await fetch(`/api/matches/${match.id}/events`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        type,
                                        minute: matchState?.clock.absoluteMinute ?? 0,
                                        teamId,
                                        playerId: takerId,
                                        relatedPlayerId: outcome === 'Saved' ? keeperId : null,
                                        period: currentPeriod,
                                        loggerName: currentLogger?.name,
                                    }),
                                });
                                if (res.ok) {
                                    const saved = await res.json();
                                    if (saved.shootoutHomeScore !== undefined && saved.shootoutAwayScore !== undefined) {
                                        setShootoutScore({ home: saved.shootoutHomeScore, away: saved.shootoutAwayScore });
                                    } else {
                                        // Response didn't carry the score (e.g. a miss/save, which
                                        // doesn't change it) — re-fetch match state to stay in sync.
                                        const matchRes = await fetch(`/api/matches/${match.id}`);
                                        if (matchRes.ok) {
                                            const matchData = await matchRes.json();
                                            const m = matchData.match || matchData;
                                            if (m.shootoutHomeScore !== undefined) {
                                                setShootoutScore({ home: m.shootoutHomeScore ?? 0, away: m.shootoutAwayScore ?? 0 });
                                            }
                                        }
                                    }
                                } else {
                                    alert(`Shootout kick failed to save (${res.status}) — check connection and retry.`);
                                }
                            } catch (e) {
                                console.error('[FootballLogger] Shootout kick POST failed:', e);
                                alert('Network error: could not save this kick. Please retry.');
                            }
                        }}
                    />
                )
            }

            {
                showStoppageModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="font-black uppercase tracking-widest text-lg italic text-amber-500">Stoppage Time</h3>
                                    <p className="text-[10px] text-white/40 uppercase">Announce minutes to be added</p>
                                </div>
                                <button onClick={() => setShowStoppageModal(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X size={20} /></button>
                            </div>
                            <div className="grid grid-cols-4 gap-2.5">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => {
                                            handleSetStoppage(num);
                                            setShowStoppageModal(false);
                                        }}
                                        className="aspect-square bg-gradient-to-br from-white/10 to-transparent border border-white/10 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-500 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90"
                                    >
                                        <span className="text-[10px] opacity-40 leading-none mb-1">+</span>
                                        <span className="text-xl font-black italic tabular-nums leading-none">{num}</span>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => handleSetStoppage(0)}
                                className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/30 border border-white/5"
                            >
                                Clear Stoppage
                            </button>
                        </div>
                    </div>
                )
            }

            {
                showPeriodEndModal && pendingPeriodTransition && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <div className="bg-zinc-900 border border-primary/50 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
                            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-primary/10 to-transparent">
                                <h3 className="font-bold text-xl text-primary">
                                    {pendingPeriodTransition.current === 'FIRST_HALF' && 'End 1st Half?'}
                                    {pendingPeriodTransition.current === 'SECOND_HALF' && 'End 2nd Half?'}
                                    {pendingPeriodTransition.current === 'EXTRA_TIME_1' && 'End ET 1st Half?'}
                                    {pendingPeriodTransition.current === 'EXTRA_TIME_2' && 'End ET 2nd Half?'}
                                </h3>
                                <p className="text-sm text-white/60 mt-1">
                                    Current time: <span className="font-mono font-bold text-white">{displayTime}</span>
                                </p>
                            </div>
                            <div className="p-6">
                                <p className="text-white/70 text-sm mb-6">
                                    {pendingPeriodTransition.next === 'HALF_TIME' && 'The referee has blown for Half Time.'}
                                    {pendingPeriodTransition.next === 'FINISHED' && 'The referee has blown the final whistle.'}
                                    {pendingPeriodTransition.next === 'EXTRA_TIME_2' && 'The referee has blown for the ET break.'}
                                </p>
                                <div className="flex flex-col gap-3">
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setShowPeriodEndModal(false);
                                                setPendingPeriodTransition(null);
                                            }}
                                            className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold uppercase tracking-widest text-sm transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handlePeriodEndConfirm}
                                            className="flex-1 py-3 bg-primary text-black rounded-xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-transform"
                                        >
                                            Confirm End
                                        </button>
                                    </div>

                                    {/* Additional option: Set Stoppage Time */}
                                    <button
                                        onClick={() => {
                                            setShowPeriodEndModal(false);
                                            setShowStoppageModal(true);
                                        }}
                                        className="w-full py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl font-black uppercase tracking-widest text-sm text-amber-500 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Clock size={16} /> Set Stoppage Time
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                            <h3 className="font-display italic text-xl uppercase">Match Settings</h3>
                            <button onClick={() => setShowSettingsModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-4 space-y-3">
                            {/* Match Info */}
                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Match Info</h4>
                                <div className="text-xs space-y-1.5">
                                    <p><span className="text-white/40">Competition:</span> <span className="font-bold">{match.competition}</span></p>
                                    <p><span className="text-white/40">Sport:</span> <span className="font-bold">{match.sport}</span></p>
                                    <p><span className="text-white/40">Period:</span> <span className="font-bold">{currentPeriod.replace('_', ' ')}</span></p>
                                    <p><span className="text-white/40">Logger:</span> <span className="font-bold">{currentLogger?.name || 'Unknown'}</span></p>
                                </div>
                            </div>

                            {/* Timing & Variant */}
                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Timing & Variant</h4>
                                <div className="text-xs space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/40">Format:</span>
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${is5Aside ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                                            {is5Aside ? '5-A-SIDE' : '11 v 11'}
                                        </span>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-white/40 mb-1">
                                            <span>Half Duration:</span>
                                            <span className="font-bold text-white">{halfDuration} min</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {[15, 20, 25, 30, 35, 40, 45].map(time => {
                                                const isLocked = currentPeriod !== 'NOT_STARTED';
                                                const isActive = (matchState?.halfDuration || halfDuration) === time;

                                                return (
                                                    <button
                                                        key={time}
                                                        disabled={isLocked}
                                                        onClick={() => {
                                                            setHalfDuration(time);
                                                            stateManager.current?.updateConfig({ halfDuration: time });
                                                        }}
                                                        className={`flex-1 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${isActive
                                                            ? 'bg-primary text-black border-primary'
                                                            : isLocked
                                                                ? 'bg-white/5 border-white/5 opacity-30 cursor-not-allowed'
                                                                : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                                    >
                                                        {time}m
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {currentPeriod !== 'NOT_STARTED' && (
                                            <p className="text-[9px] text-white/20 mt-1 uppercase tracking-tighter italic">
                                                🔒 Duration locked — match already in progress
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                        <span className="text-white/40">Starters:</span>
                                        <span className="font-bold">{STARTER_COUNT} per side</span>
                                    </div>
                                    {competitionPlayersPerSide && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-white/40">Config Source:</span>
                                            <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider">✓ Verified</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Connection Status */}
                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Connection</h4>
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    <span className="text-xs font-medium">{isConnected ? 'Connected' : 'Disconnected'}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    <span className="text-xs font-medium">WebSocket: {isSocketConnected ? 'Connected' : 'Disconnected'}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-2">
                                <button
                                    disabled={currentPeriod !== 'NOT_STARTED'}
                                    onClick={() => { setViewState('confirm_lineup'); setShowSettingsModal(false); }}
                                    className={`w-full px-4 py-3 border rounded-xl text-sm font-bold text-left transition-colors ${currentPeriod !== 'NOT_STARTED'
                                        ? 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                                        : 'bg-white/5 hover:bg-white/10 border-white/10'
                                        }`}
                                >
                                    <span className="flex items-center justify-between">
                                        <span>📋 View / Edit Lineups</span>
                                        {currentPeriod !== 'NOT_STARTED' && (
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/20 flex items-center gap-1">
                                                <LockIcon size={10} /> Locked
                                            </span>
                                        )}
                                    </span>
                                </button>
                                <button
                                    onClick={() => { fetchLineups(); setShowSettingsModal(false); }}
                                    className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-left transition-colors"
                                >
                                    🔄 Refresh Lineup Data
                                </button>
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="w-full px-4 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-sm font-bold text-primary text-center transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {
                showFoulOutcomeModal && pendingFoulPlayerId && (
                    <FoulOutcomeModal
                        onSelect={(outcome) => {
                            if (outcome === 'None') {
                                confirmEvent('Foul', pendingFoulPlayerId, null);
                                // Then maybe ask reason for foul?
                                setPendingReasonEvent({ type: 'Foul', playerId: pendingFoulPlayerId });
                                setShowReasonModal(true);
                            } else {
                                // Record the Foul first
                                confirmEvent('Foul', pendingFoulPlayerId, null);
                                // Then trigger the card flow with reason
                                setTimeout(() => {
                                    setPendingReasonEvent({
                                        type: outcome === 'Yellow' ? 'Yellow Card' : 'Red Card',
                                        playerId: pendingFoulPlayerId
                                    });
                                    setShowReasonModal(true);
                                }, 300);
                            }
                            setShowFoulOutcomeModal(false);
                            setPendingFoulPlayerId(null);
                        }}
                        onClose={() => {
                            setShowFoulOutcomeModal(false);
                            setPendingFoulPlayerId(null);
                        }}
                    />
                )
            }

            {
                showReasonModal && pendingReasonEvent && (
                    <ReasonSelectionModal
                        type={pendingReasonEvent.type}
                        onSelect={(reason) => {
                            confirmEvent(pendingReasonEvent.type, pendingReasonEvent.playerId, null);
                            // Patch the last event's detail to include reason
                            if (stateManager.current) {
                                const events = stateManager.current.getState().events;
                                const last = events[events.length - 1];
                                if (last && last.type === pendingReasonEvent.type) {
                                    last.detail = `${last.detail} (${reason})`;
                                }
                            }
                            setShowReasonModal(false);
                            setPendingReasonEvent(null);
                        }}
                        onClose={() => {
                            confirmEvent(pendingReasonEvent.type, pendingReasonEvent.playerId, null);
                            setShowReasonModal(false);
                            setPendingReasonEvent(null);
                        }}
                    />
                )
            }

            <MultiLoggerStatus
                activeLoggers={activeLoggers}
                conflicts={conflicts}
                isConnected={isConnected}
                syncStatus={syncStatus}
                currentLoggerName={currentLogger?.name || 'Unknown Logger'}
                onResolveConflict={(id, resolution) => resolveConflict(id, resolution)}
            />

            {/* Staff Communication Modal */}
            {/* BACKSCOPED: 2026-07-27 (session 47C) — BACKLOG-142. Reinstate when: /api/staff-comms
                is auth-gated (done, see route.ts) AND admin/manager/page.tsx's half-built
                match-selection flow for this panel is rebuilt properly. */}
            {/* <AnimatePresence>
                {showCommsModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] overflow-hidden flex flex-col h-[80vh] shadow-2xl"
                        >
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                                <div>
                                    <h3 className="font-black uppercase tracking-widest text-primary italic">Staff Comms</h3>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Secure Channel</span>
                                    </div>
                                </div>
                                <button onClick={() => setShowCommsModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                {comms.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-20 py-12">
                                        <MessageSquare size={48} className="mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">No reports yet</p>
                                    </div>
                                ) : (
                                    comms.map((comm: any) => (
                                        <div key={comm.id} className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black uppercase text-primary/60">{comm.user?.name} · {comm.user?.role}</span>
                                                <span className="text-[8px] text-white/20 tabular-nums">{new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className={`p-4 rounded-2xl text-xs font-medium leading-relaxed ${comm.user?.role === 'admin' || comm.user?.role === 'logger_manager' ? 'bg-primary/10 border border-primary/20 text-white' : 'bg-white/5 border border-white/10 text-white/80'}`}>
                                                {comm.content}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <form onSubmit={handleSendNote} className="p-6 bg-black/40 border-t border-white/10 space-y-3">
                                <div className="relative">
                                    <textarea
                                        value={noteContent}
                                        onChange={(e) => setNoteContent(e.target.value)}
                                        placeholder="Report incident or update manager..."
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold outline-none focus:border-primary/50 transition-all resize-none h-24"
                                    />
                                    <div className="absolute top-4 right-4 text-white/10">
                                        <AlertTriangle size={14} />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={!noteContent}
                                    className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:grayscale"
                                >
                                    Transmit Report
                                    <Send size={14} />
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence> */}
        </div>
    );
}

function PenaltySequenceModal({
    attackingTeam,
    homePlayers,
    awayPlayers,
    homeLineup,
    awayLineup,
    homeSubbedOnIds,
    awaySubbedOnIds,
    onClose,
    onSubmit
}: {
    attackingTeam: 'home' | 'away',
    homePlayers: Player[],
    awayPlayers: Player[],
    homeLineup: any,
    awayLineup: any,
    homeSubbedOnIds: Set<string>,
    awaySubbedOnIds: Set<string>,
    onClose: () => void,
    onSubmit: (takerId: string | null, foulerId: string | null, outcome: 'Scored' | 'Saved' | 'Missed', keeperId: string | null) => void
}) {
    const [step, setStep] = useState(1);
    const [takerId, setTakerId] = useState<string | null>(null);
    const [foulerId, setFoulerId] = useState<string | null>(null);
    const [outcome, setOutcome] = useState<'Scored' | 'Saved' | 'Missed' | null>(null);
    const [keeperId, setKeeperId] = useState<string | null>(null);

    const attackers = attackingTeam === 'home' ? homePlayers : awayPlayers;
    const defenders = attackingTeam === 'home' ? awayPlayers : homePlayers;
    const attackerLineup = attackingTeam === 'home' ? homeLineup : awayLineup;
    const defenderLineup = attackingTeam === 'home' ? awayLineup : homeLineup;
    const attackerSubbedOnIds = attackingTeam === 'home' ? homeSubbedOnIds : awaySubbedOnIds;
    const defenderSubbedOnIds = attackingTeam === 'home' ? awaySubbedOnIds : homeSubbedOnIds;

    const attackerStarterIds = new Set((attackerLineup?.starters || attackerLineup?.players || []).map((p: any) => p.playerId || p.id));
    const defenderStarterIds = new Set((defenderLineup?.starters || defenderLineup?.players || []).map((p: any) => p.playerId || p.id));
    const attackerOnPitchIds = new Set([...attackerStarterIds, ...attackerSubbedOnIds]);
    const defenderOnPitchIds = new Set([...defenderStarterIds, ...defenderSubbedOnIds]);

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                    <div>
                        <h3 className="font-black uppercase tracking-widest text-primary italic">Penalty Flow</h3>
                        <p className="text-[10px] text-white/40 uppercase">Step {step} of 3</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {step === 1 && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-center mb-4">Who committed the foul? (Optional)</h4>
                            <div className="grid grid-cols-1 gap-2">
                                <button
                                    onClick={() => { setFoulerId(null); setStep(2); }}
                                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white/40 italic"
                                >
                                    Unknown / No specific player
                                </button>
                                {defenders.map((p: Player) => (
                                    <button
                                        key={p.id}
                                        onClick={() => { setFoulerId(p.id); setStep(2); }}
                                        className={`p-3 text-left hover:bg-white/5 bg-black/20 border rounded-xl flex items-center gap-3 ${defenderOnPitchIds.has(p.id) ? 'border-primary/20' : 'border-white/5 opacity-60'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${defenderOnPitchIds.has(p.id) ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/40'}`}>
                                            {p.number}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm">{p.name}</div>
                                            <div className="text-[10px] text-white/40">{p.position} {!defenderOnPitchIds.has(p.id) && '(Bench)'}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-center mb-4">Who is taking the penalty?</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {attackers.filter(p => attackerOnPitchIds.has(p.id)).map((p: Player) => (
                                    <button
                                        key={p.id}
                                        onClick={() => { setTakerId(p.id); setStep(3); }}
                                        className="p-3 text-left hover:bg-white/5 bg-black/20 border border-primary/20 rounded-xl flex items-center gap-3 shadow-[0_0_15px_-8px_var(--primary)]"
                                    >
                                        <div className="w-8 h-8 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xs font-black border border-primary/20">{p.number}</div>
                                        <div>
                                            <div className="font-bold text-sm">{p.name}</div>
                                            <div className="text-[10px] text-white/40">{p.position}</div>
                                        </div>
                                    </button>
                                ))}
                                {attackers.filter(p => !attackerOnPitchIds.has(p.id)).length > 0 && (
                                    <div className="py-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-2">Players on Bench</p>
                                        <div className="grid grid-cols-1 gap-2 opacity-40">
                                            {attackers.filter(p => !attackerOnPitchIds.has(p.id)).map(p => (
                                                <div key={p.id} className="p-2 bg-black/20 border border-white/5 rounded-lg flex items-center gap-3 grayscale">
                                                    <div className="w-6 h-6 bg-white/5 rounded-full flex items-center justify-center text-[10px] font-bold">{p.number}</div>
                                                    <div className="text-xs font-bold">{p.name}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 flex flex-col items-center justify-center py-8">
                            <h4 className="text-sm font-bold text-center">What was the outcome?</h4>
                            <div className="grid grid-cols-3 gap-4 w-full">
                                <button
                                    onClick={() => setOutcome('Scored')}
                                    className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${outcome === 'Scored' ? 'bg-green-500 text-black border-green-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}
                                >
                                    <span className="text-3xl">⚽</span>
                                    <span className="font-black text-[10px] uppercase">Scored</span>
                                </button>
                                <button
                                    onClick={() => setOutcome('Saved')}
                                    className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${outcome === 'Saved' ? 'bg-amber-500 text-black border-amber-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}
                                >
                                    <span className="text-3xl">🧤</span>
                                    <span className="font-black text-[10px] uppercase">Saved</span>
                                </button>
                                <button
                                    onClick={() => setOutcome('Missed')}
                                    className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${outcome === 'Missed' ? 'bg-red-500 text-black border-red-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
                                >
                                    <span className="text-3xl">❌</span>
                                    <span className="font-black text-[10px] uppercase">Missed</span>
                                </button>
                            </div>

                            {outcome === 'Saved' && (
                                <div className="w-full mt-2 space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 text-center">Goalkeeper? (optional)</p>
                                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                                        <button
                                            onClick={() => setKeeperId(null)}
                                            className={`p-2.5 rounded-xl text-xs font-bold text-center transition-all ${keeperId === null ? 'bg-white/10 border border-white/20 text-white' : 'bg-white/5 border border-white/5 text-white/30'}`}
                                        >
                                            Skip / Unknown
                                        </button>
                                        {defenders.filter(p => {
                                            const pos = (p.position || '').toLowerCase();
                                            const lineupPos = ((defenderLineup?.starters || defenderLineup?.players || []).find((lp: any) => (lp.playerId || lp.id) === p.id)?.position || '').toLowerCase();
                                            return pos.includes('gk') || pos.includes('goalkeeper') || pos.includes('keeper') || pos === 'g' || lineupPos.includes('gk') || lineupPos.includes('goalkeeper');
                                        }).concat(defenders.filter(p => {
                                            const pos = (p.position || '').toLowerCase();
                                            const lineupPos = ((defenderLineup?.starters || defenderLineup?.players || []).find((lp: any) => (lp.playerId || lp.id) === p.id)?.position || '').toLowerCase();
                                            return !(pos.includes('gk') || pos.includes('goalkeeper') || pos.includes('keeper') || pos === 'g' || lineupPos.includes('gk') || lineupPos.includes('goalkeeper'));
                                        })).slice(0, 5).map((p: Player) => (
                                            <button
                                                key={p.id}
                                                onClick={() => setKeeperId(p.id)}
                                                className={`p-2.5 text-left rounded-xl flex items-center gap-2 text-xs transition-all ${keeperId === p.id ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' : 'bg-white/5 border border-white/5 text-white/60 hover:bg-white/10'}`}
                                            >
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${keeperId === p.id ? 'bg-amber-500/30 text-amber-300' : 'bg-white/10 text-white/40'}`}>{p.number}</div>
                                                <span className="font-bold">{p.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {outcome && (
                                <button
                                    onClick={() => onSubmit(takerId, foulerId, outcome, outcome === 'Saved' ? keeperId : null)}
                                    className="w-full mt-4 py-4 bg-primary text-black font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-lg shadow-primary/20"
                                >
                                    Confirm & Log
                                </button>
                            )
                            }
                        </div>
                    )}
                </div>

                {step > 1 && (
                    <button
                        onClick={() => setStep(step - 1)}
                        className="p-4 text-xs font-bold text-white/30 uppercase tracking-widest hover:text-white transition-colors"
                    >
                        ← Back
                    </button>
                )}
            </div>
        </div>
    );
}

// BACKLOG-105: simplified 3-step shootout logger. Deliberately NOT a reuse of
// PenaltySequenceModal — that flow's fouler-picker step is wrong UX under real
// shootout time pressure (10+ kicks, no fouls to attribute). Team -> taker -> outcome only.
function ShootoutModal({
    homeTeamName,
    awayTeamName,
    homePlayers,
    awayPlayers,
    onClose,
    onSubmit,
}: {
    homeTeamName: string,
    awayTeamName: string,
    homePlayers: Player[],
    awayPlayers: Player[],
    onClose: () => void,
    onSubmit: (team: 'home' | 'away', takerId: string | null, outcome: 'Scored' | 'Missed' | 'Saved', keeperId: string | null) => void,
}) {
    const [step, setStep] = useState(1);
    const [team, setTeam] = useState<'home' | 'away' | null>(null);
    const [takerId, setTakerId] = useState<string | null>(null);
    const [outcome, setOutcome] = useState<'Scored' | 'Missed' | 'Saved' | null>(null);
    const [keeperId, setKeeperId] = useState<string | null>(null);

    const takers = team === 'home' ? homePlayers : team === 'away' ? awayPlayers : [];
    const keeperCandidates = team === 'home' ? awayPlayers : homePlayers;

    const reset = () => { setStep(1); setTeam(null); setTakerId(null); setOutcome(null); setKeeperId(null); };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                    <div>
                        <h3 className="font-black uppercase tracking-widest text-purple-400 italic">Penalty Shootout</h3>
                        <p className="text-[10px] text-white/40 uppercase">Step {step} of 3</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {step === 1 && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-center mb-4">Which team is shooting?</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => { setTeam('home'); setStep(2); }} className="p-6 rounded-2xl border-2 border-primary/20 bg-primary/10 text-primary font-black uppercase tracking-widest hover:scale-105 transition-transform">{homeTeamName}</button>
                                <button onClick={() => { setTeam('away'); setStep(2); }} className="p-6 rounded-2xl border-2 border-white/10 bg-white/5 text-white font-black uppercase tracking-widest hover:scale-105 transition-transform">{awayTeamName}</button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-center mb-4">Who is taking the kick?</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {takers.map((p: Player) => (
                                    <button
                                        key={p.id}
                                        onClick={() => { setTakerId(p.id); setStep(3); }}
                                        className="p-3 text-left hover:bg-white/5 bg-black/20 border border-primary/20 rounded-xl flex items-center gap-3"
                                    >
                                        <div className="w-8 h-8 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xs font-black border border-primary/20">{p.number}</div>
                                        <div className="font-bold text-sm">{p.name}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 flex flex-col items-center justify-center py-8">
                            <h4 className="text-sm font-bold text-center">Outcome?</h4>
                            <div className="grid grid-cols-3 gap-4 w-full">
                                <button onClick={() => setOutcome('Scored')} className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${outcome === 'Scored' ? 'bg-green-500 text-black border-green-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                                    <span className="text-3xl">⚽</span>
                                    <span className="font-black text-[10px] uppercase">Scored</span>
                                </button>
                                <button onClick={() => setOutcome('Saved')} className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${outcome === 'Saved' ? 'bg-amber-500 text-black border-amber-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                                    <span className="text-3xl">🧤</span>
                                    <span className="font-black text-[10px] uppercase">Saved</span>
                                </button>
                                <button onClick={() => setOutcome('Missed')} className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${outcome === 'Missed' ? 'bg-red-500 text-black border-red-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                    <span className="text-3xl">❌</span>
                                    <span className="font-black text-[10px] uppercase">Missed</span>
                                </button>
                            </div>

                            {outcome === 'Saved' && (
                                <div className="w-full mt-2 space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 text-center">Goalkeeper? (optional)</p>
                                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                                        <button onClick={() => setKeeperId(null)} className={`p-2.5 rounded-xl text-xs font-bold text-center transition-all ${keeperId === null ? 'bg-white/10 border border-white/20 text-white' : 'bg-white/5 border border-white/5 text-white/30'}`}>
                                            Skip / Unknown
                                        </button>
                                        {keeperCandidates.slice(0, 5).map((p: Player) => (
                                            <button key={p.id} onClick={() => setKeeperId(p.id)} className={`p-2.5 text-left rounded-xl flex items-center gap-2 text-xs transition-all ${keeperId === p.id ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' : 'bg-white/5 border border-white/5 text-white/60 hover:bg-white/10'}`}>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${keeperId === p.id ? 'bg-amber-500/30 text-amber-300' : 'bg-white/10 text-white/40'}`}>{p.number}</div>
                                                <span className="font-bold">{p.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {outcome && (
                                <button
                                    onClick={() => { onSubmit(team!, takerId, outcome, outcome === 'Saved' ? keeperId : null); reset(); }}
                                    className="w-full mt-4 py-4 bg-purple-500 text-black font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-lg shadow-purple-500/20"
                                >
                                    Confirm & Log Kick
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {step > 1 && (
                    <button onClick={() => setStep(step - 1)} className="p-4 text-xs font-bold text-white/30 uppercase tracking-widest hover:text-white transition-colors">
                        ← Back
                    </button>
                )}
            </div>
        </div>
    );
}

function EventButton({ type, icon, label, variant = 'secondary', onClick }: { type: string, icon: string, label?: string, variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'accent', onClick: () => void }) {
    const variants = {
        primary: 'bg-primary/10 border-primary/20 text-primary active:bg-primary/20',
        secondary: 'bg-white/5 border-white/10 text-white/70 active:bg-white/10',
        success: 'bg-green-500/10 border-green-500/20 text-green-400 active:bg-green-500/20',
        warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400 active:bg-amber-500/20',
        danger: 'bg-red-500/10 border-red-500/20 text-red-400 active:bg-red-500/20',
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-400 active:bg-blue-500/20',
        accent: 'bg-purple-500/10 border-purple-500/20 text-purple-400 active:bg-purple-500/20',
    };

    return (
        <button
            onClick={onClick}
            className={`aspect-square border rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-90 ${variants[variant]}`}
        >
            <span className="text-xl">{icon}</span>
            <span className="text-[8px] font-bold uppercase tracking-tight leading-tight text-center px-0.5">{label || type}</span>
        </button>
    );
}

function PlayerSelectionModal({
    players,
    onSelect,
    onClose,
    title,
    filterGoalkeepersOnly = false,
    redCardedPlayerIds,
    teamLineup,
    filterStartersOnly = false,
    filterSubsOnly = false,
    subbedOnPlayerIds,
    emptyMessage = 'No player found',
}: any) {
    // BUG-201: no guard here meant an absent lineup (starters/players both empty)
    // made starterIds an empty Set, and filterStartersOnly's `!starterIds.has(p.id)`
    // was then true for every player -- the whole roster got filtered out, showing
    // "No player found" even though the roster itself (homePlayers/awayPlayers,
    // built in getActiveRoster) was correct. getActiveRoster already treats a
    // missing lineup as "no restriction" (`if (!teamLineup) return roster`) --
    // this filter needs the same fallback, since it re-derives the same distinction
    // independently rather than reusing that already-correct roster.
    const hasLineup = !!(teamLineup?.starters?.length || teamLineup?.players?.length);
    const starterIds = new Set((teamLineup?.starters || teamLineup?.players || []).map((p: any) => p.playerId || p.id));

    // Filter players: remove red-carded players and optionally only show goalkeepers
    const filteredPlayers = players.filter((p: Player) => {
        // Always exclude red-carded players
        if (redCardedPlayerIds && redCardedPlayerIds.has(p.id)) return false;

        if (hasLineup) {
            if (filterStartersOnly && !starterIds.has(p.id) && !subbedOnPlayerIds?.has(p.id)) return false;
            if (filterSubsOnly && starterIds.has(p.id)) return false;
        }

        if (filterGoalkeepersOnly) {
            const pos = p.position?.toLowerCase() || '';
            const isGK = pos.includes('gk') || pos.includes('goalkeeper') || pos.includes('goal keeper') ||
                pos === 'g' || pos.includes('goalie') || pos.includes('keeper');

            // Also check if position assigned in lineup is GK
            const lineupPos = (teamLineup?.starters || []).find((lp: any) => (lp.playerId || lp.id) === p.id)?.position?.toLowerCase() || '';
            const isLineupGK = lineupPos.includes('gk') || lineupPos.includes('goalkeeper');

            return isGK || isLineupGK;
        }
        return true;
    });

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold">{title}</h3>
                        {filterStartersOnly && <p className="text-[10px] text-primary uppercase font-black tracking-widest">Active Players Only</p>}
                        {filterSubsOnly && <p className="text-[10px] text-amber-500 uppercase font-black tracking-widest">Bench Players Only</p>}
                    </div>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                {filterGoalkeepersOnly && (
                    <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 text-sm text-primary">
                        🧤 Goalkeeper-only event - Only GKs shown
                    </div>
                )}
                <div className="flex-1 overflow-y-auto p-2">
                    {filteredPlayers.length > 0 ? (
                        <div className="grid grid-cols-1 gap-1">
                            {filteredPlayers.map((p: Player) => {
                                // A player is bench-styled unless they're a starter OR they came on mid-match
                                const isBench = teamLineup
                                    ? !starterIds.has(p.id) && !(subbedOnPlayerIds?.has(p.id))
                                    : (p.position?.toLowerCase().includes('sub') || p.position?.toLowerCase().includes('reserve'));

                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => onSelect(p.id)}
                                        className="p-3 text-left hover:bg-white/5 rounded-lg flex items-center gap-3 group relative overflow-hidden"
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isBench ? 'bg-white/5 text-white/40' : 'bg-primary/20 text-primary border border-primary/20'}`}>
                                            {p.number}
                                        </div>
                                        <div className="flex-1">
                                            <div className={`font-medium transition-colors ${isBench ? 'text-white/40' : 'text-white'}`}>
                                                {p.name}
                                                {isBench && <span className="ml-2 text-[8px] px-1 bg-white/5 rounded italic uppercase tracking-tighter">Bench</span>}
                                            </div>
                                            <div className="text-xs text-white/30">{p.position}</div>
                                        </div>
                                        {isBench && (
                                            <div className="absolute inset-y-0 right-0 w-1 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-white/40">
                            <div className="font-medium">{emptyMessage}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ReasonSelectionModal({ type, onSelect, onClose }: { type: string, onSelect: (reason: string) => void, onClose: () => void }) {
    const cardReasons = [
        'Tactical Foul', 'Unsporting Behavior', 'Dissent (Language)',
        'Time Wasting', 'Aggressive Play', 'Simulating (Dive)',
        'Bench Conduct', 'Late Challenge', 'Professional Foul'
    ];

    const foulReasons = [
        'Trip', 'Push', 'Handball', 'Shirt Pull',
        'High Foot', 'Dangerous Play', 'Collision'
    ];

    const reasons = type.includes('Card') ? cardReasons : foulReasons;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40">
                    <div>
                        <h3 className="font-black uppercase tracking-widest text-primary italic">Select Reason</h3>
                        <p className="text-[10px] text-white/40 uppercase">{type}</p>
                    </div>
                </div>
                <div className="p-4 grid grid-cols-1 gap-1.5 max-h-[60vh] overflow-y-auto">
                    {reasons.map(r => (
                        <button
                            key={r}
                            onClick={() => onSelect(r)}
                            className="p-4 text-left hover:bg-white/5 bg-black/20 border border-white/5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                        >
                            {r}
                        </button>
                    ))}
                    <button
                        onClick={onClose}
                        className="p-4 text-center bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest mt-2"
                    >
                        Skip / Standard
                    </button>
                </div>
            </div>
        </div>
    );
}

function FoulOutcomeModal({ onSelect, onClose }: { onSelect: (outcome: 'None' | 'Yellow' | 'Red') => void, onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40">
                    <div>
                        <h3 className="font-black uppercase tracking-widest text-primary italic">Foul Outcome</h3>
                        <p className="text-[10px] text-white/40 uppercase">Was a card given?</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/40"><X size={20} /></button>
                </div>
                <div className="p-6 grid grid-cols-1 gap-3">
                    <button
                        onClick={() => onSelect('None')}
                        className="p-5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center justify-between group transition-all active:scale-95"
                    >
                        <span className="font-black uppercase tracking-widest text-sm italic">No Card</span>
                        <span className="text-2xl group-hover:scale-125 transition-transform">⚠️</span>
                    </button>
                    <button
                        onClick={() => onSelect('Yellow')}
                        className="p-5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center justify-between group transition-all active:scale-95"
                    >
                        <span className="font-black uppercase tracking-widest text-sm italic text-amber-500">Yellow Card</span>
                        <span className="text-2xl group-hover:rotate-12 transition-transform shadow-xl">🟨</span>
                    </button>
                    <button
                        onClick={() => onSelect('Red')}
                        className="p-5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-2xl flex items-center justify-between group transition-all active:scale-95"
                    >
                        <span className="font-black uppercase tracking-widest text-sm italic text-red-500">Direct Red</span>
                        <span className="text-2xl group-hover:rotate-12 transition-transform shadow-xl">🟥</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
