'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Save, Undo2, Clock, Users, TrendingUp, Target, Play, Settings, Trophy, Zap, Shield, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { useMultiLogger } from '@/hooks/useMultiLogger';
import { MultiLoggerStatus } from '@/components/MultiLoggerStatus';
import type { SyncEvent } from '@/lib/multiLogger';


import { MatchEvent } from '@/types';
import { Match, Logger, Player, Team } from '@/db/schema';

interface FootballLoggerProps {
    match: Match;
    onExit: () => void;
    currentLogger: Logger | null;
}

type FootballEventType =
    // Scoring
    | 'Goal' | 'Penalty' | 'Own Goal' | 'Assist'
    // Discipline
    | 'Yellow Card' | 'Red Card' | 'Foul' | 'Push' | 'Handball'
    // Defensive
    | 'Save' | 'Catch' | 'Block' | 'Interception' | 'Clearance' | 'Tackle'
    // Set Pieces
    | 'Corner' | 'Free Kick' | 'Throw In' | 'Goal Kick'
    // General
    | 'Shot' | 'Shot on Target' | 'Shot off Target' | 'Offside' | 'Substitution';

export function FootballLogger({ match, onExit, currentLogger }: FootballLoggerProps) {
    const [homeScore, setHomeScore] = useState(match.homeScore || 0);
    const [awayScore, setAwayScore] = useState(match.awayScore || 0);
    const [half, setHalf] = useState(1);
    const [minute, setMinute] = useState(0);
    const [extraTime, setExtraTime] = useState(0); // For injury/stoppage time (e.g., 45+2)
    const [halfDuration, setHalfDuration] = useState(35); // Default 35 minutes for school football
    const [events, setEvents] = useState<any[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');
    const [homeTeam, setHomeTeam] = useState<Team | null>(null);
    const [awayTeam, setAwayTeam] = useState<Team | null>(null);
    const [homePlayers, setHomePlayers] = useState<Player[]>([]);
    const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [matchStarted, setMatchStarted] = useState(match.status === 'LIVE');
    const [matchEnded, setMatchEnded] = useState(match.status === 'FINISHED');
    const [viewMode, setViewMode] = useState<'logger' | 'stats' | 'history'>('logger');
    const [isSaving, setIsSaving] = useState(false);

    // Player selection modals
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [pendingEvent, setPendingEvent] = useState<{ type: FootballEventType; isGoal?: boolean } | null>(null);
    const [selectedEventPlayer, setSelectedEventPlayer] = useState<string | null>(null);
    const [showAssistModal, setShowAssistModal] = useState(false);

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

    // Settings
    const [showSettingsModal, setShowSettingsModal] = useState(false);

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

    // Fetch teams, players, and existing events
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch teams
                const teamsResponse = await fetch('/api/teams');
                const teamsData = await teamsResponse.json();

                const home = teamsData.find((t: Team) => t.id === match.homeTeamId);
                const away = teamsData.find((t: Team) => t.id === match.awayTeamId);

                setHomeTeam(home || null);
                setAwayTeam(away || null);

                // Fetch players
                const playersResponse = await fetch('/api/players');
                const playersData = await playersResponse.json();

                setHomePlayers(playersData.filter((p: Player) => p.teamId === match.homeTeamId));
                setAwayPlayers(playersData.filter((p: Player) => p.teamId === match.awayTeamId));

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
                                teamId: e.teamId,
                                playerId: e.playerId,
                                assistPlayerId: e.relatedPlayerId,
                                detail: e.detail,
                                value: e.value ? (typeof e.value === 'string' ? JSON.parse(e.value) : e.value) : undefined,
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
                console.error('Error fetching data:', error);
                setIsLoading(false);
            }
        };

        fetchData();
    }, [match.homeTeamId, match.awayTeamId, match.id]);

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
                // Only update if we got new events
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
    const handleEventClick = (type: FootballEventType, isGoal: boolean = false) => {
        if (!matchStarted) return;
        setPendingEvent({ type, isGoal });
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

        // Check if this is a goal that might have an assist
        if (pendingEvent.isGoal) {
            setShowAssistModal(true);
        } else {
            // Record event without assist
            recordEvent(pendingEvent.type, playerId);
        }
    };

    // Handle incoming player for substitution
    const handleSubIn = (playerInId: string) => {
        if (!pendingEvent || !playerComingOut) return;

        // Record the event
        recordEvent('Substitution', playerComingOut, playerInId);

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

        recordEvent(pendingEvent.type, selectedEventPlayer, assistPlayerId);
        setShowAssistModal(false);
    };

    // Record the actual event
    const recordEvent = async (type: FootballEventType, playerId: string, assistPlayerId?: string | null) => {
        const allPlayers = [...homePlayers, ...awayPlayers];
        const player = allPlayers.find(p => p.id === playerId);
        const assistPlayer = assistPlayerId ? allPlayers.find(p => p.id === assistPlayerId) : null;

        const isGoal = type === 'Goal';
        const newEvent = {
            id: `e${events.length + 1}`,
            type,
            minute: half,
            second: minute * 60,
            teamId: selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId,
            playerId,
            assistPlayerId: assistPlayerId || undefined,
            detail: type === 'Substitution' && assistPlayer
                ? `${assistPlayer.name} IN for ${player?.name || 'Unknown'}`
                : player?.name || '',
            assistDetail: type === 'Substitution' ? undefined : assistPlayer?.name,
            value: isGoal ? 1 : undefined,
            loggerId: currentLogger?.id,
            loggerName: currentLogger?.name,
            createdAt: new Date(),
        };

        // Update local state immediately for responsive UI
        setEvents([...events, newEvent]);

        // Calculate new scores
        const newHomeScore = selectedTeam === 'home' && isGoal ? homeScore + 1 : homeScore;
        const newAwayScore = selectedTeam === 'away' && isGoal ? awayScore + 1 : awayScore;

        // Update scores for scoring events
        if (isGoal) {
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

        // Persist event to database
        try {
            await fetch(`/api/matches/${match.id}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    minute: half,
                    second: minute * 60,
                    teamId: selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId,
                    playerId,
                    relatedPlayerId: assistPlayerId || null,
                    detail: newEvent.detail,
                    value: isGoal ? 1 : null,
                    loggerId: currentLogger?.id,
                    loggerName: currentLogger?.name,
                }),
            });
        } catch (error) {
            console.error('Failed to persist event:', error);
            // Event is still in local state, can be synced later
        }

        // Dispatch WebSocket event for live updates
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('FOOTBALL_EVENT', {
                detail: {
                    matchId: match.id,
                    event: newEvent,
                    homeScore: newHomeScore,
                    awayScore: newAwayScore,
                    half,
                    minute,
                    status: 'LIVE',
                }
            }));
        }

        // Reset state
        setPendingEvent(null);
        setSelectedEventPlayer(null);
    };

    const undoLastEvent = () => {
        if (events.length === 0) return;
        const lastEvent = events[events.length - 1];

        // Revert score if it was a goal
        if (lastEvent.type === 'Goal') {
            if (lastEvent.teamId === match.homeTeamId) {
                setHomeScore(homeScore - 1);
            } else {
                setAwayScore(awayScore - 1);
            }
        }

        setEvents(events.slice(0, -1));
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
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Football Logger</p>
                                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-500 border border-green-500/30 rounded text-[8px] font-black uppercase tracking-tighter">Group Stage</span>
                                </div>
                                <h1 className="text-2xl font-display italic uppercase">{match.competition}</h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {!matchStarted && (
                                <button
                                    onClick={() => {
                                        if (!lineupSet) {
                                            setShowLineupModal(true);
                                        } else {
                                            setMatchStarted(true);
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
                                disabled={!matchStarted || matchEnded}
                                className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Undo2 size={16} />
                                <span className="text-xs font-black uppercase tracking-widest">Undo</span>
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

            <div className="max-w-7xl mx-auto">
                {/* Scoreboard - Compact */}
                <div className="bg-gradient-to-br from-green-900/20 to-green-950/40 border border-green-500/20 rounded-[24px] p-4 mb-4">
                    <div className="grid grid-cols-3 gap-4 items-center">
                        {/* Home Team */}
                        <div className="text-center">
                            {homeTeam?.logo ? (
                                <img src={homeTeam.logo} alt={homeTeam.name} className="w-16 h-16 mx-auto mb-2 object-contain" />
                            ) : (
                                <span className="text-4xl mb-2 block">⚽</span>
                            )}
                            <p className="text-sm font-black uppercase tracking-tight mb-1">{homeTeam?.shortName}</p>
                            <div className="text-5xl font-display italic text-primary">{homeScore}</div>
                        </div>

                        {/* Half & Time */}
                        <div className="text-center">
                            <div className="bg-white/10 rounded-xl p-3 mb-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Half</p>
                                <div className="flex justify-center gap-1">
                                    {[1, 2].map((h) => (
                                        <button
                                            key={h}
                                            onClick={() => setHalf(h)}
                                            className={`w-12 h-12 rounded-xl font-display text-xl transition-all ${half === h ? 'bg-primary text-black' : 'bg-white/5 text-white/40'
                                                }`}
                                        >
                                            {h}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center justify-center gap-2 text-4xl font-display italic">
                                    <Clock size={32} className="text-primary" />
                                    {minute}'{extraTime > 0 && <span className="text-2xl text-orange-500">+{extraTime}</span>}
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max={halfDuration}
                                    value={minute}
                                    onChange={(e) => {
                                        setMinute(parseInt(e.target.value));
                                        // Reset extra time if going back below half duration
                                        if (parseInt(e.target.value) < halfDuration) {
                                            setExtraTime(0);
                                        }
                                    }}
                                    className="w-full h-1 bg-white/10 rounded-full appearance-none accent-primary cursor-pointer"
                                />
                                {/* Extra Time Controls - Show when at half duration */}
                                {minute >= halfDuration && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Injury Time:</span>
                                        <button
                                            onClick={() => setExtraTime(Math.max(0, extraTime - 1))}
                                            className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex items-center justify-center"
                                        >
                                            -
                                        </button>
                                        <span className="text-lg font-display text-orange-500 w-8 text-center">+{extraTime}</span>
                                        <button
                                            onClick={() => setExtraTime(extraTime + 1)}
                                            className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex items-center justify-center"
                                        >
                                            +
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Away Team */}
                        <div className="text-center">
                            {awayTeam?.logo ? (
                                <img src={awayTeam.logo} alt={awayTeam.name} className="w-16 h-16 mx-auto mb-2 object-contain" />
                            ) : (
                                <span className="text-4xl mb-2 block">⚽</span>
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
                                        <span className="text-2xl">⚽</span>
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
                                        <span className="text-2xl">⚽</span>
                                    )}
                                    <span className="font-black uppercase tracking-widest">{awayTeam?.shortName}</span>
                                </button>
                            </div>

                            {/* Scoring Actions */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Trophy className="text-primary" size={16} />
                                    Scoring
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <ActionButton
                                        label="Goal"
                                        icon={<Trophy size={18} />}
                                        color="bg-green-500/20 text-green-500 border-green-500/30"
                                        onClick={() => handleEventClick('Goal', true)}
                                        matchStarted={matchStarted} matchEnded={matchEnded}
                                    />
                                    <ActionButton
                                        label="Penalty"
                                        icon={<Target size={18} />}
                                        color="bg-orange-500/20 text-orange-500 border-orange-500/30"
                                        onClick={() => handleEventClick('Penalty', true)}
                                        matchStarted={matchStarted} matchEnded={matchEnded}
                                    />
                                    <ActionButton
                                        label="Own Goal"
                                        icon={<Trophy size={18} />}
                                        color="bg-red-500/20 text-red-500 border-red-500/30"
                                        onClick={() => handleEventClick('Own Goal', true)}
                                        matchStarted={matchStarted} matchEnded={matchEnded}
                                    />
                                </div>
                            </div>

                            {/* Goalkeeper Actions */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Shield className="text-primary" size={16} />
                                    Goalkeeper
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <SimpleActionButton label="Save" onClick={() => handleEventClick('Save')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Catch" onClick={() => handleEventClick('Catch')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                </div>
                            </div>

                            {/* Defensive Actions */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Shield className="text-primary" size={16} />
                                    Defense
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <SimpleActionButton label="Block" onClick={() => handleEventClick('Block')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Interception" onClick={() => handleEventClick('Interception')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Clearance" onClick={() => handleEventClick('Clearance')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Tackle" onClick={() => handleEventClick('Tackle')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                </div>
                            </div>

                            {/* Shooting */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Target className="text-primary" size={16} />
                                    Shooting
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <SimpleActionButton label="Shot" onClick={() => handleEventClick('Shot')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Shot on Target" onClick={() => handleEventClick('Shot on Target')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Shot off Target" onClick={() => handleEventClick('Shot off Target')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                </div>
                            </div>

                            {/* Set Pieces */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Activity className="text-primary" size={16} />
                                    Set Pieces
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <SimpleActionButton label="Corner" onClick={() => handleEventClick('Corner')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Free Kick" onClick={() => handleEventClick('Free Kick')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Throw In" onClick={() => handleEventClick('Throw In')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Goal Kick" onClick={() => handleEventClick('Goal Kick')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Offside" onClick={() => handleEventClick('Offside')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                </div>
                            </div>

                            {/* Fouls & Cards */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <AlertTriangle className="text-orange-500" size={16} />
                                    Discipline
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <SimpleActionButton label="Foul" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Push" onClick={() => handleEventClick('Push')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Handball" onClick={() => handleEventClick('Handball')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <ActionButton
                                        label="Yellow Card"
                                        icon={<AlertTriangle size={18} />}
                                        color="bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                                        onClick={() => handleEventClick('Yellow Card')}
                                        matchStarted={matchStarted} matchEnded={matchEnded}
                                    />
                                    <ActionButton
                                        label="Red Card"
                                        icon={<AlertTriangle size={18} />}
                                        color="bg-red-500/20 text-red-500 border-red-500/30"
                                        onClick={() => handleEventClick('Red Card')}
                                        matchStarted={matchStarted} matchEnded={matchEnded}
                                    />
                                </div>
                            </div>

                            {/* Team Actions */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Users className="text-primary" size={16} />
                                    Team Actions
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <SimpleActionButton label="Substitution" onClick={() => handleEventClick('Substitution')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Assist" onClick={() => handleEventClick('Assist')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                </div>
                            </div>
                        </div>

                        {/* Event Log - Full Width Below Actions */}
                        <div className="bg-white/5 border border-white/10 rounded-[24px] p-4 mt-4">
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
                                                    {event.minute}' - {Math.floor((event.second || 0) / 60)}:{String((event.second || 0) % 60).padStart(2, '0')}
                                                </span>
                                                {event.value && (
                                                    <span className="text-xs font-display italic text-primary">⚽ GOAL</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {team?.logo ? (
                                                    <img src={team.logo} alt={team.name} className="w-6 h-6 object-contain flex-shrink-0" />
                                                ) : (
                                                    <span className="text-lg flex-shrink-0">⚽</span>
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
            </div>

            {/* Player Selection Modal */}
            {showPlayerModal && (
                <PlayerSelectionModal
                    players={selectedTeam === 'home' ? homePlayers : awayPlayers}
                    onSelect={handlePlayerSelect}
                    onClose={() => {
                        setShowPlayerModal(false);
                        setPendingEvent(null);
                    }}
                    title={`Select Player - ${pendingEvent?.type}`}
                />
            )}

            {/* Assist Modal */}
            {showAssistModal && (
                <AssistModal
                    players={selectedTeam === 'home' ? homePlayers : awayPlayers}
                    onSelect={handleAssistSelect}
                    onClose={() => {
                        setShowAssistModal(false);
                        handleAssistSelect(null);
                    }}
                />
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <SettingsModal
                    halfDuration={halfDuration}
                    setHalfDuration={setHalfDuration}
                    onClose={() => setShowSettingsModal(false)}
                />
            )}
        </div>
    );
}

// Helper Components
function ActionButton({ label, icon, color, onClick, matchStarted, matchEnded }: any) {
    return (
        <button
            onClick={onClick}
            disabled={!matchStarted || matchEnded}
            className={`${color} flex flex-col items-center justify-center gap-2 p-4 rounded-[20px] hover:scale-105 transition-all active:scale-95 border disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            <div className="opacity-80">{icon}</div>
            <span className="text-[9px] font-black uppercase tracking-tight text-center leading-tight">{label}</span>
        </button>
    );
}

function SimpleActionButton({ label, onClick, matchStarted, matchEnded }: any) {
    return (
        <button
            onClick={onClick}
            disabled={!matchStarted || matchEnded}
            className="bg-white/5 text-white/60 border border-white/10 p-4 rounded-[20px] hover:bg-white/10 hover:text-white transition-all text-[10px] font-black uppercase tracking-tight disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {label}
        </button>
    );
}

function PlayerSelectionModal({ players, onSelect, onClose, title }: any) {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-display italic uppercase">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {players.map((player: Player) => (
                        <button
                            key={player.id}
                            onClick={() => onSelect(player.id)}
                            className="p-4 bg-white/5 border border-white/10 rounded-[20px] hover:bg-primary/10 hover:border-primary transition-all text-left"
                        >
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1">#{player.number} • {player.position}</p>
                            <p className="text-sm font-bold">{player.name}</p>
                        </button>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}

function AssistModal({ players, onSelect, onClose }: any) {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-display italic uppercase">Select Assist (Optional)</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <button
                    onClick={() => onSelect(null)}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-[20px] hover:bg-white/10 transition-all mb-4 text-sm font-black uppercase tracking-widest"
                >
                    No Assist
                </button>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {players.map((player: Player) => (
                        <button
                            key={player.id}
                            onClick={() => onSelect(player.id)}
                            className="p-4 bg-white/5 border border-white/10 rounded-[20px] hover:bg-primary/10 hover:border-primary transition-all text-left"
                        >
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1">#{player.number} • {player.position}</p>
                            <p className="text-sm font-bold">{player.name}</p>
                        </button>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}

function SettingsModal({ halfDuration, setHalfDuration, onClose }: any) {
    const durations = [20, 25, 30, 35, 40, 45];


    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 max-w-md w-full"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-display italic uppercase">Match Settings</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-sm font-black uppercase tracking-widest text-white/60 mb-3 block">
                            Half Duration (Minutes)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {durations.map((duration) => (
                                <button
                                    key={duration}
                                    onClick={() => setHalfDuration(duration)}
                                    className={`p-4 rounded-xl font-display text-xl transition-all ${halfDuration === duration
                                        ? 'bg-primary text-black'
                                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                                        }`}
                                >
                                    {duration}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-white/40 mt-3 text-center">
                            Selected: <span className="text-primary font-bold">{halfDuration} minutes</span> per half
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full bg-primary text-black font-black uppercase tracking-widest py-4 rounded-2xl hover:scale-105 transition-all"
                    >
                        Save Settings
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
