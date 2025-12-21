'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Activity, Lock, User, CheckCircle2, AlertCircle, ChevronRight, Globe, WifiOff } from 'lucide-react';
import { LOGGERS, MATCHES, TEAMS } from '@/lib/mock-data';
import { MatchLoggerUI } from '@/components/MatchLoggerUI';

export default function LoggerPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const logger = LOGGERS.find(l => l.id === 'l1'); // Mock auth
    if (username === 'admin' && password === 'admin') {
      setIsLoggedIn(true);
      setError('');
    } else {
      setError('Invalid credentials');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white/5 border border-white/10 rounded-[40px] p-8 md:p-12 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[80px] -z-10"></div>
          
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-black font-display text-2xl -skew-x-12">B</div>
            <h1 className="font-display text-2xl tracking-tighter italic uppercase">Logger Access</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-4">Identifier</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:border-primary outline-none transition-all font-medium"
                  placeholder="Username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-4">Security Key</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:border-primary outline-none transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 text-red-500 bg-red-500/10 p-4 rounded-xl text-xs font-bold"
              >
                <AlertCircle size={14} />
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              className="w-full bg-primary text-black font-black uppercase tracking-widest py-5 rounded-2xl hover:scale-[1.02] transition-transform active:scale-95 shadow-lg shadow-primary/20"
            >
              Initialize Session
            </button>
          </form>

          <p className="text-center text-[10px] text-white/20 mt-8 leading-relaxed">
            By logging in you agree to our Protocol of Conduct.<br/>All actions are cryptographically logged.
          </p>
        </motion.div>
      </div>
    );
  }

  if (selectedMatchId) {
    const match = MATCHES.find(m => m.id === selectedMatchId);
    if (!match) return null;
    return <MatchLoggerUI match={match} onExit={() => setSelectedMatchId(null)} />;
  }

  const assignedMatches = MATCHES.filter(m => m.loggerId === 'l1');

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Active Session: John Logger</span>
            </div>
            <h1 className="font-display text-4xl tracking-tight italic uppercase leading-none">Match Assignment</h1>
          </div>
          <button 
            onClick={() => setIsOffline(!isOffline)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
              isOffline ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-green-500/10 border-green-500/20 text-green-500'
            }`}
          >
            {isOffline ? <WifiOff size={14} /> : <Globe size={14} />}
            {isOffline ? 'Offline Mode' : 'Online Sync'}
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assignedMatches.map((match) => {
            const homeTeam = TEAMS.find(t => t.id === match.homeTeamId);
            const awayTeam = TEAMS.find(t => t.id === match.awayTeamId);
            return (
              <motion.div 
                key={match.id}
                whileHover={{ y: -5 }}
                onClick={() => setSelectedMatchId(match.id)}
                className="bg-white/5 border border-white/10 rounded-[32px] p-8 cursor-pointer group hover:bg-white/10 transition-all hover:border-primary/50"
              >
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-black uppercase tracking-widest">
                    <Activity size={12} className="text-primary" />
                    {match.sport}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{match.competition}</span>
                </div>

                <div className="flex items-center justify-between mb-8">
                  <div className="text-center flex-1">
                    <span className="text-4xl mb-2 block">{homeTeam?.logo}</span>
                    <p className="text-xs font-black uppercase tracking-widest truncate">{homeTeam?.shortName}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl font-display italic text-white/20">VS</span>
                    <span className="text-[10px] font-bold text-primary">00:00</span>
                  </div>
                  <div className="text-center flex-1">
                    <span className="text-4xl mb-2 block">{awayTeam?.logo}</span>
                    <p className="text-xs font-black uppercase tracking-widest truncate">{awayTeam?.shortName}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                  <span className="flex items-center gap-2">
                    <ClockIcon size={12} />
                    {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex items-center gap-1 group-hover:text-primary transition-colors">
                    Start Input
                    <ChevronRight size={14} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 border-dashed flex flex-col items-center justify-center min-h-[200px] text-white/20">
          <Activity size={32} className="mb-4" />
          <p className="text-xs font-black uppercase tracking-widest">No more assigned matches</p>
        </div>
      </div>
    </div>
  );
}

function ClockIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
