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
import { LoadFailedState } from '@/components/resilience/ReadPathStates';

const TeamStatsChart = dynamic(() => import('@/components/TeamStatsChart'), {
    loading: () => <div className="absolute inset-0 flex items-center justify-center animate-pulse bg-muted rounded-full" />,
    ssr: false
});

interface TeamSeasonOption {
    competitionId: string;
    name: string;
    season: string;
    matchCount: number;
    latestMatchTime: string | null;
}

interface TeamData {
    team: any;
    players: any[];
    universityPlayers?: any[];
    recentMatches: any[];
    upcomingMatches: any[];
    stats: any;
    form: string[];
    competitions: string[];
    statsSeasons?: { selected: string; seasons: TeamSeasonOption[] };
}

export default function TeamDetailClient() {
    const params = useParams();
    const router = useRouter();
    const teamId = params.id as string;

    const [data, setData] = useState<TeamData | null>(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'players' | 'fixtures' | 'stats'>('overview');

    useEffect(() => {
        fetchTeamData();
    }, [teamId]);

    // A first load that failed retries by itself when the connection returns.
    useEffect(() => {
        if (!loadFailed) return;
        const retryOnReconnect = () => { fetchTeamData(); };
        window.addEventListener('online', retryOnReconnect);
        return () => window.removeEventListener('online', retryOnReconnect);
    }, [loadFailed, teamId]);

    // BACKLOG-375: `statsCompetitionId` is optional -- omitted on the initial load so
    // the API resolves its own default (most recent season with real data). Passed
    // explicitly only when the selector below is changed, so re-selecting the same
    // default the API would have picked anyway is indistinguishable from the first load.
    const fetchTeamData = async (statsCompetitionId?: string) => {
        try {
            if (statsCompetitionId) setStatsLoading(true); else setLoading(true);
            const url = statsCompetitionId
                ? `/api/teams/${teamId}?statsCompetitionId=${encodeURIComponent(statsCompetitionId)}`
                : `/api/teams/${teamId}`;
            const response = await fetch(url);
            if (response.status === 404) {
                // A genuine 404 is the only thing that means "this team doesn't exist".
                setData(null);
                setLoadFailed(false);
                return;
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const teamData = await response.json();
            setData(teamData);
            setLoadFailed(false);
        } catch (error) {
            console.error('Error fetching team:', error);
            // Only the first load has no data to fall back on. A failed season-selector
            // refetch keeps the team already on screen.
            if (!statsCompetitionId) setLoadFailed(true);
        } finally {
            setLoading(false);
            setStatsLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-foreground/40 text-sm font-medium animate-pulse">Loading Team Data...</p>
                </div>
            </div>
        );
    }

    if (!data && loadFailed) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
                <LoadFailedState title="Couldn't load this team" onRetry={() => fetchTeamData()} />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto border border-border">
                        <Search className="w-8 h-8 text-foreground/40" />
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

    const { team, players = [], universityPlayers = [], recentMatches = [], upcomingMatches = [], stats: rawStats = {}, form = [], competitions = [], statsSeasons } = data;
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
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
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
                            className="mb-8 flex items-center gap-2 text-foreground/40 hover:text-foreground transition-colors group"
                        >
                            <div className="p-2 rounded-full bg-muted group-hover:bg-muted/70 transition-colors border border-border">
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
                                <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-card border border-border flex items-center justify-center shadow-2xl overflow-hidden">
                                    {team.logo ? (
                                        <img src={team.logo} alt={team.name} className="w-28 h-28 md:w-32 md:h-32 object-contain" />
                                    ) : (
                                        <span className="text-4xl md:text-5xl font-black text-foreground/10">{team.shortName.substring(0, 2)}</span>
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
                                        <span className="px-3 py-1 rounded-full bg-muted border border-border text-[10px] font-bold uppercase tracking-widest text-foreground/60">
                                            {team.sport} Team
                                        </span>
                                        {team.founded && (
                                            <span className="text-xs font-mono text-foreground/40">{team.founded}</span>
                                        )}
                                    </div>
                                    <h1 className="text-4xl md:text-6xl font-black tracking-tight">{team.name}</h1>
                                </div>

                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-sm font-medium text-foreground/60">
                                    {team.stadium && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-primary" />
                                            <span>{team.stadium}</span>
                                        </div>
                                    )}
                                    <div className="w-1 h-1 rounded-full bg-foreground/20" />
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-blue-400" />
                                        <span>{players.length} Players</span>
                                    </div>
                                    {competitions.length > 0 && (
                                        <>
                                            <div className="w-1 h-1 rounded-full bg-foreground/20" />
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
                                    className="flex flex-col items-center md:items-end gap-2 p-4 rounded-2xl bg-muted border border-border backdrop-blur-sm"
                                >
                                    <span className="text-xs font-bold uppercase tracking-widest text-foreground/40">Recent Form</span>
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
                <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-y border-border mb-8">
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
                                        activeTab === tab ? "text-foreground" : "text-foreground/40 hover:text-foreground/60"
                                    )}>
                                        {tab}
                                    </span>
                                    {activeTab === tab && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute inset-0 bg-muted border-b-2 border-primary"
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
                                            {/* Live device report: this linked to /matches?team=..., a
                                                route that has never existed (src/app/matches/ has only
                                                a [id] dynamic route, no index page) -- a real 404. This
                                                same page already has a Fixtures tab showing this team's
                                                full match list, so switch to it instead of navigating
                                                to a page that was never built. */}
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('fixtures')}
                                                className="text-xs font-bold uppercase tracking-widest text-foreground/40 hover:text-foreground transition-colors"
                                            >
                                                View All
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {recentMatches.length > 0 ? recentMatches.slice(0, 5).map((match, i) => (
                                                <Link key={match.id} href={`/matches/${match.id}`}>
                                                    <motion.div
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.05 }}
                                                        whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.08)' }}
                                                        className="group p-5 bg-muted rounded-2xl border border-border transition-all"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-6">
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-xs font-bold text-foreground/40 uppercase mb-1">{format(new Date(match.startTime), 'MMM')}</span>
                                                                    <span className="text-xl font-black">{format(new Date(match.startTime), 'dd')}</span>
                                                                </div>
                                                                <div className="h-10 w-px bg-border" />
                                                                <div className="space-y-1">
                                                                    <div className={cn("flex items-center gap-3 text-lg font-bold", match.isHome ? "text-foreground" : "text-foreground/50")}>
                                                                        <span>{team.name}</span>
                                                                        {match.status === 'FINISHED' && (
                                                                            <span className={cn("ml-auto font-mono", match.isHome ? "text-foreground" : "text-foreground/40")}>
                                                                                {match.isHome ? match.homeScore : match.awayScore}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className={cn("flex items-center gap-3 text-lg font-bold", !match.isHome ? "text-foreground" : "text-foreground/50")}>
                                                                        <span>{match.opponent?.name || 'Unknown'}</span>
                                                                        {match.status === 'FINISHED' && (
                                                                            <span className={cn("ml-auto font-mono", !match.isHome ? "text-foreground" : "text-foreground/40")}>
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
                                                                    <span className="px-3 py-1 rounded-lg bg-muted text-foreground/40 text-xs font-bold uppercase tracking-widest">
                                                                        {format(new Date(match.startTime), 'HH:mm')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                </Link>
                                            )) : (
                                                <div className="p-12 text-center border border-dashed border-border rounded-2xl text-foreground/40">
                                                    No recent activity
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="p-6 bg-gradient-to-br from-muted to-muted/50 rounded-3xl border border-border backdrop-blur-md">
                                            <div className="flex items-center justify-between mb-6 gap-2">
                                                <h3 className="text-lg font-bold flex items-center gap-2">
                                                    <TrendingUp className="w-5 h-5 text-primary" />
                                                    Season Stats
                                                </h3>
                                                {/* BACKLOG-375: same selector pattern as competitions/[id]/page.tsx's
                                                    season switcher -- only shown once there's an actual choice to make
                                                    (a team with 0-1 competitions has nothing to switch between). "All
                                                    Competitions" spans every competition (+ friendlies); each other
                                                    option gates to just that one competition/season. */}
                                                {statsSeasons && statsSeasons.seasons.length > 0 && (
                                                    <select
                                                        aria-label="Filter season stats by competition"
                                                        value={statsSeasons.selected}
                                                        disabled={statsLoading}
                                                        onChange={(e) => fetchTeamData(e.target.value)}
                                                        className="text-[10px] font-black uppercase tracking-widest text-foreground/60 bg-muted border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-primary/50 disabled:opacity-50"
                                                    >
                                                        <option value="all">All Competitions</option>
                                                        {statsSeasons.seasons.map((s) => (
                                                            <option key={s.competitionId} value={s.competitionId}>
                                                                {s.name} ({s.season})
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                            <div className={cn("space-y-4 transition-opacity", statsLoading && "opacity-50")}>
                                                <div className="flex justify-between items-center p-3 bg-background/20 rounded-xl">
                                                    <span className="text-foreground/60 text-sm">Matches Played</span>
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
                                                <div className="p-4 bg-muted rounded-xl border border-border">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-sm text-foreground/60">Win Rate</span>
                                                        <span className="font-bold text-primary">{((stats.won / Math.max(stats.played, 1)) * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary transition-all duration-1000"
                                                            style={{ width: `${(stats.won / Math.max(stats.played, 1)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {competitions.length > 0 && (
                                            <div className="p-6 bg-muted rounded-3xl border border-border">
                                                <h3 className="text-lg font-bold mb-4">Competitions</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {competitions.map((comp, index) => (
                                                        <div key={index} className="flex items-center gap-2 pl-2 pr-4 py-1.5 bg-muted hover:bg-muted/70 transition-colors rounded-full border border-border text-xs font-bold uppercase tracking-wide cursor-default">
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
                                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-12">
                                    {/* Active Squad Section */}
                                    <div>
                                        <div className="flex items-center justify-between mb-8">
                                            <h2 className="text-2xl font-bold flex items-center gap-3">
                                                <Users className="w-6 h-6 text-primary" />
                                                Active Squad
                                                <span className="text-sm font-medium text-foreground/40 bg-muted px-2 py-1 rounded-md">{players.length}</span>
                                            </h2>
                                        </div>

                                        {players.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {players.map((player) => (
                                                    <Link key={player.id} href={`/players/${player.id}`}>
                                                        <motion.div
                                                            variants={itemVariants}
                                                            whileHover={{ y: -5 }}
                                                            className="group p-1 rounded-2xl bg-gradient-to-b from-muted to-muted/50 border border-border hover:border-primary/50 transition-all duration-300"
                                                        >
                                                            <div className="bg-card rounded-xl p-5 h-full relative overflow-hidden">
                                                                <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-foreground group-hover:opacity-20 transition-opacity select-none">
                                                                    {player.number}
                                                                </div>
                                                                <div className="relative z-10 flex flex-col h-full">
                                                                    <div className="flex items-center gap-4 mb-4">
                                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
                                                                            {player.number}
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-xs font-bold uppercase text-foreground/40 tracking-widest mb-0.5">{player.position}</div>
                                                                            <div className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{player.name}</div>
                                                                        </div>
                                                                    </div>
                                                                    {team.sport === 'Basketball' && player.stats && (
                                                                        <div className="mt-auto grid grid-cols-3 gap-2 py-3 border-t border-border">
                                                                            <div className="text-center">
                                                                                <div className="text-[10px] uppercase text-foreground/30 font-bold">PTS</div>
                                                                                <div className="font-mono font-bold text-blue-500">{(player.stats.pointsPerGame || 0).toFixed(1)}</div>
                                                                            </div>
                                                                            <div className="text-center border-l border-border">
                                                                                <div className="text-[10px] uppercase text-foreground/30 font-bold">REB</div>
                                                                                {/* Live device report: unlike PTS above, this rendered the raw
                                                                                    per-game average with no rounding -- a value like
                                                                                    3.3333333333333335 (a repeating-decimal average, not a data
                                                                                    bug) overflowed its column and visually overlapped the
                                                                                    neighbouring AST figure. Same .toFixed(1) as PTS. */}
                                                                                <div className="font-mono font-bold">{(player.stats.reboundsPerGame || 0).toFixed(1)}</div>
                                                                            </div>
                                                                            <div className="text-center border-l border-border">
                                                                                <div className="text-[10px] uppercase text-foreground/30 font-bold">AST</div>
                                                                                <div className="font-mono font-bold">{(player.stats.assistsPerGame || 0).toFixed(1)}</div>
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
                                            <div className="h-64 flex flex-col items-center justify-center bg-muted rounded-3xl border border-dashed border-border">
                                                <Users className="w-12 h-12 text-foreground/20 mb-4" />
                                                <p className="text-foreground/40 font-medium">No players registered yet.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* University Pool Section (if applicable) */}
                                    {universityPlayers.length > players.length && (
                                        <div className="pt-8 border-t border-border">
                                            <div className="flex items-center justify-between mb-8">
                                                <h2 className="text-2xl font-bold flex items-center gap-3">
                                                    <Shield className="w-6 h-6 text-blue-400" />
                                                    {team.university} Talent Pool
                                                    <span className="text-sm font-medium text-foreground/40 bg-muted px-2 py-1 rounded-md">{universityPlayers.length} Total</span>
                                                </h2>
                                                <p className="text-xs font-medium text-foreground/40">Players from across all {team.university} teams</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {universityPlayers
                                                    .filter(up => !players.some(p => p.id === up.id))
                                                    .map((player) => (
                                                        <Link key={player.id} href={`/players/${player.id}`}>
                                                            <motion.div
                                                                variants={itemVariants}
                                                                whileHover={{ y: -5 }}
                                                                className="group p-5 rounded-2xl bg-muted border border-border hover:border-blue-500/50 transition-all duration-300"
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground/40 font-bold text-sm border border-border group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                                                                        {player.number}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[10px] font-bold uppercase text-foreground/20 tracking-widest mb-0.5">{player.position}</div>
                                                                        <div className="font-bold text-base leading-tight group-hover:text-foreground transition-colors">{player.name}</div>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        </Link>
                                                    ))}
                                            </div>
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
                                                            className="relative overflow-hidden bg-muted rounded-2xl border border-border group hover:bg-muted/70 transition-colors"
                                                        >
                                                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                                                            <div className="p-6">
                                                                <div className="flex justify-between items-start mb-6">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                                                                            {format(new Date(match.startTime), 'EEEE, MMM d')}
                                                                        </span>
                                                                        <span className="text-sm font-medium text-foreground/40 flex items-center gap-2">
                                                                            <Calendar className="w-3 h-3" />
                                                                            {format(new Date(match.startTime), 'h:mm a')}
                                                                        </span>
                                                                    </div>
                                                                    <div className="px-3 py-1 rounded-full bg-muted text-xs font-bold uppercase tracking-widest text-foreground/60">
                                                                        {match.competition}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-6">
                                                                    <div className="flex-1 flex flex-col items-center gap-3">
                                                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold border border-border">
                                                                            {match.isHome ? team.shortName : match.opponent?.shortName?.substring(0, 3)}
                                                                        </div>
                                                                        <span className="text-center font-bold text-sm truncate w-full">{match.isHome ? team.name : match.opponent?.name}</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-2xl font-black text-foreground/20 italic">VS</span>
                                                                        <span className="text-[10px] font-bold uppercase text-foreground/40 mt-1">{match.venue || 'TBA'}</span>
                                                                    </div>
                                                                    <div className="flex-1 flex flex-col items-center gap-3">
                                                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-sm font-bold border border-border">
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
                                        <div className="bg-muted rounded-3xl p-12 text-center border ring-1 ring-border">
                                            <Calendar className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                                            <p className="text-foreground/40 font-medium">No upcoming fixtures scheduled.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'stats' && (
                                <div className="space-y-8">
                                    {/* Charts Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {/* Win/Loss Distribution */}
                                        <div className="p-6 bg-muted rounded-3xl border border-border flex flex-col">
                                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                                <Target className="w-5 h-5 text-primary" />
                                                Match Results
                                            </h3>
                                            <div className="flex-1 min-h-[200px] relative">
                                                <TeamStatsChart stats={stats} />
                                            </div>
                                            <div className="flex justify-center gap-4 mt-4">
                                                <div className="flex items-center gap-2 text-xs font-bold text-foreground/60">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500" /> Won
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-bold text-foreground/60">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500" /> Draw
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-bold text-foreground/60">
                                                    <div className="w-2 h-2 rounded-full bg-rose-500" /> Lost
                                                </div>
                                            </div>
                                        </div>

                                        {/* Attack Stats */}
                                        <div className="p-6 bg-muted rounded-3xl border border-border">
                                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                                <TrendingUp className="w-5 h-5 text-blue-500" />
                                                Attack
                                            </h3>
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-foreground/60">{team.sport === 'Basketball' ? 'Total Points' : 'Goals Scored'}</span>
                                                        <span className="font-bold text-2xl text-blue-500">{stats.goalsFor}</span>
                                                    </div>
                                                    <div className="w-full bg-muted rounded-full h-1.5">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: '100%' }}
                                                            className="bg-blue-500 h-1.5 rounded-full opacity-50"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-foreground/60">{team.sport === 'Basketball' ? 'PPG' : 'Goals / Game'}</span>
                                                        <span className="font-bold text-xl">{(stats.goalsFor / Math.max(stats.played, 1)).toFixed(1)}</span>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                                    <div className="text-xs text-blue-400 font-bold uppercase tracking-wide mb-1">Top Stat</div>
                                                    <div className="text-sm text-foreground/80">Scored in <span className="text-foreground font-bold">{((stats.goalsFor / Math.max(stats.played, 1)) > 0 ? '100%' : '0%')}</span> of matches</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Defense Stats */}
                                        <div className="p-6 bg-muted rounded-3xl border border-border">
                                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                                <Shield className="w-5 h-5 text-rose-500" />
                                                Defense
                                            </h3>
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-foreground/60">{team.sport === 'Basketball' ? 'Points Allowed' : 'Goals Conceded'}</span>
                                                        <span className="font-bold text-2xl text-rose-500">{stats.goalsAgainst}</span>
                                                    </div>
                                                    <div className="w-full bg-muted rounded-full h-1.5">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min((stats.goalsAgainst / 100) * 100, 100)}%` }} // Arbitrary max
                                                            className="bg-rose-500 h-1.5 rounded-full opacity-50"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-foreground/60">Goal Difference</span>
                                                        <span className={cn("font-bold text-xl", stats.goalDifference >= 0 ? "text-blue-500" : "text-rose-500")}>
                                                            {stats.goalDifference > 0 ? '+' : ''}{stats.goalDifference}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-rose-500/5 rounded-xl border border-rose-500/10">
                                                    <div className="text-xs text-rose-400 font-bold uppercase tracking-wide mb-1">Defense Note</div>
                                                    <div className="text-sm text-foreground/80">Avg <span className="text-foreground font-bold">{(stats.goalsAgainst / Math.max(stats.played, 1)).toFixed(1)}</span> conceded per game</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed Breakdowns */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-6 bg-muted rounded-3xl border border-border">
                                            <h3 className="font-bold text-lg mb-6">Home vs Away</h3>
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="flex justify-between mb-2 text-sm font-bold uppercase tracking-wider text-foreground/60">
                                                        <span>Home Performance</span>
                                                        <span>{recentMatches.filter(m => m.isHome && m.status === 'FINISHED').length} Games</span>
                                                    </div>
                                                    <div className="flex h-4 rounded-full overflow-hidden bg-muted">
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
                                                    <div className="flex justify-between mb-2 text-sm font-bold uppercase tracking-wider text-foreground/60">
                                                        <span>Away Performance</span>
                                                        <span>{recentMatches.filter(m => !m.isHome && m.status === 'FINISHED').length} Games</span>
                                                    </div>
                                                    <div className="flex h-4 rounded-full overflow-hidden bg-muted">
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

                                        <div className="p-6 bg-muted rounded-3xl border border-border">
                                            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                                                <Star className="w-5 h-5 text-yellow-500" />
                                                Team Records
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-muted rounded-2xl border border-border flex flex-col justify-center items-center text-center">
                                                    <div className="text-xs font-bold uppercase text-foreground/40 mb-2">Biggest Win</div>
                                                    {(() => {
                                                        const wins = recentMatches.filter(m => m.status === 'FINISHED' && ((m.isHome && m.homeScore > m.awayScore) || (!m.isHome && m.awayScore > m.homeScore)));
                                                        if (wins.length === 0) return <div className="font-bold text-foreground/20 text-sm">None yet</div>;
                                                        const biggest = wins.reduce((prev, current) => {
                                                            const prevMargin = Math.abs(prev.homeScore - prev.awayScore);
                                                            const currMargin = Math.abs(current.homeScore - current.awayScore);
                                                            return (prevMargin > currMargin) ? prev : current;
                                                        });
                                                        return (
                                                            <>
                                                                <div className="text-3xl font-black text-blue-500">{Math.abs(biggest.homeScore - biggest.awayScore)}<span className="text-base font-normal text-foreground/50 ml-1">pts</span></div>
                                                                <div className="text-xs text-foreground/40 mt-1">vs {biggest.isHome ? biggest.opponent?.shortName : biggest.opponent?.shortName}</div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="p-4 bg-muted rounded-2xl border border-border flex flex-col justify-center items-center text-center">
                                                    <div className="text-xs font-bold uppercase text-foreground/40 mb-2">High Score</div>
                                                    {(() => {
                                                        const finished = recentMatches.filter(m => m.status === 'FINISHED');
                                                        if (finished.length === 0) return <div className="font-bold text-foreground/20 text-sm">-</div>;
                                                        const highest = finished.reduce((prev, current) => {
                                                            return (prev.homeScore + prev.awayScore > current.homeScore + current.awayScore) ? prev : current;
                                                        });
                                                        return (
                                                            <>
                                                                <div className="text-3xl font-black text-foreground">{highest.homeScore + highest.awayScore}<span className="text-base font-normal text-foreground/50 ml-1">pts</span></div>
                                                                <div className="text-xs text-foreground/40 mt-1">Total Game Pts</div>
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
