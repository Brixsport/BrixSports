'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Trophy, Users, Layout, Shield, Search,
    Plus, X, Save, Trash2, Filter, ChevronRight,
    Trophy as TrophyIcon, Settings, Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import { TeamLogo } from '@/lib/utils/team-logo';

// Found live, session 59, while verifying BACKLOG-271 on staging: after a
// successful save, this page's own refetch of /api/standings?competitionId=
// can be served a stale pre-save copy by sw-admin.js's SWR policy on
// /^\/api\/(football\/|basketball\/)?standings(\/|$|\?)/ -- same staleness
// class BACKLOG-227 fixed for /api/players*, reproduced twice via direct DOM
// checks (not a tool-read timing artifact). Cache Storage is origin-scoped,
// not per-SW -- sw-user.js also has a "-api"-suffixed cache, so matching must
// require "-admin-" too or this can silently evict the wrong SW's cache
// (the exact mistake caught and fixed in roster-transfers/page.tsx first).
async function evictStaleStandingsCache(competitionId: string) {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    try {
        const cacheNames = await caches.keys();
        const apiCacheName = cacheNames.find((n) => n.includes('-admin-') && n.endsWith('-api'));
        if (!apiCacheName) return;
        const cache = await caches.open(apiCacheName);
        await cache.delete(`/api/standings?competitionId=${competitionId}`);
    } catch {
        // Best-effort only.
    }
}

interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    university: string;
    sport: string;
}

interface Competition {
    id: string;
    name: string;
    sport: string;
    format: string;
    season: string;
    status: string;
    numberOfTeams?: number;
    numberOfGroups?: number;
    teamsPerGroup?: number;
}

interface StandingEntry {
    id?: string;
    teamId: string;
    groupName: string | null;
    team?: Team;
}

// BACKLOG-272: soft visibility only, no hard cap enforced -- mirrors the
// same helper in the competitions list page.
function teamCountColor(assigned: number, target?: number): string {
    if (!target) return 'text-primary';
    if (assigned < target) return 'text-amber-400';
    if (assigned > target) return 'text-red-400';
    return 'text-green-400';
}

