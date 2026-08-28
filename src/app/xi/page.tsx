'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Trophy,
    Save,
    Share2,
    Eye,
    Heart,
    Trash2,
    Plus,
    Search,
    Filter,
    ArrowLeft,
    Grid3x3,
    X,
} from 'lucide-react';
import Link from 'next/link';

interface Player {
    id: string;
    name: string;
    position: string;
    team: string;
    averageRating: number | null;
    imageUrl: string | null;
}

interface PositionSlot {
    position: string;
    player: Player | null;
    x: number;
    y: number;
}

const FORMATIONS = {
    '4-4-2': [
        // Goalkeeper
        { position: 'GK', x: 50, y: 90 },
        // Defenders
        { position: 'LB', x: 20, y: 70 },
        { position: 'CB', x: 40, y: 70 },
        { position: 'CB', x: 60, y: 70 },
        { position: 'RB', x: 80, y: 70 },
        // Midfielders
        { position: 'LM', x: 20, y: 45 },
        { position: 'CM', x: 40, y: 45 },
        { position: 'CM', x: 60, y: 45 },
        { position: 'RM', x: 80, y: 45 },
        // Forwards
        { position: 'ST', x: 40, y: 20 },
        { position: 'ST', x: 60, y: 20 },
    ],
    '4-3-3': [
        // Goalkeeper
        { position: 'GK', x: 50, y: 90 },
        // Defenders
        { position: 'LB', x: 20, y: 70 },
        { position: 'CB', x: 40, y: 70 },
        { position: 'CB', x: 60, y: 70 },
        { position: 'RB', x: 80, y: 70 },
        // Midfielders
        { position: 'CM', x: 30, y: 50 },
        { position: 'CM', x: 50, y: 50 },
        { position: 'CM', x: 70, y: 50 },
        // Forwards
        { position: 'LW', x: 20, y: 20 },
        { position: 'ST', x: 50, y: 20 },
        { position: 'RW', x: 80, y: 20 },
    ],
    '3-5-2': [
        // Goalkeeper
        { position: 'GK', x: 50, y: 90 },
        // Defenders
        { position: 'CB', x: 30, y: 70 },
        { position: 'CB', x: 50, y: 70 },
        { position: 'CB', x: 70, y: 70 },
        // Midfielders
        { position: 'LM', x: 15, y: 45 },
        { position: 'CM', x: 35, y: 45 },
        { position: 'CM', x: 50, y: 45 },
        { position: 'CM', x: 65, y: 45 },
        { position: 'RM', x: 85, y: 45 },
        // Forwards
        { position: 'ST', x: 40, y: 20 },
        { position: 'ST', x: 60, y: 20 },
    ],
};

