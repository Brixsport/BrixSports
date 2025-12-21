'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Activity, Users, BarChart3, Clock, Star, MapPin, ChevronRight, Share2, Heart, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';
import { Team, Player, Match, TEAMS, PLAYERS, MatchEvent } from '@/lib/mock-data';
import { useFavorites } from '@/hooks/useFavorites';
import { useNotifications } from './Notifications';

interface MatchOverlayProps {
  match: Match;
  onClose: () => void;
  onSelectPlayer: (player: Player) => void;
}

export function MatchOverlay({ match: initialMatch, onClose, onSelectPlayer }: MatchOverlayProps) {
  const [match, setMatch] = useState(initialMatch);
  const homeTeam = TEAMS.find(t => t.id === match.homeTeamId);
  const awayTeam = TEAMS.find(t => t.id === match.awayTeamId);
  const { isFavoriteTeam, toggleTeam } = useFavorites();
  const { addNotification } = useNotifications();

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const { matchId, event, updatedMatch } = e.detail;
      if (matchId === match.id) {
        setMatch(updatedMatch);
        
        // Show notification for significant events
        if (event.type === 'Goal') {
          addNotification({
            title: 'GOAL!',
            message: `${event.detail} has scored!`,
            type: 'match'
          });
        }
        if (event.type === 'Eye Point') {
          addNotification({
            title: 'EYE POINT AWARDED',
            message: `Exceptional performance by ${event.detail}`,
            type: 'scout'
          });
        }
      }
    };

    window.addEventListener('MATCH_UPDATE', handleUpdate);
    return () => window.removeEventListener('MATCH_UPDATE', handleUpdate);
  }, [match.id, addNotification]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md overflow-y-auto"
    >
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-lg border-b border-white/10 p-4 flex items-center justify-between">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
          <div className="flex flex-col items-center text-center">
            <span className="text-[10px] font-black tracking-[0.2em] text-primary uppercase">{match.competition}</span>
            <span className="text-xs text-white/40">{match.venue}</span>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Share2 size={20} className="text-white/60" />
          </button>
        </div>

        <div className="max-w-4xl mx-auto w-full px-4 py-8 space-y-12 pb-24">
          {/* Scoreboard */}
            <section className="relative flex items-center justify-between bg-gradient-to-b from-white/5 to-transparent p-8 rounded-[48px] border border-white/10 overflow-hidden">
               <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
               
              <div className="flex flex-col items-center gap-4 flex-1 z-10">
                <div className="relative group">
                  <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center text-5xl border border-white/10 transition-all group-hover:scale-105 group-hover:border-primary/50 shadow-2xl">
                    {homeTeam?.logo}
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); if(homeTeam) toggleTeam(homeTeam.id); }}
                    className={`absolute -top-2 -right-2 p-2 rounded-full border border-white/10 transition-all ${isFavoriteTeam(homeTeam?.id || '') ? 'bg-primary text-black' : 'bg-black text-white hover:bg-white/10'}`}
                  >
                    <Heart size={14} fill={isFavoriteTeam(homeTeam?.id || '') ? "currentColor" : "none"} />
                  </button>
                </div>
                <h2 className="text-xl font-display italic uppercase tracking-tight text-center">{homeTeam?.name}</h2>
              </div>

              <div className="flex flex-col items-center gap-2 z-10">
                <motion.div 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="text-7xl font-display italic tabular-nums bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40"
                >
                  {match.homeScore} : {match.awayScore}
                </motion.div>
                <div className="px-4 py-1.5 bg-primary text-black text-[10px] font-black tracking-widest rounded-full animate-pulse uppercase">
                  {match.status === 'LIVE' ? "75' LIVE" : match.status}
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 flex-1 z-10">
                <div className="relative group">
                  <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center text-5xl border border-white/10 transition-all group-hover:scale-105 group-hover:border-primary/50 shadow-2xl">
                    {awayTeam?.logo}
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); if(awayTeam) toggleTeam(awayTeam.id); }}
                    className={`absolute -top-2 -right-2 p-2 rounded-full border border-white/10 transition-all ${isFavoriteTeam(awayTeam?.id || '') ? 'bg-primary text-black' : 'bg-black text-white hover:bg-white/10'}`}
                  >
                    <Heart size={14} fill={isFavoriteTeam(awayTeam?.id || '') ? "currentColor" : "none"} />
                  </button>
                </div>
                <h2 className="text-xl font-display italic uppercase tracking-tight text-center">{awayTeam?.name}</h2>
              </div>
            </section>


          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Timeline */}
            <div className="md:col-span-2 space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={18} className="text-primary" />
                <h3 className="font-display italic uppercase tracking-tighter text-2xl">Timeline</h3>
              </div>
              <div className="space-y-4 relative">
                <div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/5"></div>
                {match.events.map((event) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={event.id} 
                    className="flex items-start gap-6 relative"
                  >
                    <div className="relative z-10 w-8 h-8 rounded-full bg-black border border-white/10 flex items-center justify-center text-[10px] font-bold tabular-nums">
                      {event.minute}'
                    </div>
                    <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between group hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${
                            event.type === 'Goal' ? 'bg-primary/20 text-primary' : 
                            event.type === 'Yellow Card' ? 'bg-yellow-500/20 text-yellow-500' : 
                            event.type === 'Red Card' ? 'bg-red-500/20 text-red-500' :
                            event.type === 'Substitution' ? 'bg-blue-500/20 text-blue-400' :
                            event.type === 'Eye Point' ? 'bg-secondary/20 text-secondary' :
                            'bg-white/5 text-white/40'
                          }`}>
                             {event.type === 'Goal' ? <Trophy size={14} /> : 
                              event.type === 'Substitution' ? <RefreshCw size={14} /> : 
                              event.type === 'Eye Point' ? <Star size={14} fill="currentColor" /> :
                              <AlertCircle size={14} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold uppercase tracking-tight italic">{event.type}</p>
                              {event.isEyePoint && (
                                <span className="bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest uppercase">+0.5 RATING</span>
                              )}
                            </div>
                            <p className="text-xs text-white/40">{event.detail}</p>
                          </div>
                      </div>
                      {event.teamId && (
                        <div className="text-xl opacity-40 group-hover:opacity-100 transition-opacity">
                          {TEAMS.find(t => t.id === event.teamId)?.logo}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Team Stats */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-primary" />
                <h3 className="font-display italic uppercase tracking-tighter text-2xl">Match Performance</h3>
              </div>
              <div className="bg-white/5 rounded-[32px] p-6 border border-white/5 space-y-6">
                <StatRow label="Possession" values={match.stats.possession} suffix="%" />
                <StatRow label="Expected Goals (xG)" values={[1.4, 0.8]} suffix="" />
                <StatRow label="Total Shots" values={match.stats.shots} />
                <StatRow label="Shots on Target" values={match.stats.shotsOnTarget} />
                <StatRow label="Corners" values={match.stats.corners} />
                <StatRow label="Fouls" values={match.stats.fouls} />
              </div>

              <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-4 text-center">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-1">Win Probability</p>
                 <div className="flex items-center justify-between text-xs font-bold italic">
                   <span>{homeTeam?.shortName} 64%</span>
                   <div className="h-1 flex-1 mx-4 bg-white/10 rounded-full overflow-hidden flex">
                      <div className="h-full bg-secondary" style={{ width: '64%' }}></div>
                      <div className="h-full bg-white/20" style={{ width: '10%' }}></div>
                   </div>
                   <span>{awayTeam?.shortName} 26%</span>
                 </div>
              </div>
            </div>
          </div>

          {/* Player Ratings */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-primary" />
                <h3 className="font-display italic uppercase tracking-tighter text-2xl">Scout Report</h3>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/20">
                 <span className="w-2 h-2 rounded-full bg-primary"></span> Top Performance
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Home Lineup */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-4">
                  <span className="text-xs font-black tracking-widest uppercase text-white/40">{homeTeam?.shortName} Squad</span>
                </div>
                {match.lineups?.home.map(entry => {
                  const player = PLAYERS.find(p => p.id === entry.playerId);
                  if (!player) return null;
                  return (
                    <PlayerRow 
                      key={player.id} 
                      player={player} 
                      rating={entry.rating} 
                      onClick={() => onSelectPlayer(player)}
                    />
                  );
                })}
              </div>

               {/* Away Lineup */}
               <div className="space-y-4">
                <div className="flex items-center justify-between px-4">
                  <span className="text-xs font-black tracking-widest uppercase text-white/40">{awayTeam?.shortName} Squad</span>
                </div>
                {match.lineups?.away.map(entry => {
                  const player = PLAYERS.find(p => p.id === entry.playerId);
                  if (!player) return null;
                  return (
                    <PlayerRow 
                      key={player.id} 
                      player={player} 
                      rating={entry.rating} 
                      onClick={() => onSelectPlayer(player)}
                    />
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

function StatRow({ label, values, suffix = '' }: { label: string; values: [number, number]; suffix?: string }) {
  const total = values[0] + values[1];
  const homePercent = (values[0] / (total || 1)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-black tracking-widest uppercase mb-1">
        <span className={values[0] > values[1] ? 'text-primary' : 'text-white'}>{values[0]}{suffix}</span>
        <span className="text-white/20">{label}</span>
        <span className={values[1] > values[0] ? 'text-primary' : 'text-white'}>{values[1]}{suffix}</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full flex overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${homePercent}%` }}
          className="bg-primary h-full"
        />
        <div className="flex-1 bg-white/10 h-full"></div>
      </div>
    </div>
  );
}

function PlayerRow({ player, rating, onClick }: { player: Player; rating: number; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/30 group transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-black rounded-xl border border-white/10 flex items-center justify-center font-display italic group-hover:bg-primary group-hover:text-black transition-colors">
          {player.number}
        </div>
        <div className="text-left">
          <p className="text-sm font-bold uppercase italic group-hover:text-primary transition-colors">{player.name}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">{player.position}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
         <div className="text-[9px] font-black text-secondary uppercase italic opacity-0 group-hover:opacity-100 transition-opacity">
           Scout View
         </div>
         <div className={`px-2 py-1 rounded-lg font-black text-xs min-w-[32px] text-center ${rating >= 8 ? 'bg-green-500/20 text-green-500' : rating >= 7 ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/40'}`}>
           {rating.toFixed(1)}
         </div>
      </div>
    </button>
  );
}
