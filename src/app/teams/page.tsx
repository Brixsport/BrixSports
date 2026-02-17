'use client';

import { motion } from 'framer-motion';
import { Trophy, Users, TrendingUp, ArrowRight, Loader2, Filter } from 'lucide-react';
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

interface Competition {
    id: string;
    name: string;
    sport: string;
}

export default function TeamsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('all'); // 'all' or competition name

    // Fetch initial data
    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);
                // Fetch competitions first
                const compRes = await fetch('/api/competitions');
                const compData = await compRes.json();

                if (compData.competitions) {
                    setCompetitions(compData.competitions);
                }

                // Fetch all teams initially
                await fetchTeams('all');
            } catch (err) {
                console.error('Error initializing teams page:', err);
                setError('Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, []);

    // Handle tab change
    const handleTabChange = async (tab: string) => {
        setActiveTab(tab);
        await fetchTeams(tab);
    };

    const fetchTeams = async (filter: string) => {
        setLoading(true);
        setError(null);
        try {
            let data;
            if (filter === 'all') {
                const response = await fetch('/api/teams');
                if (!response.ok) throw new Error('Failed to fetch teams');
                data = await response.json();
            } else {
                // Determine sport for competition to fetch correctly (default to Football if not found)
                const comp = competitions.find(c => c.name === filter);
                const sport = comp?.sport || 'Football';

                // Fetch teams via standings for specific competition
                const response = await fetch(`/api/${sport.toLowerCase()}/standings?competition=${encodeURIComponent(filter)}`);
                if (!response.ok) throw new Error('Failed to fetch competition teams');
                const result = await response.json();

                // Transform standings to team format
                if (result.standings) {
                    data = result.standings.map((s: any) => ({
                        ...s.team,
                        played: s.played,
                        won: s.won,
                        drawn: s.drawn,
                        lost: s.lost,
                        goalsFor: s.goalsFor,
                        goalsAgainst: s.goalsAgainst,
                        points: s.points,
                    }));
                } else {
                    data = [];
                }
            }
            setTeams(data);
        } catch (err) {
            console.error('Error fetching teams:', err);
            setError('Could not load teams. Please try again later.');
            setTeams([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Users size={16} className="text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Registered Teams</span>
                        </div>
                        <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none">
                            {activeTab === 'all' ? 'All Teams' : activeTab}
                        </h1>
                        <p className="text-white/60 mt-2 text-sm">
                            {activeTab === 'all'
                                ? 'Browse all teams across every competition'
                                : `Teams participating in ${activeTab}`}
                        </p>
                    </div>

                    {/* Dynamic Tabs */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => handleTabChange('all')}
                            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${activeTab === 'all'
                                    ? 'bg-primary text-black border-primary'
                                    : 'bg-white/5 text-white/40 border-white/10 hover:text-white'
                                }`}
                        >
                            All Teams
                        </button>
                        {competitions.map((comp) => (
                            <button
                                key={comp.id}
                                onClick={() => handleTabChange(comp.name)}
                                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${activeTab === comp.name
                                        ? 'bg-primary text-black border-primary'
                                        : 'bg-white/5 text-white/40 border-white/10 hover:text-white'
                                    }`}
                            >
                                {comp.name}
                            </button>
                        ))}
                    </div>
                </header>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                            <p className="text-white/40 font-black uppercase tracking-widest text-xs">Loading Teams...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="text-center p-8 bg-white/5 border border-white/10 rounded-[40px]">
                        <p className="text-red-500 font-bold mb-4">{error}</p>
                        <button
                            onClick={() => fetchTeams(activeTab)}
                            className="px-6 py-3 bg-primary text-black rounded-xl font-black uppercase tracking-widest text-[10px]"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Quick Stats */}
                        {teams.length > 0 && (
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                                    <div>
                                        <Trophy size={32} className="mx-auto text-primary mb-3" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Top Performer</p>
                                        <p className="font-display text-2xl italic text-white">
                                            {[...teams].sort((a, b) => (b.points || 0) - (a.points || 0))[0]?.shortName || '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <Users size={32} className="mx-auto text-white/60 mb-3" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Total Teams</p>
                                        <p className="font-display text-2xl italic text-white">
                                            {teams.length}
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

                        {/* Teams Grid */}
                        {teams.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {teams.map((team, idx) => (
                                    <motion.div
                                        key={team.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <Link href={`/teams/${team.id}`}>
                                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 hover:border-primary/30 transition-all group cursor-pointer h-full">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-16 h-16 relative">
                                                            {team.logo ? (
                                                                <img
                                                                    src={team.logo}
                                                                    alt={team.name}
                                                                    className="w-full h-full object-contain filter group-hover:drop-shadow-[0_0_10px_rgba(255,214,0,0.5)] transition-all"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full bg-white/10 rounded-full flex items-center justify-center">
                                                                    <Users className="text-white/20" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-black uppercase tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                                                                {team.shortName}
                                                            </h3>
                                                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest line-clamp-1">
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
                                <p className="text-white/20 font-black uppercase tracking-widest italic">
                                    No teams found for {activeTab === 'all' ? 'any competition' : activeTab}
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

