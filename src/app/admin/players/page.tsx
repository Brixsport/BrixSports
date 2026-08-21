'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Plus, Users, Search, Filter,
    Edit, Trash2, User, Shield, Info, X,
    ChevronLeft, ChevronRight, Save, Loader2, ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import ErrorBoundary from '@/components/admin/ErrorBoundary';
import ImageUpload from '@/components/ImageUpload';
import { getPrimaryTeam, getResolvedInstitutionalData } from '@/lib/player-affiliation-utils';

interface Player {
    id: string;
    name: string;
    jerseyName: string | null;
    number: number;
    teamId: string | null;
    position: string;
    rating: number | null;
    age: number | null;
    height: string | null;
    weight: string | null;
    nationality: string | null;
    college: string | null;
    department: string | null;
    university: string | null;
    image: string | null;
    profileId: string | null;
    email: string | null;
    team?: Team | null;
    memberships?: PlayerMembership[];
    organizationAffiliations?: PlayerOrganizationAffiliation[];
}

interface Team {
    id: string;
    name: string;
    shortName: string;
    sport: string;
    university: string;
}

interface PlayerMembership {
    affiliation: {
        affiliationType?: string | null;
        isPrimary?: boolean | null;
        isActive?: boolean | null;
        role?: string | null;
        status?: string | null;
    };
    team: Team;
}

interface PlayerOrganizationAffiliation {
    affiliation: {
        affiliationType?: string | null;
        isPrimary?: boolean | null;
        role?: string | null;
        status?: string | null;
    };
    organization: {
        id: string;
        name: string;
        shortName: string | null;
        displayName?: string | null;
        type: string;
        parentOrganizationId: string | null;
    };
}

