'use client';

import { motion } from 'framer-motion';
import { Trophy, Activity, ArrowRight, Star } from 'lucide-react';
import { TEAMS, Match } from '@/lib/mock-data';

export function MatchTimeline({ events }: { events: any[] }) {
  return (
    <div className="space-y-4 py-4">
      {events.map((event, idx) => (
        <div key={idx} className="flex items-center gap-4">
          <span className="text-[10px] font-black tabular-nums text-white/40 w-6">{event.minute}'</span>
          <div className={`w-2 h-2 rounded-full ${event.isEyePoint ? 'bg-secondary' : 'bg-primary'}`}></div>
          <div className="flex flex-col">
            <span className="text-xs font-bold">{event.type}</span>
            <span className="text-[10px] text-white/60">{event.detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MatchCard({ match }: { match: Match }) {
  const homeTeam = TEAMS.find(t => t.id === match.homeTeamId);
  const awayTeam = TEAMS.find(t => t.id === match.awayTeamId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className="relative group overflow-hidden bg-gradient-to-br from-white/10 to-white/5 p-6 rounded-[32px] border border-white/10 hover:border-primary/50 transition-all min-h-[240px] flex flex-col justify-between"
    >
      <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10 group-hover:opacity-20 transition-opacity">
         <Trophy size={140} />
      </div>

      <div className="relative z-10 w-full transition-all group-hover:-translate-y-2">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase bg-white/5 px-3 py-1 rounded-full border border-white/5">
            {(match as any).round ? `${match.competition} · ${(match as any).round}` : match.competition}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            {match.sport === 'Football' ? "75'" : "Q3 04:22"}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-3xl border border-white/10 group-hover:bg-white/10 transition-colors">
              {homeTeam?.logo}
            </div>
            <span className="text-xs font-bold tracking-tight">{homeTeam?.shortName}</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-4 text-5xl font-display italic tabular-nums leading-none">
              <span>{match.homeScore}</span>
              <span className="text-white/20 text-2xl">:</span>
              <span>{match.awayScore}</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-3xl border border-white/10 group-hover:bg-white/10 transition-colors">
              {awayTeam?.logo}
            </div>
            <span className="text-xs font-bold tracking-tight">{awayTeam?.shortName}</span>
          </div>
        </div>
      </div>

      <div className="hidden group-hover:block transition-all duration-300">
         <MatchTimeline events={match.events.slice(-2)} />
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5 relative z-10">
        <div className="flex items-center gap-2">
           <Activity size={14} className="text-white/40" />
           <span className="text-[11px] text-white/60 line-clamp-1">{match.venue}</span>
        </div>
        <button className="text-[11px] font-bold text-primary flex items-center gap-1">
          INFO <ArrowRight size={12} />
        </button>
      </div>
    </motion.div>
  );
}

export function MatchRow({ match }: { match: Match }) {
  const homeTeam = TEAMS.find(t => t.id === match.homeTeamId);
  const awayTeam = TEAMS.find(t => t.id === match.awayTeamId);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="group bg-white/5 hover:bg-white/[0.08] p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center gap-2 w-32 border-r border-white/5">
           <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{match.sport}</span>
           <div className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
             match.status === 'LIVE' ? 'bg-red-500 text-white' : 
             match.status === 'FINISHED' ? 'bg-white/10 text-white/40' : 
             'bg-primary text-black'
           }`}>
             {match.status}
           </div>
        </div>
        
        <div className="flex items-center gap-8 flex-1">
          <div className="flex items-center justify-end gap-3 flex-1">
            <span className="text-sm font-bold hidden sm:block italic truncate">{homeTeam?.name}</span>
            <span className="text-sm font-bold sm:hidden">{homeTeam?.shortName}</span>
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-lg">{homeTeam?.logo}</div>
          </div>

          <div className="flex items-center gap-3 px-4 py-1 bg-black/40 rounded-lg min-w-[80px] justify-center border border-white/5">
            <span className={`text-xl font-display italic ${match.status === 'UPCOMING' ? 'text-white/20' : ''}`}>
              {match.status === 'UPCOMING' ? '0' : match.homeScore}
            </span>
            <span className="text-white/10 text-sm italic">vs</span>
            <span className={`text-xl font-display italic ${match.status === 'UPCOMING' ? 'text-white/20' : ''}`}>
              {match.status === 'UPCOMING' ? '0' : match.awayScore}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-lg">{awayTeam?.logo}</div>
            <span className="text-sm font-bold hidden sm:block italic truncate">{awayTeam?.name}</span>
            <span className="text-sm font-bold sm:hidden">{awayTeam?.shortName}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:block text-right">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{(match as any).round ? `${match.competition} · ${(match as any).round}` : match.competition}</p>
          <p className="text-[11px] text-white/50">{match.venue}</p>
        </div>
        <div className="h-8 w-[1px] bg-white/5 hidden lg:block"></div>
        <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-primary">
          <Star size={18} />
        </button>
      </div>
    </motion.div>
  );
}
