'use client';

import { motion } from 'framer-motion';
import { Trophy, Users, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    university: string;
    color: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
}

export default function TeamsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/teams');
                if (!response.ok) throw new Error('Failed to fetch teams');
                const data = await response.json();
                setTeams(data);
            } catch (err) {
                console.error('Error fetching teams:', err);
                setError('Could not load teams. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchTeams();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-white/40 font-black uppercase tracking-widest text-xs">Loading University Teams...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="text-center p-8 bg-white/5 border border-white/10 rounded-[40px]">
                    <p className="text-red-500 font-bold mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-primary text-black rounded-xl font-black uppercase tracking-widest text-[10px]"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-12">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Users size={16} className="text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Official Participating Schools</span>
                        </div>
                        <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none">University Teams</h1>
                        <p className="text-white/60 mt-2 text-sm">Explore all participating schools and their performance across competitions</p>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                        <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10">
                            <span className="text-white/40">Active Teams: </span>
                            <span className="text-primary">{teams.length}</span>
                        </div>
                    </div>
                </header>

                {/* Teams Grid */}
                {teams.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teams.map((team, idx) => (
                            <motion.div
                                key={team.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                            >
                                <Link href={`/teams/${team.id}`}>
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 hover:border-primary/30 transition-all group cursor-pointer">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 relative">
                                                    <img
                                                        src={team.logo || '/assests/Logos/BRIX-SPORT-LOGO.png'}
                                                        alt={team.name}
                                                        className="w-full h-full object-contain filter group-hover:drop-shadow-[0_0_10px_rgba(255,214,0,0.5)] transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black uppercase tracking-tight group-hover:text-primary transition-colors">
                                                        {team.shortName}
                                                    </h3>
                                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                                                        {team.university}
                                                    </p>
                                                </div>
                                            </div>
                                            <ArrowRight size={20} className="text-white/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/5">
                                            <div className="text-center">
                                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Played</p>
                                                <p className="font-display text-2xl italic text-white">{team.played || 0}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Won</p>
                                                <p className="font-display text-2xl italic text-primary">{team.won || 0}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Points</p>
                                                <p className="font-display text-2xl italic text-white">{team.points || 0}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-center gap-2">
                                            <TrendingUp size={14} className="text-primary" />
                                            <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="bg-primary h-full rounded-full transition-all"
                                                    style={{ width: `${team.played > 0 ? (team.won / team.played) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-white/60">
                                                {team.played > 0 ? Math.round((team.won / team.played) * 100) : 0}% Win Rate
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="py-24 text-center bg-white/5 border border-white/10 rounded-[40px]">
                        <p className="text-white/20 font-black uppercase tracking-widest italic">No teams registered in the system yet</p>
                    </div>
                )}

                {/* Quick Stats */}
                {teams.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                            <div>
                                <Trophy size={32} className="mx-auto text-primary mb-3" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Top Performer</p>
                                <p className="font-display text-2xl italic text-white">
                                    {[...teams].sort((a, b) => (b.points || 0) - (a.points || 0))[0]?.shortName}
                                </p>
                            </div>
                            <div>
                                <Users size={32} className="mx-auto text-white/60 mb-3" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Total Matches</p>
                                <p className="font-display text-2xl italic text-white">
                                    {teams.reduce((sum, team) => sum + (team.played || 0), 0) / 2}
                                </p>
                            </div>
                            <div>
                                <TrendingUp size={32} className="mx-auto text-white/60 mb-3" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Total Goals/Points</p>
                                <p className="font-display text-2xl italic text-white">
                                    {teams.reduce((sum, team) => sum + (team.goalsFor || 0), 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

