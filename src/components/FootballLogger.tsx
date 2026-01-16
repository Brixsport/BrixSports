'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Save, Undo2, Clock, Play, Pause, Settings } from 'lucide-react';
import { useMultiLogger } from '@/hooks/useMultiLogger';
import { useWebSocket } from '@/hooks/useWebSocket';
import { MultiLoggerStatus } from '@/components/MultiLoggerStatus';
import { getMatchStateManager, MatchStateManager, MatchState, FootballEventType } from '@/lib/match-state-manager';
import type { SyncEvent } from '@/lib/multiLogger';

import { Match, Logger, Player, Team } from '@/db/schema';

interface FootballLoggerProps {
    match: Match;
    onExit: () => void;
    currentLogger: Logger | null;
}

export function FootballLogger({ match, onExit, currentLogger }: FootballLoggerProps) {
    // ========== STATE MANAGEMENT ==========
    const stateManager = useRef<MatchStateManager | null>(null);
    const [matchState, setMatchState] = useState<MatchState | null>(null);

    // UI Local State
    const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
    const [homeTeam, setHomeTeam] = useState<Team | null>(null);
    const [awayTeam, setAwayTeam] = useState<Team | null>(null);
    const [homePlayers, setHomePlayers] = useState<Player[]>([]);
    const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    // Derived State
    const isClockRunning = matchState?.clock.isRunning ?? false;
    const currentPeriod = matchState?.clock.period ?? 'NOT_STARTED';
    const displayTime = stateManager.current ? stateManager.current.getFormattedTime() : "0'";
    const homeScore = matchState?.score.home ?? (match.homeScore || 0);
    const awayScore = matchState?.score.away ?? (match.awayScore || 0);
    const recordedEvents = matchState?.events ?? [];

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

    // Initial Load & Manager Setup
    useEffect(() => {
        const init = async () => {
            try {
                const [teamsRes, playersRes, lineupsRes] = await Promise.all([
                    fetch('/api/teams'),
                    fetch('/api/players'),
                    fetch(`/api/matches/${match.id}/lineup`)
                ]);

                const teamsData = await teamsRes.json();
                const playersData = await playersRes.json();
                const lineupsData = await lineupsRes.json();

                const teams = Array.isArray(teamsData) ? teamsData : (teamsData.teams || teamsData.data || []);
                const players = Array.isArray(playersData) ? playersData : (playersData.players || playersData.data || []);

                const home = teams.find((t: Team) => t.id === match.homeTeamId);
                const away = teams.find((t: Team) => t.id === match.awayTeamId);

                setHomeTeam(home || null);
                setAwayTeam(away || null);

                const hPlayers = players.filter((p: Player) => p.teamId === match.homeTeamId);
                const aPlayers = players.filter((p: Player) => p.teamId === match.awayTeamId);

                setHomePlayers(hPlayers);
                setAwayPlayers(aPlayers);

                // Initialize Manager
                const manager = getMatchStateManager(match.id, {
                    homeTeamId: match.homeTeamId,
                    awayTeamId: match.awayTeamId,
                    score: {
                        home: match.homeScore || 0,
                        away: match.awayScore || 0
                    },
                });

                manager.registerPlayers(hPlayers, 'home');
                manager.registerPlayers(aPlayers, 'away');

                // Auto-load published lineups if available
                if (lineupsData.success && lineupsData.lineups) {
                    const { home: homeLineup, away: awayLineup } = lineupsData.lineups;

                    // Check if home lineup is published
                    if (homeLineup && homeLineup.status === 'published') {
                        console.log('Auto-loading published home lineup');
                        // The lineup data is already stored in the match, no need to do anything
                        // The overlay and other components will fetch it from the match API
                    }

                    // Check if away lineup is published
                    if (awayLineup && awayLineup.status === 'published') {
                        console.log('Auto-loading published away lineup');
                        // The lineup data is already stored in the match, no need to do anything
                        // The overlay and other components will fetch it from the match API
                    }
                }

                stateManager.current = manager;

                const unsubscribe = manager.subscribe((newState) => {
                    setMatchState({ ...newState });
                });

                setMatchState(manager.getState());
                setIsLoading(false);

                return unsubscribe;
            } catch (err) {
                console.error("Failed to init logger:", err);
                setIsLoading(false);
            }
        };

        init();
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
    }, [matchState, isSocketConnected, emit, match.id]);

    // Multi-logger Hook
    const { activeLoggers, conflicts, isConnected, resolveConflict, syncStatus } = useMultiLogger({
        matchId: match.id,
        loggerId: currentLogger?.id || 'unknown',
        loggerName: currentLogger?.name || 'Unknown Logger',
        enabled: !!currentLogger,
    });

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
            const teamId = selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId;
            stateManager.current.recordEvent({
                matchId: match.id,
                type,
                teamId,
                playerId: null,
                playerSnapshot: null,
                relatedPlayerId: null,
                relatedPlayerSnapshot: null,
                detail: type,
                loggerId: currentLogger?.id || 'unknown'
            });
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
        confirmEvent('Substitution', playerComingOut, playerInId);
        setShowSubInModal(false);
        setPlayerComingOut(null);
    };

    const confirmEvent = (type: FootballEventType, playerId: string, relatedPlayerId: string | null) => {
        if (!stateManager.current) return;

        const teamId = selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId;
        const player = stateManager.current.getPlayer(playerId);
        const playerSnapshot = stateManager.current.createPlayerSnapshot(playerId);
        const relatedSnapshot = relatedPlayerId ? stateManager.current.createPlayerSnapshot(relatedPlayerId) : null;

        let detail = player ? (player.jerseyName || player.name) : 'Unknown';
        if (type === 'Substitution' && relatedSnapshot) {
            const relatedPlayer = stateManager.current.getPlayer(relatedPlayerId!);
            const relatedJerseyName = relatedPlayer?.jerseyName || relatedSnapshot.name;
            const outJerseyName = player?.jerseyName || detail;
            detail = `${relatedJerseyName} IN for ${outJerseyName}`;
        }

        stateManager.current.recordEvent({
            matchId: match.id,
            type,
            teamId,
            playerId,
            playerSnapshot,
            relatedPlayerId: relatedPlayerId,
            relatedPlayerSnapshot: relatedSnapshot,
            detail,
            loggerId: currentLogger?.id || 'unknown'
        });
    };

    const handleSetStoppage = (minutes: number) => {
        stateManager.current?.setAnnouncedStoppage(minutes);
        setShowStoppageModal(false);
    };

    const handlePeriodEndConfirm = (extraTimeMinutes: number) => {
        if (!stateManager.current || !pendingPeriodTransition) return;

        // Set the extra time
        if (extraTimeMinutes > 0) {
            stateManager.current.setAnnouncedStoppage(extraTimeMinutes);
        }

        // Complete the transition to next period
        stateManager.current.completePeriodTransition(pendingPeriodTransition.next as any);

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

    const handleUndo = () => {
        stateManager.current?.undoLastEvent();
    };

    const handleFinalize = async () => {
        if (!confirm('Are you sure you want to end the match?')) return;
        setIsSaving(true);
        stateManager.current?.transitionStatus('FINISHED');

        try {
            await fetch(`/api/matches/${match.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'FINISHED',
                    homeScore,
                    awayScore,
                }),
            });
            alert('Match finalized.');
        } catch (e) {
            console.error(e);
            alert('Error saving match result.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-lg border-b border-white/10 -mx-4 px-4 pb-4 mb-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onExit} className="p-2 bg-white/5 rounded-xl hover:bg-white/10">
                            <X size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl font-display uppercase italic">{match.competition}</h1>
                            <div className="text-xs text-white/40">{currentPeriod.replace('_', ' ')}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleUndo} className="p-2 bg-white/5 rounded-xl hover:bg-white/10">
                            <Undo2 size={20} />
                        </button>
                        <button onClick={() => setShowSettingsModal(true)} className="p-2 bg-white/5 rounded-xl hover:bg-white/10">
                            <Settings size={20} />
                        </button>
                        {currentPeriod !== 'FINISHED' && (
                            <button onClick={handleFinalize} disabled={isSaving} className="px-4 py-2 bg-green-500 text-black font-bold rounded-xl">
                                {isSaving ? 'Saving...' : 'End Match'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Scoreboard */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="bg-gradient-to-br from-green-900/20 to-black border border-green-500/20 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div className="text-center w-1/3">
                            <div className="text-4xl font-display italic text-primary mb-2">{homeScore}</div>
                            <div className="font-bold uppercase">{homeTeam?.shortName || 'Home'}</div>
                        </div>
                        <div className="text-center w-1/3">
                            <div className="text-5xl font-mono font-bold tracking-tight mb-2">
                                {displayTime}
                            </div>
                            <div className="flex justify-center gap-2">
                                <button onClick={toggleClock} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all">
                                    {isClockRunning ? <Pause size={24} /> : <Play size={24} />}
                                </button>
                                <button
                                    onClick={() => setShowStoppageModal(true)}
                                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all text-xs font-bold w-10 h-10 flex items-center justify-center"
                                    title="Add Stoppage Time"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        <div className="text-center w-1/3">
                            <div className="text-4xl font-display italic text-primary mb-2">{awayScore}</div>
                            <div className="font-bold uppercase">{awayTeam?.shortName || 'Away'}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                        onClick={() => setSelectedTeam('home')}
                        className={`p-4 rounded-xl border transition-all ${selectedTeam === 'home' ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10'}`}
                    >
                        {homeTeam?.name || 'Home Team'}
                    </button>
                    <button
                        onClick={() => setSelectedTeam('away')}
                        className={`p-4 rounded-xl border transition-all ${selectedTeam === 'away' ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10'}`}
                    >
                        {awayTeam?.name || 'Away Team'}
                    </button>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-8">
                    <EventButton type="Goal" icon="⚽" onClick={() => handleEventClick('Goal', true)} />
                    <EventButton type="Penalty" icon="🎯" onClick={() => handleEventClick('Penalty', true)} />
                    <EventButton type="Yellow Card" icon="🟨" onClick={() => handleEventClick('Yellow Card')} />
                    <EventButton type="Red Card" icon="🟥" onClick={() => handleEventClick('Red Card')} />
                    <EventButton type="Substitution" icon="🔄" onClick={() => handleEventClick('Substitution')} />
                    <EventButton type="Foul" icon="⚠️" onClick={() => handleEventClick('Foul')} />
                    <EventButton type="Corner" icon="🚩" onClick={() => handleEventClick('Corner')} />
                    <EventButton type="Offside" icon="🎌" onClick={() => handleEventClick('Offside')} />
                    <EventButton type="Save" icon="🧤" onClick={() => handleEventClick('Save')} />
                    <EventButton type="Shot" icon="⚡" onClick={() => handleEventClick('Shot')} />
                    <EventButton type="Shot on Target" icon="🎯" label="Shot On" onClick={() => handleEventClick('Shot on Target')} />
                    <EventButton type="Shot off Target" icon="❌" label="Shot Off" onClick={() => handleEventClick('Shot off Target')} />
                </div>

                <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest mb-4 opacity-60">Recent Events</h3>
                    <div className="space-y-2">
                        {recordedEvents.slice().reverse().map((event) => (
                            <div key={event.id} className="flex items-center gap-4 p-3 bg-black/40 rounded-xl border border-white/5">
                                <div className="text-xs font-mono opacity-50">{event.displayMinute}'</div>
                                <div className="flex-1">
                                    <div className="font-bold text-sm">{event.type}</div>
                                    <div className="text-xs opacity-60">{event.detail}</div>
                                </div>
                            </div>
                        ))}
                        {recordedEvents.length === 0 && (
                            <div className="text-center opacity-30 py-8">No events recorded yet</div>
                        )}
                    </div>
                </div>
            </div>

            {showPlayerModal && (
                <PlayerSelectionModal
                    players={selectedTeam === 'home' ? homePlayers : awayPlayers}
                    onSelect={handlePlayerSelect}
                    onClose={() => setShowPlayerModal(false)}
                    title={`Select Player for ${pendingEvent?.type}`}
                    filterGoalkeepersOnly={pendingEvent ? isGoalkeeperOnlyEvent(pendingEvent.type) : false}
                />
            )}

            {showAssistModal && (
                <PlayerSelectionModal
                    players={selectedTeam === 'home' ? homePlayers : awayPlayers}
                    onSelect={handleAssistSelect}
                    onClose={() => { setShowAssistModal(false); handleAssistSelect(null); }}
                    title="Select Assist (Optional)"
                />
            )}

            {showSubInModal && (
                <PlayerSelectionModal
                    players={selectedTeam === 'home' ? homePlayers : awayPlayers}
                    onSelect={handleSubIn}
                    onClose={() => setShowSubInModal(false)}
                    title="Select Player Coming IN"
                />
            )}

            {showStoppageModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold">Set Stoppage Time</h3>
                            <button onClick={() => setShowStoppageModal(false)}><X size={20} /></button>
                        </div>
                        <div className="p-4 grid grid-cols-4 gap-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                                <button
                                    key={num}
                                    onClick={() => handleSetStoppage(num)}
                                    className="aspect-square bg-white/5 hover:bg-primary hover:text-black rounded-xl font-bold transition-colors"
                                >
                                    +{num}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showPeriodEndModal && pendingPeriodTransition && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-primary/50 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-primary/10 to-transparent">
                            <h3 className="font-bold text-xl text-primary">Half Ended</h3>
                            <p className="text-sm text-white/60 mt-1">
                                {pendingPeriodTransition.current === 'FIRST_HALF' ? 'First Half' : 'Second Half'} has ended
                            </p>
                        </div>
                        <div className="p-6">
                            <p className="text-white/80 mb-4">Add extra time played (optional):</p>
                            <div className="grid grid-cols-5 gap-2 mb-6">
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => handlePeriodEndConfirm(num)}
                                        className="aspect-square bg-white/5 hover:bg-primary hover:text-black rounded-xl font-bold transition-all active:scale-95 border border-white/10 hover:border-primary"
                                    >
                                        {num === 0 ? 'None' : `+${num}`}
                                    </button>
                                ))}
                            </div>
                            <div className="text-xs text-white/40 text-center">
                                Click to add extra time and proceed to {pendingPeriodTransition.next === 'HALF_TIME' ? 'Half Time' : 'Full Time'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <MultiLoggerStatus
                activeLoggers={activeLoggers}
                conflicts={conflicts}
                isConnected={isConnected}
                syncStatus={syncStatus}
                currentLoggerName={currentLogger?.name || 'Unknown Logger'}
                onResolveConflict={(id, resolution) => resolveConflict(id, resolution)}
            />
        </div>
    );
}

function EventButton({ type, icon, label, onClick }: { type: string, icon: string, label?: string, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="aspect-square bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95"
        >
            <span className="text-2xl">{icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-tight">{label || type}</span>
        </button>
    );
}

function PlayerSelectionModal({ players, onSelect, onClose, title, filterGoalkeepersOnly = false }: any) {
    // Filter players based on event type
    const filteredPlayers = filterGoalkeepersOnly
        ? players.filter((p: Player) => {
            const pos = p.position?.toLowerCase() || '';
            return pos.includes('gk') || pos.includes('goalkeeper') || pos.includes('goal keeper') ||
                pos === 'g' || pos.includes('goalie') || pos.includes('keeper');
        })
        : players;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="font-bold">{title}</h3>
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
                            {filteredPlayers.map((p: Player) => (
                                <button
                                    key={p.id}
                                    onClick={() => onSelect(p.id)}
                                    className="p-3 text-left hover:bg-white/5 rounded-lg flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold">{p.number}</div>
                                    <div className="flex-1">
                                        <div className="font-medium">{p.name}</div>
                                        <div className="text-xs text-white/40">{p.position}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-white/40">
                            <div className="text-4xl mb-2">🧤</div>
                            <div className="font-medium">No goalkeeper found</div>
                            <div className="text-xs mt-1">Please add a goalkeeper to the team</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
