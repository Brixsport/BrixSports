'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Activity, Users, Star, Zap, Save, RefreshCw, Clock, ArrowRightLeft, Shield, AlertTriangle, ChevronLeft, Undo2, Redo2, History, RotateCcw, AlertCircle, Trash2 } from 'lucide-react';
import { Match, MatchEvent, Player, TEAMS, PLAYERS, SportType, EventType } from '@/lib/mock-data';

interface MatchLoggerUIProps {
  match: Match;
  onExit: () => void;
}

const SPORT_EVENTS: Record<SportType, { label: string; type: EventType; color: string; icon: React.ReactNode }[]> = {
  Football: [
    { label: 'Goal', type: 'Goal', color: 'bg-primary text-black', icon: <Trophy size={18} /> },
    { label: 'Assist', type: 'Assist', color: 'bg-primary/20 text-primary', icon: <Zap size={18} /> },
    { label: 'Save', type: 'Save', color: 'bg-white/10 text-white', icon: <Shield size={18} /> },
    { label: 'Block', type: 'Block', color: 'bg-white/10 text-white', icon: <Shield size={18} /> },
    { label: 'Interception', type: 'Interception', color: 'bg-white/10 text-white', icon: <Activity size={18} /> },
    { label: 'Yellow Card', type: 'Yellow Card', color: 'bg-yellow-500 text-black', icon: <AlertTriangle size={18} /> },
    { label: 'Red Card', type: 'Red Card', color: 'bg-red-500 text-white', icon: <AlertTriangle size={18} /> },
    { label: 'Foul', type: 'Foul', color: 'bg-white/5 text-white/60', icon: <X size={18} /> },
    { label: 'Substitution', type: 'Substitution', color: 'bg-blue-500 text-white', icon: <ArrowRightLeft size={18} /> },
    { label: 'Corner', type: 'Corner', color: 'bg-white/5 text-white/60', icon: <Shield size={18} /> },
    { label: 'Free Kick', type: 'Free Kick', color: 'bg-white/5 text-white/60', icon: <Zap size={18} /> },
    { label: 'Goal Kick', type: 'Goal Kick', color: 'bg-white/5 text-white/60', icon: <Activity size={18} /> },
    { label: 'Penalty', type: 'Penalty', color: 'bg-orange-500 text-white', icon: <Trophy size={18} /> },
    { label: 'Possession', type: 'Possession', color: 'bg-white/5 text-white/60', icon: <Activity size={18} /> },
    { label: 'Eye Point', type: 'Eye Point', color: 'bg-primary/40 text-white', icon: <Star size={18} /> },
  ],
  Basketball: [
    { label: 'Field Goal', type: 'Field Goal', color: 'bg-primary text-black', icon: <Trophy size={18} /> },
    { label: '3 Pointer', type: 'Three Pointer', color: 'bg-primary/80 text-black', icon: <Zap size={18} /> },
    { label: 'Free Throw', type: 'Free Throw', color: 'bg-white/10 text-white', icon: <Trophy size={18} /> },
    { label: 'Rebound', type: 'Rebound', color: 'bg-white/10 text-white', icon: <Shield size={18} /> },
    { label: 'Assist', type: 'Assist', color: 'bg-white/10 text-white', icon: <Zap size={18} /> },
    { label: 'Steal', type: 'Steal', color: 'bg-white/10 text-white', icon: <HandIcon size={18} /> },
    { label: 'Block', type: 'Block', color: 'bg-white/10 text-white', icon: <Shield size={18} /> },
    { label: 'Turnover', type: 'Turnover', color: 'bg-red-500/20 text-red-500', icon: <RotateCcw size={18} /> },
    { label: 'Foul', type: 'Foul', color: 'bg-yellow-500/20 text-yellow-500', icon: <X size={18} /> },
    { label: 'Timeout', type: 'Timeout', color: 'bg-blue-500/20 text-blue-500', icon: <Clock size={18} /> },
    { label: 'Eye Point', type: 'Eye Point', color: 'bg-primary/40 text-white', icon: <Star size={18} /> },
  ],
  Volleyball: [
    { label: 'Serve', type: 'Serve', color: 'bg-white/10 text-white', icon: <Zap size={18} /> },
    { label: 'Spike', type: 'Spike', color: 'bg-primary text-black', icon: <Zap size={18} /> },
    { label: 'Block', type: 'Block', color: 'bg-white/10 text-white', icon: <Shield size={18} /> },
    { label: 'Dig', type: 'Dig', color: 'bg-white/10 text-white', icon: <Shield size={18} /> },
    { label: 'Set', type: 'Set', color: 'bg-white/10 text-white', icon: <Activity size={18} /> },
    { label: 'Ace', type: 'Ace', color: 'bg-primary/80 text-black', icon: <Star size={18} /> },
    { label: 'Error', type: 'Error', color: 'bg-red-500/20 text-red-500', icon: <X size={18} /> },
  ],
  Track: [
    { label: 'Race Start', type: 'Race Start', color: 'bg-green-500 text-black', icon: <Zap size={18} /> },
    { label: 'Lap Time', type: 'Lap Time', color: 'bg-white/10 text-white', icon: <Clock size={18} /> },
    { label: 'Race Finish', type: 'Race Finish', color: 'bg-primary text-black', icon: <Trophy size={18} /> },
    { label: 'False Start', type: 'False Start', color: 'bg-red-500 text-white', icon: <AlertCircle size={18} /> },
    { label: 'Disqualify', type: 'Disqualification', color: 'bg-red-600 text-white', icon: <X size={18} /> },
    { label: 'Record Try', type: 'Record Attempt', color: 'bg-yellow-500 text-black', icon: <Star size={18} /> },
    { label: 'Jump', type: 'Jump Attempt', color: 'bg-white/10 text-white', icon: <Activity size={18} /> },
    { label: 'Throw', type: 'Throw Attempt', color: 'bg-white/10 text-white', icon: <Activity size={18} /> },
    { label: 'Measure', type: 'Measurement', color: 'bg-white/10 text-white', icon: <History size={18} /> },
  ],
  'Table Tennis': [
    { label: 'Point', type: 'Point', color: 'bg-primary text-black', icon: <Trophy size={18} /> },
    { label: 'Serve', type: 'Serve', color: 'bg-white/10 text-white', icon: <Zap size={18} /> },
    { label: 'Error', type: 'Error', color: 'bg-red-500/20 text-red-500', icon: <X size={18} /> },
    { label: 'Timeout', type: 'Timeout', color: 'bg-blue-500/20 text-blue-500', icon: <Clock size={18} /> },
  ],
  Badminton: [
    { label: 'Point', type: 'Point', color: 'bg-primary text-black', icon: <Trophy size={18} /> },
    { label: 'Serve', type: 'Serve', color: 'bg-white/10 text-white', icon: <Zap size={18} /> },
    { label: 'Error', type: 'Error', color: 'bg-red-500/20 text-red-500', icon: <X size={18} /> },
    { label: 'Timeout', type: 'Timeout', color: 'bg-blue-500/20 text-blue-500', icon: <Clock size={18} /> },
  ],
};

function HandIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" />
      <path d="M14 10V5a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8a7 7 0 0 0 7 7h1a2 2 0 0 0 2-2.1" />
    </svg>
  );
}

export function MatchLoggerUI({ match, onExit }: MatchLoggerUIProps) {
  const [currentMatch, setCurrentMatch] = useState(match);
  const [history, setHistory] = useState<Match[]>([]);
  const [redoStack, setRedoStack] = useState<Match[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<MatchEvent[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(match.homeTeamId);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [minute, setMinute] = useState(75);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubbing, setIsSubbing] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const homeTeam = TEAMS.find(t => t.id === match.homeTeamId);
  const awayTeam = TEAMS.find(t => t.id === match.awayTeamId);

  const teamPlayers = useMemo(() => {
    return PLAYERS.filter(p => p.teamId === selectedTeamId);
  }, [selectedTeamId]);

  const addEvent = useCallback((type: EventType, detail?: string, relatedPlayerId?: string) => {
    const newEvent: MatchEvent = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      minute,
      teamId: selectedTeamId,
      playerId: selectedPlayerId || undefined,
      relatedPlayerId,
      detail: detail || (selectedPlayerId ? PLAYERS.find(p => p.id === selectedPlayerId)?.name : undefined),
      isEyePoint: type === 'Eye Point'
    };

    setHistory(prev => [...prev, JSON.parse(JSON.stringify(currentMatch))]);
    setRedoStack([]);

    const updatedMatch = { ...currentMatch };
    updatedMatch.events = [newEvent, ...updatedMatch.events];

    // Handle score updates
    if (type === 'Goal' || type === 'Point' || type === 'Field Goal') {
      if (selectedTeamId === match.homeTeamId) updatedMatch.homeScore++;
      else updatedMatch.awayScore++;
    } else if (type === 'Three Pointer') {
        if (selectedTeamId === match.homeTeamId) updatedMatch.homeScore += 3;
        else updatedMatch.awayScore += 3;
    }

    // Handle stat updates
    const teamIdx = selectedTeamId === match.homeTeamId ? 0 : 1;
    if (type === 'Shot') updatedMatch.stats.shots[teamIdx]++;
    if (type === 'Corner') updatedMatch.stats.corners[teamIdx]++;
    if (type === 'Yellow Card') updatedMatch.stats.yellowCards[teamIdx]++;
    if (type === 'Red Card') updatedMatch.stats.redCards[teamIdx]++;
    if (type === 'Foul') updatedMatch.stats.fouls[teamIdx]++;
    if (type === 'Save') updatedMatch.stats.saves = updatedMatch.stats.saves ? [
        teamIdx === 0 ? updatedMatch.stats.saves[0] + 1 : updatedMatch.stats.saves[0],
        teamIdx === 1 ? updatedMatch.stats.saves[1] + 1 : updatedMatch.stats.saves[1]
    ] : [teamIdx === 0 ? 1 : 0, teamIdx === 1 ? 1 : 0];

    setCurrentMatch(updatedMatch);
    
    // Simulating offline/online behavior
    if (navigator.onLine) {
        window.dispatchEvent(new CustomEvent('MATCH_UPDATE', { 
          detail: { matchId: match.id, event: newEvent, updatedMatch } 
        }));
    } else {
        setOfflineQueue(prev => [...prev, newEvent]);
    }

    setSelectedPlayerId(null);
    setIsSubbing(false);
  }, [currentMatch, minute, selectedTeamId, selectedPlayerId, match.id, match.homeTeamId]);

  const undo = () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(currentMatch))]);
    setHistory(prev => prev.slice(0, -1));
    setCurrentMatch(lastState);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, JSON.parse(JSON.stringify(currentMatch))]);
    setRedoStack(prev => prev.slice(0, -1));
    setCurrentMatch(nextState);
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setOfflineQueue([]);
      setShowQueue(false);
    }, 1500);
  };

  const sportEvents = SPORT_EVENTS[match.sport] || SPORT_EVENTS.Football;

  return (
    <div className="fixed inset-0 bg-[#050505] text-white z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-black/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">{minute}' LIVE LOGGING</span>
              <h2 className="font-display text-2xl tracking-tight italic uppercase leading-none mt-1">
                {homeTeam?.shortName} <span className="text-primary">{currentMatch.homeScore}</span> - <span className="text-primary">{currentMatch.awayScore}</span> {awayTeam?.shortName}
              </h2>
            </div>
            <div className="hidden sm:flex items-center gap-4 border-l border-white/10 pl-6">
                <div className="text-center">
                    <span className="block text-[8px] font-black text-white/30 uppercase">Shots</span>
                    <span className="text-sm font-bold">{currentMatch.stats.shots[0]} - {currentMatch.stats.shots[1]}</span>
                </div>
                <div className="text-center">
                    <span className="block text-[8px] font-black text-white/30 uppercase">Fouls</span>
                    <span className="text-sm font-bold">{currentMatch.stats.fouls[0]} - {currentMatch.stats.fouls[1]}</span>
                </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowQueue(!showQueue)}
            className={`relative p-2 rounded-xl border transition-all ${
              offlineQueue.length > 0 ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-white/5 border-white/10 text-white/40'
            }`}
          >
            <History size={20} />
            {offlineQueue.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-black text-[8px] font-black rounded-full flex items-center justify-center">
                    {offlineQueue.length}
                </span>
            )}
          </button>
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Sync Status</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${offlineQueue.length > 0 ? 'text-orange-500' : 'text-green-500'}`}>
              {offlineQueue.length > 0 ? 'Queue Pending' : 'All Synced'}
            </span>
          </div>
          <button 
            onClick={handleSync}
            disabled={isSyncing || offlineQueue.length === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl border font-black uppercase tracking-widest text-[10px] transition-all ${
              offlineQueue.length > 0 
                ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20' 
                : 'bg-white/5 border-white/10 text-white/20'
            }`}
          >
            {isSyncing ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
            Push Batch
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Undo/Redo Floating Controls */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/10 p-1 rounded-full">
            <button 
                onClick={undo}
                disabled={history.length === 0}
                className="p-2 hover:bg-white/10 rounded-full disabled:opacity-20 transition-all"
            >
                <Undo2 size={16} />
            </button>
            <button 
                onClick={redo}
                disabled={redoStack.length === 0}
                className="p-2 hover:bg-white/10 rounded-full disabled:opacity-20 transition-all"
            >
                <Redo2 size={16} />
            </button>
        </div>

        {/* Left Side - Control Panel */}
        <div className="w-full md:w-3/5 lg:w-2/3 p-4 md:p-6 overflow-y-auto space-y-8 border-r border-white/5">
          {/* Team Selection */}
          <div className="flex bg-white/5 p-1 rounded-[24px] border border-white/10 overflow-hidden">
            {[match.homeTeamId, match.awayTeamId].map(id => {
              const team = TEAMS.find(t => t.id === id);
              const isActive = selectedTeamId === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                      setSelectedTeamId(id);
                      setSelectedPlayerId(null);
                      setIsSubbing(false);
                  }}
                  className={`flex-1 py-4 px-2 rounded-2xl flex flex-col items-center gap-2 transition-all relative ${
                    isActive ? 'text-black z-10' : 'text-white/40 hover:text-white'
                  }`}
                >
                  {isActive && (
                      <motion.div 
                        layoutId="team-active"
                        className="absolute inset-0 bg-primary -z-10 rounded-2xl"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                  )}
                  <span className="text-2xl">{team?.logo}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest truncate w-full text-center">{team?.name}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Actions Grid */}
          <section className="space-y-4">
             <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Event Protocol</h3>
                <span className="text-[10px] font-bold text-primary/60 italic">Sport: {match.sport}</span>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {sportEvents.map((ev, idx) => (
                    <ActionButton 
                        key={idx}
                        label={ev.label} 
                        icon={ev.icon} 
                        color={ev.color} 
                        onClick={() => {
                            if (ev.type === 'Substitution') setIsSubbing(true);
                            else addEvent(ev.type);
                        }} 
                    />
                ))}
             </div>
          </section>

          {/* Player Selection & Eye Points */}
          <section className="space-y-4">
             <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    {isSubbing ? 'Select Outgoing Player' : 'Active Roster'}
                </h3>
                <AnimatePresence>
                {(selectedPlayerId && !isSubbing) && (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 20 }}
                    onClick={() => addEvent('Eye Point', 'Leadership/Hustle')}
                    className="flex items-center gap-2 bg-primary/20 text-primary border border-primary/20 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest"
                  >
                    <Star size={12} fill="currentColor" />
                    Award Eye Point (+0.5)
                  </motion.button>
                )}
                {isSubbing && (
                    <motion.button 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSubbing(false)}
                        className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white"
                    >
                        Cancel Selection
                    </motion.button>
                )}
                </AnimatePresence>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {teamPlayers.map(player => (
                  <button
                    key={player.id}
                    onClick={() => {
                        if (isSubbing) {
                            addEvent('Substitution', `Out: ${player.name}`);
                        } else {
                            setSelectedPlayerId(player.id === selectedPlayerId ? null : player.id);
                        }
                    }}
                    className={`p-4 rounded-[24px] border transition-all text-left flex flex-col gap-1 relative ${
                      selectedPlayerId === player.id 
                        ? 'bg-primary/10 border-primary text-primary' 
                        : isSubbing ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase opacity-60">#{player.number} • {player.position}</span>
                    <span className="text-sm font-bold truncate">{player.name}</span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[8px] font-black bg-white/10 px-1.5 py-0.5 rounded uppercase tracking-tighter">EP {player.eyePoints}</span>
                      <span className="text-[8px] font-black bg-white/10 px-1.5 py-0.5 rounded uppercase tracking-tighter">Rate {player.rating}</span>
                    </div>
                  </button>
                ))}
             </div>
          </section>
        </div>

        {/* Right Side - Timeline & Queue Overlay */}
        <div className="hidden md:flex flex-col w-2/5 lg:w-1/3 bg-black/40 border-l border-white/5 overflow-hidden">
          {/* Animated Queue Overlay */}
          <AnimatePresence>
            {showQueue && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/95 z-20 flex flex-col p-8"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="font-display text-2xl uppercase italic">Offline Queue</h3>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Awaiting cloud synchronization</p>
                        </div>
                        <button onClick={() => setShowQueue(false)} className="p-2 hover:bg-white/10 rounded-full">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3">
                        {offlineQueue.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-white/10">
                                <CheckCircleIcon size={64} />
                                <p className="mt-4 font-black uppercase text-xs tracking-widest">Queue is empty</p>
                            </div>
                        ) : (
                            offlineQueue.map((ev, idx) => (
                                <div key={ev.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-500">
                                            <Save size={14} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-orange-500 tracking-widest">{ev.minute}'</span>
                                            <p className="text-sm font-bold">{ev.type}: {ev.detail}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setOfflineQueue(prev => prev.filter(e => e.id !== ev.id))}
                                        className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/10">
                        <button 
                            disabled={offlineQueue.length === 0}
                            onClick={handleSync}
                            className="w-full bg-orange-500 text-black font-black uppercase tracking-widest py-5 rounded-2xl hover:scale-[1.02] transition-transform disabled:opacity-20"
                        >
                            Force Sync {offlineQueue.length > 0 ? `(${offlineQueue.length})` : ''}
                        </button>
                    </div>
                </motion.div>
            )}
          </AnimatePresence>

          <div className="p-6 border-b border-white/5 bg-white/5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Live Logic Feed</h3>
            <p className="text-xs text-white/40 leading-relaxed font-medium">Automatic summary generation based on chronological event weight and importance.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
             <AnimatePresence initial={false}>
                {currentMatch.events.map((event, idx) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative pl-6 border-l border-white/10 pb-6 last:pb-0"
                  >
                    <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 bg-primary rounded-full ring-4 ring-[#050505]"></div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black text-primary tracking-widest">{event.minute}'</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/10">MATCH LOG {event.id.toUpperCase()}</span>
                    </div>
                    <p className="text-sm font-bold text-white/80 uppercase tracking-tight">
                      {event.type}: <span className="text-white">{event.detail}</span>
                    </p>
                    {event.isEyePoint && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-primary italic">
                        <Star size={10} fill="currentColor" />
                        Exceptional metric assigned
                      </div>
                    )}
                  </motion.div>
                ))}
             </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <footer className="bg-black border-t border-white/5 p-4 md:p-6 flex flex-col md:flex-row items-center gap-6 justify-between shrink-0">
         <div className="flex items-center gap-6 w-full md:w-auto">
            <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 flex-1 md:flex-initial">
              <Clock size={16} className="text-white/20" />
              <input 
                type="range" 
                min="0" 
                max="90" 
                value={minute}
                onChange={(e) => setMinute(parseInt(e.target.value))}
                className="w-full md:w-48 h-1 bg-white/10 rounded-full appearance-none accent-primary cursor-pointer"
              />
              <span className="text-[10px] font-black uppercase tracking-widest w-12 text-center">{minute}'</span>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setMinute(m => Math.max(0, m - 1))} className="p-2 hover:bg-white/5 rounded-full">-</button>
                <button onClick={() => setMinute(m => Math.min(99, m + 1))} className="p-2 hover:bg-white/5 rounded-full">+</button>
            </div>
         </div>
         <div className="flex items-center gap-3 w-full md:w-auto">
            <button className="flex-1 md:flex-initial bg-white/5 text-white/40 border border-white/10 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">Abort</button>
            <button className="flex-1 md:flex-initial bg-white text-black px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all shadow-xl shadow-white/5 active:scale-95">Finish Protocol</button>
         </div>
      </footer>
    </div>
  );
}

function ActionButton({ label, icon, color, onClick }: { label: string, icon: React.ReactNode, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`${color} flex flex-col items-center justify-center gap-2 p-4 rounded-[24px] hover:scale-105 transition-all active:scale-95 border border-white/5`}
    >
      <div className="opacity-80">{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-tight text-center leading-tight">{label}</span>
    </button>
  );
}

function CheckCircleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

