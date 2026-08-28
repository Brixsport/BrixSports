'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Trophy, Users, Star, ArrowRight, Bell, Filter, Heart, ArrowUpDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useFavorites } from '@/hooks/useFavorites';

// Define types based on database schema
interface Team {
  id: number;
  name: string;
  shortName: string;
  logo?: string;
  sport?: string;
}

interface Player {
  id: number;
  name: string;
  number: number;
  position: string;
  teamId: number;
  averageRating?: number | null;
  eyePoints?: number;
  team?: Team;
}

interface SearchOverlayProps {
  onClose: () => void;
  onSelectTeam: (team: Team) => void;
  onSelectPlayer: (player: Player) => void;
}

type SortOption = 'rating' | 'points' | 'name';

export function SearchOverlay({ onClose, onSelectTeam, onSelectPlayer }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const { toggleTeam, togglePlayer, isFavoriteTeam, isFavoritePlayer } = useFavorites();

  // Fetch search results from API
  useEffect(() => {
    const fetchSearchResults = async () => {
      if (query.length < 2) {
        setTeams([]);
        setPlayers([]);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          category: 'all',
          limit: '20',
        });

        if (selectedSport && selectedSport !== 'All') {
          params.append('sport', selectedSport.toLowerCase());
        }

        const response = await fetch(`/api/search?${params}`);
        const data = await response.json();

        if (data.results) {
          setTeams(data.results.teams || []);
          setPlayers(data.results.players || []);
        }
      } catch (error) {
        console.error('Search error:', error);
        setTeams([]);
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSearchResults, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, selectedSport]);

  // Sort players based on selected option
  const sortedPlayers = [...players].sort((a, b) => {
    // BACKLOG-254: was sorting on the frozen legacy `rating` column (BACKLOG-253),
    // making "Top Rated" a no-op tie for every player. Unrated (null) sinks last.
    if (sortBy === 'rating') return (b.averageRating ?? -1) - (a.averageRating ?? -1);
    if (sortBy === 'points') return (b.eyePoints || 0) - (a.eyePoints || 0);
    return a.name.localeCompare(b.name);
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/98 backdrop-blur-xl flex flex-col"
    >
      <div className="p-4 border-b border-white/10 flex flex-col md:flex-row items-center gap-4 bg-black/50 sticky top-0 z-20">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams, players, or universities..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-primary/50 text-lg transition-all"
          />
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 flex-1 md:flex-none">
            {['All', 'Football', 'Basketball'].map(sport => (
              <button
                key={sport}
                onClick={() => setSelectedSport(sport === 'All' ? null : sport)}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(sport === 'All' && !selectedSport) || selectedSport === sport
                  ? 'bg-primary text-black'
                  : 'text-white/40 hover:text-white'
                  }`}
              >
                {sport}
              </button>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-2 border-l border-white/10 pl-4 h-10">
            <ArrowUpDown size={14} className="text-white/20" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-[10px] font-black uppercase tracking-widest text-white/40 focus:outline-none cursor-pointer hover:text-white transition-colors"
            >
              <option value="rating">Top Rated</option>
              <option value="points">Eye Points</option>
              <option value="name">Alphabetical</option>
            </select>
          </div>

          <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-2xl transition-colors shrink-0">
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full p-4 md:p-8 space-y-12 pb-32">
        {/* Teams Section */}
        {teams.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <Trophy size={20} className="text-primary group-hover:rotate-12 transition-transform" />
                <h3 className="font-display italic uppercase tracking-tighter text-2xl">Teams</h3>
              </div>
              <span className="text-[10px] font-black tracking-widest text-white/20 uppercase">{teams.length} Found</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map(team => (
                <div
                  key={team.id}
                  className="group p-4 bg-white/5 rounded-3xl border border-white/5 hover:border-primary/30 flex items-center justify-between transition-all"
                >
                  <button
                    onClick={() => onSelectTeam(team)}
                    className="flex items-center gap-4 flex-1 text-left"
                  >
                    <div className="w-12 h-12 bg-black rounded-2xl border border-white/10 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                      {team.logo || '🏀'}
                    </div>
                    <div>
                      <h4 className="font-bold uppercase italic text-sm group-hover:text-primary transition-colors">{team.name}</h4>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">{team.shortName}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => toggleTeam(String(team.id))}
                    className={`p-3 rounded-xl transition-colors ${isFavoriteTeam(String(team.id)) ? 'text-primary bg-primary/10' : 'text-white/20 hover:text-white hover:bg-white/10'}`}
                  >
                    <Heart size={20} fill={isFavoriteTeam(String(team.id)) ? "currentColor" : "none"} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Players Section */}
        {sortedPlayers.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-secondary group-hover:scale-110 transition-transform" />
                <h3 className="font-display italic uppercase tracking-tighter text-2xl">Players</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="lg:hidden flex items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-white/5 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white/40"
                  >
                    <option value="rating">Top Rated</option>
                    <option value="points">Eye Points</option>
                    <option value="name">A-Z</option>
                  </select>
                </div>
                <span className="text-[10px] font-black tracking-widest text-white/20 uppercase">{sortedPlayers.length} Found</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedPlayers.map(player => (
                <div
                  key={player.id}
                  className="group p-4 bg-white/5 rounded-3xl border border-white/5 hover:border-secondary/30 flex items-center justify-between transition-all"
                >
                  <button
                    onClick={() => onSelectPlayer(player)}
                    className="flex items-center gap-4 flex-1 text-left"
                  >
                    <div className="w-12 h-12 bg-black rounded-2xl border border-white/10 flex items-center justify-center font-display italic group-hover:scale-105 transition-transform">
                      {player.number}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold uppercase italic text-sm group-hover:text-secondary transition-colors">{player.name}</h4>
                        <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded font-black italic">
                          {sortBy === 'points' ? (player.eyePoints || 0) : (player.averageRating != null ? player.averageRating.toFixed(1) : '-')}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">{player.position} • {player.team?.shortName || 'N/A'}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => togglePlayer(String(player.id))}
                    className={`p-3 rounded-xl transition-colors ${isFavoritePlayer(String(player.id)) ? 'text-secondary bg-secondary/10' : 'text-white/20 hover:text-white hover:bg-white/10'}`}
                  >
                    <Heart size={20} fill={isFavoritePlayer(String(player.id)) ? "currentColor" : "none"} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {(teams.length === 0 && sortedPlayers.length === 0 && query.length >= 2 && !loading) && (
          <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[48px]">
            <Search size={48} className="mx-auto text-white/10 mb-4" />
            <p className="text-white/30 font-display text-xl uppercase italic">No results found for "{query}"</p>
          </div>
        )}

        {loading && (
          <div className="py-32 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-white/30 font-display text-xl uppercase italic">Searching...</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
