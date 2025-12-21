'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Trophy, Users, Star, ArrowRight, Bell, Filter, Heart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Player, Team, TEAMS, PLAYERS } from '@/lib/mock-data';
import { useFavorites } from '@/hooks/useFavorites';

interface SearchOverlayProps {
  onClose: () => void;
  onSelectTeam: (team: Team) => void;
  onSelectPlayer: (player: Player) => void;
}

export function SearchOverlay({ onClose, onSelectTeam, onSelectPlayer }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const { toggleTeam, togglePlayer, isFavoriteTeam, isFavoritePlayer } = useFavorites();

  const filteredTeams = TEAMS.filter(t => {
    const matchesQuery = t.name.toLowerCase().includes(query.toLowerCase()) || 
                        t.university.toLowerCase().includes(query.toLowerCase());
    return matchesQuery;
  });

  const filteredPlayers = PLAYERS.filter(p => {
    const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
    const matchesSport = !selectedSport || true; // Players in mock data aren't sport-filtered yet, placeholder
    return matchesQuery && matchesSport;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/98 backdrop-blur-xl flex flex-col"
    >
      <div className="p-4 border-b border-white/10 flex items-center gap-4 bg-black/50">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
          <input 
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams, players, or universities..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-primary/50 text-lg transition-all"
          />
        </div>
        <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-2xl transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full p-4 md:p-8 space-y-12 pb-24">
        {/* Teams Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={20} className="text-primary" />
              <h3 className="font-display italic uppercase tracking-tighter text-2xl">Teams</h3>
            </div>
            <span className="text-[10px] font-black tracking-widest text-white/20 uppercase">{filteredTeams.length} Found</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTeams.map(team => (
              <div 
                key={team.id}
                className="group p-4 bg-white/5 rounded-3xl border border-white/5 hover:border-primary/30 flex items-center justify-between transition-all"
              >
                <button 
                  onClick={() => onSelectTeam(team)}
                  className="flex items-center gap-4 flex-1 text-left"
                >
                  <div className="w-12 h-12 bg-black rounded-2xl border border-white/10 flex items-center justify-center text-2xl">
                    {team.logo}
                  </div>
                  <div>
                    <h4 className="font-bold uppercase italic text-sm">{team.name}</h4>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">{team.university}</p>
                  </div>
                </button>
                <button 
                  onClick={() => toggleFavorite('teams', team.id)}
                  className={`p-3 rounded-xl transition-colors ${favorites.teams.includes(team.id) ? 'text-primary bg-primary/10' : 'text-white/20 hover:text-white hover:bg-white/10'}`}
                >
                  <Star size={20} fill={favorites.teams.includes(team.id) ? "currentColor" : "none"} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Players Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-secondary" />
              <h3 className="font-display italic uppercase tracking-tighter text-2xl">Players</h3>
            </div>
            <span className="text-[10px] font-black tracking-widest text-white/20 uppercase">{filteredPlayers.length} Found</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPlayers.map(player => (
              <div 
                key={player.id}
                className="group p-4 bg-white/5 rounded-3xl border border-white/5 hover:border-secondary/30 flex items-center justify-between transition-all"
              >
                <button 
                  onClick={() => onSelectPlayer(player)}
                  className="flex items-center gap-4 flex-1 text-left"
                >
                  <div className="w-12 h-12 bg-black rounded-2xl border border-white/10 flex items-center justify-center font-display italic">
                    {player.number}
                  </div>
                  <div>
                    <h4 className="font-bold uppercase italic text-sm">{player.name}</h4>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">{player.position} • {TEAMS.find(t => t.id === player.teamId)?.shortName}</p>
                  </div>
                </button>
                <button 
                  onClick={() => toggleFavorite('players', player.id)}
                  className={`p-3 rounded-xl transition-colors ${favorites.players.includes(player.id) ? 'text-secondary bg-secondary/10' : 'text-white/20 hover:text-white hover:bg-white/10'}`}
                >
                  <Star size={20} fill={favorites.players.includes(player.id) ? "currentColor" : "none"} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  );
}
