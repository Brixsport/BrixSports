'use client';

import { motion } from 'framer-motion';
import { Heart, Activity, ArrowRight, User } from 'lucide-react';
import { Match, Player, Team, MATCHES, PLAYERS, TEAMS } from '@/lib/mock-data';
import { useFavorites } from '@/hooks/useFavorites';

interface MyFeedProps {
  onSelectMatch: (match: Match) => void;
  onSelectPlayer: (player: Player) => void;
}

export function MyFeed({ onSelectMatch, onSelectPlayer }: MyFeedProps) {
  const { favoriteTeams, favoritePlayers } = useFavorites();

  const followedMatches = MATCHES.filter(
    m => favoriteTeams.includes(m.homeTeamId) || favoriteTeams.includes(m.awayTeamId)
  );

  const followedPlayers = PLAYERS.filter(p => favoritePlayers.includes(p.id));

  if (favoriteTeams.length === 0 && favoritePlayers.length === 0) {
    return (
      <div className="bg-white/5 rounded-[32px] border border-white/10 p-8 text-center space-y-4">
        <Heart size={32} className="mx-auto text-white/10" />
        <p className="text-sm font-bold text-white/40 italic uppercase tracking-widest">Your feed is empty</p>
        <p className="text-[10px] text-white/20 uppercase tracking-tight">Follow schools and players to see live updates here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl tracking-tight italic uppercase">My Feed</h3>
        <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
      </div>

      {followedMatches.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] px-2">Live & Upcoming</p>
          {followedMatches.map(match => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={match.id}
              onClick={() => onSelectMatch(match)}
              className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/5 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-primary uppercase">{match.status}</span>
                <Activity size={12} className="text-white/20 group-hover:text-primary transition-colors" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-xs font-bold truncate italic">{TEAMS.find(t => t.id === match.homeTeamId)?.shortName}</span>
                </div>
                <div className="bg-black/40 px-3 py-1 rounded text-sm font-display italic">
                  {match.homeScore} : {match.awayScore}
                </div>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-xs font-bold truncate italic">{TEAMS.find(t => t.id === match.awayTeamId)?.shortName}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {followedPlayers.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] px-2">Followed Players</p>
          <div className="grid grid-cols-1 gap-3">
            {followedPlayers.map(player => (
              <motion.div
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={player.id}
                onClick={() => onSelectPlayer(player)}
                className="flex items-center gap-3 bg-white/5 hover:bg-white/10 p-3 rounded-2xl border border-white/5 cursor-pointer transition-all group"
              >
                <div className="w-10 h-10 bg-black rounded-xl border border-white/10 flex items-center justify-center text-sm font-display italic group-hover:border-primary/50">
                  {player.number}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold truncate italic uppercase">{player.name}</p>
                  <p className="text-[9px] text-white/40 uppercase">{TEAMS.find(t => t.id === player.teamId)?.shortName} • {player.rating.toFixed(1)}</p>
                </div>
                <button className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <ArrowRight size={14} className="text-primary" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
