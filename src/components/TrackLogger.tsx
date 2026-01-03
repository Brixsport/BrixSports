'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Activity, Save, Clock, Users, Trophy, Timer, Flag } from 'lucide-react';
import { Match, Player, TEAMS, PLAYERS } from '@/lib/mock-data';

interface TrackLoggerProps {
    match: Match;
    onExit: () => void;
}

type TrackEventType = 'Race Start' | 'Lap Time' | 'Race Finish' | 'False Start' | 'Disqualification' | 'Record Attempt';

interface RaceResult {
    playerId: string;
    position: number;
    time: string;
    splits?: string[];
}

export function TrackLogger({ match, onExit }: TrackLoggerProps) {
    const [eventType, setEventType] = useState<'Sprint' | 'Distance' | 'Relay' | 'Field'>('Sprint');
    const [raceStatus, setRaceStatus] = useState<'Ready' | 'Running' | 'Finished'>('Ready');
    const [results, setResults] = useState<RaceResult[]>([]);
    const [currentTime, setCurrentTime] = useState('00:00.00');
    const [events, setEvents] = useState(match.events);

    const homeTeam = TEAMS.find(t => t.id === match.homeTeamId);
    const awayTeam = TEAMS.find(t => t.id === match.awayTeamId);
    const allPlayers = [...PLAYERS.filter(p => p.teamId === match.homeTeamId), ...PLAYERS.filter(p => p.teamId === match.awayTeamId)];

    const addResult = (playerId: string, time: string, position: number) => {
        const newResult: RaceResult = {
            playerId,
            position,
            time,
        };

        setResults([...results, newResult].sort((a, b) => a.position - b.position));

        const newEvent = {
            id: `e${events.length + 1}`,
            type: 'Race Finish' as const,
            minute: 0,
            second: parseFloat(time.replace(':', '.')),
            teamId: PLAYERS.find(p => p.id === playerId)?.teamId || '',
            playerId,
            detail: `Position ${position} - ${time}`,
            value: { position, time }
        };

        setEvents([...events, newEvent]);
    };

    const startRace = () => {
        setRaceStatus('Running');
        setResults([]);
        // In a real implementation, this would start a timer
    };

    const finishRace = () => {
        setRaceStatus('Finished');
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex items-center justify-between mb-6">
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

                    <div className="flex items-center gap-4">
                        <button className="px-6 py-3 bg-primary text-black rounded-2xl hover:scale-105 transition-all flex items-center gap-2 font-black uppercase tracking-widest">
                            <Save size={16} />
                            Save
                        </button>
                    </div>
                </div>

                {/* Event Type Selector */}
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 mb-6">
                    {(['Sprint', 'Distance', 'Relay', 'Field'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setEventType(type)}
                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${eventType === type ? 'bg-primary text-black' : 'text-white/40 hover:text-white'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {/* Race Control */}
                <div className="bg-gradient-to-br from-red-900/20 to-red-950/40 border border-red-500/20 rounded-[40px] p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                        {/* Status */}
                        <div className="text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Race Status</p>
                            <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest ${raceStatus === 'Ready' ? 'bg-yellow-500/20 text-yellow-500' :
                                    raceStatus === 'Running' ? 'bg-blue-500/20 text-blue-500 animate-pulse' :
                                        'bg-blue-500/20 text-blue-500'
                                }`}>
                                <Activity size={16} />
                                {raceStatus}
                            </div>
                        </div>

                        {/* Timer */}
                        <div className="text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Time</p>
                            <div className="text-6xl font-display italic text-primary flex items-center justify-center gap-2">
                                <Timer size={48} />
                                {currentTime}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col gap-3">
                            {raceStatus === 'Ready' && (
                                <button
                                    onClick={startRace}
                                    className="bg-blue-500 text-white px-8 py-4 rounded-2xl hover:scale-105 transition-all font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <Flag size={20} />
                                    Start Race
                                </button>
                            )}
                            {raceStatus === 'Running' && (
                                <button
                                    onClick={finishRace}
                                    className="bg-red-500 text-white px-8 py-4 rounded-2xl hover:scale-105 transition-all font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <Flag size={20} />
                                    Finish Race
                                </button>
                            )}
                            {raceStatus === 'Finished' && (
                                <button
                                    onClick={() => setRaceStatus('Ready')}
                                    className="bg-primary text-black px-8 py-4 rounded-2xl hover:scale-105 transition-all font-black uppercase tracking-widest"
                                >
                                    New Race
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Participants */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
                        <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Users className="text-primary" size={16} />
                            Participants
                        </h3>
                        <div className="space-y-3">
                            {allPlayers.slice(0, 8).map((player, idx) => {
                                const team = TEAMS.find(t => t.id === player.teamId);
                                const result = results.find(r => r.playerId === player.id);

                                return (
                                    <div
                                        key={player.id}
                                        className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center font-display text-2xl">
                                                    {idx + 1}
                                                </div>
                                                <span className="text-2xl">{team?.logo}</span>
                                                <div>
                                                    <p className="text-sm font-black uppercase tracking-tight">{player.name}</p>
                                                    <p className="text-[10px] text-white/40 font-bold uppercase">{team?.shortName}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {result ? (
                                                    <div className="text-right">
                                                        <p className="text-2xl font-display italic text-primary">{result.time}</p>
                                                        <p className="text-[10px] text-white/40 font-bold">Position {result.position}</p>
                                                    </div>
                                                ) : raceStatus === 'Running' ? (
                                                    <button
                                                        onClick={() => addResult(player.id, currentTime, results.length + 1)}
                                                        className="px-4 py-2 bg-primary text-black rounded-xl hover:scale-105 transition-all text-xs font-black uppercase tracking-widest"
                                                    >
                                                        Finish
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Quick Time Entry */}
                    {raceStatus === 'Finished' && (
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
                            <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Clock className="text-primary" size={16} />
                                Manual Time Entry
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    placeholder="Player ID"
                                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all"
                                />
                                <input
                                    type="text"
                                    placeholder="Time (MM:SS.MS)"
                                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Results & Leaderboard */}
                <div className="space-y-6">
                    {/* Live Results */}
                    <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
                        <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Trophy className="text-primary" size={16} />
                            Results
                        </h3>
                        <div className="space-y-2">
                            {results.length > 0 ? (
                                results.map((result) => {
                                    const player = PLAYERS.find(p => p.id === result.playerId);
                                    const team = TEAMS.find(t => t.id === player?.teamId);

                                    return (
                                        <motion.div
                                            key={result.playerId}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className={`border rounded-2xl p-4 ${result.position === 1 ? 'bg-yellow-500/10 border-yellow-500/30' :
                                                    result.position === 2 ? 'bg-gray-400/10 border-gray-400/30' :
                                                        result.position === 3 ? 'bg-orange-500/10 border-orange-500/30' :
                                                            'bg-white/5 border-white/10'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-lg font-bold ${result.position === 1 ? 'bg-yellow-500 text-black' :
                                                            result.position === 2 ? 'bg-gray-400 text-black' :
                                                                result.position === 3 ? 'bg-orange-500 text-black' :
                                                                    'bg-white/10 text-white'
                                                        }`}>
                                                        {result.position}
                                                    </div>
                                                    <span className="text-xl">{team?.logo}</span>
                                                </div>
                                                <div className="text-2xl font-display italic text-primary">{result.time}</div>
                                            </div>
                                            <p className="text-xs font-black uppercase tracking-tight ml-11">{player?.name}</p>
                                            <p className="text-[10px] text-white/40 font-bold uppercase ml-11">{team?.shortName}</p>
                                        </motion.div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-12 text-white/20">
                                    <Activity size={48} className="mx-auto mb-4" />
                                    <p className="text-xs font-black uppercase tracking-widest">No results yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Event Log */}
                    <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
                        <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Activity className="text-primary" size={16} />
                            Event Log
                        </h3>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {events.slice().reverse().map((event) => {
                                const team = TEAMS.find(t => t.id === event.teamId);
                                const player = PLAYERS.find(p => p.id === event.playerId);
                                return (
                                    <div
                                        key={event.id}
                                        className="bg-white/5 border border-white/10 rounded-xl p-3"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{team?.logo}</span>
                                            <div className="flex-1">
                                                <p className="text-xs font-black uppercase tracking-tight">{event.type}</p>
                                                <p className="text-[10px] text-white/60">{event.detail}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

