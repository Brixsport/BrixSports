'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Star, Trophy, Users, Activity, X, Plus } from 'lucide-react';

// Mock favorites data
const mockFavorites = {
    teams: [
        { id: 'unilag', name: 'UNILAG Marines', logo: '🌊', university: 'University of Lagos', color: '#003366' },
        { id: 'uniben', name: 'UNIBEN Royals', logo: '🦁', university: 'University of Benin', color: '#990000' },
    ],
    players: [
        { id: 'p1', name: 'Tunde Adeyemi', number: 10, team: 'UNILAG Marines', position: 'ST', rating: 8.5 },
        { id: 'p3', name: 'Segun Bello', number: 9, team: 'UNILAG Marines', position: 'LW', rating: 8.2 },
        { id: 'p2', name: 'Emeka Obi', number: 7, team: 'UNIBEN Royals', position: 'CM', rating: 7.8 },
    ],
    competitions: [
        { id: 'c1', name: 'NUGA Games 2024', sport: 'Football', teams: 16 },
        { id: 'c2', name: 'NUGA Basketball Championship', sport: 'Basketball', teams: 12 },
    ],
    matches: [
        { id: 'm1', home: 'UNILAG Marines', away: 'UNIBEN Royals', sport: 'Football', date: '2024-03-25', time: '16:00' },
    ],
};

type TabType = 'teams' | 'players' | 'competitions' | 'matches';

export default function FavoritesPage() {
    const [activeTab, setActiveTab] = useState<TabType>('teams');
    const [favorites, setFavorites] = useState(mockFavorites);

    const removeFavorite = (type: TabType, id: string) => {
        setFavorites(prev => ({
            ...prev,
            [type]: prev[type].filter((item: any) => item.id !== id),
        }));
    };

    const tabs: { key: TabType; label: string; icon: React.ReactNode; count: number }[] = [
        { key: 'teams', label: 'Teams', icon: <Users size={16} />, count: favorites.teams.length },
        { key: 'players', label: 'Players', icon: <Star size={16} />, count: favorites.players.length },
        { key: 'competitions', label: 'Competitions', icon: <Trophy size={16} />, count: favorites.competitions.length },
        { key: 'matches', label: 'Matches', icon: <Activity size={16} />, count: favorites.matches.length },
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Heart size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Your Collection</span>
                    </div>
                    <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none">Favorites</h1>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-3">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all ${activeTab === tab.key
                                    ? 'bg-primary text-black'
                                    : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            {tab.icon}
                            <span className="font-black uppercase tracking-widest text-sm">{tab.label}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${activeTab === tab.key ? 'bg-black/20' : 'bg-white/10'
                                }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'teams' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {favorites.teams.map((team) => (
                                    <TeamCard key={team.id} team={team} onRemove={() => removeFavorite('teams', team.id)} />
                                ))}
                                <AddCard type="team" />
                            </div>
                        )}

                        {activeTab === 'players' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {favorites.players.map((player) => (
                                    <PlayerCard key={player.id} player={player} onRemove={() => removeFavorite('players', player.id)} />
                                ))}
                                <AddCard type="player" />
                            </div>
                        )}

                        {activeTab === 'competitions' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {favorites.competitions.map((comp) => (
                                    <CompetitionCard key={comp.id} competition={comp} onRemove={() => removeFavorite('competitions', comp.id)} />
                                ))}
                                <AddCard type="competition" />
                            </div>
                        )}

                        {activeTab === 'matches' && (
                            <div className="space-y-4">
                                {favorites.matches.map((match) => (
                                    <MatchCard key={match.id} match={match} onRemove={() => removeFavorite('matches', match.id)} />
                                ))}
                                <AddCard type="match" />
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function TeamCard({ team, onRemove }: { team: any; onRemove: () => void }) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white/5 border border-white/10 rounded-[32px] p-6 relative group"
        >
            <button
                onClick={onRemove}
                className="absolute top-4 right-4 w-8 h-8 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30"
            >
                <X size={14} className="text-red-500" />
            </button>

            <div className="text-center">
                <span className="text-6xl mb-4 block">{team.logo}</span>
                <h3 className="text-xl font-display italic uppercase tracking-tight mb-2">{team.name}</h3>
                <p className="text-xs text-white/60 font-bold uppercase">{team.university}</p>
                <div className="flex items-center justify-center gap-2 mt-4">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }}></div>
                    <span className="text-xs text-white/40">Team Color</span>
                </div>
            </div>
        </motion.div>
    );
}

function PlayerCard({ player, onRemove }: { player: any; onRemove: () => void }) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white/5 border border-white/10 rounded-[32px] p-6 relative group"
        >
            <button
                onClick={onRemove}
                className="absolute top-4 right-4 w-8 h-8 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30"
            >
                <X size={14} className="text-red-500" />
            </button>

            <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center text-2xl font-display font-bold">
                    {player.number}
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-black uppercase tracking-tight">{player.name}</h3>
                    <p className="text-xs text-white/60 font-bold">{player.team}</p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-white/10 rounded-lg text-xs font-black uppercase">{player.position}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-lg font-display italic text-primary">{player.rating}</span>
                </div>
            </div>
        </motion.div>
    );
}

function CompetitionCard({ competition, onRemove }: { competition: any; onRemove: () => void }) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white/5 border border-white/10 rounded-[32px] p-6 relative group"
        >
            <button
                onClick={onRemove}
                className="absolute top-4 right-4 w-8 h-8 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30"
            >
                <X size={14} className="text-red-500" />
            </button>

            <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-3xl">
                    🏆
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-display italic uppercase tracking-tight mb-2">{competition.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-white/60">
                        <div className="flex items-center gap-2">
                            <Activity size={14} />
                            {competition.sport}
                        </div>
                        <div className="flex items-center gap-2">
                            <Users size={14} />
                            {competition.teams} Teams
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function MatchCard({ match, onRemove }: { match: any; onRemove: () => void }) {
    return (
        <motion.div
            whileHover={{ x: 5 }}
            className="bg-white/5 border border-white/10 rounded-[32px] p-6 relative group"
        >
            <button
                onClick={onRemove}
                className="absolute top-4 right-4 w-8 h-8 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30"
            >
                <X size={14} className="text-red-500" />
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                        <span className="px-3 py-1 bg-primary/20 border border-primary/30 rounded-lg text-xs font-black uppercase text-primary">
                            {match.sport}
                        </span>
                        <span className="text-xs text-white/40">{match.date} • {match.time}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-black uppercase tracking-tight">{match.home}</span>
                        <span className="text-2xl font-display italic text-white/40">VS</span>
                        <span className="text-lg font-black uppercase tracking-tight">{match.away}</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function AddCard({ type }: { type: string }) {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            className="bg-white/5 border-2 border-dashed border-white/20 rounded-[32px] p-6 hover:bg-white/10 hover:border-primary/50 transition-all min-h-[200px] flex flex-col items-center justify-center gap-3 text-white/40 hover:text-primary"
        >
            <Plus size={32} />
            <span className="text-sm font-black uppercase tracking-widest">Add {type}</span>
        </motion.button>
    );
}
