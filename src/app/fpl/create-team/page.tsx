'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Search,
    Filter,
    Check,
    X,
    DollarSign,
    TrendingUp,
    Users,
    Shield,
    Zap,
    Target
} from 'lucide-react';

interface Player {
    id: string;
    name: string;
    teamName: string;
    position: 'GK' | 'DEF' | 'MID' | 'FWD';
    price: number;
    totalPoints: number;
    form: number;
    selectedBy: number;
}

interface SquadPlayer {
    id: string;
    name: string;
    teamName: string;
    playerPosition: 'GK' | 'DEF' | 'MID' | 'FWD'; // Renamed from position
    price: number;
    totalPoints: number;
    form: number;
    selectedBy: number;
    squadPosition: number; // 1-15 (renamed from position)
    isCaptain: boolean;
    isViceCaptain: boolean;
}

const POSITIONS = {
    GK: { required: 2, label: 'Goalkeepers' },
    DEF: { required: 5, label: 'Defenders' },
    MID: { required: 5, label: 'Midfielders' },
    FWD: { required: 3, label: 'Forwards' },
};

export default function CreateTeamPage() {
    const router = useRouter();
    const [teamName, setTeamName] = useState('');
    const [squad, setSquad] = useState<SquadPlayer[]>([]);
    const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
    const [selectedPosition, setSelectedPosition] = useState<'GK' | 'DEF' | 'MID' | 'FWD'>('GK');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    const budget = 100;
    const spent = squad.reduce((sum, p) => sum + p.price, 0);
    const remaining = budget - spent;

    useEffect(() => {
        fetchPlayers();
    }, [selectedPosition]);

    const fetchPlayers = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/fpl/players?position=${selectedPosition}&sortBy=totalPoints&limit=200`);
            if (res.ok) {
                const data = await res.json();
                setAvailablePlayers(data.map((d: any) => ({
                    id: d.player.id,
                    name: d.player.name,
                    teamName: d.team?.name || 'Unknown',
                    position: d.fplData.position,
                    price: d.fplData.price,
                    totalPoints: d.fplData.totalPoints,
                    form: d.fplData.form,
                    selectedBy: d.fplData.selectedBy,
                })));
            }
        } catch (error) {
            console.error('Error fetching players:', error);
        } finally {
            setLoading(false);
        }
    };

    const addPlayer = (player: Player) => {
        const positionCount = squad.filter(p => p.playerPosition === player.position).length;
        const maxForPosition = POSITIONS[player.position].required;

        if (positionCount >= maxForPosition) {
            alert(`You can only have ${maxForPosition} ${POSITIONS[player.position].label}`);
            return;
        }

        if (spent + player.price > budget) {
            alert('Not enough budget!');
            return;
        }

        if (squad.length >= 15) {
            alert('Squad is full!');
            return;
        }

        const newPlayer: SquadPlayer = {
            id: player.id,
            name: player.name,
            teamName: player.teamName,
            playerPosition: player.position,
            price: player.price,
            totalPoints: player.totalPoints,
            form: player.form,
            selectedBy: player.selectedBy,
            squadPosition: squad.length + 1,
            isCaptain: false,
            isViceCaptain: false,
        };

        setSquad([...squad, newPlayer]);
    };

    const removePlayer = (playerId: string) => {
        setSquad(squad.filter(p => p.id !== playerId));
    };

    const setCaptain = (playerId: string) => {
        setSquad(squad.map(p => ({
            ...p,
            isCaptain: p.id === playerId,
            isViceCaptain: p.isViceCaptain && p.id !== playerId ? p.isViceCaptain : false,
        })));
    };

    const setViceCaptain = (playerId: string) => {
        setSquad(squad.map(p => ({
            ...p,
            isViceCaptain: p.id === playerId,
            isCaptain: p.isCaptain && p.id !== playerId ? p.isCaptain : false,
        })));
    };

    const handleCreateTeam = async () => {
        if (!teamName.trim()) {
            alert('Please enter a team name');
            return;
        }

        if (squad.length !== 15) {
            alert('You must select exactly 15 players');
            return;
        }

        // Validate formation
        const gk = squad.filter(p => p.playerPosition === 'GK').length;
        const def = squad.filter(p => p.playerPosition === 'DEF').length;
        const mid = squad.filter(p => p.playerPosition === 'MID').length;
        const fwd = squad.filter(p => p.playerPosition === 'FWD').length;

        if (gk !== 2 || def !== 5 || mid !== 5 || fwd !== 3) {
            alert('Invalid squad formation! You need 2 GK, 5 DEF, 5 MID, 3 FWD');
            return;
        }

        const captain = squad.find(p => p.isCaptain);
        if (!captain) {
            alert('Please select a captain');
            return;
        }

        try {
            setCreating(true);
            const res = await fetch('/api/fpl/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'user_1', // Replace with actual user ID
                    name: teamName,
                    initialSquad: squad.map(p => ({
                        playerId: p.id,
                        position: p.squadPosition,
                        price: p.price,
                        isCaptain: p.isCaptain,
                        isViceCaptain: p.isViceCaptain,
                    })),
                }),
            });

            if (res.ok) {
                router.push('/fpl');
            } else {
                const error = await res.json();
                alert(error.error || 'Failed to create team');
            }
        } catch (error) {
            console.error('Error creating team:', error);
            alert('Failed to create team');
        } finally {
            setCreating(false);
        }
    };

    const filteredPlayers = availablePlayers.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.teamName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getPositionCount = (pos: string) => squad.filter(p => p.playerPosition === pos).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-white/70 hover:text-white mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back
                    </button>
                    <h1 className="text-4xl font-bold text-white mb-4">Create Your Team</h1>

                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 mb-6">
                        <input
                            type="text"
                            placeholder="Enter team name..."
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            className="w-full bg-transparent text-white text-xl font-semibold placeholder-white/50 outline-none"
                        />
                    </div>

                    {/* Budget Display */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                            <p className="text-white/70 text-sm mb-1">Budget</p>
                            <p className="text-2xl font-bold text-white">£{budget}m</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                            <p className="text-white/70 text-sm mb-1">Spent</p>
                            <p className="text-2xl font-bold text-white">£{spent.toFixed(1)}m</p>
                        </div>
                        <div className={`backdrop-blur-md rounded-xl p-4 border ${remaining < 0 ? 'bg-red-500/20 border-red-500/50' : 'bg-blue-500/20 border-blue-500/50'
                            }`}>
                            <p className="text-white/70 text-sm mb-1">Remaining</p>
                            <p className="text-2xl font-bold text-white">£{remaining.toFixed(1)}m</p>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Squad Display */}
                    <div className="lg:col-span-1">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 sticky top-6">
                            <h2 className="text-xl font-bold text-white mb-4">
                                Your Squad ({squad.length}/15)
                            </h2>

                            {/* Position Counts */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {Object.entries(POSITIONS).map(([pos, data]) => (
                                    <div
                                        key={pos}
                                        className={`p-2 rounded-lg text-center ${getPositionCount(pos) === data.required
                                            ? 'bg-blue-500/20 border border-blue-500/50'
                                            : 'bg-white/5 border border-white/10'
                                            }`}
                                    >
                                        <p className="text-white/70 text-xs">{pos}</p>
                                        <p className="text-white font-bold">
                                            {getPositionCount(pos)}/{data.required}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Squad List */}
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {squad.length === 0 ? (
                                    <p className="text-white/50 text-center py-8">
                                        No players selected
                                    </p>
                                ) : (
                                    squad.map(player => (
                                        <div
                                            key={player.id}
                                            className="bg-white/5 rounded-lg p-3 border border-white/10"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex-1">
                                                    <p className="text-white font-semibold text-sm">
                                                        {player.name}
                                                    </p>
                                                    <p className="text-white/50 text-xs">
                                                        {player.teamName} • £{player.price}m
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => removePlayer(player.id)}
                                                    className="p-1 hover:bg-red-500/20 rounded"
                                                >
                                                    <X className="w-4 h-4 text-red-400" />
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setCaptain(player.id)}
                                                    className={`flex-1 px-2 py-1 rounded text-xs ${player.isCaptain
                                                        ? 'bg-yellow-500 text-gray-900 font-bold'
                                                        : 'bg-white/10 text-white/70'
                                                        }`}
                                                >
                                                    Captain
                                                </button>
                                                <button
                                                    onClick={() => setViceCaptain(player.id)}
                                                    className={`flex-1 px-2 py-1 rounded text-xs ${player.isViceCaptain
                                                        ? 'bg-blue-500 text-white font-bold'
                                                        : 'bg-white/10 text-white/70'
                                                        }`}
                                                >
                                                    Vice
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {squad.length === 15 && (
                                <button
                                    onClick={handleCreateTeam}
                                    disabled={creating}
                                    className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {creating ? 'Creating...' : 'Create Team'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Player Selection */}
                    <div className="lg:col-span-2">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                            {/* Position Tabs */}
                            <div className="flex gap-2 mb-4 overflow-x-auto">
                                {Object.entries(POSITIONS).map(([pos, data]) => (
                                    <button
                                        key={pos}
                                        onClick={() => setSelectedPosition(pos as any)}
                                        className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap ${selectedPosition === pos
                                            ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900'
                                            : 'bg-white/10 text-white/70 hover:text-white'
                                            }`}
                                    >
                                        {data.label} ({getPositionCount(pos)}/{data.required})
                                    </button>
                                ))}
                            </div>

                            {/* Search */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                                <input
                                    type="text"
                                    placeholder="Search players..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 outline-none focus:border-yellow-400"
                                />
                            </div>

                            {/* Players List */}
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {loading ? (
                                    <p className="text-white/50 text-center py-8">Loading players...</p>
                                ) : filteredPlayers.length === 0 ? (
                                    <p className="text-white/50 text-center py-8">No players found</p>
                                ) : (
                                    filteredPlayers.map(player => {
                                        const isSelected = squad.some(p => p.id === player.id);
                                        const canAfford = remaining >= player.price || isSelected;

                                        return (
                                            <div
                                                key={player.id}
                                                className={`p-4 rounded-lg border ${isSelected
                                                    ? 'bg-blue-500/20 border-blue-500/50'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <p className="text-white font-semibold">{player.name}</p>
                                                        <p className="text-white/50 text-sm">{player.teamName}</p>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <p className="text-white font-bold">£{player.price}m</p>
                                                            <p className="text-white/50 text-xs">{player.totalPoints} pts</p>
                                                        </div>
                                                        {isSelected ? (
                                                            <button
                                                                onClick={() => removePlayer(player.id)}
                                                                className="p-2 bg-red-500/20 rounded-lg"
                                                            >
                                                                <Check className="w-5 h-5 text-blue-400" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => addPlayer(player)}
                                                                disabled={!canAfford}
                                                                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                Add
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

