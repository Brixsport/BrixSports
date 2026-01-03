'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Activity, Lock, User, CheckCircle2, AlertCircle, ChevronRight, Globe, WifiOff } from 'lucide-react';
import { MatchLoggerUI } from '@/components/MatchLoggerUI';
import { BasketballLogger } from '@/components/BasketballLogger';
import { FootballLogger } from '@/components/FootballLogger';
import { TrackLogger } from '@/components/TrackLogger';

import { Match, SportType } from '@/lib/mock-data';

interface Logger {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function LoggerPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [logger, setLogger] = useState<Logger | null>(null);
  const [assignedMatches, setAssignedMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/loggers/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed');
        setIsLoading(false);
        return;
      }

      setLogger(data.logger);
      setAssignedMatches(data.assignedMatches || []);
      setIsLoggedIn(true);
      localStorage.setItem('logger', JSON.stringify(data.logger));
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    const savedLogger = localStorage.getItem('logger');
    if (savedLogger) {
      const loggerData = JSON.parse(savedLogger);
      setLogger(loggerData);
      setIsLoggedIn(true);
      // Fetch assigned matches
      fetchAssignedMatches(loggerData.id);
    }
  }, []);

  // Fetch teams when logged in
  useEffect(() => {
    if (isLoggedIn) {
      fetchTeams();
    }
  }, [isLoggedIn]);

  const fetchAssignedMatches = async (loggerId: string) => {
    try {
      const response = await fetch(`/api/loggers/${loggerId}`);
      const data = await response.json();
      setAssignedMatches(data.assignedMatches || []);
    } catch (err) {
      console.error('Failed to fetch assigned matches:', err);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams');
      const data = await response.json();
      setTeams(data);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
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
              disabled={isLoading}
              className="w-full bg-primary text-black font-black uppercase tracking-widest py-5 rounded-2xl hover:scale-[1.02] transition-transform active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Authenticating...' : 'Initialize Session'}
            </button>
          </form>

          <p className="text-center text-[10px] text-white/20 mt-8 leading-relaxed">
            By logging in you agree to our Protocol of Conduct.<br />All actions are cryptographically logged.
          </p>
        </motion.div>
      </div>
    );
  }



  if (selectedMatchId) {
    const match = assignedMatches.find(m => m.id === selectedMatchId);
    if (!match) return null;

    // Render sport-specific logger
    if (match.sport === 'Basketball') {
      return <BasketballLogger match={match} onExit={() => setSelectedMatchId(null)} currentLogger={logger} />;
    } else if (match.sport === 'Football') {
      return <FootballLogger match={match} onExit={() => setSelectedMatchId(null)} currentLogger={logger} />;
    } else if (match.sport === 'Track') {
      return <TrackLogger match={match} onExit={() => setSelectedMatchId(null)} />;
    } else {
      // Default to generic logger for other sports
      return <MatchLoggerUI match={match} onExit={() => setSelectedMatchId(null)} />;
    }
  }

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLogger(null);
    setAssignedMatches([]);
    localStorage.removeItem('logger');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Active Session: {logger?.name || 'Logger'}
              </span>
            </div>
            <h1 className="font-display text-4xl tracking-tight italic uppercase leading-none">Match Assignment</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOffline(!isOffline)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${isOffline ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                }`}
            >
              {isOffline ? <WifiOff size={14} /> : <Globe size={14} />}
              {isOffline ? 'Offline Mode' : 'Online Sync'}
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-full border border-red-500/20 bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Logger Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-[32px] p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -z-10"></div>

          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/50 rounded-2xl flex items-center justify-center text-black font-display text-3xl italic uppercase shadow-lg shadow-primary/20">
                {logger?.name?.charAt(0) || 'L'}
              </div>

              {/* Logger Info */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-display italic uppercase tracking-tight">{logger?.name || 'Logger'}</h2>
                  <span className="px-2 py-1 bg-primary/20 text-primary border border-primary/30 rounded-lg text-[9px] font-black uppercase tracking-widest">
                    {logger?.role || 'Logger'}
                  </span>
                </div>
                <p className="text-sm text-white/60 font-medium">{logger?.email}</p>
                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">ID: {logger?.id}</p>
              </div>
            </div>

            {/* Stats Badge */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center min-w-[120px]">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Assigned Matches</p>
              <p className="text-3xl font-display italic text-primary">{assignedMatches.length}</p>
              <p className="text-[9px] text-white/40 mt-1">
                {assignedMatches.filter(m => m.status === 'LIVE').length} Live • {assignedMatches.filter(m => m.status === 'UPCOMING').length} Upcoming
              </p>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Total Events</p>
              <p className="text-xl font-display italic text-white">-</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Logged Matches</p>
              <p className="text-xl font-display italic text-white">-</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Active Since</p>
              <p className="text-xl font-display italic text-white">Today</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assignedMatches.map((match) => {
            const homeTeam = teams.find(t => t.id === match.homeTeamId);
            const awayTeam = teams.find(t => t.id === match.awayTeamId);
            const isLoggable = match.status === 'UPCOMING' || match.status === 'LIVE';

            return (
              <motion.div
                key={match.id}
                whileHover={isLoggable ? { y: -5 } : {}}
                onClick={() => isLoggable && setSelectedMatchId(match.id)}
                className={`bg-white/5 border border-white/10 rounded-[32px] p-8 transition-all ${isLoggable
                  ? 'cursor-pointer group hover:bg-white/10 hover:border-primary/50'
                  : 'opacity-50 cursor-not-allowed'
                  }`}
              >
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-black uppercase tracking-widest">
                      <Activity size={12} className="text-primary" />
                      {match.sport}
                    </div>
                    <div className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${match.status === 'LIVE' ? 'bg-red-500/20 text-red-500 border border-red-500/30 animate-pulse' :
                      match.status === 'UPCOMING' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' :
                        'bg-gray-500/20 text-gray-500 border border-gray-500/30'
                      }`}>
                      {match.status}
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{match.competition}</span>
                </div>

                <div className="flex items-center justify-between mb-8">
                  <div className="text-center flex-1">
                    {homeTeam?.logo ? (
                      <img src={homeTeam.logo} alt={homeTeam.name} className="w-16 h-16 mx-auto mb-2 object-contain" />
                    ) : (
                      <span className="text-4xl mb-2 block">🏀</span>
                    )}
                    <p className="text-xs font-black uppercase tracking-widest truncate">{homeTeam?.shortName || 'HOME'}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl font-display italic text-white/20">VS</span>
                    <span className="text-[10px] font-bold text-primary">
                      {match.status === 'LIVE' ? `${match.homeScore}-${match.awayScore}` :
                        match.status === 'FINISHED' ? `${match.homeScore}-${match.awayScore}` : '00:00'}
                    </span>
                  </div>
                  <div className="text-center flex-1">
                    {awayTeam?.logo ? (
                      <img src={awayTeam.logo} alt={awayTeam.name} className="w-16 h-16 mx-auto mb-2 object-contain" />
                    ) : (
                      <span className="text-4xl mb-2 block">🏀</span>
                    )}
                    <p className="text-xs font-black uppercase tracking-widest truncate">{awayTeam?.shortName || 'AWAY'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                  <span className="flex items-center gap-2">
                    <ClockIcon size={12} />
                    {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isLoggable ? (
                    <div className="flex items-center gap-1 group-hover:text-primary transition-colors">
                      Start Input
                      <ChevronRight size={14} />
                    </div>
                  ) : (
                    <span className="text-gray-500">Match Ended</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {assignedMatches.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 border-dashed flex flex-col items-center justify-center min-h-[200px] text-white/20">
            <Activity size={32} className="mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">No assigned matches</p>
          </div>
        )}
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