export default function CompetitionTeamsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { toasts, removeToast, success, error } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [competition, setCompetition] = useState<Competition | null>(null);
    const [competitionTeams, setCompetitionTeams] = useState<StandingEntry[]>([]);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddTeamModal, setShowAddTeamModal] = useState(false);
    // BACKLOG-271: ids of previously-saved standings rows removed locally
    // this session -- POST alone never deleted them, so Save must explicitly
    // DELETE these before/alongside upserting whatever remains.
    const [removedIds, setRemovedIds] = useState<string[]>([]);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        setIsLoading(true);
        setRemovedIds([]);
        try {
            const [compRes, teamsRes, standingsRes] = await Promise.all([
                fetch(`/api/competitions/${id}`),
                fetch('/api/teams'),
                fetch(`/api/standings?competitionId=${id}`)
            ]);

            if (compRes.ok) {
                const data = await compRes.json();
                setCompetition(data.competition || data);
            }

            if (teamsRes.ok) {
                const teamsData = await teamsRes.json();
                setAllTeams(Array.isArray(teamsData) ? teamsData : teamsData.teams || []);
            }

            if (standingsRes.ok) {
                const data = await standingsRes.json();
                setCompetitionTeams(data.map((s: any) => ({
                    id: s.id,
                    teamId: s.teamId,
                    groupName: s.groupName || '',
                    team: s.team
                })));
            }
        } catch (err) {
            error('Failed to load data');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddTeam = (team: Team) => {
        if (competitionTeams.some(t => t.teamId === team.id)) {
            error('Team already added to competition');
            return;
        }

        setCompetitionTeams([
            ...competitionTeams,
            {
                teamId: team.id,
                groupName: '',
                team: team
            }
        ]);
        setShowAddTeamModal(false);
        success(`${team.name} added to competition`);
    };

    const handleRemoveTeam = (teamId: string) => {
        const target = competitionTeams.find(t => t.teamId === teamId);
        if (target?.id) {
            // Was a real, already-saved standings row -- must be explicitly
            // deleted on Save, not just dropped from local state.
            setRemovedIds([...removedIds, target.id]);
        }
        setCompetitionTeams(competitionTeams.filter(t => t.teamId !== teamId));
    };

    const handleGroupChange = (teamId: string, groupName: string) => {
        setCompetitionTeams(competitionTeams.map(t =>
            t.teamId === teamId ? { ...t, groupName } : t
        ));
    };

    const handleSave = async () => {
        if (!competition) return;
        setIsSaving(true);

        try {
            // BACKLOG-271: teams removed locally must be actually deleted --
            // the POST below is upsert-only and would otherwise leave their
            // rows in the DB untouched forever.
            if (removedIds.length > 0) {
                const delResponse = await fetch('/api/standings', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: removedIds }),
                });
                if (!delResponse.ok) {
                    error('Failed to remove some teams');
                    setIsSaving(false);
                    return;
                }
            }

            // Prepare entries for the standings table -- may be empty if
            // every team was removed and none remain to upsert.
            const entries = competitionTeams.map(t => ({
                id: t.id,
                teamId: t.teamId,
                competitionId: competition.id,
                competition: competition.name,
                sport: competition.sport,
                groupName: t.groupName || null,
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                points: 0
            }));

            if (entries.length > 0) {
                const response = await fetch('/api/standings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ entries })
                });

                if (!response.ok) {
                    error('Failed to save changes');
                    setIsSaving(false);
                    return;
                }
            }

            success('Competition teams saved successfully');
            await evictStaleStandingsCache(competition.id);
            fetchData(); // Refresh to get correct IDs
        } catch (err) {
            error('Network error while saving');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const filteredTeams = allTeams.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.university.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group teams for display if they have group names
    const groupedTeams: Record<string, StandingEntry[]> = {};
    competitionTeams.forEach(t => {
        const group = t.groupName || 'Unassigned';
        if (!groupedTeams[group]) groupedTeams[group] = [];
        groupedTeams[group].push(t);
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#050505] p-12">
                <SkeletonLoader type="card" count={3} />
            </div>
        );
    }

    if (!competition) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-12">
                <h1 className="text-2xl font-bold mb-4">Competition not found</h1>
                <Link href="/admin/competitions" className="text-primary hover:underline">Return to competitions</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            <ToastContainer toasts={toasts} onClose={removeToast} />

            <div className="max-w-7xl mx-auto space-y-12">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <Link href="/admin/competitions" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">
                            <ArrowLeft size={14} /> Back to Competitions
                        </Link>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center">
                                <TrophyIcon size={32} className="text-primary" />
                            </div>
                            <div>
                                <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none">
                                    {competition.name}
                                </h1>
                                <div className="flex items-center gap-4 mt-2">
                                    <span className="text-xs font-bold uppercase tracking-widest text-white/40">{competition.sport}</span>
                                    <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                                    <span className="text-xs font-bold uppercase tracking-widest text-white/40">{competition.season}</span>
                                    <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                                    <span className="text-xs font-bold uppercase tracking-widest text-primary italic">TEAM MANAGEMENT</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-primary text-black px-8 py-4 rounded-2xl font-black uppercase italic tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : (
                                <>
                                    <Save size={18} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    {/* Left Panel: Assigned Teams */}
                    <div className="lg:col-span-8 space-y-8">
                        <div className="flex items-center justify-between">
                            <h2 className="font-display text-2xl italic uppercase tracking-tight flex items-center gap-3">
                                <Users size={20} className="text-primary" />
                                Assigned Teams ({competitionTeams.length})
                            </h2>
                            <button
                                onClick={() => setShowAddTeamModal(true)}
                                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-4 py-2 rounded-xl hover:bg-white/10 transition-colors"
                            >
                                <Plus size={14} /> Add Team
                            </button>
                        </div>

                        {competitionTeams.length === 0 ? (
                            <div className="bg-white/5 border border-white/10 rounded-[32px] p-12 text-center">
                                <Users size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-white/40 font-bold">No teams assigned yet</p>
                                <p className="text-white/20 text-sm mt-1">Add teams to start managing groups and standings</p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {Object.entries(groupedTeams).sort().map(([groupName, teams]) => (
                                    <div key={groupName} className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-[1px] flex-1 bg-white/10"></div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary italic px-3">{groupName}</span>
                                            <div className="h-[1px] flex-1 bg-white/10"></div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {teams.map((entry) => (
                                                <motion.div
                                                    layout
                                                    key={entry.teamId}
                                                    className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:border-primary/50 transition-all shadow-xl"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <TeamLogo logo={entry.team?.logo} name={entry.team?.name || 'Team'} size="md" />
                                                        <div>
                                                            <p className="text-sm font-black uppercase tracking-tight">{entry.team?.name}</p>
                                                            <p className="text-[10px] text-white/40 font-bold uppercase">{entry.team?.university}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="text"
                                                            value={entry.groupName || ''}
                                                            onChange={(e) => handleGroupChange(entry.teamId, e.target.value)}
                                                            className="w-24 bg-black border border-white/10 rounded-lg px-2 py-1 text-[10px] font-black uppercase text-center focus:border-primary transition-colors"
                                                            placeholder="GROUP"
                                                        />
                                                        <button
                                                            onClick={() => handleRemoveTeam(entry.teamId)}
                                                            className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Side Stats / Controls */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl">
                            <h3 className="font-display text-xl italic uppercase tracking-tight flex items-center gap-2">
                                <Layout size={18} className="text-primary" />
                                Competition Config
                            </h3>

                            <div className="space-y-4">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Total Teams</p>
                                    <p className={`text-2xl font-display italic ${teamCountColor(competitionTeams.length, competition.numberOfTeams)}`}>
                                        {competitionTeams.length}{!!competition.numberOfTeams && `/${competition.numberOfTeams}`}
                                    </p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Target Teams</p>
                                    <p className="text-2xl font-display italic text-white">{competition.numberOfTeams || 'Not defined'}</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Target Groups</p>
                                    <p className="text-2xl font-display italic text-white">{competition.numberOfGroups || 'Not defined'}</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Structure</p>
                                    <p className="text-sm font-bold uppercase tracking-widest text-white/60">{competition.format?.replace('-', ' ')}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => router.push(`/admin/competitions`)}
                                className="w-full py-4 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors"
                            >
                                Advanced Settings
                            </button>
                        </div>
                    </div>
                </main>
            </div>

            {/* Add Team Modal */}
            <AnimatePresence>
                {showAddTeamModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddTeamModal(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="font-display italic text-3xl uppercase">Add Teams</h3>
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:border-primary focus:outline-none transition-all w-64"
                                        placeholder="SEARCH TEAMS..."
                                    />
                                </div>
                            </div>

                            <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                                {filteredTeams.map((team) => (
                                    <button
                                        key={team.id}
                                        onClick={() => handleAddTeam(team)}
                                        disabled={competitionTeams.some(t => t.teamId === team.id)}
                                        className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-primary/50 transition-all group disabled:opacity-30"
                                    >
                                        <div className="flex items-center gap-4">
                                            <TeamLogo logo={team.logo} name={team.name} size="sm" />
                                            <div className="text-left">
                                                <p className="text-sm font-black uppercase tracking-tight">{team.name}</p>
                                                <p className="text-[10px] text-white/40 font-bold uppercase">{team.university}</p>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center group-hover:bg-primary transition-colors">
                                            <Plus size={16} className="group-hover:text-black" />
                                        </div>
                                    </button>
                                ))}
                                {filteredTeams.length === 0 && (
                                    <div className="text-center py-12 text-white/20 font-black uppercase tracking-widest">
                                        No teams found
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={() => setShowAddTeamModal(false)}
                                    className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(var(--primary-rgb), 0.5);
                }
            `}</style>
        </div>
    );
}
