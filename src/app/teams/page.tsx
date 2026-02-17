'use client';

import { motion } from 'framer-motion';
import { Trophy, Users, TrendingUp, ArrowRight, Loader2, Globe, Building2, GraduationCap, LayoutGrid } from 'lucide-react';
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
    level?: string; // 'inter-university' | 'busa-league' | 'college' | 'department'
}

export default function TeamsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('');

    // Fetch initial data
    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);
                // Fetch competitions first
                const compRes = await fetch('/api/competitions');
                const compData = await compRes.json();

                let currentComps: Competition[] = [];
                if (compData.competitions) {
                    currentComps = compData.competitions;
                    setCompetitions(currentComps);
                }

                // Determine default tab (BUSA if exists, else first comp)
                let defaultTab = '';
                if (currentComps.length > 0) {
                    const busaComp = currentComps.find(c => c.name.toUpperCase().includes('BUSA'));
                    defaultTab = busaComp ? busaComp.name : currentComps[0].name;
                }

                if (defaultTab) {
                    setActiveTab(defaultTab);
                    // Fetch teams for the default tab immediately
                    await fetchTeams(defaultTab, currentComps);
                } else {
                    setLoading(false); // No competitions found
                }

            } catch (err) {
                console.error('Error initializing teams page:', err);
                setError('Failed to load data');
                setLoading(false);
            }
        };

        init();
    }, []);

    // Handle tab change
    const handleTabChange = async (tab: string) => {
        setActiveTab(tab);
        await fetchTeams(tab, competitions);
    };

    const fetchTeams = async (filter: string, currentComps: Competition[]) => {
        setLoading(true);
        setError(null);
        try {
            let data;
            if (filter === 'all') {
                const response = await fetch('/api/teams');
                if (!response.ok) throw new Error('Failed to fetch teams');
                const result = await response.json();
                data = result.teams || [];
            } else {
                // Determine sport for competition
                const comp = currentComps.find(c => c.name === filter);
                const sport = comp?.sport || 'Football';

                // Fetch teams via standings for specific competition
                const response = await fetch(`/api/${sport.toLowerCase()}/standings?competition=${encodeURIComponent(filter)}`);
                if (!response.ok) throw new Error('Failed to fetch competition teams');
                const result = await response.json();

                // Transform standings to team format
                if (result.standings) {
                    data = result.standings.map((s: any) => ({
                        ...(s.team || {}),
                        id: s.teamId || s.team?.id,
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

    // Helper to group competitions
    const getCompetitionsByLevel = (level: string) => {
        return competitions.filter(c => c.level === level);
    };

    const busaComps = getCompetitionsByLevel('busa-league');
    const universityComps = getCompetitionsByLevel('inter-university');
    const otherComps = competitions.filter(c => !['busa-league', 'inter-university'].includes(c.level || ''));

    // Render a section of tabs
    const renderCompTabs = (title: string, comps: Competition[], icon: any) => {
        if (comps.length === 0) return null;
        return (
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                    {icon}
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{title}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {comps.map((comp) => (
                        <button
                            key={comp.id}
                            onClick={() => handleTabChange(comp.name)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${activeTab === comp.name
                                    ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20'
                                    : 'bg-white/5 text-white/40 border-white/10 hover:text-white hover:border-white/20'
                                }`}
                        >
                            {comp.name}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            <div className="max-w-7xl mx-auto space-y-8">
                <header className="flex flex-col md:flex-row md:items-start justify-between gap-8 border-b border-white/5 pb-8">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <Users size={16} className="text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Teams Directory</span>
                        </div>
                        <h1 className="font-display text-3xl md:text-5xl tracking-tighter italic uppercase leading-none mb-4">
                            {activeTab === 'all' ? 'All Teams' : activeTab || 'Loading...'}
                        </h1>
                        <p className="text-white/60 text-sm max-w-lg">
                            {activeTab === 'all'
                                ? 'Browsing all registered teams across every competition level.'
                                : `Viewing teams participating in ${activeTab}.`}
                        </p>
                    </div>

                    {/* Categorized Tabs */}
                    <div className="flex-1 w-full max-w-2xl">
                        {renderCompTabs('Internal Leagues', busaComps, <Building2 size={12} className="text-white/40" />)}
                        {renderCompTabs('University Competitions', universityComps, <Globe size={12} className="text-white/40" />)}
                        {renderCompTabs('Other Competitions', otherComps, <GraduationCap size={12} className="text-white/40" />)}

                        {/* Optional 'All' Tab as separate section */}
                        <div className="mt-6 pt-4 border-t border-white/5 flex justify-end">
                            <button
                                onClick={() => handleTabChange('all')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${activeTab === 'all'
                                        ? 'bg-white/10 text-white border-white/20' // Subtle style for 'All'
                                        : 'text-white/20 border-transparent hover:text-white/60'
                                    }`}
                            >
                                <LayoutGrid size={12} />
                                Browse All Teams
                            </button>
                        </div>
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
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-primary text-black rounded-xl font-black uppercase tracking-widest text-[10px]"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Quick Stats - Only for filtered views */}
                        {teams.length > 0 && activeTab !== 'all' && (
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                    <div className="border-r border-white/5 last:border-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Total Teams</p>
                                        <p className="font-display text-xl italic text-white">{teams.length}</p>
                                    </div>
                                    <div className="border-r border-white/5 last:border-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Top Scorer</p>
                                        <p className="font-display text-xl italic text-primary truncate px-2">{[...teams].sort((a, b) => (b.goalsFor || 0) - (a.goalsFor || 0))[0]?.shortName || '-'}</p>
                                    </div>
                                    <div className="border-r border-white/5 last:border-0 hidden md:block">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Leader</p>
                                        <p className="font-display text-xl italic text-white truncate px-2">{[...teams].sort((a, b) => (b.points || 0) - (a.points || 0))[0]?.shortName || '-'}</p>
                                    </div>
                                    <div className="hidden md:block">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Total Goals</p>
                                        <p className="font-display text-xl italic text-white">{teams.reduce((sum, t) => sum + (t.goalsFor || 0), 0)}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Teams Grid */}
                        {teams.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {teams.map((team, idx) => (
                                    <motion.div
                                        key={team.id || idx}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <Link href={`/teams/${team.id}`}>
                                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 hover:border-primary/30 transition-all group cursor-pointer h-full flex flex-col">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 relative bg-white/5 rounded-lg overflow-hidden p-1">
                                                            {team.logo ? (
                                                                <img
                                                                    src={team.logo}
                                                                    alt={team.name}
                                                                    className="w-full h-full object-contain filter group-hover:drop-shadow-[0_0_5px_rgba(255,214,0,0.5)] transition-all"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Users size={20} className="text-white/20" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-base font-black uppercase tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                                                                {team.shortName}
                                                            </h3>
                                                            {/* Show School/Location if it's a University Team, otherwise show 'Club' or University name context */}
                                                            <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest line-clamp-1">
                                                                {team.university || 'Registered Team'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-auto pt-4 border-t border-white/5 grid grid-cols-3 gap-2 text-center">
                                                    <div>
                                                        <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest">P</p>
                                                        <p className="font-bold text-white">{team.played || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest">W</p>
                                                        <p className="font-bold text-primary">{team.won || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] text-white/30 font-bold uppercase tracking-widest">Pts</p>
                                                        <p className="font-bold text-white">{team.points || 0}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-24 text-center bg-white/5 border border-white/10 rounded-[40px]">
                                <Trophy className="w-16 h-16 text-white/5 mx-auto mb-6" />
                                <h3 className="text-xl font-display italic uppercase font-bold text-white/40 mb-2">No Teams Found</h3>
                                <p className="text-white/20 font-black uppercase tracking-widest text-[10px] max-w-sm mx-auto">
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