export default function BuildYourXIPage() {
    const [formation, setFormation] = useState<keyof typeof FORMATIONS>('4-3-3');
    const [positions, setPositions] = useState<PositionSlot[]>([]);
    const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPosition, setFilterPosition] = useState('all');
    const [teamName, setTeamName] = useState('My Dream Team');
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [showPlayerSelector, setShowPlayerSelector] = useState(false);

    useEffect(() => {
        initializeFormation();
        fetchPlayers();
    }, [formation]);

    const initializeFormation = () => {
        const formationPositions = FORMATIONS[formation].map((pos, index) => ({
            ...pos,
            player: null,
        }));
        setPositions(formationPositions);
    };

    const fetchPlayers = async () => {
        try {
            const response = await fetch('/api/players?limit=100');
            const data = await response.json();
            setAvailablePlayers(data.players || []);
        } catch (error) {
            console.error('Error fetching players:', error);
        }
    };

    const handleSlotClick = (index: number) => {
        setSelectedSlot(index);
        setShowPlayerSelector(true);
    };

    const handlePlayerSelect = (player: Player) => {
        if (selectedSlot !== null) {
            const newPositions = [...positions];
            newPositions[selectedSlot] = {
                ...newPositions[selectedSlot],
                player,
            };
            setPositions(newPositions);
            setShowPlayerSelector(false);
            setSelectedSlot(null);
        }
    };

    const handleRemovePlayer = (index: number) => {
        const newPositions = [...positions];
        newPositions[index] = {
            ...newPositions[index],
            player: null,
        };
        setPositions(newPositions);
    };

    const handleSaveTeam = async () => {
        const teamData = {
            name: teamName,
            formation,
            players: positions.map((pos, index) => ({
                position: pos.position,
                playerId: pos.player?.id || null,
                slotIndex: index,
            })),
        };

        try {
            const response = await fetch('/api/user/xi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(teamData),
            });

            if (response.ok) {
                alert('Team saved successfully!');
            }
        } catch (error) {
            console.error('Error saving team:', error);
        }
    };

    const filteredPlayers = availablePlayers.filter((player) => {
        const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPosition = filterPosition === 'all' || player.position === filterPosition;
        return matchesSearch && matchesPosition;
    });

    const teamRating = positions.reduce((sum, pos) => sum + (pos.player?.averageRating || 0), 0) / 11;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                Back
                            </Link>
                            <div className="h-6 w-px bg-slate-700" />
                            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                                Build Your XI
                            </h1>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSaveTeam}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-500 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all"
                            >
                                <Save className="w-4 h-4" />
                                Save Team
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 transition-colors">
                                <Share2 className="w-4 h-4" />
                                Share
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Sidebar - Controls */}
                    <div className="space-y-6">
                        {/* Team Name */}
                        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                            <label className="block text-sm font-semibold text-slate-300 mb-2">
                                Team Name
                            </label>
                            <input
                                type="text"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                placeholder="Enter team name..."
                            />
                        </div>

                        {/* Formation Selector */}
                        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                            <label className="block text-sm font-semibold text-slate-300 mb-3">
                                Formation
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.keys(FORMATIONS).map((form) => (
                                    <button
                                        key={form}
                                        onClick={() => setFormation(form as keyof typeof FORMATIONS)}
                                        className={`px-4 py-3 rounded-xl font-bold transition-all ${formation === form
                                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/50'
                                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                            }`}
                                    >
                                        {form}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Team Stats */}
                        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Team Stats</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Overall Rating</span>
                                    <span className="text-2xl font-bold text-cyan-400">
                                        {teamRating.toFixed(1)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Players Selected</span>
                                    <span className="text-lg font-semibold text-white">
                                        {positions.filter((p) => p.player).length}/11
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
                            <div className="space-y-2">
                                <button
                                    onClick={() => initializeFormation()}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 text-red-400 rounded-lg font-semibold hover:bg-red-500/30 transition-colors border border-red-500/20"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Clear Team
                                </button>
                                <Link
                                    href="/xi/gallery"
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500/20 text-purple-400 rounded-lg font-semibold hover:bg-purple-500/30 transition-colors border border-purple-500/20"
                                >
                                    <Grid3x3 className="w-4 h-4" />
                                    View Gallery
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Center - Football Pitch */}
                    <div className="lg:col-span-2">
                        <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl p-8 relative overflow-hidden border-4 border-white/10">
                            {/* Pitch Lines */}
                            <div className="absolute inset-0 opacity-20">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-white" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white rounded-full" />
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 border-2 border-white border-t-0" />
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-24 border-2 border-white border-b-0" />
                            </div>

                            {/* Player Positions */}
                            <div className="relative aspect-[2/3] max-h-[800px]">
                                {positions.map((slot, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="absolute"
                                        style={{
                                            left: `${slot.x}%`,
                                            top: `${slot.y}%`,
                                            transform: 'translate(-50%, -50%)',
                                        }}
                                    >
                                        {slot.player ? (
                                            <div className="relative group">
                                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg border-4 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform">
                                                    {slot.player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                </div>
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 px-3 py-1 rounded-lg text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {slot.player.name}
                                                </div>
                                                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-cyan-500 px-2 py-0.5 rounded text-white text-xs font-bold">
                                                    {slot.position}
                                                </div>
                                                <button
                                                    onClick={() => handleRemovePlayer(index)}
                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-4 h-4 text-white" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleSlotClick(index)}
                                                className="w-20 h-20 rounded-full border-4 border-dashed border-white/50 flex flex-col items-center justify-center text-white hover:border-cyan-400 hover:bg-white/10 transition-all group"
                                            >
                                                <Plus className="w-6 h-6 mb-1 group-hover:scale-125 transition-transform" />
                                                <span className="text-xs font-bold">{slot.position}</span>
                                            </button>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Player Selector Modal */}
            <AnimatePresence>
                {showPlayerSelector && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowPlayerSelector(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[80vh] overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-slate-700">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-2xl font-bold text-white">Select Player</h2>
                                    <button
                                        onClick={() => setShowPlayerSelector(false)}
                                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        <X className="w-6 h-6 text-slate-400" />
                                    </button>
                                </div>

                                {/* Search and Filter */}
                                <div className="flex gap-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search players..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>
                                    <select
                                        value={filterPosition}
                                        onChange={(e) => setFilterPosition(e.target.value)}
                                        className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    >
                                        <option value="all">All Positions</option>
                                        <option value="GK">Goalkeeper</option>
                                        <option value="DEF">Defender</option>
                                        <option value="MID">Midfielder</option>
                                        <option value="FWD">Forward</option>
                                    </select>
                                </div>
                            </div>

                            {/* Player List */}
                            <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {filteredPlayers.map((player) => (
                                        <motion.button
                                            key={player.id}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handlePlayerSelect(player)}
                                            className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-cyan-500/50 transition-all text-left"
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                                                    {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-white truncate">{player.name}</h3>
                                                    <p className="text-sm text-slate-400">{player.team}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                                                    {player.position}
                                                </span>
                                                <span className="text-lg font-bold text-white">
                                                    {player.averageRating != null ? player.averageRating.toFixed(1) : '-'}
                                                </span>
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

