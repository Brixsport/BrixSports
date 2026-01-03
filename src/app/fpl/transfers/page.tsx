'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Search,
    Filter,
    TrendingUp,
    TrendingDown,
    ArrowRightLeft,
    Check,
    X,
    DollarSign,
    AlertCircle,
    Zap,
    Users
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
    priceChange: number;
}

interface Transfer {
    playerOut: Player | null;
    playerIn: Player | null;
}

export default function TransfersPage() {
    const router = useRouter();
    const [currentSquad, setCurrentSquad] = useState<Player[]>([]);
    const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [selectedPosition, setSelectedPosition] = useState<'GK' | 'DEF' | 'MID' | 'FWD' | 'ALL'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'points' | 'price' | 'form'>('points');
    const [loading, setLoading] = useState(true);
    const [selectingFor, setSelectingFor] = useState<'out' | 'in' | null>(null);
    const [currentTransfer, setCurrentTransfer] = useState<Transfer>({ playerOut: null, playerIn: null });

    const freeTransfers = 1;
    const bankBalance = 2.5;
    const transferCost = transfers.length > freeTransfers ? (transfers.length - freeTransfers) * 4 : 0;

    useEffect(() => {
        fetchData();
    }, [selectedPosition, sortBy]);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Mock current squad
            setCurrentSquad([
                { id: '1', name: 'Alisson', teamName: 'Liverpool', position: 'GK', price: 5.5, totalPoints: 45, form: 4.2, selectedBy: 15, priceChange: 0 },
                { id: '8', name: 'Salah', teamName: 'Liverpool', position: 'MID', price: 13.0, totalPoints: 125, form: 7.8, selectedBy: 65, priceChange: 0.1 },
                // Add more mock players...
            ]);

            // Mock available players
            const mockPlayers: Player[] = [
                { id: 'p1', name: 'Ederson', teamName: 'Man City', position: 'GK', price: 5.5, totalPoints: 48, form: 4.5, selectedBy: 12, priceChange: 0.1 },
                { id: 'p2', name: 'De Bruyne', teamName: 'Man City', position: 'MID', price: 12.5, totalPoints: 118, form: 6.9, selectedBy: 45, priceChange: 0 },
                { id: 'p3', name: 'Haaland', teamName: 'Man City', position: 'FWD', price: 14.0, totalPoints: 145, form: 8.5, selectedBy: 78, priceChange: 0.2 },
                { id: 'p4', name: 'Saka', teamName: 'Arsenal', position: 'MID', price: 9.0, totalPoints: 95, form: 5.4, selectedBy: 35, priceChange: 0.1 },
                { id: 'p5', name: 'Van Dijk', teamName: 'Liverpool', position: 'DEF', price: 6.5, totalPoints: 78, form: 5.1, selectedBy: 28, priceChange: 0 },
            ];

            let filtered = mockPlayers;
            if (selectedPosition !== 'ALL') {
                filtered = mockPlayers.filter(p => p.position === selectedPosition);
            }

            // Sort
            filtered.sort((a, b) => {
                switch (sortBy) {
                    case 'price':
                        return b.price - a.price;
                    case 'form':
                        return b.form - a.form;
                    case 'points':
                    default:
                        return b.totalPoints - a.totalPoints;
                }
            });

            setAvailablePlayers(filtered);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const startTransfer = (type: 'out' | 'in') => {
        setSelectingFor(type);
    };

    const selectPlayer = (player: Player) => {
        if (selectingFor === 'out') {
            setCurrentTransfer({ ...currentTransfer, playerOut: player });
            setSelectingFor('in');
        } else if (selectingFor === 'in') {
            setCurrentTransfer({ ...currentTransfer, playerIn: player });
            setSelectingFor(null);
        }
    };

    const confirmTransfer = () => {
        if (currentTransfer.playerOut && currentTransfer.playerIn) {
            setTransfers([...transfers, currentTransfer]);
            setCurrentTransfer({ playerOut: null, playerIn: null });
        }
    };

    const cancelTransfer = () => {
        setCurrentTransfer({ playerOut: null, playerIn: null });
        setSelectingFor(null);
    };

    const removeTransfer = (index: number) => {
        setTransfers(transfers.filter((_, i) => i !== index));
    };

    const makeTransfers = async () => {
        try {
            for (const transfer of transfers) {
                await fetch('/api/fpl/transfers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        teamId: 'team_1',
                        playerInId: transfer.playerIn?.id,
                        playerOutId: transfer.playerOut?.id,
                    }),
                });
            }
            router.push('/fpl/team');
        } catch (error) {
            console.error('Error making transfers:', error);
            alert('Failed to make transfers');
        }
    };

    const filteredPlayers = availablePlayers.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.teamName.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

                    <h1 className="text-4xl font-bold text-white mb-6">Transfers</h1>

                    {/* Transfer Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                            <p className="text-white/70 text-sm mb-1">Free Transfers</p>
                            <p className="text-2xl font-bold text-white">{freeTransfers}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                            <p className="text-white/70 text-sm mb-1">Bank Balance</p>
                            <p className="text-2xl font-bold text-white">£{bankBalance}m</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                            <p className="text-white/70 text-sm mb-1">Transfers Made</p>
                            <p className="text-2xl font-bold text-white">{transfers.length}</p>
                        </div>
                        <div className={`backdrop-blur-md rounded-xl p-4 border ${transferCost > 0 ? 'bg-red-500/20 border-red-500/50' : 'bg-blue-500/20 border-blue-500/50'
                            }`}>
                            <p className="text-white/70 text-sm mb-1">Points Cost</p>
                            <p className="text-2xl font-bold text-white">{transferCost > 0 ? `-${transferCost}` : '0'}</p>
                        </div>
                    </div>

                    {/* Pending Transfers */}
                    {transfers.length > 0 && (
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 mb-6">
                            <h2 className="text-xl font-bold text-white mb-4">Pending Transfers</h2>
                            <div className="space-y-3">
                                {transfers.map((transfer, index) => (
                                    <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="text-white">
                                                    <p className="font-semibold">{transfer.playerOut?.name}</p>
                                                    <p className="text-sm text-white/70">{transfer.playerOut?.teamName}</p>
                                                </div>
                                                <ArrowRightLeft className="w-5 h-5 text-yellow-400" />
                                                <div className="text-white">
                                                    <p className="font-semibold">{transfer.playerIn?.name}</p>
                                                    <p className="text-sm text-white/70">{transfer.playerIn?.teamName}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeTransfer(index)}
                                                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                            >
                                                <X className="w-5 h-5 text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={makeTransfers}
                                className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-500 text-white font-bold rounded-xl hover:scale-105 transition-transform"
                            >
                                Confirm Transfers {transferCost > 0 && `(-${transferCost} points)`}
                            </button>
                        </div>
                    )}

                    {/* Current Transfer Selection */}
                    {(currentTransfer.playerOut || currentTransfer.playerIn) && (
                        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-md rounded-xl p-6 border border-yellow-500/50 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white">New Transfer</h2>
                                <button
                                    onClick={cancelTransfer}
                                    className="text-white/70 hover:text-white"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 bg-white/10 rounded-lg p-4 border border-white/20">
                                    {currentTransfer.playerOut ? (
                                        <>
                                            <p className="text-white/70 text-sm mb-1">Out</p>
                                            <p className="text-white font-bold">{currentTransfer.playerOut.name}</p>
                                            <p className="text-white/70 text-sm">{currentTransfer.playerOut.teamName}</p>
                                        </>
                                    ) : (
                                        <p className="text-white/50">Select player to remove</p>
                                    )}
                                </div>
                                <ArrowRightLeft className="w-6 h-6 text-yellow-400" />
                                <div className="flex-1 bg-white/10 rounded-lg p-4 border border-white/20">
                                    {currentTransfer.playerIn ? (
                                        <>
                                            <p className="text-white/70 text-sm mb-1">In</p>
                                            <p className="text-white font-bold">{currentTransfer.playerIn.name}</p>
                                            <p className="text-white/70 text-sm">{currentTransfer.playerIn.teamName}</p>
                                        </>
                                    ) : (
                                        <p className="text-white/50">Select replacement</p>
                                    )}
                                </div>
                            </div>
                            {currentTransfer.playerOut && currentTransfer.playerIn && (
                                <button
                                    onClick={confirmTransfer}
                                    className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-500 text-white font-bold rounded-xl hover:scale-105 transition-transform"
                                >
                                    Add Transfer
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Current Squad */}
                    <div className="lg:col-span-1">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 sticky top-6">
                            <h2 className="text-xl font-bold text-white mb-4">Your Squad</h2>
                            {selectingFor === 'out' && (
                                <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                                    <p className="text-white text-sm">Select a player to transfer out</p>
                                </div>
                            )}
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {currentSquad.map(player => (
                                    <button
                                        key={player.id}
                                        onClick={() => selectingFor === 'out' && selectPlayer(player)}
                                        disabled={selectingFor !== 'out'}
                                        className={`w-full text-left p-3 rounded-lg border transition-all ${selectingFor === 'out'
                                                ? 'bg-white/5 border-white/20 hover:bg-white/10 cursor-pointer'
                                                : 'bg-white/5 border-white/10 cursor-default'
                                            } ${currentTransfer.playerOut?.id === player.id ? 'ring-2 ring-yellow-400' : ''}`}
                                    >
                                        <p className="text-white font-semibold">{player.name}</p>
                                        <p className="text-white/70 text-sm">{player.teamName} • £{player.price}m</p>
                                    </button>
                                ))}
                            </div>
                            {!selectingFor && (
                                <button
                                    onClick={() => startTransfer('out')}
                                    className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-xl hover:scale-105 transition-transform"
                                >
                                    Start New Transfer
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Available Players */}
                    <div className="lg:col-span-2">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                            <h2 className="text-xl font-bold text-white mb-4">Available Players</h2>

                            {selectingFor === 'in' && (
                                <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                                    <p className="text-white text-sm">Select a replacement player</p>
                                </div>
                            )}

                            {/* Filters */}
                            <div className="space-y-4 mb-6">
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                                    <input
                                        type="text"
                                        placeholder="Search players..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 outline-none focus:border-yellow-400"
                                    />
                                </div>

                                {/* Position Filter */}
                                <div className="flex gap-2 overflow-x-auto">
                                    {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map(pos => (
                                        <button
                                            key={pos}
                                            onClick={() => setSelectedPosition(pos)}
                                            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap ${selectedPosition === pos
                                                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900'
                                                    : 'bg-white/10 text-white/70 hover:text-white'
                                                }`}
                                        >
                                            {pos}
                                        </button>
                                    ))}
                                </div>

                                {/* Sort */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSortBy('points')}
                                        className={`flex-1 px-4 py-2 rounded-lg font-semibold ${sortBy === 'points'
                                                ? 'bg-white text-gray-900'
                                                : 'bg-white/10 text-white/70'
                                            }`}
                                    >
                                        Points
                                    </button>
                                    <button
                                        onClick={() => setSortBy('price')}
                                        className={`flex-1 px-4 py-2 rounded-lg font-semibold ${sortBy === 'price'
                                                ? 'bg-white text-gray-900'
                                                : 'bg-white/10 text-white/70'
                                            }`}
                                    >
                                        Price
                                    </button>
                                    <button
                                        onClick={() => setSortBy('form')}
                                        className={`flex-1 px-4 py-2 rounded-lg font-semibold ${sortBy === 'form'
                                                ? 'bg-white text-gray-900'
                                                : 'bg-white/10 text-white/70'
                                            }`}
                                    >
                                        Form
                                    </button>
                                </div>
                            </div>

                            {/* Players List */}
                            <div className="space-y-2 max-h-[600px] overflow-y-auto">
                                {loading ? (
                                    <p className="text-white/50 text-center py-8">Loading players...</p>
                                ) : filteredPlayers.length === 0 ? (
                                    <p className="text-white/50 text-center py-8">No players found</p>
                                ) : (
                                    filteredPlayers.map(player => (
                                        <button
                                            key={player.id}
                                            onClick={() => selectingFor === 'in' && selectPlayer(player)}
                                            disabled={selectingFor !== 'in'}
                                            className={`w-full text-left p-4 rounded-lg border transition-all ${selectingFor === 'in'
                                                    ? 'bg-white/5 border-white/20 hover:bg-white/10 cursor-pointer'
                                                    : 'bg-white/5 border-white/10 cursor-default'
                                                } ${currentTransfer.playerIn?.id === player.id ? 'ring-2 ring-blue-400' : ''}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="text-white font-semibold">{player.name}</p>
                                                        {player.priceChange !== 0 && (
                                                            <span className={`flex items-center gap-1 text-xs ${player.priceChange > 0 ? 'text-blue-400' : 'text-red-400'
                                                                }`}>
                                                                {player.priceChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                                {Math.abs(player.priceChange)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-white/70 text-sm">{player.teamName} • {player.position}</p>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-right">
                                                        <p className="text-white/70 text-xs">Price</p>
                                                        <p className="text-white font-semibold">£{player.price}m</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-white/70 text-xs">Form</p>
                                                        <p className="text-white font-semibold">{player.form}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-white/70 text-xs">Points</p>
                                                        <p className="text-white font-bold">{player.totalPoints}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

