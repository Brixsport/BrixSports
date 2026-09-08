'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ArrowLeft, Star, Trophy, Target, Shield,
    TrendingUp, Activity, Calendar, History,
    Clock, BarChart3, Table2, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { PlayerAvatar } from '@/lib/utils/player-avatar';
import { useFavorites } from '@/hooks/useFavorites';

interface PlayerData {
    player: any;
    stats: any;
    recentMatches: any[];
    events: any;
    allEvents: any[];
}

const TABS = ['overview', 'stats', 'history'] as const;
type Tab = typeof TABS[number];

const TAB_ICON: Record<Tab, ReactNode> = {
    overview: <Clock className="w-2.5 h-2.5" />,
    stats: <BarChart3 className="w-2.5 h-2.5" />,
    history: <Table2 className="w-2.5 h-2.5" />,
};

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
            <span className="text-white/60 text-sm">{label}</span>
            <span className="font-semibold text-sm">{value}</span>
        </div>
    );
}

function StatTile({ value, label }: { value: ReactNode; label: string }) {
    return (
        <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-white/60">{label}</div>
        </div>
    );
}

export default function PlayerDetailClient() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const playerId = params.id as string;

    const [data, setData] = useState<PlayerData | null>(null);
    const [loading, setLoading] = useState(true);
    // Distinguishes "player really doesn't exist" (404) from "the request
    // itself failed" (network/server error) -- BACKLOG-296 item 5, these
    // used to render the same generic message regardless of cause.
    const [errorState, setErrorState] = useState<'not-found' | 'failed' | null>(null);

    const { togglePlayer, isFavoritePlayer } = useFavorites();

    const tabParam = searchParams.get('tab');
    const activeTab: Tab = (TABS as readonly string[]).includes(tabParam || '') ? (tabParam as Tab) : 'overview';

    const setActiveTab = (tab: Tab) => {
        const next = new URLSearchParams(searchParams.toString());
        next.set('tab', tab);
        router.replace(`/players/${playerId}?${next.toString()}`, { scroll: false });
    };

    useEffect(() => {
        fetchPlayerData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playerId]);

    const fetchPlayerData = async () => {
        try {
            setLoading(true);
            setErrorState(null);
            const response = await fetch(`/api/players/${playerId}`);
            if (response.status === 404) {
                setErrorState('not-found');
                setData(null);
                return;
            }
            if (!response.ok) {
                setErrorState('failed');
                setData(null);
                return;
            }
            const playerData = await response.json();
            setData(playerData);
        } catch (error) {
            console.error('Error fetching player:', error);
            setErrorState('failed');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const formatHistoryDate = (value: string | null) => {
        if (!value) return null;
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : format(d, 'MMM yyyy');
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

    if (errorState === 'not-found') {
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

    if (errorState === 'failed' || !data) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Couldn't load this player</h2>
                    <p className="text-white/60 mb-4">Something went wrong. Please try again.</p>
                    <div className="flex items-center justify-center gap-4">
                        <button onClick={fetchPlayerData} className="text-primary hover:underline">
                            Retry
                        </button>
                        <button onClick={() => router.back()} className="text-white/60 hover:underline">
                            Go back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const { player, stats, recentMatches, allEvents } = data;
    const playerSport = player.team?.sport || 'Football'; // Detect sport from team
    const favorited = isFavoritePlayer(playerId);

    return (
        <div className="min-h-screen bg-[#050505] text-white pb-20">
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back</span>
                        </button>
                        <button
                            onClick={() => togglePlayer(playerId)}
                            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
                            className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <Star className={`w-6 h-6 ${favorited ? 'text-yellow-500 fill-yellow-500' : 'text-white/60'}`} />
                        </button>
                    </div>

                    {/* Player Info */}
                    <div className="flex flex-col md:flex-row items-start gap-6 mb-6">
                        <PlayerAvatar
                            image={player.image}
                            name={player.name}
                            size="xl"
                            className="border-4 border-primary/30"
                        />

                        <div className="flex-1">
                            <h1 className="text-4xl font-bold mb-2">{player.name}</h1>
                            <div className="flex flex-wrap gap-4 text-white/60">
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
                        </div>
                    </div>

                    {/* Related Profiles (Multi-sport) */}
                    {player.relatedProfiles && player.relatedProfiles.length > 0 && (
                        <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                            <span className="text-xs text-white/50 uppercase font-bold tracking-wider mb-2 block">
                                Multi-Sport Athlete
                            </span>
                            <div className="flex gap-2 flex-wrap">
                                {player.relatedProfiles.map((related: any) => (
                                    <Link
                                        key={related.id}
                                        href={`/players/${related.id}`}
                                        className="flex-1 min-w-[180px] flex items-center gap-3 px-3 py-2 bg-white/10 hover:bg-white/20 hover:border-primary/50 rounded-lg transition-all border border-white/5 group"
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

                    {/* Tabs -- sized to match the match-detail page's tab bar
                        (MatchDetailClient.tsx) so 3 tabs never need horizontal
                        scroll on a mobile viewport */}
                    <div className="flex gap-1 border-b border-white/10 overflow-x-auto scrollbar-hide">
                        {TABS.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all relative whitespace-nowrap flex items-center gap-1 ${activeTab === tab
                                    ? 'text-primary'
                                    : 'text-white/60 hover:text-white'
                                    }`}
                            >
                                {TAB_ICON[tab]}
                                {tab}
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="playerDetailActiveTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Basic Info */}
                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-primary" />
                                    Basic Info
                                </h3>
                                <div>
                                    <InfoRow label="Position" value={player.position} />
                                    {player.team && <InfoRow label="Team" value={player.team.name} />}
                                    {player.height && <InfoRow label="Height" value={`${player.height} cm`} />}
                                    {player.weight && <InfoRow label="Weight" value={`${player.weight} kg`} />}
                                    {player.dateOfBirth && (
                                        <InfoRow
                                            label="Age"
                                            value={new Date().getFullYear() - new Date(player.dateOfBirth).getFullYear()}
                                        />
                                    )}
                                    {player.jerseyName && <InfoRow label="Jersey Name" value={player.jerseyName} />}
                                    <InfoRow label="Jersey Number" value={`#${player.number}`} />
                                    <InfoRow
                                        label="Rating"
                                        value={
                                            <span className="flex items-center gap-1">
                                                <Star className={`w-4 h-4 ${stats.rating != null ? 'text-yellow-500 fill-yellow-500' : 'text-white/30'}`} />
                                                {stats.rating != null && stats.rating.toFixed(1)}
                                            </span>
                                        }
                                    />
                                </div>
                            </div>

                            {/* Individual Stats */}
                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-primary" />
                                    Individual Stats
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {playerSport === 'Basketball' ? (
                                        <>
                                            <StatTile value={stats.pointsPerGame || '0.0'} label="Pts/Game" />
                                            <StatTile value={((stats.rebounds || 0) / (stats.appearances || 1)).toFixed(1)} label="Rebounds/Game" />
                                            <StatTile value={stats.assistsPerGame || '0.0'} label="Assists/Game" />
                                            <StatTile value={stats.steals || 0} label="Steals" />
                                            <StatTile value={stats.blocks || 0} label="Blocks" />
                                        </>
                                    ) : (
                                        <>
                                            <StatTile value={stats.appearances || 0} label="Apps" />
                                            <StatTile value={stats.goals} label="Goals" />
                                            <StatTile value={stats.assists} label="Assists" />
                                            <StatTile value={(stats.yellowCards || 0) + (stats.redCards || 0)} label="Cards" />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Compare entry card -- replaces the old inline Compare tab;
                                links out to the existing dedicated compare page instead */}
                            <Link
                                href={`/players/compare?player1=${playerId}`}
                                className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all group"
                            >
                                <PlayerAvatar image={player.image} name={player.name} size="sm" />
                                <div className="flex-1 font-semibold">{player.name}</div>
                                <span className="flex items-center gap-1 text-primary font-medium whitespace-nowrap">
                                    Compare players
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </Link>

                            {/* Recent Matches */}
                            <div>
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
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Career History */}
                            {player.careerHistory?.length > 0 && (
                                <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <History className="w-5 h-5" />
                                        Career History
                                    </h3>
                                    <div className="space-y-2">
                                        {player.careerHistory.map((h: any, idx: number) => {
                                            const start = formatHistoryDate(h.startDate);
                                            const end = formatHistoryDate(h.endDate);
                                            return (
                                                <div
                                                    key={idx}
                                                    className="flex items-start justify-between gap-3 text-sm border-b border-white/5 last:border-0 pb-2 last:pb-0"
                                                >
                                                    <div>
                                                        <div className="font-medium">{h.teamName}</div>
                                                        <div className="text-xs text-white/40">
                                                            {h.season}
                                                            {start ? ` · ${start} – ${end ?? 'present'}` : ''}
                                                        </div>
                                                    </div>
                                                    {h.isActive && (
                                                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-green-500/10 text-green-400">
                                                            Current
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
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
                                            <span className="font-bold text-2xl text-primary">{stats.rating != null ? stats.rating.toFixed(1) : 'Not yet rated'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Appearances</span>
                                            <span className="font-bold text-2xl">{stats.appearances || '-'}</span>
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
            </div>
        </div>
    );
}
