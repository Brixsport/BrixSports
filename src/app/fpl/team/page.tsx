'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Edit,
    TrendingUp,
    Trophy,
    DollarSign,
    Users,
    Star,
    Shield,
    Activity,
    Target,
    ChevronRight
} from 'lucide-react';

interface Player {
    id: string;
    name: string;
    teamName: string;
    position: 'GK' | 'DEF' | 'MID' | 'FWD';
    price: number;
    points: number;
    form: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
    squadPosition: number;
}

interface TeamData {
    id: string;
    name: string;
    totalPoints: number;
    gameweekPoints: number;
    bankBalance: number;
    teamValue: number;
    overallRank: number;
    gameweekRank: number;
}

export default function TeamPage() {
    const router = useRouter();
    const [team, setTeam] = useState<TeamData | null>(null);
    const [squad, setSquad] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'pitch' | 'list'>('pitch');

    useEffect(() => {
        fetchTeamData();
    }, []);

    const fetchTeamData = async () => {
        try {
            // Mock data - replace with actual API calls
            setTeam({
                id: 'team_1',
                name: 'My Dream Team',
                totalPoints: 1247,
                gameweekPoints: 68,
                bankBalance: 2.5,
                teamValue: 102.5,
                overallRank: 15234,
                gameweekRank: 8921,
            });

            // Mock squad - replace with actual API call
            setSquad([
                // GK
                { id: '1', name: 'Alisson', teamName: 'Liverpool', position: 'GK', price: 5.5, points: 8, form: 4.2, isCaptain: false, isViceCaptain: false, squadPosition: 1 },
                { id: '2', name: 'Ramsdale', teamName: 'Arsenal', position: 'GK', price: 4.5, points: 0, form: 3.8, isCaptain: false, isViceCaptain: false, squadPosition: 12 },
                // DEF
                { id: '3', name: 'Van Dijk', teamName: 'Liverpool', position: 'DEF', price: 6.5, points: 12, form: 5.1, isCaptain: false, isViceCaptain: true, squadPosition: 2 },
                { id: '4', name: 'Saliba', teamName: 'Arsenal', position: 'DEF', price: 5.5, points: 9, form: 4.8, isCaptain: false, isViceCaptain: false, squadPosition: 3 },
                { id: '5', name: 'Walker', teamName: 'Man City', position: 'DEF', price: 5.0, points: 6, form: 4.2, isCaptain: false, isViceCaptain: false, squadPosition: 4 },
                { id: '6', name: 'Trippier', teamName: 'Newcastle', position: 'DEF', price: 6.0, points: 0, form: 5.5, isCaptain: false, isViceCaptain: false, squadPosition: 13 },
                { id: '7', name: 'Chilwell', teamName: 'Chelsea', position: 'DEF', price: 5.5, points: 0, form: 3.9, isCaptain: false, isViceCaptain: false, squadPosition: 14 },
                // MID
                { id: '8', name: 'Salah', teamName: 'Liverpool', position: 'MID', price: 13.0, points: 15, form: 7.8, isCaptain: true, isViceCaptain: false, squadPosition: 5 },
                { id: '9', name: 'De Bruyne', teamName: 'Man City', position: 'MID', price: 12.5, points: 11, form: 6.9, isCaptain: false, isViceCaptain: false, squadPosition: 6 },
                { id: '10', name: 'Saka', teamName: 'Arsenal', position: 'MID', price: 9.0, points: 8, form: 5.4, isCaptain: false, isViceCaptain: false, squadPosition: 7 },
                { id: '11', name: 'Maddison', teamName: 'Tottenham', position: 'MID', price: 7.5, points: 0, form: 4.8, isCaptain: false, isViceCaptain: false, squadPosition: 15 },
                { id: '12', name: 'Rashford', teamName: 'Man Utd', position: 'MID', price: 7.0, points: 0, form: 4.1, isCaptain: false, isViceCaptain: false, squadPosition: 8 },
                // FWD
                { id: '13', name: 'Haaland', teamName: 'Man City', position: 'FWD', price: 14.0, points: 18, form: 8.5, isCaptain: false, isViceCaptain: false, squadPosition: 9 },
                { id: '14', name: 'Kane', teamName: 'Tottenham', position: 'FWD', price: 11.5, points: 9, form: 6.2, isCaptain: false, isViceCaptain: false, squadPosition: 10 },
                { id: '15', name: 'Watkins', teamName: 'Aston Villa', position: 'FWD', price: 7.5, points: 6, form: 5.1, isCaptain: false, isViceCaptain: false, squadPosition: 11 },
            ]);
        } catch (error) {
            console.error('Error fetching team:', error);
        } finally {
            setLoading(false);
        }
    };

    const startingXI = squad.filter(p => p.squadPosition <= 11).sort((a, b) => a.squadPosition - b.squadPosition);
    const bench = squad.filter(p => p.squadPosition > 11).sort((a, b) => a.squadPosition - b.squadPosition);

    const getPositionPlayers = (position: string, players: Player[]) => {
        return players.filter(p => p.position === position);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading team...</div>
            </div>
        );
    }

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

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-4xl font-bold text-white mb-2">{team?.name}</h1>
                            <p className="text-white/70">Gameweek 1</p>
                        </div>
                        <button
                            onClick={() => router.push('/fpl/transfers')}
                            className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold rounded-xl hover:scale-105 transition-transform flex items-center gap-2"
                        >
                            <Edit className="w-5 h-5" />
                            Make Transfers
                        </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            icon={<Trophy className="w-6 h-6" />}
                            label="Total Points"
                            value={team?.totalPoints.toLocaleString() || '0'}
                            color="from-yellow-500 to-orange-500"
                        />
                        <StatCard
                            icon={<Target className="w-6 h-6" />}
                            label="GW Points"
                            value={team?.gameweekPoints.toString() || '0'}
                            color="from-blue-500 to-blue-500"
                        />
                        <StatCard
                            icon={<TrendingUp className="w-6 h-6" />}
                            label="Overall Rank"
                            value={team?.overallRank.toLocaleString() || 'N/A'}
                            color="from-blue-500 to-cyan-500"
                        />
                        <StatCard
                            icon={<DollarSign className="w-6 h-6" />}
                            label="Team Value"
                            value={`£${team?.teamValue.toFixed(1)}m`}
                            color="from-purple-500 to-pink-500"
                        />
                    </div>
                </div>

                {/* View Toggle */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setView('pitch')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all ${view === 'pitch'
                                ? 'bg-white text-gray-900'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        Pitch View
                    </button>
                    <button
                        onClick={() => setView('list')}
                        className={`px-6 py-3 rounded-xl font-semibold transition-all ${view === 'list'
                                ? 'bg-white text-gray-900'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        List View
                    </button>
                </div>

                {/* Pitch View */}
                {view === 'pitch' && (
                    <div className="bg-gradient-to-b from-blue-600 to-blue-700 rounded-2xl p-8 border-4 border-white/20 relative overflow-hidden">
                        {/* Pitch Lines */}
                        <div className="absolute inset-0 opacity-20">
                            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white"></div>
                            <div className="absolute top-0 left-1/2 bottom-0 w-0.5 bg-white"></div>
                            <div className="absolute top-1/2 left-1/2 w-24 h-24 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                        </div>

                        {/* Starting XI */}
                        <div className="relative space-y-8">
                            {/* Forwards */}
                            <div className="flex justify-center gap-4">
                                {getPositionPlayers('FWD', startingXI).map(player => (
                                    <PlayerCard key={player.id} player={player} />
                                ))}
                            </div>

                            {/* Midfielders */}
                            <div className="flex justify-center gap-4">
                                {getPositionPlayers('MID', startingXI).map(player => (
                                    <PlayerCard key={player.id} player={player} />
                                ))}
                            </div>

                            {/* Defenders */}
                            <div className="flex justify-center gap-4">
                                {getPositionPlayers('DEF', startingXI).map(player => (
                                    <PlayerCard key={player.id} player={player} />
                                ))}
                            </div>

                            {/* Goalkeeper */}
                            <div className="flex justify-center">
                                {getPositionPlayers('GK', startingXI).map(player => (
                                    <PlayerCard key={player.id} player={player} />
                                ))}
                            </div>
                        </div>

                        {/* Bench */}
                        <div className="mt-8 pt-6 border-t-2 border-white/20">
                            <h3 className="text-white font-bold mb-4 text-center">Substitutes</h3>
                            <div className="flex justify-center gap-4">
                                {bench.map(player => (
                                    <PlayerCard key={player.id} player={player} isBench />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* List View */}
                {view === 'list' && (
                    <div className="space-y-6">
                        {/* Starting XI */}
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                            <h2 className="text-2xl font-bold text-white mb-4">Starting XI</h2>
                            <div className="space-y-2">
                                {startingXI.map(player => (
                                    <PlayerListItem key={player.id} player={player} />
                                ))}
                            </div>
                        </div>

                        {/* Bench */}
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                            <h2 className="text-2xl font-bold text-white mb-4">Substitutes</h2>
                            <div className="space-y-2">
                                {bench.map(player => (
                                    <PlayerListItem key={player.id} player={player} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PlayerCard({ player, isBench = false }: { player: Player; isBench?: boolean }) {
    return (
        <div className={`relative ${isBench ? 'opacity-70' : ''}`}>
            <div className="bg-white rounded-lg p-3 shadow-lg min-w-[100px] text-center relative">
                {/* Captain/Vice Badge */}
                {player.isCaptain && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs font-bold text-gray-900">
                        C
                    </div>
                )}
                {player.isViceCaptain && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center text-xs font-bold text-white">
                        V
                    </div>
                )}

                {/* Player Image Placeholder */}
                <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <Users className="w-8 h-8 text-gray-600" />
                </div>

                {/* Player Info */}
                <p className="font-bold text-sm text-gray-900 truncate">{player.name}</p>
                <p className="text-xs text-gray-600 truncate">{player.teamName}</p>

                {/* Points */}
                <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-lg font-bold text-gray-900">{player.points}</p>
                    <p className="text-xs text-gray-600">pts</p>
                </div>
            </div>
        </div>
    );
}

function PlayerListItem({ player }: { player: Player }) {
    return (
        <div className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-white">{player.name}</p>
                            {player.isCaptain && (
                                <span className="px-2 py-0.5 bg-yellow-400 text-gray-900 text-xs font-bold rounded">C</span>
                            )}
                            {player.isViceCaptain && (
                                <span className="px-2 py-0.5 bg-blue-400 text-white text-xs font-bold rounded">V</span>
                            )}
                        </div>
                        <p className="text-sm text-white/70">{player.teamName} • {player.position}</p>
                    </div>
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
                        <p className="text-2xl font-bold text-white">{player.points}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/50" />
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color }: any) {
    return (
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
            <div className={`inline-block p-2 bg-gradient-to-r ${color} rounded-lg mb-2`}>
                {icon}
            </div>
            <p className="text-white/70 text-sm mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    );
}

