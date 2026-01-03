'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Trophy, Target, Zap, Home, Plane, Shield, Activity } from 'lucide-react';
import Link from 'next/link';

interface TeamStats {
    team: {
        id: string;
        name: string;
        shortName: string;
        logo: string;
        sport: string;
    };
    basic: {
        played: number;
        won: number;
        drawn: number;
        lost: number;
        goalsFor: number;
        goalsAgainst: number;
        goalDifference: number;
        points: number;
    };
    advanced: {
        winPercentage: number;
        avgGoalsFor: number;
        avgGoalsAgainst: number;
        cleanSheets: number;
        failedToScore: number;
        biggestWin: number;
        biggestLoss: number;
        form: string;
        currentStreak: { type: string; count: number };
        longestWinStreak: number;
        longestLossStreak: number;
    };
    splits: {
        home: {
            played: number;
            won: number;
            drawn: number;
            lost: number;
            record: string;
        };
        away: {
            played: number;
            won: number;
            drawn: number;
            lost: number;
            record: string;
        };
    };
}

export default function StatsPage() {
    const [selectedSport, setSelectedSport] = useState<'Football' | 'Basketball'>('Football');
    const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            setLoading(true);
            try {
                const response = await fetch(`/api/teams/stats?sport=${selectedSport}`);
                const data = await response.json();
                setTeamStats(data);
            } catch (error) {
                console.error('Error fetching stats:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, [selectedSport]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/60">Loading team statistics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            <div className="max-w-7xl mx-auto space-y-12">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <TrendingUp size={16} className="text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">BUSA League</span>
                        </div>
                        <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none">Team Statistics</h1>
                        <p className="text-white/60 mt-2 text-sm">Comprehensive team performance analytics</p>
                    </div>

                    {/* Sport Selector */}
                    <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 gap-1">
                        {['Football', 'Basketball'].map((sport) => (
                            <button
                                key={sport}
                                onClick={() => setSelectedSport(sport as any)}
                                className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedSport === sport ? 'bg-primary text-black' : 'text-white/40 hover:text-white'
                                    }`}
                            >
                                {sport}
                            </button>
                        ))}
                    </div>
                </header>

                {/* Stats Grid */}
                {teamStats.length > 0 ? (
                    <div className="space-y-6">
                        {teamStats.map((stats, index) => (
                            <motion.div
                                key={stats.team.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all"
                            >
                                {/* Team Header */}
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <span className="text-5xl">{stats.team.logo || '⚽'}</span>
                                        <div>
                                            <h2 className="text-2xl font-display italic uppercase tracking-tight">{stats.team.name}</h2>
                                            <p className="text-xs text-white/60 font-bold uppercase tracking-wider">{stats.team.sport}</p>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/teams/${stats.team.id}`}
                                        className="px-6 py-3 bg-primary/10 border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-colors"
                                    >
                                        View Team
                                    </Link>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Basic Stats */}
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Trophy size={16} className="text-primary" />
                                            <h3 className="text-sm font-black uppercase tracking-widest">Record</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <StatRow label="Played" value={stats.basic.played} />
                                            <StatRow label="Won" value={stats.basic.won} highlight />
                                            <StatRow label="Drawn" value={stats.basic.drawn} />
                                            <StatRow label="Lost" value={stats.basic.lost} />
                                            <div className="pt-3 border-t border-white/10">
                                                <StatRow label="Points" value={stats.basic.points} highlight large />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Scoring Stats */}
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Target size={16} className="text-primary" />
                                            <h3 className="text-sm font-black uppercase tracking-widest">Scoring</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <StatRow label={selectedSport === 'Football' ? 'Goals For' : 'Points For'} value={stats.basic.goalsFor} />
                                            <StatRow label={selectedSport === 'Football' ? 'Goals Against' : 'Points Against'} value={stats.basic.goalsAgainst} />
                                            <StatRow
                                                label="Differential"
                                                value={`${stats.basic.goalDifference > 0 ? '+' : ''}${stats.basic.goalDifference}`}
                                                highlight={stats.basic.goalDifference > 0}
                                            />
                                            <StatRow label="Avg For" value={stats.advanced.avgGoalsFor.toFixed(2)} />
                                            <StatRow label="Avg Against" value={stats.advanced.avgGoalsAgainst.toFixed(2)} />
                                        </div>
                                    </div>

                                    {/* Advanced Stats */}
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Zap size={16} className="text-primary" />
                                            <h3 className="text-sm font-black uppercase tracking-widest">Performance</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <StatRow label="Win %" value={`${stats.advanced.winPercentage.toFixed(1)}%`} highlight />
                                            <StatRow label="Clean Sheets" value={stats.advanced.cleanSheets} />
                                            <StatRow label="Failed to Score" value={stats.advanced.failedToScore} />
                                            <StatRow label="Biggest Win" value={`+${stats.advanced.biggestWin}`} />
                                            <StatRow label="Biggest Loss" value={stats.advanced.biggestLoss > 0 ? `-${stats.advanced.biggestLoss}` : '0'} />
                                        </div>
                                    </div>
                                </div>

                                {/* Form & Streaks */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                    {/* Current Form */}
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Activity size={16} className="text-primary" />
                                            <h3 className="text-sm font-black uppercase tracking-widest">Form (Last 5)</h3>
                                        </div>
                                        <div className="flex gap-2">
                                            {stats.advanced.form.split('').map((result, i) => (
                                                <div
                                                    key={i}
                                                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black ${result === 'W'
                                                            ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                                                            : result === 'L'
                                                                ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                                                                : 'bg-white/10 text-white/60 border border-white/20'
                                                        }`}
                                                >
                                                    {result}
                                                </div>
                                            ))}
                                        </div>
                                        {stats.advanced.currentStreak.count > 0 && (
                                            <p className="text-xs text-white/60 mt-3">
                                                Current: {stats.advanced.currentStreak.count} {stats.advanced.currentStreak.type === 'W' ? 'wins' : stats.advanced.currentStreak.type === 'L' ? 'losses' : 'draws'}
                                            </p>
                                        )}
                                    </div>

                                    {/* Home Record */}
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Home size={16} className="text-primary" />
                                            <h3 className="text-sm font-black uppercase tracking-widest">Home</h3>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-2xl font-display italic text-primary">{stats.splits.home.record}</p>
                                            <p className="text-xs text-white/60">{stats.splits.home.played} matches played</p>
                                        </div>
                                    </div>

                                    {/* Away Record */}
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Plane size={16} className="text-primary" />
                                            <h3 className="text-sm font-black uppercase tracking-widest">Away</h3>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-2xl font-display italic text-primary">{stats.splits.away.record}</p>
                                            <p className="text-xs text-white/60">{stats.splits.away.played} matches played</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Streaks */}
                                <div className="grid grid-cols-2 gap-4 mt-6">
                                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Longest Win Streak</p>
                                        <p className="text-3xl font-display italic text-green-500">{stats.advanced.longestWinStreak}</p>
                                    </div>
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Longest Loss Streak</p>
                                        <p className="text-3xl font-display italic text-red-500">{stats.advanced.longestLossStreak}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <TrendingUp size={64} className="mx-auto text-white/10 mb-4" />
                        <h2 className="text-2xl font-bold mb-2">No Statistics Available</h2>
                        <p className="text-white/40">No team statistics found for {selectedSport}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatRow({ label, value, highlight, large }: { label: string; value: string | number; highlight?: boolean; large?: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</span>
            <span className={`${large ? 'text-2xl' : 'text-sm'} font-display italic ${highlight ? 'text-primary' : 'text-white'}`}>
                {value}
            </span>
        </div>
    );
}
