'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Calendar, Users, MapPin, Trophy, Edit, Trash2, Eye, Filter, ClipboardList, Star } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import ErrorBoundary from '@/components/admin/ErrorBoundary';

interface MatchTeam {
    name: string;
    shortName: string;
    logo: string;
}

interface Match {
    id: string;
    sport: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam?: MatchTeam | null;
    awayTeam?: MatchTeam | null;
    homeScore: number;
    awayScore: number;
    status: 'LIVE' | 'FINISHED' | 'UPCOMING' | 'HALF_TIME';
    startTime: string;
    venue: string;
    matchType: 'competition' | 'friendly';
    competition: string;
    competitionId?: string;
    competitionLevel?: 'busa-league' | 'college' | 'department' | 'year-level' | 'external';
    friendlyType?: 'internal' | 'external';
    friendlyDescription?: string;
    round?: string;
    groupName?: string;
    matchday?: number;
}

interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    sport: string;
    groupName?: string | null;
}

interface Competition {
    id: string;
    name: string;
    sport: string;
    isMultiSport: boolean;
    level?: string;
}

function AdminMatchesPageContent() {
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingMatch, setEditingMatch] = useState<Match | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [matches, setMatches] = useState<Match[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const { toasts, removeToast, success, error } = useToast();

    const [deleteDialog, setDeleteDialog] = useState({
        isOpen: false,
        itemId: null as string | null,
        itemName: '',
        isDeleting: false,
    });

    const [competitionTeams, setCompetitionTeams] = useState<Team[]>([]);
    const [isFetchingTeams, setIsFetchingTeams] = useState(false);

    const [formData, setFormData] = useState({
        sport: 'Football',
        homeTeamId: '',
        awayTeamId: '',
        startTime: '',
        venue: '',
        matchType: 'competition',
        competition: '',
        competitionId: '',
        competitionLevel: 'busa-league',
        friendlyType: 'internal',
        friendlyDescription: '',
        status: 'UPCOMING',
        livestreamEnabled: false,
        round: '',
        groupName: '',
        matchday: null as number | null
    });

    useEffect(() => {
        fetchMatches();
    }, []);

    const fetchCompetitionTeams = async (compId: string) => {
        setIsFetchingTeams(true);
        try {
            const response = await fetch(`/api/competitions/${compId}/teams`);
            if (response.ok) {
                const data = await response.json();
                setCompetitionTeams(data.teams || []);
            } else {
                setCompetitionTeams([]);
            }
        } catch (err) {
            console.error('Error fetching competition teams:', err);
            setCompetitionTeams([]);
        } finally {
            setIsFetchingTeams(false);
        }
    };

    useEffect(() => {
        if (formData.competitionId) {
            fetchCompetitionTeams(formData.competitionId);
        } else {
            setCompetitionTeams([]);
        }
    }, [formData.competitionId]);

    const fetchMatches = async () => {
        setIsLoading(true);
        try {
            const [matchesRes, teamsRes, compsRes] = await Promise.all([
                fetch('/api/matches'),
                fetch('/api/teams'),
                fetch('/api/competitions')
            ]);

            if (matchesRes.ok) setMatches(await matchesRes.json());
            if (teamsRes.ok) setTeams(await teamsRes.json());
            if (compsRes.ok) {
                const compsData = await compsRes.json();
                setCompetitions(compsData.competitions);
            }
        } catch (err) {
            error('Failed to load matches data. Please try again.');
            console.error('Error fetching data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);

        const matchPayload = {
            id: nanoid(),
            ...formData,
            homeScore: 0,
            awayScore: 0,
        };

        try {
            const response = await fetch('/api/matches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(matchPayload),
            });

            if (response.ok) {
                const newMatch = await response.json();
                setMatches([...matches, newMatch]);
                setShowCreateModal(false);
                setFormData({
                    sport: 'Football',
                    homeTeamId: '',
                    awayTeamId: '',
                    startTime: '',
                    venue: '',
                    matchType: 'competition',
                    competition: '',
                    competitionId: '',
                    competitionLevel: 'busa-league',
                    friendlyType: 'internal',
                    friendlyDescription: '',
                    status: 'UPCOMING',
                    livestreamEnabled: false,
                    round: '',
                    groupName: '',
                    matchday: null
                });
                success('Match created successfully!');
            } else {
                const data = await response.json();
                error(data.error || 'Failed to create match');
            }
        } catch (err) {
            error('Network error. Please check your connection.');
            console.error('Error creating match:', err);
        } finally {
            setIsCreating(false);
        }
    };

    const confirmDelete = (id: string, name: string) => {
        setDeleteDialog({
            isOpen: true,
            itemId: id,
            itemName: name,
            isDeleting: false,
        });
    };

    const handleDelete = async () => {
        if (!deleteDialog.itemId) return;

        setDeleteDialog(prev => ({ ...prev, isDeleting: true }));

        try {
            const response = await fetch(`/api/matches/${deleteDialog.itemId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setMatches(matches.filter(m => m.id !== deleteDialog.itemId));
                success('Match deleted successfully!');
                setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false });
            } else {
                const data = await response.json();
                error(data.error || 'Failed to delete match');
                setDeleteDialog(prev => ({ ...prev, isDeleting: false }));
            }
        } catch (err) {
            error('Network error. Please try again.');
            console.error('Error deleting match:', err);
            setDeleteDialog(prev => ({ ...prev, isDeleting: false }));
        }
    };

    const openEditModal = (match: Match) => {
        setEditingMatch(match);
        setFormData({
            sport: match.sport,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            startTime: new Date(match.startTime).toISOString().slice(0, 16),
            venue: match.venue,
            matchType: match.matchType,
            competition: match.competition,
            competitionId: match.competitionId || '',
            competitionLevel: match.competitionLevel || 'busa-league',
            friendlyType: match.friendlyType || 'internal',
            friendlyDescription: match.friendlyDescription || '',
            status: match.status,
            livestreamEnabled: false,
            round: match.round || '',
            groupName: match.groupName || '',
            matchday: match.matchday || null
        });
        setShowEditModal(true);
    };

    const filteredTeams = useMemo(() => {
        // If competition is selected and we have competition teams, use those
        if (formData.competitionId && formData.matchType === 'competition') {
            if (competitionTeams.length > 0) {
                if (formData.groupName) {
                    return competitionTeams.filter(t => t.groupName?.toLowerCase() === formData.groupName.toLowerCase());
                }
                return competitionTeams;
            }
            // If competition is selected but teams haven't loaded yet, return empty array
            return [];
        }
        // For friendly matches or when no competition is selected, show all teams for the sport
        return teams.filter(t => t.sport === formData.sport || t.sport === 'Multi-Sport');
    }, [formData.competitionId, formData.matchType, formData.groupName, competitionTeams, teams, formData.sport]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMatch) return;

        setIsUpdating(true);

        try {
            const response = await fetch(`/api/matches/${editingMatch.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                setMatches(matches.map(m =>
                    m.id === editingMatch.id
                        ? {
                            ...m,
                            sport: formData.sport,
                            homeTeamId: formData.homeTeamId,
                            awayTeamId: formData.awayTeamId,
                            venue: formData.venue,
                            competition: formData.competition,
                            competitionId: formData.competitionId,
                            status: formData.status as any,
                            matchType: formData.matchType as any,
                            competitionLevel: formData.competitionLevel as any,
                            friendlyType: formData.friendlyType as any,
                            friendlyDescription: formData.friendlyDescription,
                            startTime: new Date(formData.startTime).toISOString()
                        }
                        : m
                ));
                setShowEditModal(false);
                setEditingMatch(null);
                success('Match updated successfully!');
            } else {
                const data = await response.json();
                error(data.error || 'Failed to update match');
            }
        } catch (err) {
            error('Network error. Please check your connection.');
            console.error('Error updating match:', err);
        } finally {
            setIsUpdating(false);
        }
    };

    // Prefer shortName from the embedded team object returned by /api/matches.
    // Fall back to the separately-fetched teams list, then raw ID as last resort.
    const getTeamDisplay = (match: Match, side: 'home' | 'away') => {
        const embedded = side === 'home' ? match.homeTeam : match.awayTeam;
        if (embedded?.shortName) return embedded.shortName;
        const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
        const fallback = teams.find(t => t.id === teamId);
        return fallback?.shortName ?? fallback?.name ?? teamId;
    };

    const filteredMatches = matches.filter(match => {
        if (filterStatus === 'all') return true;
        return match.status === filterStatus;
    });

    return (
        <>
            <div className="py-8 px-6">
                <ToastContainer toasts={toasts} onClose={removeToast} />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-4xl font-display italic uppercase tracking-tight leading-none mb-2">Match Management</h1>
                        <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Schedule and coordinate all active fixtures</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 bg-primary text-black px-6 py-3 rounded-xl font-bold text-xs uppercase italic transition-transform hover:scale-105"
                    >
                        <Plus size={18} />
                        Create Match
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                    <StatCard label="Total Matches" value={matches.length.toString()} icon={<Calendar className="text-primary" size={24} />} />
                    <StatCard label="Live" value={matches.filter(m => m.status === 'LIVE').length.toString()} icon={<div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />} />
                    <StatCard label="Upcoming" value={matches.filter(m => m.status === 'UPCOMING').length.toString()} icon={<Calendar className="text-blue-500" size={24} />} />
                    <StatCard label="Finished" value={matches.filter(m => m.status === 'FINISHED').length.toString()} icon={<Trophy className="text-yellow-500" size={24} />} />
                </div>

                <div className="flex items-center gap-3 mb-8">
                    <Filter size={18} className="text-white/60" />
                    <div className="flex gap-2">
                        {['all', 'LIVE', 'UPCOMING', 'HALF_TIME', 'FINISHED'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === status
                                    ? 'bg-primary text-black'
                                    : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {status.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 font-bold">
                    {isLoading ? (
                        <SkeletonLoader type="card" count={5} />
                    ) : (
                        <>
                            {filteredMatches.map((match) => (
                                <motion.div
                                    key={match.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/5 rounded-[32px] p-8 border border-white/10 hover:border-primary/50 transition-all group"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-4 mb-6">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${match.status === 'LIVE' ? 'bg-red-500/20 text-red-500 animate-pulse' :
                                                    match.status === 'UPCOMING' ? 'bg-blue-500/20 text-blue-500' :
                                                        'bg-white/20 text-white/60'
                                                    }`}>
                                                    {match.status}
                                                </span>
                                                <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">{match.sport}</span>
                                                <div className="w-1 h-1 rounded-full bg-white/10" />
                                                <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">{match.competition}</span>
                                            </div>

                                            <div className="flex items-center gap-12 mb-6">
                                                <div className="flex-1 text-right">
                                                    <p className="text-2xl font-display italic uppercase truncate">{getTeamDisplay(match, 'home')}</p>
                                                </div>
                                                <div className="px-6 py-2 bg-white/5 rounded-2xl border border-white/10 min-w-[120px] flex items-center justify-center">
                                                    {match.status === 'UPCOMING' ? (
                                                        <span className="text-white/20 text-sm font-black italic">VS</span>
                                                    ) : (
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-3xl font-display italic">{match.homeScore}</span>
                                                            <span className="text-white/20 text-xl font-display">-</span>
                                                            <span className="text-3xl font-display italic">{match.awayScore}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-2xl font-display italic uppercase truncate">{getTeamDisplay(match, 'away')}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest text-white/20">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-primary" />
                                                    <span>{new Date(match.startTime).toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={14} className="text-primary" />
                                                    <span>{match.venue}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-row md:flex-col gap-2">
                                            <div className="flex gap-2">
                                                <Link
                                                    href={`/admin/match-lineups`}
                                                    className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-blue-500/20 text-blue-400 transition-colors"
                                                    title="Manage Lineups"
                                                >
                                                    <ClipboardList size={20} />
                                                </Link>
                                                {match.status === 'FINISHED' && (
                                                    <Link
                                                        href={`/admin/match-ratings/${match.id}`}
                                                        className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-yellow-500/20 text-yellow-400 transition-colors"
                                                        title="Adjust Ratings"
                                                    >
                                                        <Star size={20} />
                                                    </Link>
                                                )}
                                                <Link href={`/logger?matchId=${match.id}`} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                                                    <Eye size={20} />
                                                </Link>
                                                <button
                                                    onClick={() => openEditModal(match)}
                                                    className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                                                >
                                                    <Edit size={20} />
                                                </button>
                                                <button
                                                    onClick={() => confirmDelete(match.id, `${getTeamDisplay(match, 'home')} vs ${getTeamDisplay(match, 'away')}`)}
                                                    className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/20 text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {filteredMatches.length === 0 && (
                                <div className="text-center py-24 bg-white/5 rounded-[32px] border border-white/10">
                                    <Calendar size={48} className="mx-auto mb-6 opacity-10" />
                                    <h4 className="font-display italic text-2xl uppercase mb-2">No matches found</h4>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Expand your filters or schedule a new fixture</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {showCreateModal && (
                    <Modal onClose={() => setShowCreateModal(false)} title="Create New Match">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Sport</label>
                                    <select
                                        value={formData.sport}
                                        onChange={(e) => {
                                            const newSport = e.target.value;
                                            setFormData(prev => {
                                                // If current competition doesn't match new sport, clear it
                                                const currentComp = competitions.find(c => c.id === prev.competitionId);
                                                const clearComp = currentComp && !currentComp.isMultiSport && currentComp.sport !== newSport;

                                                return {
                                                    ...prev,
                                                    sport: newSport,
                                                    competitionId: clearComp ? '' : prev.competitionId,
                                                    competition: clearComp ? '' : prev.competition
                                                };
                                            });
                                        }}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white hover:border-white/20"
                                    >
                                        <option value="Football" className="bg-[#0a0a0a]">Football</option>
                                        <option value="Basketball" className="bg-[#0a0a0a]">Basketball</option>
                                        <option value="Table Tennis" className="bg-[#0a0a0a]">Table Tennis</option>
                                        <option value="Scrabble" className="bg-[#0a0a0a]">Scrabble</option>
                                        <option value="Chess" className="bg-[#0a0a0a]">Chess</option>
                                        <option value="Volleyball" className="bg-[#0a0a0a]">Volleyball</option>
                                        <option value="Track" className="bg-[#0a0a0a]">Track & Field</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white hover:border-white/20"
                                    >
                                        <option value="UPCOMING" className="bg-[#0a0a0a]">Upcoming</option>
                                        <option value="LIVE" className="bg-[#0a0a0a]">Live</option>
                                        <option value="HALF_TIME" className="bg-[#0a0a0a]">Half Time</option>
                                        <option value="FINISHED" className="bg-[#0a0a0a]">Finished</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Match Type</label>
                                    <select
                                        value={formData.matchType}
                                        onChange={(e) => setFormData({ ...formData, matchType: e.target.value as any })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white hover:border-white/20"
                                    >
                                        <option value="competition" className="bg-[#0a0a0a]">Competition</option>
                                        <option value="friendly" className="bg-[#0a0a0a]">Friendly</option>
                                    </select>
                                </div>
                                {formData.matchType === 'competition' ? (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Competition</label>
                                        <select
                                            value={formData.competitionId}
                                            onChange={(e) => {
                                                const comp = competitions.find(c => c.id === e.target.value);
                                                if (comp) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        competitionId: comp.id,
                                                        competition: comp.name,
                                                        sport: comp.isMultiSport ? prev.sport : (comp.sport || prev.sport),
                                                        competitionLevel: (comp.level as any) || prev.competitionLevel,
                                                        homeTeamId: '', // Clear team selections when competition changes
                                                        awayTeamId: ''  // Clear team selections when competition changes
                                                    }));
                                                } else {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        competitionId: '',
                                                        competition: '',
                                                        homeTeamId: '', // Clear team selections when competition is cleared
                                                        awayTeamId: ''  // Clear team selections when competition is cleared
                                                    }));
                                                }
                                            }}
                                            className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white hover:border-white/20"
                                            required
                                        >
                                            <option value="" className="bg-[#0a0a0a]">Select Competition</option>
                                            {competitions.filter(c => c.isMultiSport || !c.sport || c.sport === formData.sport).map(comp => (
                                                <option key={comp.id} value={comp.id} className="bg-[#0a0a0a]">{comp.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Friendly Description</label>
                                        <input
                                            type="text"
                                            value={formData.friendlyDescription}
                                            onChange={(e) => setFormData({ ...formData, friendlyDescription: e.target.value })}
                                            className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white placeholder-white/20"
                                            placeholder="e.g. Pre-season friendly"
                                        />
                                    </div>
                                )}
                            </div>

                            {formData.matchType === 'competition' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Round / Stage</label>
                                        <input
                                            type="text"
                                            value={formData.round || ''}
                                            onChange={(e) => setFormData({ ...formData, round: e.target.value })}
                                            className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white placeholder-white/20"
                                            placeholder="e.g. Group Stage, Semi Final"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Group Name (Optional)</label>
                                        <input
                                            type="text"
                                            value={formData.groupName || ''}
                                            onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                                            className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white placeholder-white/20"
                                            placeholder="e.g. Group A"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Start Time</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.startTime}
                                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white placeholder-white/20"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Venue</label>
                                    <input
                                        type="text"
                                        value={formData.venue}
                                        onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white placeholder-white/20"
                                        placeholder="Stadium/Court name"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Home Team</label>
                                    <select
                                        value={formData.homeTeamId}
                                        onChange={(e) => setFormData({ ...formData, homeTeamId: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white hover:border-white/20"
                                        required
                                    >
                                        <option value="" className="bg-[#0a0a0a]">{isFetchingTeams ? 'Loading competition teams...' : 'Select Team'}</option>
                                        {filteredTeams.map((team: Team) => (
                                            <option key={team.id} value={team.id} className="bg-[#0a0a0a]">
                                                {team.name} {team.groupName ? `(${team.groupName})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Away Team</label>
                                    <select
                                        value={formData.awayTeamId}
                                        onChange={(e) => setFormData({ ...formData, awayTeamId: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white hover:border-white/20"
                                        required
                                    >
                                        <option value="" className="bg-[#0a0a0a]">{isFetchingTeams ? 'Loading competition teams...' : 'Select Team'}</option>
                                        {filteredTeams.map((team: Team) => (
                                            <option key={team.id} value={team.id} className="bg-[#0a0a0a]">
                                                {team.name} {team.groupName ? `(${team.groupName})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">Cancel</button>
                                <button type="submit" disabled={isCreating} className="flex-1 bg-primary text-black py-4 rounded-xl text-[10px] font-black uppercase italic tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                                    {isCreating ? 'Creating...' : 'Create Fixture'}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showEditModal && editingMatch && (
                    <Modal onClose={() => setShowEditModal(false)} title="Edit Fixture">
                        <form onSubmit={handleUpdate} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white hover:border-white/20"
                                    >
                                        <option value="UPCOMING" className="bg-[#0a0a0a]">Upcoming</option>
                                        <option value="LIVE" className="bg-[#0a0a0a]">Live</option>
                                        <option value="HALF_TIME" className="bg-[#0a0a0a]">Half Time</option>
                                        <option value="FINISHED" className="bg-[#0a0a0a]">Finished</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Venue</label>
                                    <input
                                        type="text"
                                        value={formData.venue}
                                        onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white placeholder-white/20"
                                        placeholder="Venue name"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">Cancel</button>
                                <button type="submit" disabled={isUpdating} className="flex-1 bg-primary text-black py-4 rounded-xl text-[10px] font-black uppercase italic tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                                    {isUpdating ? 'Updating...' : 'Update Fixture'}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>

            <ConfirmDialog
                isOpen={deleteDialog.isOpen}
                onClose={() => setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false })}
                onConfirm={handleDelete}
                title="Remove Fixture"
                message={`Are you sure you want to remove the match between ${deleteDialog.itemName}? This action cannot be undone.`}
                confirmText="Remove Match"
                variant="danger"
                isLoading={deleteDialog.isDeleting}
            />
        </>
    );
}

function Modal({ children, onClose, title }: { children: React.ReactNode, onClose: () => void, title: string }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden"
            >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                <h3 className="font-display italic text-3xl uppercase mb-8">{title}</h3>
                {children}
            </motion.div>
        </div>
    );
}

function StatCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                {icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</span>
            <p className="text-4xl font-display italic uppercase leading-none mt-2">{value}</p>
        </div>
    );
}

export default function AdminMatchesPage() {
    return (
        <ErrorBoundary>
            <AdminMatchesPageContent />
        </ErrorBoundary>
    );
}
