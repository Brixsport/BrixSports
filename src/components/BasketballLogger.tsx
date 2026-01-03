'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Save, Undo2, Clock, Users, TrendingUp, Target, Play, Settings } from 'lucide-react';
import { useMultiLogger } from '@/hooks/useMultiLogger';
import { MultiLoggerStatus } from '@/components/MultiLoggerStatus';
import type { SyncEvent } from '@/lib/multiLogger';


interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    color: string;
}

interface Player {
    id: string;
    name: string;
    number: number;
    teamId: string;
    position: string;
}

interface Match {
    id: string;
    sport: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    status: string;
    startTime: string;
    venue: string;
    competition: string;
    homeTeam?: Team;
    awayTeam?: Team;
}

interface Logger {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface BasketballLoggerProps {
    match: Match;
    onExit: () => void;
    currentLogger: Logger | null;
}

type BasketballEventType = 'Field Goal' | 'Three Pointer' | 'Free Throw' | 'Rebound' | 'Assist' | 'Steal' | 'Block' | 'Turnover' | 'Foul' | 'Substitution' | 'Timeout';

export function BasketballLogger({ match, onExit, currentLogger }: BasketballLoggerProps) {
    const [homeScore, setHomeScore] = useState(match.homeScore);
    const [awayScore, setAwayScore] = useState(match.awayScore);
    const [quarter, setQuarter] = useState(1);
    const [time, setTime] = useState('12:00');
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



    // Modal-based player selection
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [pendingEvent, setPendingEvent] = useState<{ type: BasketballEventType; points?: number } | null>(null);
    const [selectedEventPlayer, setSelectedEventPlayer] = useState<string | null>(null);
    const [showAssistModal, setShowAssistModal] = useState(false);


    // Settings
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [quarterDuration, setQuarterDuration] = useState(12); // minutes per quarter

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
                    case 'Free Throw':
                        if (event.value && event.value > 0) {
                            rating += event.value; // Made shot
                        } else {
                            rating -= 1; // Missed shot
                        }
                        break;
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
                    minute: e.minute || quarter,
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
    }, [events, isConnected, syncEvents, currentLogger, quarter]);

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

    // Record the actual event
    const recordEvent = async (type: BasketballEventType, playerId: string, points?: number, assistPlayerId?: string | null) => {
        const allPlayers = [...homePlayers, ...awayPlayers];
        const player = allPlayers.find(p => p.id === playerId);
        const assistPlayer = assistPlayerId ? allPlayers.find(p => p.id === assistPlayerId) : null;

        const newEvent = {
            id: `e${events.length + 1}`,
            type,
            minute: quarter,
            second: parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]),
            teamId: selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId,
            playerId,
            assistPlayerId: assistPlayerId || undefined,
            detail: type === 'Substitution' && assistPlayer
                ? `${assistPlayer.name} IN for ${player?.name || 'Unknown'}`
                : player?.name || '',
            assistDetail: type === 'Substitution' ? undefined : assistPlayer?.name,
            value: points,
            loggerId: currentLogger?.id,
            loggerName: currentLogger?.name,
            createdAt: new Date(),
        };

        // Update local state immediately for responsive UI
        setEvents([...events, newEvent]);

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

        // Persist event to database
        try {
            await fetch(`/api/matches/${match.id}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    minute: quarter,
                    second: parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]),
                    teamId: selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId,
                    playerId,
                    relatedPlayerId: assistPlayerId || null,
                    detail: newEvent.detail,
                    value: points || null,
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
    };

    const undoLastEvent = () => {
        if (events.length === 0) return;
        const lastEvent = events[events.length - 1];

        // Revert score if it was a scoring event
        if (lastEvent.value) {
            if (lastEvent.teamId === match.homeTeamId) {
                setHomeScore(homeScore - lastEvent.value);
            } else {
                setAwayScore(awayScore - lastEvent.value);
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
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Basketball Logger</p>
                                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-500 border border-orange-500/30 rounded text-[8px] font-black uppercase tracking-tighter">Semi-Finals</span>
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
                                <div className="grid grid-cols-3 gap-3">
                                    <ActionButton
                                        label="2 Points Made"
                                        value="2PT"
                                        color="bg-green-500/20 text-green-500 border-green-500/30"
                                        onClick={() => handleEventClick('Field Goal', 2)}
                                        matchStarted={matchStarted} matchEnded={matchEnded}
                                    />
                                    <ActionButton
                                        label="3 Points Made"
                                        value="3PT"
                                        color="bg-purple-500/20 text-purple-500 border-purple-500/30"
                                        onClick={() => handleEventClick('Three Pointer', 3)}
                                        matchStarted={matchStarted} matchEnded={matchEnded}
                                    />
                                    <ActionButton
                                        label="Free Throw"
                                        value="FT"
                                        color="bg-blue-500/20 text-blue-500 border-blue-500/30"
                                        onClick={() => handleEventClick('Free Throw', 1)}
                                        matchStarted={matchStarted} matchEnded={matchEnded}
                                    />
                                    <SimpleActionButton label="2PT Missed" onClick={() => handleEventClick('Field Goal', 0)} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="3PT Missed" onClick={() => handleEventClick('Three Pointer', 0)} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="FT Missed" onClick={() => handleEventClick('Free Throw', 0)} matchStarted={matchStarted} matchEnded={matchEnded} />
                                </div>
                            </div>

                            {/* Rebounds */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <TrendingUp className="text-primary" size={16} />
                                    Rebounds
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <SimpleActionButton label="Offensive Rebound" onClick={() => handleEventClick('Rebound')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Defensive Rebound" onClick={() => handleEventClick('Rebound')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                </div>
                            </div>

                            {/* Defensive Actions */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Activity className="text-primary" size={16} />
                                    Defense
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    <SimpleActionButton label="Steal" onClick={() => handleEventClick('Steal')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Block" onClick={() => handleEventClick('Block')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Deflection" onClick={() => handleEventClick('Block')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                </div>
                            </div>

                            {/* Assists & Turnovers */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Activity className="text-primary" size={16} />
                                    Playmaking
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <SimpleActionButton label="Assist" onClick={() => handleEventClick('Assist')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Turnover" onClick={() => handleEventClick('Turnover')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                </div>
                            </div>

                            {/* Fouls */}
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-4">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Activity className="text-orange-500" size={16} />
                                    Fouls
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    <SimpleActionButton label="Personal Foul" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Technical Foul" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Flagrant Foul" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Offensive Foul" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Shooting Foul" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} />
                                    <SimpleActionButton label="Unsportsmanlike" onClick={() => handleEventClick('Foul')} matchStarted={matchStarted} matchEnded={matchEnded} />
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
                                    <SimpleActionButton label="Timeout" onClick={() => handleEventClick('Timeout')} matchStarted={matchStarted} matchEnded={matchEnded} />
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
                                                    Q{event.minute} - {Math.floor((event.second || 0) / 60)}:{String((event.second || 0) % 60).padStart(2, '0')}
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
                                            Q{event.minute}
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
                                    .map((player) => (
                                        <button
                                            key={player.id}
                                            onClick={() => handlePlayerSelect(player.id)}
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
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {(selectedTeam === 'home' ? homePlayers : awayPlayers)
                                    .filter(p => (selectedTeam === 'home' ? homeSubs : awaySubs).includes(p.id))
                                    .map((player) => (
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
                                        {[8, 10, 12].map((duration) => (
                                            <button
                                                key={duration}
                                                onClick={() => {
                                                    setQuarterDuration(duration);
                                                    setTime(`${duration}:00`);
                                                }}
                                                className={`py-4 rounded-xl font-display text-2xl transition-all ${quarterDuration === duration
                                                    ? 'bg-primary text-black'
                                                    : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                                                    }`}
                                            >
                                                {duration}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-white/40 mt-2">Standard: 12 min | Youth: 8-10 min</p>
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
                                    <p className="text-sm text-white/40">Select 5 starters for each team before starting the match</p>
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
                                                {homeStarters.length}/5 Starters Selected
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
                                                        } else if (homeStarters.length < 5) {
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
                                                {awayStarters.length}/5 Starters Selected
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
                                                        } else if (awayStarters.length < 5) {
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
                                            <p className="font-bold text-white">{homeStarters.length}/5</p>
                                        </div>
                                        <div>
                                            <p className="text-white/40 text-xs">{awayTeam?.shortName} Starters</p>
                                            <p className="font-bold text-white">{awayStarters.length}/5</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (homeStarters.length === 5 && awayStarters.length === 5) {
                                            // Set remaining players as subs
                                            setHomeSubs(homePlayers.filter(p => !homeStarters.includes(p.id)).map(p => p.id));
                                            setAwaySubs(awayPlayers.filter(p => !awayStarters.includes(p.id)).map(p => p.id));
                                            setLineupSet(true);
                                            setShowLineupModal(false);
                                        }
                                    }}
                                    disabled={homeStarters.length !== 5 || awayStarters.length !== 5}
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
                                {quarter < 4 ? (
                                    <button
                                        onClick={() => {
                                            setQuarter(prev => prev + 1);
                                            setTime(`${quarterDuration}:00`);
                                            setShowPeriodModal(false);
                                            // Dispatch event for quarter change
                                            if (typeof window !== 'undefined') {
                                                window.dispatchEvent(new CustomEvent('MATCH_PERIOD_CHANGE', {
                                                    detail: { matchId: match.id, period: `Q${quarter + 1}` }
                                                }));
                                            }
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
                                                setIsOT(true);
                                                setQuarter(5); // 5 represents OT
                                                setTime("5:00");
                                                setShowPeriodModal(false);
                                            } else {
                                                setMatchEnded(true);
                                                setShowPeriodModal(false);
                                                // Dispatch event for match end
                                                if (typeof window !== 'undefined') {
                                                    window.dispatchEvent(new CustomEvent('MATCH_STATUS_CHANGE', {
                                                        detail: {
                                                            matchId: match.id,
                                                            status: 'FINISHED',
                                                            homeScore,
                                                            awayScore
                                                        }
                                                    }));
                                                }
                                            }
                                        }}
                                        className="w-full bg-primary text-black py-4 rounded-xl font-black uppercase tracking-widest hover:scale-105 transition-transform"
                                    >
                                        {homeScore === awayScore ? 'Start Extra Time (OT)' : 'Finalize Match'}
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        // Specific user request for "Extra Time" even after first qtr
                                        setIsOT(true);
                                        setTime("5:00"); // Standard OT length or just extra logging time
                                        setShowPeriodModal(false);
                                    }}
                                    className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                >
                                    Add Extra Time
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


function ActionButton({ label, value, color, onClick, matchStarted, matchEnded }: { label: string; value: string; color: string; onClick: () => void; matchStarted: boolean; matchEnded?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={!matchStarted || matchEnded}
            className={`border rounded-2xl p-6 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${color}`}
        >
            <p className="text-3xl font-display italic mb-2">{value}</p>
            <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
        </button>
    );
}

function SimpleActionButton({ label, onClick, matchStarted, matchEnded }: { label: string; onClick: () => void; matchStarted: boolean; matchEnded?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={!matchStarted || matchEnded}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <p className="text-xs font-black uppercase tracking-widest">{label}</p>
        </button>
    );
}


