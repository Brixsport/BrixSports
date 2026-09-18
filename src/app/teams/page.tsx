'use client';

import { motion } from 'framer-motion';
import { Trophy, Users, TrendingUp, ArrowRight, Loader2, Globe, Building2, GraduationCap, LayoutGrid } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UnderlineTabs, UnderlineTab } from '@/components/ui/UnderlineTabs';
import { BackButton } from '@/components/ui/BackButton';

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
    season?: string;
    level?: string; // 'inter-university' | 'busa-league' | 'college' | 'department'
}

// BACKLOG-401 #7: two real competitions can share an identical display name
// (confirmed live: "BUSA LEAGUE FOOTBALL" 2025/2026 vs 2026/2027) -- /competitions
// shows season alongside the name so they're distinguishable there, but this
// page's tabs used the bare name as both the tab key AND its label, so the two
// were indistinguishable in the tab strip AND a name-only lookup couldn't tell
// them apart. Appends the season only when the name actually collides within
// the current competitions list, so every other (unique-named) tab is unchanged.
function getTabKey(c: Competition, allComps: Competition[]): string {
    const isDuplicateName = allComps.filter(x => x.name === c.name).length > 1;
    return isDuplicateName && c.season ? `${c.name} (${c.season})` : c.name;
}

export default function TeamsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('');

    // BACKLOG-401 #6: the Quick Stats tile below hardcoded "Total Goals" even
    // for a basketball competition, where the shared `goalsFor` field
    // actually holds points -- confirmed live on
    // "/teams?competition=BUSA LEAGUE BASKETBALL" (showed "TOTAL GOALS: 2322").
    // Sport-conditional label only; not touching the shared goalsFor column.
    const activeSport = competitions.find(c => getTabKey(c, competitions) === activeTab)?.sport;
    const isBasketballTab = activeSport?.toLowerCase() === 'basketball';

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
                    defaultTab = getTabKey(busaComp || currentComps[0], currentComps);
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
                // /api/teams returns a bare array, not { teams: [...] } -- every other
                // caller in this codebase (admin/teams, admin/players, profile,
                // OnboardingModal) already consumes it this way.
                const result = await response.json();
                data = Array.isArray(result) ? result : [];
            } else {
                // Determine sport for competition
                const comp = currentComps.find(c => getTabKey(c, currentComps) === filter);
                const sport = comp?.sport || 'Football';

                // BACKLOG-401 #7: prefer competitionId when we've already resolved
                // the exact competition row -- authoritative on both standings
                // routes specifically to avoid the name-collision bug two
                // same-named-different-season competitions can trigger (see
                // those routes' own comments). Name-only fallback stays for the
                // (should no longer happen) case where lookup by tab key fails.
                const query = comp?.id
                    ? `competitionId=${encodeURIComponent(comp.id)}`
                    : `competition=${encodeURIComponent(filter)}`;

                // Fetch teams via standings for specific competition
                const response = await fetch(`/api/${sport.toLowerCase()}/standings?${query}`);
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

    // Render one grouped row of underline tabs (one competition = one tab).
    // A shared layoutId across all groups lets the highlight glide between
    // rows when the active competition changes group, instead of 3
    // independently-animating bars.
    const renderCompTabs = (title: string, comps: Competition[], icon: any) => {
        if (comps.length === 0) return null;
        const tabs: UnderlineTab[] = comps.map((c) => {
            const key = getTabKey(c, competitions);
            return { id: key, label: key };
        });
        return (
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-1 px-1">
                    {icon}
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{title}</span>
                </div>
                <UnderlineTabs
                    tabs={tabs}
                    activeId={activeTab}
                    onChange={handleTabChange}
                    layoutId="teamsActiveTab"
                />
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-12">
            <div className="max-w-7xl mx-auto space-y-8">
                <header className="flex flex-col md:flex-row md:items-start justify-between gap-8 border-b border-border pb-8">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <BackButton />
                            <Users size={16} className="text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Teams Directory</span>
                        </div>
                        <h1 className="font-display text-3xl md:text-5xl tracking-tighter italic uppercase leading-none mb-4">
                            {activeTab === 'all' ? 'All Teams' : activeTab || 'Loading...'}
                        </h1>
                        <p className="text-foreground/60 text-sm max-w-lg">
                            {activeTab === 'all'
                                ? 'Browsing all registered teams across every competition level.'
                                : `Viewing teams participating in ${activeTab}.`}
                        </p>
                    </div>

                    {/* Categorized Tabs */}
                    <div className="flex-1 w-full max-w-2xl">
                        {renderCompTabs('Internal Leagues', busaComps, <Building2 size={12} className="text-foreground/40" />)}
                        {renderCompTabs('University Competitions', universityComps, <Globe size={12} className="text-foreground/40" />)}
                        {renderCompTabs('Other Competitions', otherComps, <GraduationCap size={12} className="text-foreground/40" />)}

                        {/* Optional 'All' Tab as separate section */}
                        <div className="mt-6 pt-4 border-t border-border flex justify-end">
                            <button
                                onClick={() => handleTabChange('all')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${activeTab === 'all'
                                        ? 'bg-muted text-foreground border-border' // Subtle style for 'All'
                                        : 'text-foreground/20 border-transparent hover:text-foreground/60'
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
                            <p className="text-foreground/40 font-black uppercase tracking-widest text-xs">Loading Teams...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="text-center p-8 bg-muted border border-border rounded-[40px]">
                        <p className="text-red-500 font-bold mb-4">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-black uppercase tracking-widest text-[10px]"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Quick Stats - Only for filtered views */}
                        {teams.length > 0 && activeTab !== 'all' && (
                            <div className="bg-muted border border-border rounded-3xl p-6 mb-8">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                    <div className="border-r border-border last:border-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-1">Total Teams</p>
                                        <p className="font-display text-xl italic text-foreground">{teams.length}</p>
                                    </div>
                                    <div className="border-r border-border last:border-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-1">Top Scorer</p>
                                        <p className="font-display text-xl italic text-primary truncate px-2">{[...teams].sort((a, b) => (b.goalsFor || 0) - (a.goalsFor || 0))[0]?.shortName || '-'}</p>
                                    </div>
                                    <div className="border-r border-border last:border-0 hidden md:block">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-1">Leader</p>
                                        <p className="font-display text-xl italic text-foreground truncate px-2">{[...teams].sort((a, b) => (b.points || 0) - (a.points || 0))[0]?.shortName || '-'}</p>
                                    </div>
                                    <div className="hidden md:block">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-1">{isBasketballTab ? 'Total Points' : 'Total Goals'}</p>
                                        <p className="font-display text-xl italic text-foreground">{teams.reduce((sum, t) => sum + (t.goalsFor || 0), 0)}</p>
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
                                            <div className="bg-muted border border-border rounded-2xl p-5 hover:bg-muted/70 hover:border-primary/30 transition-all group cursor-pointer h-full flex flex-col">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 relative bg-muted rounded-lg overflow-hidden p-1">
                                                            {team.logo ? (
                                                                <img
                                                                    src={team.logo}
                                                                    alt={team.name}
                                                                    className="w-full h-full object-contain filter group-hover:drop-shadow-[0_0_5px_rgba(255,214,0,0.5)] transition-all"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Users size={20} className="text-foreground/20" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-base font-black uppercase tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                                                                {team.shortName}
                                                            </h3>
                                                            {/* Show School/Location if it's a University Team, otherwise show 'Club' or University name context */}
                                                            <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-widest line-clamp-1">
                                                                {team.university || 'Registered Team'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-auto pt-4 border-t border-border grid grid-cols-3 gap-2 text-center">
                                                    <div>
                                                        <p className="text-[8px] text-foreground/30 font-bold uppercase tracking-widest">P</p>
                                                        <p className="font-bold text-foreground">{team.played || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] text-foreground/30 font-bold uppercase tracking-widest">W</p>
                                                        <p className="font-bold text-primary">{team.won || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] text-foreground/30 font-bold uppercase tracking-widest">Pts</p>
                                                        <p className="font-bold text-foreground">{team.points || 0}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-24 text-center bg-muted border border-border rounded-[40px]">
                                <Trophy className="w-16 h-16 text-foreground/5 mx-auto mb-6" />
                                <h3 className="text-xl font-display italic uppercase font-bold text-foreground/40 mb-2">No Teams Found</h3>
                                <p className="text-foreground/20 font-black uppercase tracking-widest text-[10px] max-w-sm mx-auto">
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
