'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ArrowLeft, Star, Trophy, Target, Shield,
    TrendingUp, Activity, Calendar, Award, UserPlus, Search
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { PlayerComparison, PlayerComparisonEmpty } from '@/components/PlayerComparison';

interface PlayerData {
    player: any;
    stats: any;
    recentMatches: any[];
    events: any;
    allEvents: any[];
}

export default function PlayerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const playerId = params.id as string;

    const [data, setData] = useState<PlayerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'history' | 'compare'>('overview');
    const [comparePlayer, setComparePlayer] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        fetchPlayerData();
    }, [playerId]);

    const fetchPlayerData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/players/${playerId}`);
            const playerData = await response.json();
            setData(playerData);
        } catch (error) {
            console.error('Error fetching player:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchPlayers = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=players&limit=10`);
            const data = await res.json();
            setSearchResults(data.players || []);
        } catch (error) {
            console.error('Error searching players:', error);
        } finally {
            setSearching(false);
        }
    };

    const selectComparePlayer = async (selectedPlayerId: string) => {
        try {
            const res = await fetch(`/api/players/compare?player1=${playerId}&player2=${selectedPlayerId}`);
            const data = await res.json();
            setComparePlayer(data.player2);
            setSearchQuery('');
            setSearchResults([]);
        } catch (error) {
            console.error('Error fetching comparison:', error);
        }
    };

    const getEventIcon = (eventType: string, sport?: string) => {
        // Basketball events
        if (sport === 'Basketball') {
            switch (eventType) {
                case 'BASKET_2PT': return '🏀';
                case 'BASKET_3PT': return '🎯';
                case 'FREE_THROW': return '🎪';
                case 'STEAL': return '⚡';
                case 'BLOCK': return '🛡️';
                case 'REBOUND': return '↩️';
                case 'ASSIST': return '🤝';
                default: return '📋';
            }
        }
        // Football events
        switch (eventType) {
            case 'GOAL': return '⚽';
            case 'ASSIST': return '🎯';
            case 'YELLOW_CARD': return '🟨';
            case 'RED_CARD': return '🟥';
            default: return '📋';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Player not found</h2>
                    <button onClick={() => router.back()} className="text-primary hover:underline">
                        Go back
                    </button>
                </div>
            </div>
        );
    }

    const { player, stats, recentMatches, events, allEvents } = data;
    const playerSport = player.team?.sport || 'Football'; // Detect sport from team

    return (
        <div className="min-h-screen bg-[#050505] text-white pb-20">
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    {/* Back Button */}
                    <button
                        onClick={() => router.back()}
                        className="mb-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back</span>
                    </button>

                    {/* Player Info */}
                    <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
                        {/* Player Avatar */}
                        <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 border-4 border-primary/30">
                            <span className="text-5xl font-bold">#{player.number}</span>
                        </div>

                        {/* Player Details */}
                        <div className="flex-1">
                            <h1 className="text-4xl font-bold mb-2">{player.name}</h1>
                            <div className="flex flex-wrap gap-4 text-white/60 mb-4">
                                <div className="flex items-center gap-2">
                                    <Trophy className="w-4 h-4" />
                                    <span>{player.position}</span>
                                </div>
                                {player.team && (
                                    <Link href={`/teams/${player.team.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                                        <Shield className="w-4 h-4" />
                                        <span>{player.team.name}</span>
                                    </Link>
                                )}
                                {playerSport && (
                                    <div className="flex items-center gap-2">
                                        <span>{playerSport === 'Basketball' ? '🏀' : '⚽'}</span>
                                        <span>{playerSport}</span>
                                    </div>
                                )}
                                {player.nationality && (
                                    <div className="flex items-center gap-2">
                                        <span>🌍</span>
                                        <span>{player.nationality}</span>
                                    </div>
                                )}
                            </div>

                            {/* Rating */}
                            {player.rating && (
                                <div className="flex items-center gap-2">
                                    <Star className="w-6 h-6 text-yellow-500 fill-current" />
                                    <span className="text-3xl font-bold">{player.rating.toFixed(1)}</span>
                                    <span className="text-white/60">Rating</span>
                                </div>
                            )}
                        </div>
                        {/* Related Profiles (Multi-sport) */}
                        {player.relatedProfiles && player.relatedProfiles.length > 0 && (
                            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10 w-full max-w-sm">
                                <span className="text-xs text-white/50 uppercase font-bold tracking-wider mb-2 block">
                                    Multi-Sport Athlete
                                </span>
                                <div className="flex gap-2">
                                    {player.relatedProfiles.map((related: any) => (
                                        <Link
                                            key={related.id}
                                            href={`/players/${related.id}`}
                                            className="flex-1 flex items-center gap-3 px-3 py-2 bg-white/10 hover:bg-white/20 hover:border-primary/50 rounded-lg transition-all border border-white/5 group"
                                        >
                                            <span className="text-2xl group-hover:scale-110 transition-transform">
                                                {related.sport === 'Basketball' ? '🏀' : '⚽'}
                                            </span>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                                                    {related.sport}
                                                </span>
                                                <span className="text-xs text-white/60">
                                                    {related.teamName}
                                                </span>
                                            </div>
                                            <div className="ml-auto">
                                                <ArrowLeft className="w-4 h-4 text-white/40 group-hover:text-primary rotate-180 transition-colors" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                                <div className="text-2xl font-bold text-primary">{stats.appearances}</div>
                                <div className="text-xs text-white/60">Apps</div>
                            </div>
                            {playerSport === 'Basketball' ? (
                                <>
                                    <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="text-2xl font-bold text-green-500">{stats.totalPoints || 0}</div>
                                        <div className="text-xs text-white/60">Points</div>
                                    </div>
                                    <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="text-2xl font-bold text-blue-500">{stats.rebounds || 0}</div>
                                        <div className="text-xs text-white/60">Rebounds</div>
                                    </div>
                                    <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="text-2xl font-bold text-purple-500">{stats.totalAssists || 0}</div>
                                        <div className="text-xs text-white/60">Assists</div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="text-2xl font-bold text-green-500">{stats.goals}</div>
                                        <div className="text-xs text-white/60">Goals</div>
                                    </div>
                                    <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="text-2xl font-bold text-blue-500">{stats.assists}</div>
                                        <div className="text-xs text-white/60">Assists</div>
                                    </div>
                                    <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="text-2xl font-bold text-yellow-500">{stats.yellowCards}</div>
                                        <div className="text-xs text-white/60">Cards</div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-white/10 overflow-x-auto">
                        {['overview', 'stats', 'history', 'compare'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-6 py-3 font-medium transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab
                                    ? 'text-primary border-b-2 border-primary'
                                    : 'text-white/60 hover:text-white'
                                    }`}
                            >
                                {tab === 'compare' && <UserPlus className="w-4 h-4" />}
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Recent Matches */}
                        <div className="lg:col-span-2">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <Activity className="w-6 h-6" />
                                Recent Performances
                            </h2>
                            <div className="space-y-3">
                                {recentMatches.map((matchData, index) => (
                                    <Link key={index} href={`/matches/${matchData.match?.id}`}>
                                        <motion.div
                                            whileHover={{ scale: 1.02 }}
                                            className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-sm text-white/60">
                                                    {matchData.match && format(new Date(matchData.match.startTime), 'MMM d, yyyy')}
                                                </div>
                                                <div className="text-sm font-semibold">
                                                    {matchData.match?.homeScore} - {matchData.match?.awayScore}
                                                </div>
                                            </div>
                                            <div className="text-xs text-white/40 mb-2">{matchData.match?.competition}</div>
                                            {matchData.events.length > 0 && (
                                                <div className="flex gap-2 flex-wrap">
                                                    {matchData.events.map((event: any, idx: number) => (
                                                        <span
                                                            key={idx}
                                                            className="px-2 py-1 bg-primary/20 text-primary rounded text-xs"
                                                        >
                                                            {getEventIcon(event.type, playerSport)} {event.minute}'
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </motion.div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Season Stats */}
                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                <h3 className="font-bold text-lg mb-4">Season Stats</h3>
                                <div className="space-y-3">
                                    {playerSport === 'Basketball' ? (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Points/Game</span>
                                                <span className="font-bold">{stats.pointsPerGame || '0.0'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Rebounds/Game</span>
                                                <span className="font-bold">{((stats.rebounds || 0) / (stats.appearances || 1)).toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Assists/Game</span>
                                                <span className="font-bold">{stats.assistsPerGame || '0.0'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Steals</span>
                                                <span className="font-bold text-yellow-500">{stats.steals || 0}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Blocks</span>
                                                <span className="font-bold text-blue-500">{stats.blocks || 0}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Goals/Game</span>
                                                <span className="font-bold">{stats.goalsPerGame}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Assists/Game</span>
                                                <span className="font-bold">{stats.assistsPerGame}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Yellow Cards</span>
                                                <span className="font-bold text-yellow-500">{stats.yellowCards}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Red Cards</span>
                                                <span className="font-bold text-red-500">{stats.redCards}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Player Info */}
                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                <h3 className="font-bold text-lg mb-4">Player Info</h3>
                                <div className="space-y-3 text-sm">
                                    {player.height && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Height</span>
                                            <span>{player.height} cm</span>
                                        </div>
                                    )}
                                    {player.weight && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Weight</span>
                                            <span>{player.weight} kg</span>
                                        </div>
                                    )}
                                    {player.dateOfBirth && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Age</span>
                                            <span>
                                                {new Date().getFullYear() - new Date(player.dateOfBirth).getFullYear()}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-white/60">Jersey Number</span>
                                        <span className="font-bold">#{player.number}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'stats' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {playerSport === 'Basketball' ? (
                            <>
                                {/* Scoring Card */}
                                <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Target className="w-8 h-8 text-green-500" />
                                        <h3 className="font-bold text-lg">Scoring</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Total Points</span>
                                            <span className="font-bold text-2xl text-green-500">{stats.totalPoints || 0}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Points/Game</span>
                                            <span className="font-bold">{stats.pointsPerGame || '0.0'}</span>
                                        </div>
                                        <div className="h-px bg-white/10 my-2" />
                                        <div className="flex justify-between text-sm">
                                            <span className="text-white/40">2-Pointers Made</span>
                                            <span className="font-semibold">{stats.twoPointers || 0}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-white/40">3-Pointers Made</span>
                                            <span className="font-semibold">{stats.threePointers || 0}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-white/40">Free Throws Made</span>
                                            <span className="font-semibold">{stats.freeThrows || 0}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Rebounding Card */}
                                <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Activity className="w-8 h-8 text-blue-500" />
                                        <h3 className="font-bold text-lg">Rebounding</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Total Rebounds</span>
                                            <span className="font-bold text-2xl text-blue-500">{stats.rebounds || 0}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Rebounds/Game</span>
                                            <span className="font-bold">{(stats.rebounds / (stats.appearances || 1)).toFixed(1)}</span>
                                        </div>
                                        <div className="h-px bg-white/10 my-2" />
                                        <div className="flex justify-between text-sm">
                                            <span className="text-white/40">Offensive Rebounds</span>
                                            <span className="font-semibold text-blue-400/60">{stats.offensiveRebounds || 0}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-white/40">Defensive Rebounds</span>
                                            <span className="font-semibold text-blue-400/60">{stats.defensiveRebounds || 0}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Playmaking & Defense Card */}
                                <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <TrendingUp className="w-8 h-8 text-purple-500" />
                                        <h3 className="font-bold text-lg">Playmaking & Def</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Assists</span>
                                            <span className="font-bold text-2xl text-purple-500">{stats.totalAssists || 0}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Steals</span>
                                            <span className="font-bold text-2xl text-yellow-500">{stats.steals || 0}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Blocks</span>
                                            <span className="font-bold text-2xl text-blue-400">{stats.blocks || 0}</span>
                                        </div>
                                        <div className="h-px bg-white/10 my-2" />
                                        <div className="flex justify-between text-sm">
                                            <span className="text-white/40">Turnovers</span>
                                            <span className="font-semibold text-red-400/60">{stats.turnovers || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Target className="w-8 h-8 text-green-500" />
                                        <h3 className="font-bold text-lg">Attacking</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Goals</span>
                                            <span className="font-bold text-2xl text-green-500">{stats.goals}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Assists</span>
                                            <span className="font-bold text-2xl text-blue-500">{stats.assists}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Goals/Game</span>
                                            <span className="font-bold">{stats.goalsPerGame}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Assists/Game</span>
                                            <span className="font-bold">{stats.assistsPerGame}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Activity className="w-8 h-8 text-blue-500" />
                                        <h3 className="font-bold text-lg">Discipline</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Yellow Cards</span>
                                            <span className="font-bold text-2xl text-yellow-500">{stats.yellowCards}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Red Cards</span>
                                            <span className="font-bold text-2xl text-red-500">{stats.redCards}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Total Cards</span>
                                            <span className="font-bold">{stats.yellowCards + stats.redCards}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <TrendingUp className="w-8 h-8 text-purple-500" />
                                        <h3 className="font-bold text-lg">Performance</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Rating</span>
                                            <span className="font-bold text-2xl text-primary">{stats.rating.toFixed(1)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Appearances</span>
                                            <span className="font-bold text-2xl">{stats.appearances}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Goal Contributions</span>
                                            <span className="font-bold">{stats.goals + stats.assists}</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <Calendar className="w-6 h-6" />
                            Event History
                        </h2>
                        <div className="space-y-2">
                            {allEvents.map((event, index) => (
                                <Link key={index} href={`/matches/${event.match?.id}`}>
                                    <motion.div
                                        whileHover={{ scale: 1.01 }}
                                        className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="text-2xl">{getEventIcon(event.type)}</div>
                                            <div>
                                                <div className="font-semibold">{event.type.replace('_', ' ')}</div>
                                                <div className="text-sm text-white/60">
                                                    {event.match && format(new Date(event.match.startTime), 'MMM d, yyyy')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold">{event.minute}'</div>
                                            <div className="text-xs text-white/60">{event.match?.competition}</div>
                                        </div>
                                    </motion.div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'compare' && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <UserPlus className="w-6 h-6" />
                            Compare Players
                        </h2>

                        {!comparePlayer ? (
                            <div className="max-w-2xl mx-auto">
                                {/* Search Box */}
                                <div className="mb-6">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                        <input
                                            type="text"
                                            placeholder="Search for a player to compare..."
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                searchPlayers(e.target.value);
                                            }}
                                            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-primary transition-all"
                                        />
                                    </div>

                                    {/* Search Results */}
                                    {searchResults.length > 0 && (
                                        <div className="mt-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                            {searchResults.map((result) => (
                                                <button
                                                    key={result.id}
                                                    onClick={() => selectComparePlayer(result.id)}
                                                    className="w-full p-4 hover:bg-white/10 transition-all flex items-center gap-4 text-left"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                                        <span className="font-bold">#{result.number}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-semibold">{result.name}</div>
                                                        <div className="text-sm text-white/60">
                                                            {result.position} • {result.team?.name}
                                                        </div>
                                                    </div>
                                                    {result.rating && (
                                                        <div className="flex items-center gap-1">
                                                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                                            <span className="font-bold">{result.rating.toFixed(1)}</span>
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {searching && (
                                        <div className="mt-4 text-center text-white/60">
                                            Searching...
                                        </div>
                                    )}
                                </div>

                                {/* Empty State */}
                                <PlayerComparisonEmpty />
                            </div>
                        ) : (
                            <div>
                                {/* Clear Button */}
                                <div className="mb-6 flex justify-end">
                                    <button
                                        onClick={() => setComparePlayer(null)}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-all"
                                    >
                                        Clear Comparison
                                    </button>
                                </div>

                                {/* Comparison */}
                                <PlayerComparison
                                    player1={{ ...player, stats }}
                                    player2={comparePlayer}
                                    sport={player.team?.sport || 'Football'}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
}
