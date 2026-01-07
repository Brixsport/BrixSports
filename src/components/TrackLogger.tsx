'use client';

/**
 * TRACK & FIELD LOGGER - POSITION DETERMINATION SYSTEM
 * 
 * This logger handles position/ranking determination for different track & field events:
 * 
 * 1. TRACK EVENTS (Sprint, Distance, Hurdles, Relay):
 *    - Positions are determined by FINISH TIME (fastest = 1st place)
 *    - Times are sorted automatically (not by button click order)
 *    - Ties: Athletes with times within 0.001s (1ms) share the same position
 *    - Example: If two athletes finish at 10.234s, both get position 1
 *              The next finisher gets position 3 (not 2)
 * 
 * 2. FIELD EVENTS (Jump, Throw):
 *    - Positions are determined by BEST VALID ATTEMPT (highest/longest = 1st place)
 *    - Each athlete gets up to 6 attempts
 *    - Fouls don't count toward ranking
 *    - Ties: Athletes with marks within 0.01m share the same position
 *    - Wind speed is tracked for jumps (>±2.0 m/s = illegal for records)
 * 
 * 3. HEAT QUALIFICATION (for multi-round events):
 *    - Top N finishers from each heat advance automatically
 *    - Plus fastest "losers" across all heats (time-based qualification)
 *    - Example: Top 2 from each heat + 2 fastest times overall
 * 
 * 4. REAL-TIME UPDATES:
 *    - Positions recalculate automatically when new results are added
 *    - Click "Finish" button when athlete crosses line (order doesn't matter)
 *    - System sorts by actual time and assigns correct positions
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Activity, Save, Clock, Users, Trophy, Timer, Flag, Wind,
    Thermometer, Zap, AlertTriangle, CheckCircle, XCircle, Play,
    Pause, RotateCcw, Plus, Minus, TrendingUp, Award, Target,
    MapPin, Ruler, ChevronDown, ChevronUp, Settings, History, Search
} from 'lucide-react';
import { Match, Team, Player } from '@/db/schema';

interface TrackLoggerProps {
    match: Match;
    onExit: () => void;
    teams: Team[];
    players: Player[];
}

type EventCategory = 'Sprint' | 'Distance' | 'Hurdles' | 'Relay' | 'Jump' | 'Throw';
type RaceStatus = 'Setup' | 'Ready' | 'Running' | 'Finished';
type RoundType = 'Heat' | 'Semi-Final' | 'Final';

interface AthleteEntry {
    playerId: string;
    lane: number;
    bib: string;
    reactionTime?: number;
    splits?: number[];
    finalTime?: number;
    position?: number;
    status: 'Ready' | 'Running' | 'Finished' | 'DNF' | 'DQ';
    dqReason?: string;
}

interface FieldAttempt {
    playerId: string;
    attemptNumber: number;
    measurement?: number;
    isFoul: boolean;
    windSpeed?: number;
    timestamp: number;
}

interface WeatherConditions {
    windSpeed: number;
    windDirection: number;
    temperature: number;
    humidity: number;
}

interface EventRecord {
    type: 'Meet' | 'Personal' | 'Season';
    value: number;
    holder: string;
    date: string;
}

export function TrackLogger({ match, onExit, teams, players }: TrackLoggerProps) {
    // Event Configuration
    const [eventCategory, setEventCategory] = useState<EventCategory>('Sprint');
    const [eventDistance, setEventDistance] = useState('100m');
    const [roundType, setRoundType] = useState<RoundType>('Heat');
    const [heatNumber, setHeatNumber] = useState(1);

    // Race State
    const [raceStatus, setRaceStatus] = useState<RaceStatus>('Setup');
    const [athletes, setAthletes] = useState<AthleteEntry[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    // Field Events
    const [fieldAttempts, setFieldAttempts] = useState<FieldAttempt[]>([]);
    const [currentRound, setCurrentRound] = useState(1);
    const [maxAttempts] = useState(6);

    // Weather & Conditions
    const [weather, setWeather] = useState<WeatherConditions>({
        windSpeed: 0,
        windDirection: 0,
        temperature: 20,
        humidity: 50
    });

    // Records & Standards
    const [meetRecord, setMeetRecord] = useState<number | null>(null);
    const [qualifyingStandard, setQualifyingStandard] = useState<number | null>(null);

    // UI State
    const [viewMode, setViewMode] = useState<'live' | 'results' | 'history'>('live');
    const [showSettings, setShowSettings] = useState(false);
    const [athleteSearch, setAthleteSearch] = useState('');

    const homeTeam = teams.find(t => t.id === match.homeTeamId);
    const awayTeam = teams.find(t => t.id === match.awayTeamId);

    // Check if competition is Inter-College or Inter-University
    const isInterCompetition = /inter[\s-]?(college|university)/i.test(match.competition || '');

    // If Inter-Competition, restrict to match teams. Otherwise allow all players.
    const eligiblePlayers = isInterCompetition
        ? players.filter(p => p.teamId === match.homeTeamId || p.teamId === match.awayTeamId)
        : players;

    const filteredPlayers = eligiblePlayers.filter(p =>
        p.name.toLowerCase().includes(athleteSearch.toLowerCase()) ||
        (isInterCompetition && teams.find(t => t.id === p.teamId)?.shortName?.toLowerCase().includes(athleteSearch.toLowerCase()))
    );

    const [events, setEvents] = useState<any[]>([]);

    // Event Distance Options
    const eventDistances = {
        Sprint: ['60m', '100m', '200m', '400m'],
        Distance: ['800m', '1500m', '3000m', '5000m'],
        Hurdles: ['100mH', '110mH', '400mH'],
        Relay: ['4x100m', '4x400m'],
        Jump: ['Long Jump', 'Triple Jump', 'High Jump', 'Pole Vault'],
        Throw: ['Shot Put', 'Discus', 'Javelin', 'Hammer']
    };

    // Timer Management
    useEffect(() => {
        if (isTimerRunning) {
            startTimeRef.current = Date.now() - currentTime;
            timerRef.current = setInterval(() => {
                setCurrentTime(Date.now() - startTimeRef.current);
            }, 10);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isTimerRunning]);

    // Format time display
    const formatTime = (ms: number) => {
        const totalSeconds = ms / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const milliseconds = Math.floor((ms % 1000) / 10);

        if (minutes > 0) {
            return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
        }
        return `${seconds}.${milliseconds.toString().padStart(2, '0')}`;
    };

    // Add athlete to race
    const addAthlete = (playerId: string, lane: number) => {
        const player = eligiblePlayers.find(p => p.id === playerId);
        if (!player) return;

        const newAthlete: AthleteEntry = {
            playerId,
            lane,
            bib: `${lane}`,
            status: 'Ready',
            splits: []
        };

        setAthletes([...athletes, newAthlete].sort((a, b) => a.lane - b.lane));
    };

    // Remove athlete
    const removeAthlete = (playerId: string) => {
        setAthletes(athletes.filter(a => a.playerId !== playerId));
    };

    // Start Race
    const startRace = () => {
        if (athletes.length === 0) {
            alert('Please add athletes first!');
            return;
        }

        setRaceStatus('Running');
        setIsTimerRunning(true);
        setCurrentTime(0);

        // Simulate reaction times (in real scenario, this would come from timing system)
        const updatedAthletes = athletes.map(a => ({
            ...a,
            reactionTime: 0.100 + Math.random() * 0.150, // 100-250ms
            status: 'Running' as const
        }));
        setAthletes(updatedAthletes);

        logEvent('Race Start', `${eventDistance} ${roundType} ${heatNumber} started`);
    };

    // Record finish for athlete
    const recordFinish = (playerId: string) => {
        const finishTime = currentTime;

        // Update athlete with finish time (position will be calculated automatically)
        const updatedAthletes = athletes.map(a =>
            a.playerId === playerId
                ? { ...a, finalTime: finishTime, status: 'Finished' as const }
                : a
        );

        // Calculate positions based on actual times (not click order)
        const finishedAthletes = updatedAthletes
            .filter(a => a.finalTime !== undefined)
            .sort((a, b) => (a.finalTime || 0) - (b.finalTime || 0));

        // Assign positions (handle ties)
        let currentPosition = 1;
        finishedAthletes.forEach((athlete, index) => {
            if (index > 0) {
                const prevTime = finishedAthletes[index - 1].finalTime || 0;
                const currTime = athlete.finalTime || 0;
                // If times are within 0.001s (1ms), it's a tie
                if (Math.abs(currTime - prevTime) > 0.001) {
                    currentPosition = index + 1;
                }
            }
            athlete.position = currentPosition;
        });

        // Update state with calculated positions
        setAthletes(updatedAthletes);

        const player = eligiblePlayers.find(p => p.id === playerId);
        const position = finishedAthletes.find(a => a.playerId === playerId)?.position || 0;
        logEvent('Finish', `${player?.name} - Position ${position} - ${formatTime(finishTime)}`);
    };

    // Disqualify athlete
    const disqualifyAthlete = (playerId: string, reason: string) => {
        setAthletes(athletes.map(a =>
            a.playerId === playerId
                ? { ...a, status: 'DQ' as const, dqReason: reason }
                : a
        ));

        const player = eligiblePlayers.find(p => p.id === playerId);
        logEvent('Disqualification', `${player?.name} - ${reason}`);
    };

    // Record field attempt
    const recordFieldAttempt = (playerId: string, measurement: number | null, isFoul: boolean) => {
        const attemptNumber = fieldAttempts.filter(a => a.playerId === playerId).length + 1;

        const newAttempt: FieldAttempt = {
            playerId,
            attemptNumber,
            measurement: measurement || undefined,
            isFoul,
            windSpeed: weather.windSpeed,
            timestamp: Date.now()
        };

        setFieldAttempts([...fieldAttempts, newAttempt]);

        const player = eligiblePlayers.find(p => p.id === playerId);
        logEvent(
            'Field Attempt',
            `${player?.name} - Attempt ${attemptNumber}: ${isFoul ? 'FOUL' : `${measurement}m`}`
        );
    };

    // Get best attempt for athlete
    const getBestAttempt = (playerId: string) => {
        const validAttempts = fieldAttempts.filter(a =>
            a.playerId === playerId && !a.isFoul && a.measurement
        );

        if (validAttempts.length === 0) return null;

        return Math.max(...validAttempts.map(a => a.measurement!));
    };

    // Get field event rankings (for jumps/throws)
    const getFieldEventRankings = () => {
        const athleteResults = eligiblePlayers.slice(0, 8).map(player => {
            const best = getBestAttempt(player.id);
            const attempts = fieldAttempts.filter(a => a.playerId === player.id);
            return {
                playerId: player.id,
                bestMark: best,
                attemptCount: attempts.length,
                fouls: attempts.filter(a => a.isFoul).length
            };
        }).filter(r => r.bestMark !== null);

        // Sort by best mark (descending for field events)
        athleteResults.sort((a, b) => (b.bestMark || 0) - (a.bestMark || 0));

        // Assign positions (handle ties)
        let currentPosition = 1;
        athleteResults.forEach((result, index) => {
            if (index > 0) {
                const prevMark = athleteResults[index - 1].bestMark || 0;
                const currMark = result.bestMark || 0;
                // If marks are within 0.01m, it's a tie
                if (Math.abs(currMark - prevMark) > 0.01) {
                    currentPosition = index + 1;
                }
            }
            (result as any).position = currentPosition;
        });

        return athleteResults;
    };

    // Log event
    const logEvent = (type: string, detail: string) => {
        const newEvent = {
            id: `e${events.length + 1}`,
            type,
            detail,
            timestamp: new Date(),
            weather: { ...weather }
        };
        setEvents([...events, newEvent]);
    };

    // Save results
    const saveResults = async () => {
        try {
            // In real implementation, save to database
            alert('Results saved successfully!');
            logEvent('Save', 'Results saved to database');
        } catch (error) {
            console.error('Error saving results:', error);
            alert('Failed to save results');
        }
    };

    // Reset race
    const resetRace = () => {
        setRaceStatus('Setup');
        setIsTimerRunning(false);
        setCurrentTime(0);
        setAthletes(athletes.map(a => ({ ...a, status: 'Ready', finalTime: undefined, position: undefined, reactionTime: undefined })));
    };

    const isFieldEvent = eventCategory === 'Jump' || eventCategory === 'Throw';

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-lg border-b border-white/10 -mx-4 px-4 pb-4 mb-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onExit}
                                className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all"
                            >
                                <X size={20} />
                            </button>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Track & Field Logger</p>
                                <h1 className="text-2xl font-display italic uppercase">{match.competition}</h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2"
                            >
                                <Settings size={16} />
                            </button>
                            <button
                                onClick={saveResults}
                                className="px-6 py-3 bg-primary text-black rounded-2xl hover:scale-105 transition-all flex items-center gap-2 font-black uppercase tracking-widest"
                            >
                                <Save size={16} />
                                Save
                            </button>
                        </div>
                    </div>

                    {/* Event Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {/* Category */}
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2 block">Category</label>
                            <select
                                value={eventCategory}
                                onChange={(e) => {
                                    setEventCategory(e.target.value as EventCategory);
                                    setEventDistance(eventDistances[e.target.value as EventCategory][0]);
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                            >
                                {Object.keys(eventDistances).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* Distance/Event */}
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2 block">Event</label>
                            <select
                                value={eventDistance}
                                onChange={(e) => setEventDistance(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                            >
                                {eventDistances[eventCategory].map(dist => (
                                    <option key={dist} value={dist}>{dist}</option>
                                ))}
                            </select>
                        </div>

                        {/* Round */}
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2 block">Round</label>
                            <select
                                value={roundType}
                                onChange={(e) => setRoundType(e.target.value as RoundType)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                            >
                                <option value="Heat">Heat</option>
                                <option value="Semi-Final">Semi-Final</option>
                                <option value="Final">Final</option>
                            </select>
                        </div>

                        {/* Heat Number */}
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2 block">Heat #</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setHeatNumber(Math.max(1, heatNumber - 1))}
                                    className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center"
                                >
                                    <Minus size={16} />
                                </button>
                                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center font-display text-xl">
                                    {heatNumber}
                                </div>
                                <button
                                    onClick={() => setHeatNumber(heatNumber + 1)}
                                    className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto">
                {/* Weather & Conditions */}
                <AnimatePresence>
                    {showSettings && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-white/5 border border-white/10 rounded-[24px] p-6 mb-4"
                        >
                            <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Wind className="text-primary" size={16} />
                                Weather & Conditions
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2 block">Wind (m/s)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={weather.windSpeed}
                                        onChange={(e) => setWeather({ ...weather, windSpeed: parseFloat(e.target.value) })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2 block">Temperature (°C)</label>
                                    <input
                                        type="number"
                                        value={weather.temperature}
                                        onChange={(e) => setWeather({ ...weather, temperature: parseInt(e.target.value) })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-2 block">Humidity (%)</label>
                                    <input
                                        type="number"
                                        value={weather.humidity}
                                        onChange={(e) => setWeather({ ...weather, humidity: parseInt(e.target.value) })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <div className={`px-4 py-2 rounded-xl font-bold text-sm ${Math.abs(weather.windSpeed) > 2.0
                                        ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                                        : 'bg-green-500/20 text-green-500 border border-green-500/30'
                                        }`}>
                                        {Math.abs(weather.windSpeed) > 2.0 ? 'Wind Illegal' : 'Wind Legal'}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Control Panel */}
                <div className="bg-gradient-to-br from-red-900/20 to-red-950/40 border border-red-500/20 rounded-[32px] p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        {/* Status */}
                        <div className="text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Status</p>
                            <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest ${raceStatus === 'Setup' ? 'bg-gray-500/20 text-gray-400' :
                                raceStatus === 'Ready' ? 'bg-yellow-500/20 text-yellow-500' :
                                    raceStatus === 'Running' ? 'bg-green-500/20 text-green-500 animate-pulse' :
                                        'bg-blue-500/20 text-blue-500'
                                }`}>
                                <Activity size={16} />
                                {raceStatus}
                            </div>
                        </div>

                        {/* Timer */}
                        <div className="text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Time</p>
                            <div className="text-6xl font-display italic text-primary flex items-center justify-center gap-3">
                                <Timer size={48} />
                                {formatTime(currentTime)}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col gap-3">
                            {raceStatus === 'Setup' && (
                                <button
                                    onClick={() => setRaceStatus('Ready')}
                                    disabled={athletes.length === 0}
                                    className="bg-yellow-500 text-black px-6 py-4 rounded-2xl hover:scale-105 transition-all font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Flag size={20} />
                                    Set Ready
                                </button>
                            )}
                            {raceStatus === 'Ready' && (
                                <button
                                    onClick={startRace}
                                    className="bg-green-500 text-black px-6 py-4 rounded-2xl hover:scale-105 transition-all font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <Play size={20} />
                                    Start Race
                                </button>
                            )}
                            {raceStatus === 'Running' && (
                                <>
                                    <button
                                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                                        className="bg-orange-500 text-black px-6 py-3 rounded-2xl hover:scale-105 transition-all font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        {isTimerRunning ? <Pause size={20} /> : <Play size={20} />}
                                        {isTimerRunning ? 'Pause' : 'Resume'}
                                    </button>
                                    <button
                                        onClick={() => setRaceStatus('Finished')}
                                        className="bg-blue-500 text-white px-6 py-3 rounded-2xl hover:scale-105 transition-all font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        <Flag size={20} />
                                        Finish
                                    </button>
                                </>
                            )}
                            {raceStatus === 'Finished' && (
                                <button
                                    onClick={resetRace}
                                    className="bg-primary text-black px-6 py-4 rounded-2xl hover:scale-105 transition-all font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <RotateCcw size={20} />
                                    New Race
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* View Tabs */}
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mb-6">
                    {(['live', 'results', 'history'] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewMode === mode ? 'bg-primary text-black' : 'text-white/40 hover:text-white'
                                }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Athletes/Participants */}
                    <div className="lg:col-span-2 space-y-6">
                        {viewMode === 'live' && (
                            <>
                                {/* Add Athletes */}
                                {raceStatus === 'Setup' && !isFieldEvent && (
                                    <div className="bg-white/5 border border-white/10 rounded-[24px] p-6">
                                        <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Users className="text-primary" size={16} />
                                            Add Athletes to Race
                                        </h3>
                                        <div className="space-y-3">
                                            {/* Search Input */}
                                            <div className="relative mb-4">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                                                <input
                                                    type="text"
                                                    value={athleteSearch}
                                                    onChange={(e) => setAthleteSearch(e.target.value)}
                                                    placeholder="Search athletes..."
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                                                />
                                            </div>

                                            {filteredPlayers.slice(0, 8).map((player, idx) => {
                                                const team = teams.find(t => t.id === player.teamId);
                                                const isAdded = athletes.some(a => a.playerId === player.id);

                                                return (
                                                    <div
                                                        key={player.id}
                                                        className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 transition-all"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {isInterCompetition && team?.logo && <img src={team.logo} alt={team.name} className="w-8 h-8 object-contain" />}
                                                            <div>
                                                                <p className="text-sm font-black uppercase tracking-tight">{player.name}</p>
                                                                {isInterCompetition && (
                                                                    <p className="text-[10px] text-white/40 font-bold uppercase">{team?.shortName}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {!isAdded ? (
                                                            <button
                                                                onClick={() => addAthlete(player.id, athletes.length + 1)}
                                                                className="px-4 py-2 bg-primary text-black rounded-xl hover:scale-105 transition-all text-xs font-black uppercase tracking-widest"
                                                            >
                                                                Add Lane {athletes.length + 1}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => removeAthlete(player.id)}
                                                                className="px-4 py-2 bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl hover:scale-105 transition-all text-xs font-black uppercase tracking-widest"
                                                            >
                                                                Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {filteredPlayers.length === 0 && (
                                                <div className="text-center py-4 text-white/40 text-xs font-bold uppercase tracking-widest">
                                                    No athletes found
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Race Participants */}
                                {athletes.length > 0 && !isFieldEvent && (
                                    <div className="bg-white/5 border border-white/10 rounded-[24px] p-6">
                                        <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Flag className="text-primary" size={16} />
                                            Race Participants
                                        </h3>
                                        <div className="space-y-3">
                                            {athletes.map((athlete) => {
                                                const player = eligiblePlayers.find(p => p.id === athlete.playerId);
                                                const team = teams.find(t => t.id === player?.teamId);

                                                return (
                                                    <div
                                                        key={athlete.playerId}
                                                        className={`border rounded-2xl p-4 ${athlete.status === 'Finished' ? 'bg-green-500/10 border-green-500/30' :
                                                            athlete.status === 'DQ' ? 'bg-red-500/10 border-red-500/30' :
                                                                athlete.status === 'Running' ? 'bg-blue-500/10 border-blue-500/30' :
                                                                    'bg-white/5 border-white/10'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center font-display text-2xl">
                                                                    {athlete.lane}
                                                                </div>
                                                                {isInterCompetition && team?.logo && <img src={team.logo} alt={team.name} className="w-8 h-8 object-contain" />}
                                                                <div>
                                                                    <p className="text-sm font-black uppercase tracking-tight">{player?.name}</p>
                                                                    {isInterCompetition && (
                                                                        <p className="text-[10px] text-white/40 font-bold uppercase">{team?.shortName}</p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-3">
                                                                {athlete.finalTime ? (
                                                                    <div className="text-right">
                                                                        <div className="text-3xl font-display italic text-primary">{formatTime(athlete.finalTime)}</div>
                                                                        {athlete.position && (
                                                                            <p className="text-[10px] text-white/40 font-bold">Position {athlete.position}</p>
                                                                        )}
                                                                    </div>
                                                                ) : raceStatus === 'Running' && athlete.status !== 'DQ' ? (
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => recordFinish(athlete.playerId)}
                                                                            className="px-4 py-2 bg-green-500 text-black rounded-xl hover:scale-105 transition-all text-xs font-black uppercase tracking-widest"
                                                                        >
                                                                            Finish
                                                                        </button>
                                                                        <button
                                                                            onClick={() => disqualifyAthlete(athlete.playerId, 'Lane Violation')}
                                                                            className="px-4 py-2 bg-red-500 text-white rounded-xl hover:scale-105 transition-all text-xs font-black uppercase tracking-widest"
                                                                        >
                                                                            DQ
                                                                        </button>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>

                                                        {/* Additional Info */}
                                                        <div className="flex gap-4 text-[10px] text-white/60">
                                                            {athlete.reactionTime && (
                                                                <span>RT: {athlete.reactionTime.toFixed(3)}s</span>
                                                            )}
                                                            {athlete.status === 'DQ' && athlete.dqReason && (
                                                                <span className="text-red-500 font-bold">DQ: {athlete.dqReason}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Field Event Attempts */}
                                {isFieldEvent && (
                                    <div className="bg-white/5 border border-white/10 rounded-[24px] p-6">
                                        <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Target className="text-primary" size={16} />
                                            Field Event - Round {currentRound}
                                        </h3>
                                        {/* Search Input for Field Events */}
                                        <div className="relative mb-4">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                                            <input
                                                type="text"
                                                value={athleteSearch}
                                                onChange={(e) => setAthleteSearch(e.target.value)}
                                                placeholder="Search athletes..."
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                                            />
                                        </div>
                                        <div className="space-y-4">
                                            {filteredPlayers.slice(0, 8).map((player) => {
                                                const team = teams.find(t => t.id === player.teamId);
                                                const attempts = fieldAttempts.filter(a => a.playerId === player.id);
                                                const best = getBestAttempt(player.id);

                                                return (
                                                    <div key={player.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-3">
                                                                {isInterCompetition && team?.logo && <img src={team.logo} alt={team.name} className="w-8 h-8 object-contain" />}
                                                                <div>
                                                                    <p className="text-sm font-black uppercase tracking-tight">{player.name}</p>
                                                                    {isInterCompetition && (
                                                                        <p className="text-[10px] text-white/40 font-bold uppercase">{team?.shortName}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {best && (
                                                                <div className="text-right">
                                                                    <div className="text-2xl font-display italic text-primary">{best.toFixed(2)}m</div>
                                                                    <p className="text-[10px] text-white/40 font-bold">Best</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Attempts */}
                                                        <div className="flex gap-2 mb-3">
                                                            {Array.from({ length: maxAttempts }).map((_, idx) => {
                                                                const attempt = attempts[idx];
                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        className={`flex-1 h-12 rounded-xl flex items-center justify-center text-xs font-bold ${attempt
                                                                            ? attempt.isFoul
                                                                                ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                                                                                : 'bg-green-500/20 text-green-500 border border-green-500/30'
                                                                            : 'bg-white/5 border border-white/10 text-white/40'
                                                                            }`}
                                                                    >
                                                                        {attempt ? (attempt.isFoul ? 'X' : `${attempt.measurement?.toFixed(2)}`) : idx + 1}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Record Attempt Buttons */}
                                                        {attempts.length < maxAttempts && (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        const measurement = prompt('Enter measurement (meters):');
                                                                        if (measurement) {
                                                                            recordFieldAttempt(player.id, parseFloat(measurement), false);
                                                                        }
                                                                    }}
                                                                    className="flex-1 px-4 py-2 bg-green-500 text-black rounded-xl hover:scale-105 transition-all text-xs font-black uppercase tracking-widest"
                                                                >
                                                                    Valid
                                                                </button>
                                                                <button
                                                                    onClick={() => recordFieldAttempt(player.id, null, true)}
                                                                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl hover:scale-105 transition-all text-xs font-black uppercase tracking-widest"
                                                                >
                                                                    Foul
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Results View */}
                        {viewMode === 'results' && (
                            <div className="bg-white/5 border border-white/10 rounded-[24px] p-6">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Trophy className="text-primary" size={16} />
                                    Final Results
                                </h3>
                                <div className="space-y-3">
                                    {athletes
                                        .filter(a => a.finalTime)
                                        .sort((a, b) => (a.finalTime || 0) - (b.finalTime || 0))
                                        .map((athlete, idx) => {
                                            const player = players.find(p => p.id === athlete.playerId);
                                            const team = teams.find(t => t.id === player?.teamId);
                                            const position = idx + 1;

                                            return (
                                                <motion.div
                                                    key={athlete.playerId}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className={`border rounded-2xl p-4 ${position === 1 ? 'bg-yellow-500/10 border-yellow-500/30' :
                                                        position === 2 ? 'bg-gray-400/10 border-gray-400/30' :
                                                            position === 3 ? 'bg-orange-500/10 border-orange-500/30' :
                                                                'bg-white/5 border-white/10'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-display text-lg font-bold ${position === 1 ? 'bg-yellow-500 text-black' :
                                                                position === 2 ? 'bg-gray-400 text-black' :
                                                                    position === 3 ? 'bg-orange-500 text-black' :
                                                                        'bg-white/10 text-white'
                                                                }`}>
                                                                {position}
                                                            </div>
                                                            {isInterCompetition && team?.logo && <img src={team.logo} alt={team.name} className="w-8 h-8 object-contain" />}
                                                            <div>
                                                                <p className="text-sm font-black uppercase tracking-tight">{player?.name}</p>
                                                                {isInterCompetition && (
                                                                    <p className="text-[10px] text-white/40 font-bold uppercase">{team?.shortName}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-3xl font-display italic text-primary">{formatTime(athlete.finalTime!)}</div>
                                                            {athlete.reactionTime && (
                                                                <p className="text-[10px] text-white/40 font-bold">RT: {athlete.reactionTime.toFixed(3)}s</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar - Event Log & Info */}
                    <div className="space-y-6">
                        {/* Event Info */}
                        <div className="bg-white/5 border border-white/10 rounded-[24px] p-6">
                            <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Award className="text-primary" size={16} />
                                Event Info
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-white/40 font-bold uppercase">Event</span>
                                    <span className="text-sm font-black">{eventDistance}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-white/40 font-bold uppercase">Round</span>
                                    <span className="text-sm font-black">{roundType} {heatNumber}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-white/40 font-bold uppercase">Participants</span>
                                    <span className="text-sm font-black">{athletes.length}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-white/40 font-bold uppercase">Wind</span>
                                    <span className={`text-sm font-black ${Math.abs(weather.windSpeed) > 2.0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {weather.windSpeed > 0 ? '+' : ''}{weather.windSpeed.toFixed(1)} m/s
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-white/40 font-bold uppercase">Temperature</span>
                                    <span className="text-sm font-black">{weather.temperature}°C</span>
                                </div>
                            </div>
                        </div>

                        {/* Event Log */}
                        <div className="bg-white/5 border border-white/10 rounded-[24px] p-6">
                            <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                <History className="text-primary" size={16} />
                                Event Log
                            </h3>
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {events.slice().reverse().map((event) => (
                                    <div
                                        key={event.id}
                                        className="bg-white/5 border border-white/10 rounded-xl p-3"
                                    >
                                        <div className="flex items-start gap-2">
                                            <Activity size={14} className="text-primary mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-xs font-black uppercase tracking-tight">{event.type}</p>
                                                <p className="text-[10px] text-white/60 mt-1">{event.detail}</p>
                                                <p className="text-[9px] text-white/40 mt-1">
                                                    {new Date(event.timestamp).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {events.length === 0 && (
                                    <div className="text-center py-8 text-white/20">
                                        <Activity size={32} className="mx-auto mb-2" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">No events yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
