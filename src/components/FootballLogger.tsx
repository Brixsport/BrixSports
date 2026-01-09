'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Save, Undo2, Clock, Users, TrendingUp, Target, Play, Pause, Settings, Trophy, Zap, Shield, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { useMultiLogger } from '@/hooks/useMultiLogger';
import { useWebSocket } from '@/hooks/useWebSocket';
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
    const [homeScore, setHomeScore] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`match_${match.id}_homeScore`);
            return saved ? parseInt(saved) : (match.homeScore || 0);
        }
        return match.homeScore || 0;
    });
    const [awayScore, setAwayScore] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`match_${match.id}_awayScore`);
            return saved ? parseInt(saved) : (match.awayScore || 0);
        }
        return match.awayScore || 0;
    });
    const [half, setHalf] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`match_${match.id}_half`);
            return saved ? parseInt(saved) : 1;
        }
        return 1;
    });
    const [minute, setMinute] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`match_${match.id}_minute`);
            return saved ? parseInt(saved) : 0;
        }
        return 0;
    });
    const [second, setSecond] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`match_${match.id}_second`);
            return saved ? parseInt(saved) : 0;
        }
        return 0;
    });
    const [extraTime, setExtraTime] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`match_${match.id}_extraTime`);
            return saved ? parseInt(saved) : 0;
        }
        return 0;
    });
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

    // WebSocket connection for broadcasting events explicitly
    const { emit } = useWebSocket({
        matchId: match.id,
        autoConnect: true,
    });

    // Player selection modals
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [pendingEvent, setPendingEvent] = useState<{ type: FootballEventType; isGoal?: boolean } | null>(null);
    const [selectedEventPlayer, setSelectedEventPlayer] = useState<string | null>(null);
    const [showAssistModal, setShowAssistModal] = useState(false);
    const [showFinishModal, setShowFinishModal] = useState(false);

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

    // Timer control
    const [timerRunning, setTimerRunning] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`match_${match.id}_timerRunning`);
            return saved === 'true';
        }
        return false;
    });

    // Persist state to localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(`match_${match.id}_homeScore`, homeScore.toString());
        localStorage.setItem(`match_${match.id}_awayScore`, awayScore.toString());
        localStorage.setItem(`match_${match.id}_half`, half.toString());
        localStorage.setItem(`match_${match.id}_minute`, minute.toString());
        localStorage.setItem(`match_${match.id}_second`, second.toString());
        localStorage.setItem(`match_${match.id}_extraTime`, extraTime.toString());
        localStorage.setItem(`match_${match.id}_timerRunning`, timerRunning.toString());
    }, [match.id, homeScore, awayScore, half, minute, second, extraTime, timerRunning]);

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

    // Debug: Monitor lineup modal state
    useEffect(() => {
        console.log('⚽ [FOOTBALL] Lineup Modal State Changed:', showLineupModal);
        console.log('📊 [FOOTBALL] Current State:', {
            showLineupModal,
            lineupSet,
            homePlayersCount: homePlayers.length,
            awayPlayersCount: awayPlayers.length,
            homeStartersCount: homeStarters.length,
            awayStartersCount: awayStarters.length
        });
    }, [showLineupModal, lineupSet, homePlayers.length, awayPlayers.length, homeStarters.length, awayStarters.length]);

    // Auto-timer: Increment minute every second when running
    useEffect(() => {
        if (timerRunning && matchStarted && !matchEnded) {
            const interval = setInterval(() => {
                setSecond((prevSecond) => {
                    const newSecond = prevSecond + 1;

                    if (newSecond >= 60) {
                        // Minute rollover
                        setMinute((prevMinute) => {
                            // Check if we're still in regular time (before half duration)
                            if (prevMinute < halfDuration - 1) {
                                // Still in regular time, increment minute
                                const nextMinute = prevMinute + 1;

                                if (typeof window !== 'undefined') {
                                    window.dispatchEvent(new CustomEvent('MATCH_TIME_UPDATE', {
                                        detail: {
                                            matchId: match.id,
                                            minute: nextMinute,
                                            extraTime: 0,
                                            half,
                                        }
                                    }));
                                    emit('match:time:update', {
                                        matchId: match.id,
                                        minute: nextMinute,
                                        extraTime: 0,
                                        half,
                                    });
                                }
                                return nextMinute;
                            } else if (prevMinute === halfDuration - 1) {
                                // Reached the last minute of regular time, move to halfDuration
                                const nextMinute = halfDuration;
                                if (typeof window !== 'undefined') {
                                    window.dispatchEvent(new CustomEvent('MATCH_TIME_UPDATE', {
                                        detail: {
                                            matchId: match.id,
                                            minute: nextMinute,
                                            extraTime: 0,
                                            half,
                                        }
                                    }));
                                    emit('match:time:update', {
                                        matchId: match.id,
                                        minute: nextMinute,
                                        extraTime: 0,
                                        half,
                                    });
                                }
                                return nextMinute;
                            } else if (prevMinute === halfDuration && extraTime === 0) {
                                // At half duration with no extra time set - enter extra time mode
                                setExtraTime((prevExtra) => {
                                    const nextExtra = prevExtra + 1;
                                    if (typeof window !== 'undefined') {
                                        window.dispatchEvent(new CustomEvent('MATCH_TIME_UPDATE', {
                                            detail: {
                                                matchId: match.id,
                                                minute: halfDuration,
                                                extraTime: nextExtra,
                                                half,
                                            }
                                        }));
                                        emit('match:time:update', {
                                            matchId: match.id,
                                            minute: halfDuration,
                                            extraTime: nextExtra,
                                            half,
                                        });
                                    }
                                    return nextExtra;
                                });
                                return halfDuration; // Keep minute at halfDuration
                            } else if (prevMinute === halfDuration && extraTime > 0) {
                                // In extra time mode - increment extra time
                                setExtraTime((prevExtra) => {
                                    const nextExtra = prevExtra + 1;
                                    if (typeof window !== 'undefined') {
                                        window.dispatchEvent(new CustomEvent('MATCH_TIME_UPDATE', {
                                            detail: {
                                                matchId: match.id,
                                                minute: halfDuration,
                                                extraTime: nextExtra,
                                                half,
                                            }
                                        }));
                                        emit('match:time:update', {
                                            matchId: match.id,
                                            minute: halfDuration,
                                            extraTime: nextExtra,
                                            half,
                                        });
                                    }
                                    return nextExtra;
                                });
                                return halfDuration; // Keep minute at halfDuration
                            } else {
                                // Past half duration (36, 37, 38...) - continue incrementing normally
                                const nextMinute = prevMinute + 1;
                                if (typeof window !== 'undefined') {
                                    window.dispatchEvent(new CustomEvent('MATCH_TIME_UPDATE', {
                                        detail: {
                                            matchId: match.id,
                                            minute: nextMinute,
                                            extraTime: 0,
                                            half,
                                        }
                                    }));
                                    emit('match:time:update', {
                                        matchId: match.id,
                                        minute: nextMinute,
                                        extraTime: 0,
                                        half,
                                    });
                                }
                                return nextMinute;
                            }
                        });
                        return 0;
                    }
                    return newSecond;
                });
            }, 1000); // Increment every second (real-time)

            return () => clearInterval(interval);
        }
    }, [timerRunning, matchStarted, matchEnded, halfDuration, match.id, half]);

    // Fetch teams, players, and existing events
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch teams
                const teamsResponse = await fetch('/api/teams');
                const teamsData = await teamsResponse.json();

                // Handle different response formats for teams
                const teamsArray = Array.isArray(teamsData) ? teamsData : (teamsData.teams || teamsData.data || []);

                const home = teamsArray.find((t: Team) => t.id === match.homeTeamId);
                const away = teamsArray.find((t: Team) => t.id === match.awayTeamId);

                setHomeTeam(home || null);
                setAwayTeam(away || null);

                // Fetch players
                const playersResponse = await fetch('/api/players');
                const playersData = await playersResponse.json();

                // Handle different response formats for players
                const playersArray = Array.isArray(playersData)
                    ? playersData
                    : (playersData.players || playersData.data || []);

                console.log('📊 Players fetched:', playersArray.length);
                console.log('🏠 Home team ID:', match.homeTeamId);
                console.log('✈️ Away team ID:', match.awayTeamId);

                const homePlayersList = playersArray.filter((p: Player) => p.teamId === match.homeTeamId);
                const awayPlayersList = playersArray.filter((p: Player) => p.teamId === match.awayTeamId);

                console.log('🏠 Home players:', homePlayersList.length);
                console.log('✈️ Away players:', awayPlayersList.length);

                setHomePlayers(homePlayersList);
                setAwayPlayers(awayPlayersList);

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

    // Helper function to determine if an event requires player selection
    const requiresPlayerSelection = (type: FootballEventType): boolean => {
        // Set pieces and team-level events don't need player selection
        const noPlayerEvents: FootballEventType[] = [
            'Corner', 'Free Kick', 'Throw In', 'Goal Kick', 'Offside'
        ];
        return !noPlayerEvents.includes(type);
    };

    // Handle event button click - opens player modal or records directly
    const handleEventClick = (type: FootballEventType, isGoal: boolean = false) => {
        if (!matchStarted) return;

        // If event doesn't require player selection, record it directly
        if (!requiresPlayerSelection(type)) {
            recordEvent(type, 'team-event'); // Use a placeholder for team events
            return;
        }

        // Otherwise, show player selection modal
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
        const isTeamEvent = playerId === 'team-event';
        const player = isTeamEvent ? null : allPlayers.find(p => p.id === playerId);
        const assistPlayer = assistPlayerId ? allPlayers.find(p => p.id === assistPlayerId) : null;

        const isScoringEvent = ['Goal', 'Penalty', 'Own Goal'].includes(type);

        // For team events, use team name; for player events, use player name
        const eventDetail = isTeamEvent
            ? (selectedTeam === 'home' ? homeTeam?.name : awayTeam?.name) || type
            : type === 'Substitution' && assistPlayer
                ? `${assistPlayer.name} IN for ${player?.name || 'Unknown'}`
                : player?.name || '';

        const newEvent = {
            id: `e${events.length + 1}`,
            type,
            minute: minute,
            second: second,
            teamId: selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId,
            playerId: isTeamEvent ? null : playerId,
            assistPlayerId: assistPlayerId || undefined,
            detail: eventDetail,
            assistDetail: type === 'Substitution' ? undefined : assistPlayer?.name,
            value: isScoringEvent ? 1 : undefined,
            loggerId: currentLogger?.id,
            loggerName: currentLogger?.name,
            createdAt: new Date(),
        };

        // Update local state immediately for responsive UI
        setEvents([...events, newEvent]);

        // Calculate new scores
        let newHomeScore = homeScore;
        let newAwayScore = awayScore;

        if (isScoringEvent) {
            if (type === 'Own Goal') {
                // Own goal scores for the OPPONENT
                if (selectedTeam === 'home') {
                    newAwayScore = awayScore + 1;
                    setAwayScore(newAwayScore);
                } else {
                    newHomeScore = homeScore + 1;
                    setHomeScore(newHomeScore);
                }
            } else {
                // Goal/Penalty scores for the SELECTED team
                if (selectedTeam === 'home') {
                    newHomeScore = homeScore + 1;
                    setHomeScore(newHomeScore);
                } else {
                    newAwayScore = awayScore + 1;
                    setAwayScore(newAwayScore);
                }
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
                    minute: minute,  // Actual match minute
                    second: second,  // Actual match second
                    teamId: selectedTeam === 'home' ? match.homeTeamId : match.awayTeamId,
                    playerId: isTeamEvent ? null : playerId,
                    relatedPlayerId: assistPlayerId || null,
                    detail: newEvent.detail,
                    value: isScoringEvent ? 1 : null,
                    loggerId: currentLogger?.id,
                    loggerName: currentLogger?.name,
                }),
            });

            // Update player statistics in real-time (only for player-specific events)
            if (!isTeamEvent) {
                await updatePlayerStats(type, playerId, assistPlayerId);
            }
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

            // Emit to socket server for remote clients
            emit('event:new', {
                matchId: match.id,
                event: {
                    ...newEvent,
                    createdAt: new Date(newEvent.createdAt).toISOString()
                }
            });

            if (isScoringEvent) {
                emit('match:score:updated', {
                    matchId: match.id,
                    homeScore: newHomeScore,
                    awayScore: newAwayScore
                });
            }
        }

        // Send push notifications to users following the teams
        try {
            let notificationEventType: 'GOAL' | 'RED_CARD' | 'YELLOW_CARD' | undefined;

            if (type === 'Goal' || type === 'Penalty') {
                notificationEventType = 'GOAL';
            } else if (type === 'Red Card') {
                notificationEventType = 'RED_CARD';
            } else if (type === 'Yellow Card') {
                notificationEventType = 'YELLOW_CARD';
            }

            if (notificationEventType) {
                await fetch('/api/notifications/match-event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        matchId: match.id,
                        homeTeamId: match.homeTeamId,
                        awayTeamId: match.awayTeamId,
                        eventType: notificationEventType,
                        playerName: player?.name,
                        teamName: selectedTeam === 'home' ? homeTeam?.name : awayTeam?.name,
                        minute,
                        homeScore: newHomeScore,
                        awayScore: newAwayScore,
                    }),
                });
                console.log(`✅ Push notification sent for ${notificationEventType}`);
            }
        } catch (error) {
            console.error('Failed to send push notification:', error);
            // Don't block event recording if notification fails
        }

        // Reset state
        setPendingEvent(null);
        setSelectedEventPlayer(null);
    };

    // Helper function to update player statistics
    const updatePlayerStats = async (eventType: FootballEventType, playerId: string, assistPlayerId?: string | null) => {
        try {
            const statsUpdate: any = {
                competition: match.competition,
                sport: match.sport,
            };

            // Determine what to increment based on event type
            switch (eventType) {
                case 'Goal':
                case 'Penalty':
                    statsUpdate.incrementGoals = 1;
                    break;
                case 'Yellow Card':
                    statsUpdate.incrementYellowCards = 1;
                    break;
                case 'Red Card':
                    statsUpdate.incrementRedCards = 1;
                    break;
                case 'Save':
                case 'Catch':
                    statsUpdate.incrementSaves = 1;
                    break;
                // Own goals don't count for the player
                case 'Own Goal':
                    return; // Don't update stats for own goals
            }

            // Update primary player stats
            if (Object.keys(statsUpdate).length > 2) { // More than just competition and sport
                await fetch(`/api/players/${playerId}/stats`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(statsUpdate),
                });
                console.log(`✅ Updated stats for player ${playerId}:`, statsUpdate);
            }

            // Update assist player stats if applicable
            if (assistPlayerId && (eventType === 'Goal' || eventType === 'Penalty')) {
                await fetch(`/api/players/${assistPlayerId}/stats`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        competition: match.competition,
                        sport: match.sport,
                        incrementAssists: 1,
                    }),
                });
                console.log(`✅ Updated assist stats for player ${assistPlayerId}`);
            }
        } catch (error) {
            console.error('Failed to update player stats:', error);
            // Don't throw - stats can be recalculated later
        }
    };

    const undoLastEvent = () => {
        if (events.length === 0) return;
        const lastEvent = events[events.length - 1];

        // Revert score if it was a scoring event
        if (['Goal', 'Penalty', 'Own Goal'].includes(lastEvent.type)) {
            if (lastEvent.type === 'Own Goal') {
                // Revert OPPONENT score
                if (lastEvent.teamId === match.homeTeamId) {
                    setAwayScore(awayScore - 1);
                } else {
                    setHomeScore(homeScore - 1);
                }
            } else {
                // Revert TEAM score
                if (lastEvent.teamId === match.homeTeamId) {
                    setHomeScore(homeScore - 1);
                } else {
                    setAwayScore(awayScore - 1);
                }
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

                // Emit final status
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('MATCH_STATUS_CHANGE', {
                        detail: {
                            matchId: match.id,
                            status: 'FINISHED',
                            homeTeamId: match.homeTeamId,
                            awayTeamId: match.awayTeamId
                        }
                    }));

                    emit('match:status:change', {
                        matchId: match.id,
                        status: 'FINISHED'
                    });
                }

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
                                    onClick={async () => {
                                        console.log('⚽ [FOOTBALL] Button clicked! lineupSet:', lineupSet);
                                        if (!lineupSet) {
                                            console.log('✅ [FOOTBALL] Opening lineup modal...');
                                            setShowLineupModal(true);
                                        } else {
                                            console.log('▶️ [FOOTBALL] Starting match...');
                                            setMatchStarted(true);

                                            // Update match status in database to LIVE
                                            try {
                                                const response = await fetch(`/api/matches/${match.id}`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        status: 'LIVE',
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

                                                emit('match:status:change', {
                                                    matchId: match.id,
                                                    status: 'LIVE'
                                                });
                                            }

                                            // Send push notification for match start
                                            try {
                                                await fetch('/api/notifications/match-event', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        matchId: match.id,
                                                        homeTeamId: match.homeTeamId,
                                                        awayTeamId: match.awayTeamId,
                                                        eventType: 'MATCH_START',
                                                        teamName: `${homeTeam?.name} vs ${awayTeam?.name}`,
                                                    }),
                                                });
                                                console.log('✅ Match start notification sent');
                                            } catch (error) {
                                                console.error('Failed to send match start notification:', error);
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
                                            onClick={() => {
                                                setHalf(h);
                                                // Reset time when changing halves
                                                setMinute(0);
                                                setSecond(0);
                                                setExtraTime(0);
                                                // Broadcast time update when half changes
                                                if (typeof window !== 'undefined') {
                                                    window.dispatchEvent(new CustomEvent('MATCH_TIME_UPDATE', {
                                                        detail: {
                                                            matchId: match.id,
                                                            minute: 0,
                                                            extraTime: 0,
                                                            half: h,
                                                        }
                                                    }));
                                                    emit('match:time:update', {
                                                        matchId: match.id,
                                                        minute: 0,
                                                        extraTime: 0,
                                                        half: h,
                                                    });
                                                }
                                            }}
                                            className={`w-12 h-12 rounded-xl font-display text-xl transition-all ${half === h ? 'bg-primary text-black' : 'bg-white/5 text-white/40'
                                                }`}
                                        >
                                            {h}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center justify-center gap-3 text-4xl font-display italic">
                                    <Clock size={32} className="text-primary" />
                                    {minute}:{second.toString().padStart(2, '0')}{extraTime > 0 && <span className="text-2xl text-orange-500">+{extraTime}</span>}
                                    {matchStarted && !matchEnded && (
                                        <button
                                            onClick={() => setTimerRunning(!timerRunning)}
                                            className="ml-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                                            title={timerRunning ? 'Pause Timer' : 'Start Timer'}
                                        >
                                            {timerRunning ? (
                                                <Pause size={20} className="text-primary" />
                                            ) : (
                                                <Play size={20} className="text-primary" />
                                            )}
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max={halfDuration}
                                    value={minute}
                                    onChange={(e) => {
                                        const newMinute = parseInt(e.target.value);
                                        setMinute(newMinute);
                                        // Reset extra time if going back below half duration
                                        const newExtraTime = newMinute < halfDuration ? 0 : extraTime;
                                        if (newMinute < halfDuration) {
                                            setExtraTime(0);
                                        }
                                        // Broadcast time update
                                        if (typeof window !== 'undefined') {
                                            window.dispatchEvent(new CustomEvent('MATCH_TIME_UPDATE', {
                                                detail: {
                                                    matchId: match.id,
                                                    minute: newMinute,
                                                    extraTime: newExtraTime,
                                                    half,
                                                }
                                            }));
                                            emit('match:time:update', {
                                                matchId: match.id,
                                                minute: newMinute,
                                                extraTime: newExtraTime,
                                                half,
                                            });
                                        }
                                    }}
                                    className="w-full h-1 bg-white/10 rounded-full appearance-none accent-primary cursor-pointer"
                                />
                                {/* Extra Time Controls - Show when at half duration */}
                                {minute >= halfDuration && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Injury Time:</span>
                                        <button
                                            onClick={() => {
                                                const newExtraTime = Math.max(0, extraTime - 1);
                                                setExtraTime(newExtraTime);
                                                // Broadcast time update
                                                if (typeof window !== 'undefined') {
                                                    window.dispatchEvent(new CustomEvent('MATCH_TIME_UPDATE', {
                                                        detail: {
                                                            matchId: match.id,
                                                            minute: halfDuration,
                                                            extraTime: newExtraTime,
                                                            half,
                                                        }
                                                    }));
                                                    emit('match:time:update', {
                                                        matchId: match.id,
                                                        minute: halfDuration,
                                                        extraTime: newExtraTime,
                                                        half,
                                                    });
                                                }
                                            }}
                                            className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all flex items-center justify-center"
                                        >
                                            -
                                        </button>
                                        <span className="text-lg font-display text-orange-500 w-8 text-center">+{extraTime}</span>
                                        <button
                                            onClick={() => {
                                                // Continue past extra time - move to next minute
                                                const newMinute = halfDuration + 1;
                                                setMinute(newMinute);
                                                setExtraTime(0);
                                                // Broadcast time update
                                                if (typeof window !== 'undefined') {
                                                    window.dispatchEvent(new CustomEvent('MATCH_TIME_UPDATE', {
                                                        detail: {
                                                            matchId: match.id,
                                                            minute: newMinute,
                                                            extraTime: 0,
                                                            half,
                                                        }
                                                    }));
                                                    emit('match:time:update', {
                                                        matchId: match.id,
                                                        minute: newMinute,
                                                        extraTime: 0,
                                                        half,
                                                    });
                                                }
                                            }}
                                            className="bg-green-500 text-black px-6 py-3 rounded-2xl hover:scale-105 transition-all font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                        >
                                            <Play size={20} />
                                            Continue
                                        </button>
                                        <button
                                            onClick={() => {
                                                const newExtraTime = extraTime + 1;
                                                setExtraTime(newExtraTime);
                                                // Broadcast time update
                                                if (typeof window !== 'undefined') {
                                                    window.dispatchEvent(new CustomEvent('MATCH_TIME_UPDATE', {
                                                        detail: {
                                                            matchId: match.id,
                                                            minute: halfDuration,
                                                            extraTime: newExtraTime,
                                                            half,
                                                        }
                                                    }));
                                                    emit('match:time:update', {
                                                        matchId: match.id,
                                                        minute: halfDuration,
                                                        extraTime: newExtraTime,
                                                        half,
                                                    });
                                                }
                                            }}
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
                        <div className="space-y-3 sm:space-y-4">
                            {/* Team Toggle - Mobile Optimized */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-0 sm:flex sm:bg-white/5 sm:p-1 sm:rounded-xl sm:border sm:border-white/10">
                                <button
                                    onClick={() => setSelectedTeam('home')}
                                    className={`flex items-center justify-center gap-2 py-3 sm:py-3 px-4 rounded-lg sm:rounded-lg transition-all ${selectedTeam === 'home'
                                        ? 'bg-primary text-black scale-105'
                                        : 'bg-white/5 sm:bg-transparent text-white/40 border border-white/10 sm:border-0'
                                        }`}
                                >
                                    {homeTeam?.logo ? (
                                        <img src={homeTeam.logo} alt={homeTeam.name} className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
                                    ) : (
                                        <span className="text-xl sm:text-2xl">⚽</span>
                                    )}
                                    <span className="font-black uppercase tracking-widest text-xs sm:text-base">{homeTeam?.shortName}</span>
                                </button>
                                <button
                                    onClick={() => setSelectedTeam('away')}
                                    className={`flex items-center justify-center gap-2 py-3 sm:py-3 px-4 rounded-lg sm:rounded-lg transition-all ${selectedTeam === 'away'
                                        ? 'bg-primary text-black scale-105'
                                        : 'bg-white/5 sm:bg-transparent text-white/40 border border-white/10 sm:border-0'
                                        }`}
                                >
                                    {awayTeam?.logo ? (
                                        <img src={awayTeam.logo} alt={awayTeam.name} className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
                                    ) : (
                                        <span className="text-xl sm:text-2xl">⚽</span>
                                    )}
                                    <span className="font-black uppercase tracking-widest text-xs sm:text-base">{awayTeam?.shortName}</span>
                                </button>
                            </div>

                            {/* UNIFIED EVENT PANEL - ALL 24 EVENTS */}
                            <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-[24px] p-3 sm:p-6">
                                <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-white/60 mb-3 sm:mb-4">
                                    UNIFIED EVENT PANEL
                                </h3>

                                {/* Event Grid - Responsive columns */}
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                                    {/* SCORING (3) */}
                                    {/* Goal */}
                                    <button
                                        onClick={() => handleEventClick('Goal', true)}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-green-500/10 hover:border-green-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">⚽</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Goal</span>
                                    </button>

                                    {/* Penalty */}
                                    <button
                                        onClick={() => handleEventClick('Penalty', true)}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-orange-500/10 hover:border-orange-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🎯</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Penalty</span>
                                    </button>

                                    {/* Own Goal */}
                                    <button
                                        onClick={() => handleEventClick('Own Goal', true)}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-red-500/10 hover:border-red-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">⚽</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Own Goal</span>
                                    </button>

                                    {/* GOALKEEPER (2) */}
                                    {/* Save */}
                                    <button
                                        onClick={() => handleEventClick('Save')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🧤</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Save</span>
                                    </button>

                                    {/* Catch */}
                                    <button
                                        onClick={() => handleEventClick('Catch')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🤲</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Catch</span>
                                    </button>

                                    {/* DEFENSE (4) */}
                                    {/* Block */}
                                    <button
                                        onClick={() => handleEventClick('Block')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🚫</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Block</span>
                                    </button>

                                    {/* Interception */}
                                    <button
                                        onClick={() => handleEventClick('Interception')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🛡️</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Intercept</span>
                                    </button>

                                    {/* Clearance */}
                                    <button
                                        onClick={() => handleEventClick('Clearance')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🦶</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Clear</span>
                                    </button>

                                    {/* Tackle */}
                                    <button
                                        onClick={() => handleEventClick('Tackle')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">💪</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Tackle</span>
                                    </button>

                                    {/* SHOOTING (3) */}
                                    {/* Shot */}
                                    <button
                                        onClick={() => handleEventClick('Shot')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">⚡</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Shot</span>
                                    </button>

                                    {/* Shot On Target */}
                                    <button
                                        onClick={() => handleEventClick('Shot on Target')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🎯</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Shot On</span>
                                    </button>

                                    {/* Shot Off Target */}
                                    <button
                                        onClick={() => handleEventClick('Shot off Target')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">❌</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Shot Off</span>
                                    </button>

                                    {/* SET PIECES (5) */}
                                    {/* Corner */}
                                    <button
                                        onClick={() => handleEventClick('Corner')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🚩</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Corner</span>
                                    </button>

                                    {/* Free Kick */}
                                    <button
                                        onClick={() => handleEventClick('Free Kick')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🦶</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Free Kick</span>
                                    </button>

                                    {/* Throw In */}
                                    <button
                                        onClick={() => handleEventClick('Throw In')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">👐</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Throw-in</span>
                                    </button>

                                    {/* Goal Kick */}
                                    <button
                                        onClick={() => handleEventClick('Goal Kick')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🥅</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Goal Kick</span>
                                    </button>

                                    {/* Offside */}
                                    <button
                                        onClick={() => handleEventClick('Offside')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🚩</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Offside</span>
                                    </button>

                                    {/* DISCIPLINE (5) */}
                                    {/* Foul */}
                                    <button
                                        onClick={() => handleEventClick('Foul')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">⚠️</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Foul</span>
                                    </button>

                                    {/* Push */}
                                    <button
                                        onClick={() => handleEventClick('Push')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🤚</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Push</span>
                                    </button>

                                    {/* Handball */}
                                    <button
                                        onClick={() => handleEventClick('Handball')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">✋</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Handball</span>
                                    </button>

                                    {/* Yellow Card */}
                                    <button
                                        onClick={() => handleEventClick('Yellow Card')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-yellow-500/10 hover:border-yellow-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🟨</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Yellow</span>
                                    </button>

                                    {/* Red Card */}
                                    <button
                                        onClick={() => handleEventClick('Red Card')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-red-500/10 hover:border-red-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🟥</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Red</span>
                                    </button>

                                    {/* TEAM ACTIONS (2) */}
                                    {/* Substitution */}
                                    <button
                                        onClick={() => handleEventClick('Substitution')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🔄</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Sub</span>
                                    </button>

                                    {/* Assist */}
                                    <button
                                        onClick={() => handleEventClick('Assist')}
                                        disabled={!matchStarted || matchEnded}
                                        className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
                                    >
                                        <span className="text-2xl sm:text-3xl mb-1">🤝</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Assist</span>
                                    </button>
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
                    players={
                        selectedTeam === 'home'
                            ? homePlayers.filter(p => homeStarters.includes(p.id))
                            : awayPlayers.filter(p => awayStarters.includes(p.id))
                    }
                    onSelect={handlePlayerSelect}
                    onClose={() => {
                        setShowPlayerModal(false);
                        setPendingEvent(null);
                    }}
                    title={`Select Player - ${pendingEvent?.type}`}
                />
            )}

            {/* Assist Modal */}
            {/* Assist Modal */}
            {showAssistModal && (
                <AssistModal
                    players={
                        selectedTeam === 'home'
                            ? homePlayers.filter(p => homeStarters.includes(p.id))
                            : awayPlayers.filter(p => awayStarters.includes(p.id))
                    }
                    onSelect={handleAssistSelect}
                    onClose={() => {
                        setShowAssistModal(false);
                        handleAssistSelect(null);
                    }}
                />
            )}

            {/* Sub In Modal - Select incoming player */}
            {showSubInModal && (
                <PlayerSelectionModal
                    players={
                        selectedTeam === 'home'
                            ? homePlayers.filter(p => !homeStarters.includes(p.id))
                            : awayPlayers.filter(p => !awayStarters.includes(p.id))
                    }
                    onSelect={handleSubIn}
                    onClose={() => {
                        setShowSubInModal(false);
                        setPlayerComingOut(null);
                        setPendingEvent(null);
                    }}
                    title="Select Player Coming IN"
                />
            )}

            {/* Lineup Selection Modal - Football (11 players) */}
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
                                    <p className="text-sm text-white/40">Select 11 starters for each team before starting the match</p>
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
                                            <span className="text-3xl">⚽</span>
                                        )}
                                        <div>
                                            <h3 className="text-xl font-black uppercase">{homeTeam?.name}</h3>
                                            <p className="text-xs text-white/40">
                                                {homeStarters.length}/11 Starters Selected
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                                        {homePlayers.map((player) => {
                                            const isStarter = homeStarters.includes(player.id);
                                            return (
                                                <button
                                                    key={player.id}
                                                    onClick={() => {
                                                        if (isStarter) {
                                                            setHomeStarters(homeStarters.filter(id => id !== player.id));
                                                        } else if (homeStarters.length < 11) {
                                                            // Check for GK limit
                                                            const isGK = player.position === 'GK' || player.position === 'Goalkeeper';
                                                            if (isGK) {
                                                                const hasGK = homeStarters.some(id => {
                                                                    const p = homePlayers.find(p => p.id === id);
                                                                    return p?.position === 'GK' || p?.position === 'Goalkeeper';
                                                                });
                                                                if (hasGK) {
                                                                    alert('Only one Goalkeeper is allowed in the starting lineup.');
                                                                    return;
                                                                }
                                                            }
                                                            setHomeStarters([...homeStarters, player.id]);
                                                            setHomeSubs(homeSubs.filter(id => id !== player.id));
                                                        }
                                                    }}
                                                    className={`w-full border rounded-xl p-4 transition-all text-left ${isStarter
                                                        ? 'bg-green-500/20 border-green-500'
                                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-10 h-10 rounded-full flex items-center justify-center font-display text-lg font-bold border-2"
                                                                style={{
                                                                    backgroundColor: homeTeam?.color,
                                                                    borderColor: isStarter ? '#22c55e' : 'rgba(255,255,255,0.3)',
                                                                }}
                                                            >
                                                                {player.number}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black uppercase">{player.jerseyName || player.name}</p>
                                                                <p className="text-xs text-white/40">{player.position}</p>
                                                            </div>
                                                        </div>
                                                        {isStarter && (
                                                            <span className="text-xs font-black uppercase tracking-widest text-green-500">STARTER</span>
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
                                            <span className="text-3xl">⚽</span>
                                        )}
                                        <div>
                                            <h3 className="text-xl font-black uppercase">{awayTeam?.name}</h3>
                                            <p className="text-xs text-white/40">
                                                {awayStarters.length}/11 Starters Selected
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                                        {awayPlayers.map((player) => {
                                            const isStarter = awayStarters.includes(player.id);
                                            return (
                                                <button
                                                    key={player.id}
                                                    onClick={() => {
                                                        if (isStarter) {
                                                            setAwayStarters(awayStarters.filter(id => id !== player.id));
                                                        } else if (awayStarters.length < 11) {
                                                            // Check for GK limit
                                                            const isGK = player.position === 'GK' || player.position === 'Goalkeeper';
                                                            if (isGK) {
                                                                const hasGK = awayStarters.some(id => {
                                                                    const p = awayPlayers.find(p => p.id === id);
                                                                    return p?.position === 'GK' || p?.position === 'Goalkeeper';
                                                                });
                                                                if (hasGK) {
                                                                    alert('Only one Goalkeeper is allowed in the starting lineup.');
                                                                    return;
                                                                }
                                                            }
                                                            setAwayStarters([...awayStarters, player.id]);
                                                            setAwaySubs(awaySubs.filter(id => id !== player.id));
                                                        }
                                                    }}
                                                    className={`w-full border rounded-xl p-4 transition-all text-left ${isStarter
                                                        ? 'bg-green-500/20 border-green-500'
                                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-10 h-10 rounded-full flex items-center justify-center font-display text-lg font-bold border-2"
                                                                style={{
                                                                    backgroundColor: awayTeam?.color,
                                                                    borderColor: isStarter ? '#22c55e' : 'rgba(255,255,255,0.3)',
                                                                }}
                                                            >
                                                                {player.number}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black uppercase">{player.jerseyName || player.name}</p>
                                                                <p className="text-xs text-white/40">{player.position}</p>
                                                            </div>
                                                        </div>
                                                        {isStarter && (
                                                            <span className="text-xs font-black uppercase tracking-widest text-green-500">STARTER</span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center justify-between gap-4">
                                <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                    <p className="text-xs font-black uppercase tracking-widest text-green-500 mb-2">Lineup Status</p>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-white/40 text-xs">{homeTeam?.shortName} Starters</p>
                                            <p className="font-bold text-white">{homeStarters.length}/11</p>
                                        </div>
                                        <div>
                                            <p className="text-white/40 text-xs">{awayTeam?.shortName} Starters</p>
                                            <p className="font-bold text-white">{awayStarters.length}/11</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (homeStarters.length === 11 && awayStarters.length === 11) {
                                            // Set remaining players as subs
                                            const homeSubIds = homePlayers.filter(p => !homeStarters.includes(p.id)).map(p => p.id);
                                            const awaySubIds = awayPlayers.filter(p => !awayStarters.includes(p.id)).map(p => p.id);

                                            setHomeSubs(homeSubIds);
                                            setAwaySubs(awaySubIds);
                                            setLineupSet(true);
                                            setShowLineupModal(false);

                                            // Publish lineups to server
                                            try {
                                                // Prepare home lineup with proper structure
                                                const homeLineupData = {
                                                    formation: '4-3-3', // Default formation
                                                    starters: homeStarters.map((id, index) => {
                                                        const player = homePlayers.find(p => p.id === id);
                                                        return {
                                                            playerId: id,
                                                            position: player?.position || 'Unknown',
                                                            jerseyNumber: player?.number || 0,
                                                            isCaptain: index === 0, // First player is captain by default
                                                            isViceCaptain: false,
                                                            jerseyName: player?.jerseyName || player?.name
                                                        };
                                                    }),
                                                    substitutes: homeSubIds.map(id => {
                                                        const player = homePlayers.find(p => p.id === id);
                                                        return {
                                                            playerId: id,
                                                            position: player?.position || 'Unknown',
                                                            jerseyNumber: player?.number || 0,
                                                            jerseyName: player?.jerseyName || player?.name
                                                        };
                                                    }),
                                                    status: 'published',
                                                    publishedAt: new Date().toISOString()
                                                };

                                                // Prepare away lineup with proper structure
                                                const awayLineupData = {
                                                    formation: '4-3-3', // Default formation
                                                    starters: awayStarters.map((id, index) => {
                                                        const player = awayPlayers.find(p => p.id === id);
                                                        return {
                                                            playerId: id,
                                                            position: player?.position || 'Unknown',
                                                            jerseyNumber: player?.number || 0,
                                                            isCaptain: index === 0, // First player is captain by default
                                                            isViceCaptain: false,
                                                            jerseyName: player?.jerseyName || player?.name
                                                        };
                                                    }),
                                                    substitutes: awaySubIds.map(id => {
                                                        const player = awayPlayers.find(p => p.id === id);
                                                        return {
                                                            playerId: id,
                                                            position: player?.position || 'Unknown',
                                                            jerseyNumber: player?.number || 0,
                                                            jerseyName: player?.jerseyName || player?.name
                                                        };
                                                    }),
                                                    status: 'published',
                                                    publishedAt: new Date().toISOString()
                                                };

                                                // Save and publish home lineup
                                                const homeResponse = await fetch(`/api/matches/${match.id}/lineup`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        team: 'home',
                                                        lineup: homeLineupData
                                                    })
                                                });

                                                // Save and publish away lineup
                                                const awayResponse = await fetch(`/api/matches/${match.id}/lineup`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        team: 'away',
                                                        lineup: awayLineupData
                                                    })
                                                });

                                                if (homeResponse.ok && awayResponse.ok) {
                                                    console.log('✅ Lineups published successfully');

                                                    // Broadcast lineup update event
                                                    if (typeof window !== 'undefined') {
                                                        window.dispatchEvent(new CustomEvent('LINEUP_PUBLISHED', {
                                                            detail: {
                                                                matchId: match.id,
                                                                home: homeLineupData,
                                                                away: awayLineupData
                                                            }
                                                        }));
                                                    }
                                                } else {
                                                    console.error('❌ Failed to publish lineups');
                                                    alert('Failed to publish lineups. Please try again.');
                                                }
                                            } catch (error) {
                                                console.error('Error publishing lineups:', error);
                                                alert('Error publishing lineups. Please check console for details.');
                                            }
                                        }
                                    }}
                                    disabled={homeStarters.length !== 11 || awayStarters.length !== 11}
                                    className="px-8 py-4 bg-green-500 text-black rounded-xl font-black uppercase tracking-widest hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                >
                                    Confirm Lineup & Start
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Settings Modal */}
            {showSettingsModal && (
                <SettingsModal
                    halfDuration={halfDuration}
                    setHalfDuration={setHalfDuration}
                    onClose={() => setShowSettingsModal(false)}
                />
            )}

            {/* Finish Match Confirmation Modal */}
            {showFinishModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 max-w-md w-full text-center"
                    >
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center">
                                <Trophy size={32} />
                            </div>
                        </div>
                        <h3 className="text-2xl font-display italic uppercase mb-2">Finish Match?</h3>
                        <p className="text-white/60 mb-8">
                            Are you sure you want to finish this match? This action cannot be undone.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setShowFinishModal(false)}
                                className="bg-white/5 text-white border border-white/10 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    finalizeMatch();
                                    setShowFinishModal(false);
                                }}
                                className="bg-blue-500 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:scale-105 transition-all"
                            >
                                Confirm Finish
                            </button>
                        </div>
                    </motion.div>
                </div>
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
            className={`${color} flex flex-col items-center justify-center gap-2 p-4 min-h-[80px] rounded-[20px] hover:scale-105 transition-all active:scale-95 border disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation`}
        >
            <div className="opacity-80">{icon}</div>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-tight text-center leading-tight">{label}</span>
        </button>
    );
}

function SimpleActionButton({ label, onClick, matchStarted, matchEnded }: any) {
    return (
        <button
            onClick={onClick}
            disabled={!matchStarted || matchEnded}
            className="bg-white/5 text-white/60 border border-white/10 p-4 min-h-[60px] rounded-[20px] hover:bg-white/10 hover:text-white active:bg-white/15 transition-all text-[10px] sm:text-xs font-black uppercase tracking-tight disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
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
                            <p className="text-sm font-bold">{player.jerseyName || player.name}</p>
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
                            <p className="text-sm font-bold">{player.jerseyName || player.name}</p>
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