function AdminPlayersPageContent() {
    const [isLoading, setIsLoading] = useState(true);
    const [players, setPlayers] = useState<Player[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sportFilter, setSportFilter] = useState('all');
    const [teamFilter, setTeamFilter] = useState('all');
    const [universityFilter, setUniversityFilter] = useState('all');

    // Modal & Dialog state
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [isSaving, setIsSaving] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [deleteDialog, setDeleteDialog] = useState({
        isOpen: false,
        itemId: null as string | null,
        itemName: '',
        isDeleting: false
    });

    const { toasts, removeToast, success, error } = useToast();
    const getPlayerTeam = (player: Player) => getPrimaryTeam(player, teams) as Team | null;
    const getPlayerInstitutionData = (player: Player) => getResolvedInstitutionalData(player, getPlayerTeam(player));

    // Form state
    const [formData, setFormData] = useState<Partial<Player>>({
        name: '',
        jerseyName: '',
        number: 0,
        teamId: '',
        position: '',
        age: null,
        height: '',
        weight: '',
        nationality: '',
        college: '',
        department: '',
        university: 'Bells University',
        email: '',
        image: ''
    });

    // Auto-update university from team selection
    useEffect(() => {
        if (formData.teamId && modalMode === 'create') {
            const selectedTeam = teams.find(t => t.id === formData.teamId);
            if (selectedTeam?.university) {
                setFormData(prev => ({ ...prev, university: selectedTeam.university }));
            }
        }
    }, [formData.teamId, teams, modalMode]);

    useEffect(() => {
        Promise.all([fetchPlayers(), fetchTeams()]).then(() => setIsLoading(false));
    }, []);

    const fetchPlayers = async () => {
        try {
            const res = await fetch('/api/players');
            const data = await res.json();
            if (data.success) {
                setPlayers(data.players);
            }
        } catch (err) {
            error('Failed to load players');
        }
    };

    const fetchTeams = async () => {
        try {
            const res = await fetch('/api/teams');
            const data = await res.json();
            if (Array.isArray(data)) {
                setTeams(data);
            }
        } catch (err) {
            error('Failed to load teams');
        }
    };

    // Unique universities derived from teams AND players
    const universities = useMemo(() => {
        const seen = new Set<string>();
        teams.forEach(t => { if (t.university) seen.add(t.university); });
        players.forEach(p => {
            const university = getPlayerInstitutionData(p).university;
            if (university) {
                seen.add(university);
            }
        });
        return Array.from(seen).sort();
    }, [teams, players]);

    const filteredPlayers = useMemo(() => {
        return players.filter(p => {
            const team = getPlayerTeam(p);
            const institutionalData = getPlayerInstitutionData(p);
            const q = searchQuery.toLowerCase();

            const matchesSearch = !q ||
                p.name.toLowerCase().includes(q) ||
                p.jerseyName?.toLowerCase().includes(q) ||
                p.id.toLowerCase().includes(q) ||
                // Player-level fields
                institutionalData.university?.toLowerCase().includes(q) ||
                institutionalData.college?.toLowerCase().includes(q) ||
                institutionalData.department?.toLowerCase().includes(q) ||
                // Team-level fields — catches BUSA teams where university is on the team row
                team?.university?.toLowerCase().includes(q) ||
                team?.name?.toLowerCase().includes(q) ||
                team?.shortName?.toLowerCase().includes(q);

            const matchesSport = sportFilter === 'all' || team?.sport === sportFilter;

            // University filter: match player.university OR the team's university
            const matchesUniversity = universityFilter === 'all' ||
                institutionalData.university === universityFilter ||
                team?.university === universityFilter;

            // Team filter: only apply if university filter is not narrowing things down
            const matchesTeam = teamFilter === 'all' || team?.id === teamFilter;

            return matchesSearch && matchesSport && matchesUniversity && matchesTeam;
        });
    }, [players, teams, searchQuery, sportFilter, teamFilter, universityFilter]);

    const handleOpenCreate = () => {
        setModalMode('create');
        setFormData({
            name: '',
            jerseyName: '',
            number: undefined,
            teamId: teamFilter !== 'all' ? teamFilter : '',
            position: '',
            age: null,
            height: '',
            weight: '',
            nationality: '',
            college: '',
            department: '',
            university: 'Bells University',
            email: '',
            image: ''
        });
        setShowModal(true);
    };

    const handleOpenEdit = (player: Player) => {
        setModalMode('edit');
        setSelectedPlayer(player);
        const primaryTeam = getPlayerTeam(player);
        const institutionalData = getPlayerInstitutionData(player);
        setFormData({
            ...player,
            teamId: primaryTeam?.id ?? player.teamId ?? '',
            university: institutionalData.university ?? '',
            college: institutionalData.college ?? '',
            department: institutionalData.department ?? '',
        });
        setShowModal(true);
    };

    const handleSubmit = async (e?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
        e?.preventDefault();
        setIsSaving(true);

        try {
            const url = modalMode === 'create' ? '/api/players' : `/api/players/${selectedPlayer?.id}`;
            const method = modalMode === 'create' ? 'POST' : 'PATCH';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                await fetchPlayers();
                success(modalMode === 'create' ? 'Player created successfully!' : 'Player updated successfully!');
                setShowModal(false);
            } else {
                const data = await res.json();
                error(data.error || 'Failed to save player');
            }
        } catch (err) {
            error('Network error');
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = (player: Player) => {
        setDeleteDialog({
            isOpen: true,
            itemId: player.id,
            itemName: player.name,
            isDeleting: false
        });
    };

    const handleDelete = async () => {
        if (!deleteDialog.itemId) return;
        setDeleteDialog(prev => ({ ...prev, isDeleting: true }));

        try {
            const res = await fetch(`/api/players/${deleteDialog.itemId}`, { method: 'DELETE' });
            if (res.ok) {
                setPlayers(players.filter(p => p.id !== deleteDialog.itemId));
                success('Player deleted successfully');
                setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false });
            } else {
                error('Failed to delete player');
            }
        } catch (err) {
            error('Network error');
        } finally {
            setDeleteDialog(prev => ({ ...prev, isDeleting: false }));
        }
    };

    return (
        <div className="min-h-screen bg-black text-white selection:bg-primary selection:text-black">
            <ToastContainer toasts={toasts} onClose={removeToast} />

            {/* Header */}
            <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5 py-4 md:py-6 px-4 md:px-8">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                    <div className="flex items-center gap-3 md:gap-4">
                        <Link href="/admin" className="p-1.5 md:p-2 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10 group">
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        </Link>
                        <div>
                            <h1 className="text-xl md:text-2xl font-display font-black uppercase italic tracking-tighter flex items-center gap-2 md:gap-3">
                                <Users className="text-primary" size={24} />
                                Player Profiles
                            </h1>
                            <p className="text-[8px] md:text-[10px] uppercase tracking-widest font-bold text-white/40">Nexus Athlete Management System</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleOpenCreate}
                            className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary text-black px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black uppercase italic text-[10px] md:text-xs tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]"
                        >
                            <Plus size={18} strokeWidth={3} />
                            Add Athlete
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 md:p-8">
                {/* Filters & Search */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
                    <div className="md:col-span-2 lg:col-span-2 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search athletes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl pl-11 pr-4 py-3 md:py-4 focus:outline-none focus:border-primary/50 transition-all font-bold text-xs md:text-sm"
                        />
                    </div>
                    {/* University filter — shows players across ALL teams under a university */}
                    <div className="relative">
                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                        <select
                            value={universityFilter}
                            onChange={(e) => { setUniversityFilter(e.target.value); setTeamFilter('all'); }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl pl-11 pr-4 py-3 md:py-4 focus:outline-none focus:border-primary/50 transition-all font-bold text-xs md:text-sm appearance-none"
                        >
                            <option value="all">All Universities</option>
                            {universities.map(u => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                        <select
                            value={sportFilter}
                            onChange={(e) => setSportFilter(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl pl-11 pr-4 py-3 md:py-4 focus:outline-none focus:border-primary/50 transition-all font-bold text-xs md:text-sm appearance-none"
                        >
                            <option value="all">All Sports</option>
                            <option value="Football">Football</option>
                            <option value="Basketball">Basketball</option>
                        </select>
                    </div>
                    <div className="relative">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                        <select
                            value={teamFilter}
                            onChange={(e) => setTeamFilter(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl pl-11 pr-4 py-3 md:py-4 focus:outline-none focus:border-primary/50 transition-all font-bold text-xs md:text-sm appearance-none"
                        >
                            <option value="all">All Teams</option>
                            {teams
                                .filter(t => universityFilter === 'all' || t.university === universityFilter)
                                .map(t => (
                                    <option key={t.id} value={t.id}>{t.name} ({t.sport})</option>
                                ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white/5 rounded-2xl md:rounded-[2.5rem] border border-white/10 overflow-hidden backdrop-blur-sm">
                    {isLoading ? (
                        <div className="p-12 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="animate-spin text-primary" size={40} />
                            <p className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Synchronizing Athlete Data...</p>
                        </div>
                    ) : filteredPlayers.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 text-nowrap">
                                        <th className="px-4 md:px-8 py-4 md:py-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-primary/60 italic">Athlete Info</th>
                                        <th className="px-4 md:px-8 py-4 md:py-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-primary/60 italic">Position & Team</th>
                                        <th className="px-4 md:px-8 py-4 md:py-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-primary/60 italic text-center">Stats</th>
                                        <th className="px-4 md:px-8 py-4 md:py-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-primary/60 italic text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPlayers.map((player) => {
                                        const team = getPlayerTeam(player);
                                        return (
                                            <motion.tr
                                                layout
                                                key={player.id}
                                                className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                                            >
                                                <td className="px-4 md:px-8 py-4 md:py-6">
                                                    <div className="flex items-center gap-3 md:gap-4">
                                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-lg md:rounded-xl flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-primary/30 transition-colors shrink-0">
                                                            {player.image ? (
                                                                <img src={player.image} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <User className="text-white/20" size={24} />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-display font-black text-sm md:text-base italic uppercase truncate">{player.name}</div>
                                                            <div className="text-[8px] md:text-[10px] font-bold text-white/40 uppercase tracking-tight flex items-center gap-2">
                                                                {player.jerseyName && <span className="truncate max-w-[60px] md:max-w-none">{player.jerseyName}</span>}
                                                                {player.jerseyName && <span className="w-1 h-1 bg-white/10 rounded-full shrink-0" />}
                                                                <span className="text-primary/60 shrink-0">ID: {player.id.slice(0, 8)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 md:px-8 py-4 md:py-6">
                                                    <div className="min-w-[120px]">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[8px] md:text-[10px] font-black rounded uppercase italic">#{player.number}</span>
                                                            <span className="font-bold text-xs md:text-sm">{player.position}</span>
                                                        </div>
                                                        <div className="text-[10px] md:text-xs text-white/40 font-semibold truncate max-w-[150px]">{team?.name || 'Unknown Team'}</div>
                                                    </div>
                                                </td>
                                                <td className="px-4 md:px-8 py-4 md:py-6">
                                                    <div className="flex items-center justify-center gap-3 md:gap-4">
                                                        <div className="text-center">
                                                            <p className="text-[8px] md:text-[10px] font-black text-white/20 uppercase tracking-tighter">Rating</p>
                                                            <p className="font-display font-black text-primary italic leading-none text-base md:text-lg">{player.rating?.toFixed(1) || '—'}</p>
                                                        </div>
                                                        <div className="w-px h-4 md:h-6 bg-white/10" />
                                                        <div className="text-center">
                                                            <p className="text-[8px] md:text-[10px] font-black text-white/20 uppercase tracking-tighter">Age</p>
                                                            <p className="font-display font-black text-white italic leading-none text-base md:text-lg">{player.age || '—'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 md:px-8 py-4 md:py-6 text-right">
                                                    <div className="flex items-center justify-end gap-1 md:gap-2">
                                                        <Link
                                                            href={`/admin/players/${player.id}`}
                                                            className="p-1.5 md:p-2 hover:bg-white/5 rounded-lg md:rounded-xl transition-all border border-transparent hover:border-white/10 group/btn"
                                                            title="View profile"
                                                        >
                                                            <ExternalLink size={18} className="text-white/40 group-hover/btn:text-primary" />
                                                        </Link>
                                                        <button
                                                            onClick={() => handleOpenEdit(player)}
                                                            className="p-1.5 md:p-2 hover:bg-white/5 rounded-lg md:rounded-xl transition-all border border-transparent hover:border-white/10 group/btn"
                                                        >
                                                            <Edit size={18} className="text-white/40 group-hover/btn:text-white" />
                                                        </button>
                                                        <button
                                                            onClick={() => confirmDelete(player)}
                                                            className="p-1.5 md:p-2 hover:bg-red-500/10 rounded-lg md:rounded-xl transition-all border border-transparent hover:border-red-500/20 group/btn"
                                                        >
                                                            <Trash2 size={18} className="text-white/40 group-hover/btn:text-red-500" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-24 flex flex-col items-center justify-center bg-white/[0.01]">
                            <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mb-6 border border-white/5">
                                <Users size={40} className="text-white/10" />
                            </div>
                            <h3 className="text-xl font-display font-black italic uppercase mb-2">No Athletes Found</h3>
                            <p className="text-white/30 text-xs font-bold uppercase tracking-widest mb-8">Refine your search parameters or add a new athlete</p>
                            <button
                                onClick={handleOpenCreate}
                                className="px-8 py-4 bg-white/5 rounded-2xl border border-white/10 font-black uppercase italic text-xs tracking-[0.2em] hover:bg-primary hover:text-black hover:border-transparent transition-all"
                            >
                                Register New Athlete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.95 }}
                            className="relative w-full max-w-2xl bg-[#0a0a0a] rounded-[2.5rem] border border-white/10 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]"
                        >
                            <div className="p-8 border-b border-white/5 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-display font-black italic uppercase tracking-tighter">
                                        {modalMode === 'create' ? 'Register Athlete' : 'Refine Athlete Profile'}
                                    </h2>
                                    <p className="text-[10px] uppercase tracking-widest font-black text-primary/60">
                                        {modalMode === 'create' ? 'Adding to Matrix' : `Recalibrating System ID: ${selectedPlayer?.id}`}
                                    </p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Profile Image & Core Identity */}
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 border-b border-white/5 pb-2">Profile Visualization</h3>
                                        <div className="space-y-4">
                                            <ImageUpload
                                                value={formData.image || ''}
                                                onChange={url => setFormData({ ...formData, image: url })}
                                                folder="brixsports/players/avatars"
                                            />
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">Image URL (Manual Override)</label>
                                                <input
                                                    type="text"
                                                    value={formData.image || ''}
                                                    onChange={e => setFormData({ ...formData, image: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all text-[10px]"
                                                    placeholder="Paste image URL here..."
                                                />
                                            </div>
                                        </div>

                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 border-b border-white/5 pb-2 mt-8">Core Identity</h3>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">Full Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all"
                                                placeholder="e.g. John Doe"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">Jersey Name</label>
                                            <input
                                                type="text"
                                                value={formData.jerseyName || ''}
                                                onChange={e => setFormData({ ...formData, jerseyName: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all"
                                                placeholder="e.g. DOE"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">Jersey #</label>
                                                <input
                                                    type="number"
                                                    value={formData.number || ''}
                                                    onChange={e => setFormData({ ...formData, number: parseInt(e.target.value) })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all"
                                                    placeholder="10"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">Age</label>
                                                <input
                                                    type="number"
                                                    value={formData.age || ''}
                                                    onChange={e => setFormData({ ...formData, age: e.target.value ? parseInt(e.target.value) : null })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all"
                                                    placeholder="20"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* System Parameters */}
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 border-b border-white/5 pb-2">Technical Matrix</h3>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">Assigned Team</label>
                                            <select
                                                value={formData.teamId}
                                                onChange={e => setFormData({ ...formData, teamId: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all appearance-none"
                                            >
                                                <option value="">No team assigned</option>
                                                {teams.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name} ({t.sport})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">Tactical Position</label>
                                            <select
                                                value={formData.position || ''}
                                                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all"
                                            >
                                                <option value="">Select position</option>
                                                <optgroup label="Goalkeeper">
                                                    <option value="GK">GK — Goalkeeper</option>
                                                </optgroup>
                                                <optgroup label="Defenders">
                                                    <option value="CB">CB — Centre Back</option>
                                                    <option value="LB">LB — Left Back</option>
                                                    <option value="RB">RB — Right Back</option>
                                                    <option value="LWB">LWB — Left Wing Back</option>
                                                    <option value="RWB">RWB — Right Wing Back</option>
                                                </optgroup>
                                                <optgroup label="Midfielders">
                                                    <option value="CDM">CDM — Defensive Mid</option>
                                                    <option value="CM">CM — Central Mid</option>
                                                    <option value="CAM">CAM — Attacking Mid</option>
                                                    <option value="LM">LM — Left Mid</option>
                                                    <option value="RM">RM — Right Mid</option>
                                                </optgroup>
                                                <optgroup label="Forwards">
                                                    <option value="LW">LW — Left Wing</option>
                                                    <option value="RW">RW — Right Wing</option>
                                                    <option value="CF">CF — Centre Forward</option>
                                                    <option value="ST">ST — Striker</option>
                                                    <option value="SS">SS — Second Striker</option>
                                                </optgroup>
                                                <optgroup label="Basketball">
                                                    <option value="PG">PG — Point Guard</option>
                                                    <option value="SG">SG — Shooting Guard</option>
                                                    <option value="SF">SF — Small Forward</option>
                                                    <option value="PF">PF — Power Forward</option>
                                                    <option value="C">C — Center</option>
                                                    <option value="G/F">G/F — Guard/Forward</option>
                                                </optgroup>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">Height</label>
                                                <input
                                                    type="text"
                                                    value={formData.height || ''}
                                                    onChange={e => setFormData({ ...formData, height: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all"
                                                    placeholder="180cm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">Weight</label>
                                                <input
                                                    type="text"
                                                    value={formData.weight || ''}
                                                    onChange={e => setFormData({ ...formData, weight: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all"
                                                    placeholder="75kg"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 border-b border-white/5 pb-2">Academic & Metadata</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">University</label>
                                                <select
                                                    value={formData.university || ''}
                                                    onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all"
                                                >
                                                    <option value="">Not specified</option>
                                                    <option value="Bells University of Technology">Bells University of Technology</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">College</label>
                                                <select
                                                    value={formData.college || ''}
                                                    onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all"
                                                >
                                                    <option value="">None / External</option>
                                                    <option value="COLNAS">COLNAS — Natural &amp; Applied Sciences</option>
                                                    <option value="COLENG">COLENG — Engineering</option>
                                                    <option value="COLMANS">COLMANS — Management Sciences</option>
                                                    <option value="COLENVS">COLENVS — Environmental Sciences</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">Department</label>
                                                <input
                                                    type="text"
                                                    value={formData.department || ''}
                                                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all"
                                                    placeholder="e.g. Civil Engineering"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">Email (Linking)</label>
                                                <input
                                                    type="email"
                                                    value={formData.email || ''}
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all"
                                                    placeholder="Linking ID for multiple sports"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 italic">Nationality</label>
                                                <input
                                                    type="text"
                                                    value={formData.nationality || ''}
                                                    onChange={e => setFormData({ ...formData, nationality: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-[1.25rem] px-5 py-4 focus:outline-none focus:border-primary/50 font-bold transition-all"
                                                    placeholder="Nigerian"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>

                            <div className="p-8 border-t border-white/5 bg-white/[0.02] flex gap-4">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-8 py-5 border border-white/10 rounded-[1.5rem] font-black uppercase italic text-xs tracking-widest hover:bg-white/5 transition-all"
                                >
                                    Abort Changes
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSaving}
                                    className="flex-1 px-8 py-5 bg-primary text-black rounded-[1.5rem] font-black uppercase italic text-xs tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 shadow-[0_0_50px_rgba(var(--primary-rgb),0.2)]"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                    {isSaving ? 'Synchronizing...' : (modalMode === 'create' ? 'Establish Profile' : 'Commit Changes')}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmDialog
                isOpen={deleteDialog.isOpen}
                onClose={() => setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false })}
                onConfirm={handleDelete}
                title="Decommission Athlete?"
                message={`This will permanently remove ${deleteDialog.itemName} from the system matrix. This action is terminal.`}
                confirmText="Execute Deletion"
                variant="danger"
                isLoading={deleteDialog.isDeleting}
            />
        </div>
    );
}

export default function AdminPlayersPage() {
    return (
        <ErrorBoundary>
            <AdminPlayersPageContent />
        </ErrorBoundary>
    );
}
