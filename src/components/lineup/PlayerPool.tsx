'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Star, Shield } from 'lucide-react';

interface Player {
    id: string;
    name: string;
    jerseyName?: string;
    number: number;
    position: string;
    rating: number;
    teamId: string;
    originalTeam?: 'home' | 'away'; // For combined XI
}

interface PlayerPoolProps {
    players: Player[];
    selectedPlayerIds: string[];
    onSelectPlayer: (player: Player) => void;
    teamSide: 'home' | 'away' | 'combined';
}

export function PlayerPool({ players, selectedPlayerIds, onSelectPlayer, teamSide }: PlayerPoolProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [positionFilter, setPositionFilter] = useState<string>('all');

    // Get unique positions
    const positions = useMemo(() => {
        const uniquePositions = new Set(players.map(p => p.position));
        return ['all', ...Array.from(uniquePositions)];
    }, [players]);

    // Filter players
    const filteredPlayers = useMemo(() => {
        return players.filter(player => {
            const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (player.jerseyName && player.jerseyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                player.number.toString().includes(searchQuery);
            const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
            return matchesSearch && matchesPosition;
        });
    }, [players, searchQuery, positionFilter]);

    // Sort by rating
    const sortedPlayers = useMemo(() => {
        return [...filteredPlayers].sort((a, b) => b.rating - a.rating);
    }, [filteredPlayers]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/60">
                    Player Pool
                </h3>
                <span className="text-xs text-white/40">
                    {selectedPlayerIds.length} / {players.length} selected
                </span>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" />
                <input
                    type="text"
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary transition-colors"
                />
            </div>

            {/* Position Filter */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {positions.map((pos) => (
                    <button
                        key={pos}
                        onClick={() => setPositionFilter(pos)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${positionFilter === pos
                            ? 'bg-primary text-black'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        {pos}
                    </button>
                ))}
            </div>

            {/* Players List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {sortedPlayers.length === 0 ? (
                    <div className="text-center py-8 text-white/40 text-sm">
                        No players found
                    </div>
                ) : (
                    sortedPlayers.map((player) => (
                        <PlayerCard
                            key={player.id}
                            player={player}
                            isSelected={selectedPlayerIds.includes(player.id)}
                            onClick={() => onSelectPlayer(player)}
                            teamSide={teamSide}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function PlayerCard({ player, isSelected, onClick, teamSide }: {
    player: Player;
    isSelected: boolean;
    onClick: () => void;
    teamSide: 'home' | 'away' | 'combined';
}) {
    return (
        <motion.button
            whileHover={{ x: 5 }}
            onClick={onClick}
            disabled={isSelected}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${isSelected
                ? 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                : 'bg-white/5 border-white/10 hover:border-primary/50 hover:bg-white/10'
                }`}
        >
            {/* Jersey Number */}
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-display text-sm font-bold border ${teamSide === 'combined'
                    ? player.originalTeam === 'home'
                        ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                        : 'bg-red-500/20 border-red-500/30 text-red-400'
                    : teamSide === 'home'
                        ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                        : 'bg-red-500/20 border-red-500/30 text-red-400'
                }`}>
                {player.number}
            </div>

            {/* Player Info */}
            <div className="flex-1 text-left">
                <p className="text-sm font-black uppercase tracking-tight text-white">
                    {player.jerseyName || player.name}
                </p>
                <div className="flex items-center gap-2">
                    <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">
                        {player.position}
                    </p>
                    {player.jerseyName && (
                        <p className="text-[10px] text-white/40 truncate">
                            {player.name}
                        </p>
                    )}
                </div>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-1">
                <Star size={12} className="text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-bold text-yellow-500">
                    {player.rating.toFixed(1)}
                </span>
            </div>

            {/* Selected Indicator */}
            {isSelected && (
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Shield size={14} className="text-black" />
                </div>
            )}
        </motion.button>
    );
}


