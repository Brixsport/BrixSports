'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Users, Trophy, TrendingUp, Calendar,
    Target, Shield, Activity, Star, MapPin, Search
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

const TeamStatsChart = dynamic(() => import('@/components/TeamStatsChart'), {
    loading: () => <div className="absolute inset-0 flex items-center justify-center animate-pulse bg-white/5 rounded-full" />,
    ssr: false
});

interface TeamData {
    team: any;
    players: any[];
    recentMatches: any[];
    upcomingMatches: any[];
    stats: any;
    form: string[];
    competitions: string[];
}

export default function TeamDetailPage() {
    const params = useParams();
    const router = useRouter();
    const teamId = params.id as string;

    const [data, setData] = useState<TeamData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'players' | 'fixtures' | 'stats'>('overview');

    useEffect(() => {
        fetchTeamData();
    }, [teamId]);

    const fetchTeamData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/teams/${teamId}`);
            const teamData = await response.json();
            setData(teamData);
        } catch (error) {
            console.error('Error fetching team:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-white/40 text-sm font-medium animate-pulse">Loading Team Data...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto border border-white/10">
                        <Search className="w-8 h-8 text-white/40" />
                    </div>
                    <h2 className="text-2xl font-bold">Team not found</h2>
                    <button
                        onClick={() => router.back()}
                        className="text-primary hover:text-primary/80 transition-colors font-medium flex items-center gap-2 mx-auto"
                    >
                        <ArrowLeft className="w-4 h-4" /> Go back
                    </button>
                </div>
            </div>
        );
    }

    const { team, players = [], recentMatches = [], upcomingMatches = [], stats: rawStats = {}, form = [], competitions = [] } = data;
    const stats = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, ...rawStats };

    const getFormColor = (result: string) => {
        switch (result) {
            case 'W': return 'bg-blue-500/20 text-blue-500 border-blue-500/20';
            case 'D': return 'bg-amber-500/20 text-amber-500 border-amber-500/20';
            case 'L': return 'bg-rose-500/20 text-rose-500 border-rose-500/20';
            default: return 'bg-zinc-500/20 text-zinc-500 border-zinc-500/20';
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };



    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/20 selection:text-primary">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div
                    className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-20 blur-[120px]"
                    style={{ background: team.color || '#2563eb' }}
                />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
            </div>

            <div className="relative z-10 pb-20">
                {/* Header */}
                <div className="relative pt-8 pb-12 overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 md:px-6">
                        <button
                            onClick={() => router.back()}
                            className="mb-8 flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
                        >
                            <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors border border-white/5">
                                <ArrowLeft className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-medium">Back to Teams</span>
                        </button>

                        <div className="flex flex-col md:flex-row items-center md:items-end gap-8 md:gap-12">
                            {/* Logo with Glow */}
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="relative flex-shrink-0"
                            >
                                <div
                                    className="absolute inset-0 rounded-full blur-3xl opacity-30"
                                    style={{ background: team.color }}
                                />
                                <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-[#0A0A0A] border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden">
                                    {team.logo ? (
                                        <img src={team.logo} alt={team.name} className="w-28 h-28 md:w-32 md:h-32 object-contain" />
                                    ) : (
                                        <span className="text-4xl md:text-5xl font-black text-white/10">{team.shortName.substring(0, 2)}</span>
                                    )}
                                </div>
                            </motion.div>

                            {/* Info */}
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="flex-1 text-center md:text-left space-y-4"
                            >
                                <div>
                                    <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/60">
                                            {team.sport} Team
                                        </span>
                                        {team.founded && (
                                            <span className="text-xs font-mono text-white/40">{team.founded}</span>
                                        )}
                                    </div>
                                    <h1 className="text-4xl md:text-6xl font-black tracking-tight">{team.name}</h1>
                                </div>

                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-sm font-medium text-white/60">
                                    {team.stadium && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-primary" />
                                            <span>{team.stadium}</span>
                                        </div>
                                    )}
                                    <div className="w-1 h-1 rounded-full bg-white/20" />
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-blue-400" />
                                        <span>{players.length} Players</span>
                                    </div>
                                    {competitions.length > 0 && (
                                        <>
                                            <div className="w-1 h-1 rounded-full bg-white/20" />
                                            <div className="flex items-center gap-2">
                                                <Trophy className="w-4 h-4 text-amber-400" />
                                                <span>{competitions[0]}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </motion.div>

                            {/* Quick Form */}
                            {form.length > 0 && (
                                <motion.div
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="flex flex-col items-center md:items-end gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
                                >
                                    <span className="text-xs font-bold uppercase tracking-widest text-white/40">Recent Form</span>
                                    <div className="flex gap-1.5">
                                        {form.map((result, index) => (
                                            <div
                                                key={index}
                                                className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border",
                                                    getFormColor(result)
                                                )}
                                            >
                                                {result}
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-y border-white/5 mb-8">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
                            {['overview', 'players', 'fixtures', 'stats'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className="relative px-6 py-4 outline-none"
                                >
                                    <span className={cn(
                                        "relative z-10 text-sm font-bold uppercase tracking-widest transition-colors duration-200",
                                        activeTab === tab ? "text-white" : "text-white/40 hover:text-white/60"
                                    )}>
                                        {tab}
                                    </span>
                                    {activeTab === tab && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute inset-0 bg-white/5 border-b-2 border-primary"
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="max-w-7xl mx-auto px-4 md:px-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'overview' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-xl font-bold flex items-center gap-2">
                                                <Activity className="w-5 h-5 text-primary" />
                                                Recent Activity
                                            </h2>
                                            <Link
                                                href={`/matches?team=${teamId}`}
                                                className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                                            >
                                                View All
                                            </Link>
                                        </div>

                                        <div className="space-y-4">
                                            {recentMatches.length > 0 ? recentMatches.slice(0, 5).map((match, i) => (
                                                <Link key={match.id} href={`/matches/${match.id}`}>
                                                    <motion.div
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.05 }}
                                                        whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.08)' }}
                                                        className="group p-5 bg-white/5 rounded-2xl border border-white/10 transition-all"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-6">
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-xs font-bold text-white/40 uppercase mb-1">{format(new Date(match.startTime), 'MMM')}</span>
                                                                    <span className="text-xl font-black">{format(new Date(match.startTime), 'dd')}</span>
                                                                </div>
                                                                <div className="h-10 w-px bg-white/10" />
                                                                <div className="space-y-1">
                                                                    <div className={cn("flex items-center gap-3 text-lg font-bold", match.isHome ? "text-white" : "text-white/50")}>
                                                                        <span>{team.name}</span>
                                                                        {match.status === 'FINISHED' && (
                                                                            <span className={cn("ml-auto font-mono", match.isHome ? "text-white" : "text-white/40")}>
                                                                                {match.isHome ? match.homeScore : match.awayScore}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className={cn("flex items-center gap-3 text-lg font-bold", !match.isHome ? "text-white" : "text-white/50")}>
                                                                        <span>{match.opponent?.name || 'Unknown'}</span>
                                                                        {match.status === 'FINISHED' && (
                                                                            <span className={cn("ml-auto font-mono", !match.isHome ? "text-white" : "text-white/40")}>
                                                                                {!match.isHome ? match.homeScore : match.awayScore}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col items-end gap-2">
                                                                {match.status === 'FINISHED' ? (
                                                                    <span className={cn(
                                                                        "px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest",
                                                                        (match.isHome && match.homeScore > match.awayScore) || (!match.isHome && match.awayScore > match.homeScore)
                                                                            ? "bg-blue-500/20 text-blue-500"
                                                                            : match.homeScore === match.awayScore
                                                                                ? "bg-amber-500/20 text-amber-500"
                                                                                : "bg-rose-500/20 text-rose-500"
                                                                    )}>
                                                                        {(match.isHome && match.homeScore > match.awayScore) || (!match.isHome && match.awayScore > match.homeScore) ? 'Won' : (match.homeScore === match.awayScore ? 'Draw' : 'Lost')}
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-3 py-1 rounded-lg bg-white/10 text-white/40 text-xs font-bold uppercase tracking-widest">
                                                                        {format(new Date(match.startTime), 'HH:mm')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                </Link>
                                            )) : (
                                                <div className="p-12 text-center border border-dashed border-white/10 rounded-2xl text-white/40">
                                                    No recent activity
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="p-6 bg-gradient-to-br from-white/10 to-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
                                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                                <TrendingUp className="w-5 h-5 text-primary" />
                                                Season Stats
                                            </h3>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center p-3 bg-black/20 rounded-xl">
                                                    <span className="text-white/60 text-sm">Matches Played</span>
                                                    <span className="font-mono text-xl font-bold">{stats.played}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/10">
                                                        <div className="text-xs text-blue-400 font-bold uppercase mb-1">{team.sport === 'Basketball' ? 'PTS For' : 'Goals For'}</div>
                                                        <div className="text-2xl font-bold text-blue-500">{stats.goalsFor}</div>
                                                    </div>
                                                    <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/10">
                                                        <div className="text-xs text-rose-400 font-bold uppercase mb-1">{team.sport === 'Basketball' ? 'PTS Agst' : 'Conceded'}</div>
                                                        <div className="text-2xl font-bold text-rose-500">{stats.goalsAgainst}</div>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-sm text-white/60">Win Rate</span>
                                                        <span className="font-bold text-primary">{((stats.won / Math.max(stats.played, 1)) * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary transition-all duration-1000"
                                                            style={{ width: `${(stats.won / Math.max(stats.played, 1)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {competitions.length > 0 && (
                                            <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                                <h3 className="text-lg font-bold mb-4">Competitions</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {competitions.map((comp, index) => (
                                                        <div key={index} className="flex items-center gap-2 pl-2 pr-4 py-1.5 bg-white/5 hover:bg-white/10 transition-colors rounded-full border border-white/10 text-xs font-bold uppercase tracking-wide cursor-default">
                                                            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center">
                                                                <Trophy className="w-3 h-3" />
                                                            </div>
                                                            {comp}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'players' && (
                                <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                    <div className="flex items-center justify-between mb-8">
                                        <h2 className="text-2xl font-bold flex items-center gap-3">
                                            <Users className="w-6 h-6 text-primary" />
                                            Active Squad
                                            <span className="text-sm font-medium text-white/40 bg-white/5 px-2 py-1 rounded-md">{players.length}</span>
                                        </h2>
                                    </div>

                                    {players.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {players.map((player) => (
                                                <Link key={player.id} href={`/players/${player.id}`}>
                                                    <motion.div
                                                        variants={itemVariants}
                                                        whileHover={{ y: -5 }}
                                                        className="group p-1 rounded-2xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 hover:border-primary/50 transition-all duration-300"
                                                    >
                                                        <div className="bg-[#0A0A0A] rounded-xl p-5 h-full relative overflow-hidden">
                                                            <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-white group-hover:opacity-20 transition-opacity select-none">
                                                                {player.number}
                                                            </div>
                                                            <div className="relative z-10 flex flex-col h-full">
                                                                <div className="flex items-center gap-4 mb-4">
                                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-black font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
                                                                        {player.number}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs font-bold uppercase text-white/40 tracking-widest mb-0.5">{player.position}</div>
                                                                        <div className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{player.name}</div>
                                                                    </div>
                                                                </div>

                                                                {team.sport === 'Basketball' && player.stats && (
                                                                    <div className="mt-auto grid grid-cols-3 gap-2 py-3 border-t border-white/5">
                                                                        <div className="text-center">
                                                                            <div className="text-[10px] uppercase text-white/30 font-bold">PTS</div>
                                                                            <div className="font-mono font-bold text-blue-500">{(player.stats.pointsPerGame || 0).toFixed(1)}</div>
                                                                        </div>
                                                                        <div className="text-center border-l border-white/5">
                                                                            <div className="text-[10px] uppercase text-white/30 font-bold">REB</div>
                                                                            <div className="font-mono font-bold">{player.stats.reboundsPerGame || 0}</div>
                                                                        </div>
                                                                        <div className="text-center border-l border-white/5">
                                                                            <div className="text-[10px] uppercase text-white/30 font-bold">AST</div>
                                                                            <div className="font-mono font-bold">{player.stats.assistsPerGame || 0}</div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-64 flex flex-col items-center justify-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                                            <Users className="w-12 h-12 text-white/20 mb-4" />
                                            <p className="text-white/40 font-medium">No players registered yet.</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {activeTab === 'fixtures' && (
                                <div className="space-y-8">
                                    {upcomingMatches.length > 0 ? (
                                        <div>
                                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                                <Calendar className="w-5 h-5 text-primary" />
                                                Upcoming Schedule
                                            </h2>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                {upcomingMatches.map((match, i) => (
                                                    <Link key={match.id} href={`/matches/${match.id}`}>
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.1 }}
                                                            whileHover={{ scale: 1.01 }}
                                                            className="relative overflow-hidden bg-white/5 rounded-2xl border border-white/10 group hover:bg-white/10 transition-colors"
                                                        >
                                                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                                                            <div className="p-6">
                                                                <div className="flex justify-between items-start mb-6">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors">
                                                                            {format(new Date(match.startTime), 'EEEE, MMM d')}
                                                                        </span>
                                                                        <span className="text-sm font-medium text-white/40 flex items-center gap-2">
                                                                            <Calendar className="w-3 h-3" />
                                                                            {format(new Date(match.startTime), 'h:mm a')}
                                                                        </span>
                                                                    </div>
                                                                    <div className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold uppercase tracking-widest text-white/60">
                                                                        {match.competition}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-6">
                                                                    <div className="flex-1 flex flex-col items-center gap-3">
                                                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold border border-white/10">
                                                                            {match.isHome ? team.shortName : match.opponent?.shortName?.substring(0, 3)}
                                                                        </div>
                                                                        <span className="text-center font-bold text-sm truncate w-full">{match.isHome ? team.name : match.opponent?.name}</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-2xl font-black text-white/20 italic">VS</span>
                                                                        <span className="text-[10px] font-bold uppercase text-white/40 mt-1">{match.venue || 'TBA'}</span>
                                                                    </div>
                                                                    <div className="flex-1 flex flex-col items-center gap-3">
                                                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold border border-white/10">
                                                                            {!match.isHome ? team.shortName : match.opponent?.shortName?.substring(0, 3)}
                                                                        </div>
                                                                        <span className="text-center font-bold text-sm truncate w-full">{!match.isHome ? team.name : match.opponent?.name}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white/5 rounded-3xl p-12 text-center border ring-1 ring-white/5">
                                            <Calendar className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                            <p className="text-white/40 font-medium">No upcoming fixtures scheduled.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'stats' && (
                                <div className="space-y-8">
                                    {/* Charts Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {/* Win/Loss Distribution */}
                                        <div className="p-6 bg-white/5 rounded-3xl border border-white/10 flex flex-col">
                                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                                <Target className="w-5 h-5 text-primary" />
                                                Match Results
                                            </h3>
                                            <div className="flex-1 min-h-[200px] relative">
                                                <TeamStatsChart stats={stats} />
                                            </div>
                                            <div className="flex justify-center gap-4 mt-4">
                                                <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500" /> Won
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500" /> Draw
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-bold text-white/60">
                                                    <div className="w-2 h-2 rounded-full bg-rose-500" /> Lost
                                                </div>
                                            </div>
                                        </div>

                                        {/* Attack Stats */}
                                        <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                                <TrendingUp className="w-5 h-5 text-blue-500" />
                                                Attack
                                            </h3>
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-white/60">{team.sport === 'Basketball' ? 'Total Points' : 'Goals Scored'}</span>
                                                        <span className="font-bold text-2xl text-blue-500">{stats.goalsFor}</span>
                                                    </div>
                                                    <div className="w-full bg-white/5 rounded-full h-1.5">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: '100%' }}
                                                            className="bg-blue-500 h-1.5 rounded-full opacity-50"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-white/60">{team.sport === 'Basketball' ? 'PPG' : 'Goals / Game'}</span>
                                                        <span className="font-bold text-xl">{(stats.goalsFor / Math.max(stats.played, 1)).toFixed(1)}</span>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                                    <div className="text-xs text-blue-400 font-bold uppercase tracking-wide mb-1">Top Stat</div>
                                                    <div className="text-sm text-white/80">Scored in <span className="text-white font-bold">{((stats.goalsFor / Math.max(stats.played, 1)) > 0 ? '100%' : '0%')}</span> of matches</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Defense Stats */}
                                        <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                                <Shield className="w-5 h-5 text-rose-500" />
                                                Defense
                                            </h3>
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-white/60">{team.sport === 'Basketball' ? 'Points Allowed' : 'Goals Conceded'}</span>
                                                        <span className="font-bold text-2xl text-rose-500">{stats.goalsAgainst}</span>
                                                    </div>
                                                    <div className="w-full bg-white/5 rounded-full h-1.5">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min((stats.goalsAgainst / 100) * 100, 100)}%` }} // Arbitrary max
                                                            className="bg-rose-500 h-1.5 rounded-full opacity-50"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-white/60">Goal Difference</span>
                                                        <span className={cn("font-bold text-xl", stats.goalDifference >= 0 ? "text-blue-500" : "text-rose-500")}>
                                                            {stats.goalDifference > 0 ? '+' : ''}{stats.goalDifference}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-rose-500/5 rounded-xl border border-rose-500/10">
                                                    <div className="text-xs text-rose-400 font-bold uppercase tracking-wide mb-1">Defense Note</div>
                                                    <div className="text-sm text-white/80">Avg <span className="text-white font-bold">{(stats.goalsAgainst / Math.max(stats.played, 1)).toFixed(1)}</span> conceded per game</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Breakdowns */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                            <h3 className="font-bold text-lg mb-6">Home vs Away</h3>
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="flex justify-between mb-2 text-sm font-bold uppercase tracking-wider text-white/60">
                                                        <span>Home Performance</span>
                                                        <span>{recentMatches.filter(m => m.isHome && m.status === 'FINISHED').length} Games</span>
                                                    </div>
                                                    <div className="flex h-4 rounded-full overflow-hidden bg-white/5">
                                                        {(() => {
                                                            const homeGames = recentMatches.filter(m => m.isHome && m.status === 'FINISHED');
                                                            const total = Math.max(homeGames.length, 1);
                                                            const wins = homeGames.filter(m => m.homeScore > m.awayScore).length;
                                                            const draws = homeGames.filter(m => m.homeScore === m.awayScore).length;
                                                            return (
                                                                <>
                                                                    <div className="bg-blue-500" style={{ width: `${(wins / total) * 100}%` }} />
                                                                    <div className="bg-amber-500" style={{ width: `${(draws / total) * 100}%` }} />
                                                                    <div className="bg-rose-500 flex-1" />
                                                                </>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between mb-2 text-sm font-bold uppercase tracking-wider text-white/60">
                                                        <span>Away Performance</span>
                                                        <span>{recentMatches.filter(m => !m.isHome && m.status === 'FINISHED').length} Games</span>
                                                    </div>
                                                    <div className="flex h-4 rounded-full overflow-hidden bg-white/5">
                                                        {(() => {
                                                            const awayGames = recentMatches.filter(m => !m.isHome && m.status === 'FINISHED');
                                                            const total = Math.max(awayGames.length, 1);
                                                            const wins = awayGames.filter(m => m.awayScore > m.homeScore).length;
                                                            const draws = awayGames.filter(m => m.awayScore === m.homeScore).length;
                                                            return (
                                                                <>
                                                                    <div className="bg-blue-500" style={{ width: `${(wins / total) * 100}%` }} />
                                                                    <div className="bg-amber-500" style={{ width: `${(draws / total) * 100}%` }} />
                                                                    <div className="bg-rose-500 flex-1" />
                                                                </>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                                <Star className="w-5 h-5 text-yellow-500" />
                                                Team Records
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col justify-center items-center text-center">
                                                    <div className="text-xs font-bold uppercase text-white/40 mb-2">Biggest Win</div>
                                                    {(() => {
                                                        const wins = recentMatches.filter(m => m.status === 'FINISHED' && ((m.isHome && m.homeScore > m.awayScore) || (!m.isHome && m.awayScore > m.homeScore)));
                                                        if (wins.length === 0) return <div className="font-bold text-white/20 text-sm">None yet</div>;
                                                        const biggest = wins.reduce((prev, current) => {
                                                            const prevMargin = Math.abs(prev.homeScore - prev.awayScore);
                                                            const currMargin = Math.abs(current.homeScore - current.awayScore);
                                                            return (prevMargin > currMargin) ? prev : current;
                                                        });
                                                        return (
                                                            <>
                                                                <div className="text-3xl font-black text-blue-500">{Math.abs(biggest.homeScore - biggest.awayScore)}<span className="text-base font-normal text-white/50 ml-1">pts</span></div>
                                                                <div className="text-xs text-white/40 mt-1">vs {biggest.isHome ? biggest.opponent?.shortName : biggest.opponent?.shortName}</div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col justify-center items-center text-center">
                                                    <div className="text-xs font-bold uppercase text-white/40 mb-2">High Score</div>
                                                    {(() => {
                                                        const finished = recentMatches.filter(m => m.status === 'FINISHED');
                                                        if (finished.length === 0) return <div className="font-bold text-white/20 text-sm">-</div>;
                                                        const highest = finished.reduce((prev, current) => {
                                                            return (prev.homeScore + prev.awayScore > current.homeScore + current.awayScore) ? prev : current;
                                                        });
                                                        return (
                                                            <>
                                                                <div className="text-3xl font-black text-white">{highest.homeScore + highest.awayScore}<span className="text-base font-normal text-white/50 ml-1">pts</span></div>
                                                                <div className="text-xs text-white/40 mt-1">Total Game Pts</div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
