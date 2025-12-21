'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Activity, Users, Star, Zap, Save, RefreshCw, Clock, ArrowRightLeft, Shield, AlertTriangle, ChevronLeft } from 'lucide-react';
import { Match, MatchEvent, Player, TEAMS, PLAYERS } from '@/lib/mock-data';

interface MatchLoggerUIProps {
  match: Match;
  onExit: () => void;
}

export function MatchLoggerUI({ match, onExit }: MatchLoggerUIProps) {
  const [currentMatch, setCurrentMatch] = useState(match);
  const [offlineQueue, setOfflineQueue] = useState<MatchEvent[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(match.homeTeamId);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [minute, setMinute] = useState(75);
  const [isSyncing, setIsSyncing] = useState(false);

  const homeTeam = TEAMS.find(t => t.id === match.homeTeamId);
  const awayTeam = TEAMS.find(t => t.id === match.awayTeamId);

  const teamPlayers = useMemo(() => {
    return PLAYERS.filter(p => p.teamId === selectedTeamId);
  }, [selectedTeamId]);

  const addEvent = (type: MatchEvent['type'], detail?: string, relatedPlayerId?: string) => {
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

    // Update local state
    const updatedMatch = { ...currentMatch };
    updatedMatch.events = [newEvent, ...updatedMatch.events];

    // Handle score updates
    if (type === 'Goal') {
      if (selectedTeamId === match.homeTeamId) updatedMatch.homeScore++;
      else updatedMatch.awayScore++;
    }

    // Handle stat updates (simplified)
    if (type === 'Shot') {
      const idx = selectedTeamId === match.homeTeamId ? 0 : 1;
      updatedMatch.stats.shots[idx]++;
    }

    setCurrentMatch(updatedMatch);
    
    // Broadcast event (Simulating WebSocket)
    window.dispatchEvent(new CustomEvent('MATCH_UPDATE', { 
      detail: { matchId: match.id, event: newEvent, updatedMatch } 
    }));

    // Reset selection
    setSelectedPlayerId(null);
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setOfflineQueue([]);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-[#050505] text-white z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-black/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="font-display text-xl tracking-tight italic uppercase leading-none">
              {homeTeam?.shortName} {currentMatch.homeScore} - {currentMatch.awayScore} {awayTeam?.shortName}
            </h2>
            <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">{minute}' LIVE LOGGING</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end mr-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Queue Status</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-green-500">All Synced</span>
          </div>
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
          >
            {isSyncing ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
            Push Data
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Control Panel */}
        <div className="w-full md:w-2/3 p-6 overflow-y-auto space-y-8 border-r border-white/5">
          {/* Team Selection */}
          <div className="flex bg-white/5 p-1 rounded-[20px] border border-white/10">
            {[match.homeTeamId, match.awayTeamId].map(id => {
              const team = TEAMS.find(t => t.id === id);
              return (
                <button
                  key={id}
                  onClick={() => setSelectedTeamId(id)}
                  className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-2 transition-all ${
                    selectedTeamId === id ? 'bg-primary text-black' : 'text-white/40 hover:text-white'
                  }`}
                >
                  <span className="text-2xl">{team?.logo}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">{team?.name}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Actions */}
          <section className="space-y-4">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-2">Match Actions</h3>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ActionButton label="Goal" icon={<Trophy size={18} />} color="bg-primary text-black" onClick={() => addEvent('Goal')} />
                <ActionButton label="Card" icon={<AlertTriangle size={18} />} color="bg-yellow-500 text-black" onClick={() => addEvent('Yellow Card')} />
                <ActionButton label="Sub" icon={<ArrowRightLeft size={18} />} color="bg-blue-500 text-white" onClick={() => addEvent('Substitution')} />
                <ActionButton label="Shot" icon={<Zap size={18} />} color="bg-white/10 text-white" onClick={() => addEvent('Shot')} />
                <ActionButton label="Corner" icon={<Shield size={18} />} color="bg-white/10 text-white" onClick={() => addEvent('Corner')} />
                <ActionButton label="Save" icon={<Activity size={18} />} color="bg-white/10 text-white" onClick={() => addEvent('Save')} />
                <ActionButton label="Foul" icon={<X size={18} />} color="bg-white/10 text-white" onClick={() => addEvent('Foul')} />
                <ActionButton label="Period" icon={<Clock size={18} />} color="bg-white/10 text-white" onClick={() => addEvent('Period End')} />
             </div>
          </section>

          {/* Player Selection & Eye Points */}
          <section className="space-y-4">
             <div className="flex items-center justify-between ml-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Active Roster</h3>
                {selectedPlayerId && (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => addEvent('Eye Point', 'Hustle Award')}
                    className="flex items-center gap-2 bg-primary/20 text-primary border border-primary/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                  >
                    <Star size={12} fill="currentColor" />
                    Award Eye Point (+0.5)
                  </motion.button>
                )}
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {teamPlayers.map(player => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedPlayerId(player.id === selectedPlayerId ? null : player.id)}
                    className={`p-4 rounded-[24px] border transition-all text-left flex flex-col gap-1 ${
                      selectedPlayerId === player.id 
                        ? 'bg-primary/10 border-primary text-primary shadow-[0_0_20px_rgba(var(--primary),0.1)]' 
                        : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase opacity-60">#{player.number} • {player.position}</span>
                    <span className="text-sm font-bold truncate">{player.name}</span>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[8px] font-black bg-white/10 px-1.5 py-0.5 rounded uppercase tracking-tighter">Rate {player.rating}</span>
                      <span className="text-[8px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase tracking-tighter">EP {player.eyePoints}</span>
                    </div>
                  </button>
                ))}
             </div>
          </section>
        </div>

        {/* Right Side - Timeline & Summaries */}
        <div className="hidden md:flex flex-col w-1/3 bg-black/40 border-l border-white/5 overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Live Summary Stream</h3>
            <p className="text-xs text-white/20 leading-relaxed">System generating real-time chronological event logs with team weighting.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
             <AnimatePresence initial={false}>
                {currentMatch.events.map((event, idx) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative pl-6 border-l border-white/10 pb-4 last:pb-0"
                  >
                    <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 bg-primary rounded-full ring-4 ring-black"></div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black text-primary tracking-widest">{event.minute}'</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Authorized LOG</span>
                    </div>
                    <p className="text-sm font-bold text-white/90">
                      {event.type.toUpperCase()}: {event.detail}
                    </p>
                    {event.isEyePoint && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-primary italic">
                        <Star size={10} fill="currentColor" />
                        Exceptional performance detected
                      </div>
                    )}
                  </motion.div>
                ))}
             </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <footer className="bg-black border-t border-white/5 p-6 flex items-center justify-between">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-white/20" />
              <input 
                type="range" 
                min="0" 
                max="90" 
                value={minute}
                onChange={(e) => setMinute(parseInt(e.target.value))}
                className="w-48 h-1 bg-white/10 rounded-full appearance-none accent-primary cursor-pointer"
              />
              <span className="text-[10px] font-black uppercase tracking-widest w-12">{minute}' IN</span>
            </div>
         </div>
         <div className="flex items-center gap-4">
            <button className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-colors">Undo Last</button>
            <button className="bg-white text-black px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-colors">Finish Half</button>
         </div>
      </footer>
    </div>
  );
}

function ActionButton({ label, icon, color, onClick }: { label: string, icon: React.ReactNode, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`${color} flex flex-col items-center justify-center gap-2 p-4 rounded-[24px] hover:scale-105 transition-transform active:scale-95`}
    >
      {icon}
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
