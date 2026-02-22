'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trophy, Calendar, Users, Settings, Edit, Trash2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import ErrorBoundary from '@/components/admin/ErrorBoundary';

interface Competition {
    id: string;
    name: string;
    sport: string;
    scope: 'external' | 'internal';
    level: 'inter-university' | 'busa-league' | 'college' | 'department' | 'year-level';
    format: 'league' | 'knockout' | 'group-knockout';
    season: string;
    status: 'upcoming' | 'ongoing' | 'completed';
    numberOfTeams?: number;
    numberOfGroups?: number;
    teamsPerGroup?: number;
    isMultiSport?: boolean;
}

function AdminCompetitionsPageContent() {
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const { toasts, removeToast, success, error } = useToast();

    const [deleteDialog, setDeleteDialog] = useState({
        isOpen: false,
        itemId: null as string | null,
        itemName: '',
        isDeleting: false,
    });

    const [formData, setFormData] = useState({
        name: '',
        sport: 'Football',
        scope: 'internal',
        level: 'busa-league',
        format: 'league',
        season: '2024/2025',
        status: 'upcoming',
        numberOfTeams: 0,
        numberOfGroups: 0,
        teamsPerGroup: 0,
        isMultiSport: false
    });

    useEffect(() => {
        fetchCompetitions();
    }, []);

    const fetchCompetitions = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/competitions?includeStats=true');

            if (!response.ok) {
                throw new Error('Failed to fetch competitions');
            }

            const data = await response.json();
            const mappedCompetitions = data.competitions.map((c: any) => ({
                ...c,
                scope: c.level === 'inter-university' ? 'external' : 'internal'
            }));
            setCompetitions(mappedCompetitions);
        } catch (err) {
            error('Failed to load competitions. Please try again.');
            console.error('Error fetching competitions:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);

        try {
            const response = await fetch('/api/competitions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                const newComp = await response.json();
                setCompetitions([...competitions, {
                    ...newComp,
                    scope: newComp.level === 'inter-university' ? 'external' : 'internal'
                }]);
                setShowCreateModal(false);
                setFormData({
                    name: '',
                    sport: 'Football',
                    scope: 'internal',
                    level: 'busa-league',
                    format: 'league',
                    season: '2024/2025',
                    status: 'upcoming',
                    numberOfTeams: 0,
                    numberOfGroups: 0,
                    teamsPerGroup: 0,
                    isMultiSport: false
                });
                success('Competition created successfully!');
            } else {
                const data = await response.json();
                error(data.error || 'Failed to create competition');
            }
        } catch (err) {
            error('Network error. Please check your connection.');
            console.error('Error creating competition:', err);
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
            const response = await fetch(`/api/competitions/${deleteDialog.itemId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setCompetitions(competitions.filter(c => c.id !== deleteDialog.itemId));
                success('Competition deleted successfully!');
                setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false });
            } else {
                const data = await response.json();
                error(data.error || 'Failed to delete competition');
                setDeleteDialog(prev => ({ ...prev, isDeleting: false }));
            }
        } catch (err) {
            error('Network error. Please try again.');
            console.error('Error deleting competition:', err);
            setDeleteDialog(prev => ({ ...prev, isDeleting: false }));
        }
    };

    return (
        <>
            <div className="py-8 px-6">
                <ToastContainer toasts={toasts} onClose={removeToast} />
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/admin" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                                <ArrowLeft size={20} />
                            </Link>
                            <div>
                                <h1 className="text-2xl font-display font-bold">Competition Management</h1>
                                <p className="text-sm text-white/60">Create and manage competitions</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary/90 transition-colors"
                        >
                            <Plus size={18} />
                            Create Competition
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats */}
                {isLoading ? (
                    <SkeletonLoader type="stat" />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                                <Trophy className="text-primary" size={24} />
                                <span className="text-white/60 text-sm">Total Competitions</span>
                            </div>
                            <p className="text-3xl font-bold">{competitions.length}</p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                                <Calendar className="text-blue-500" size={24} />
                                <span className="text-white/60 text-sm">Ongoing</span>
                            </div>
                            <p className="text-3xl font-bold">{competitions.filter(c => c.status === 'ongoing').length}</p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                                <Users className="text-blue-500" size={24} />
                                <span className="text-white/60 text-sm">Internal</span>
                            </div>
                            <p className="text-3xl font-bold">{competitions.filter(c => c.scope === 'internal').length}</p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                                <Settings className="text-purple-500" size={24} />
                                <span className="text-white/60 text-sm">External</span>
                            </div>
                            <p className="text-3xl font-bold">{competitions.filter(c => c.scope === 'external').length}</p>
                        </div>
                    </div>
                )}

                {/* Competitions List */}
                <div className="space-y-4">
                    {isLoading ? (
                        <SkeletonLoader type="card" count={5} />
                    ) : competitions.length > 0 ? (
                        competitions.map((competition) => (
                            <motion.div
                                key={competition.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-primary/50 transition-all"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-bold">{competition.name}</h3>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${competition.status === 'ongoing' ? 'bg-blue-500/20 text-blue-500' :
                                                competition.status === 'upcoming' ? 'bg-blue-500/20 text-blue-500' :
                                                    'bg-white/20 text-white/60'
                                                }`}>
                                                {competition.status.toUpperCase()}
                                            </span>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${competition.scope === 'internal' ? 'bg-primary/20 text-primary' :
                                                'bg-purple-500/20 text-purple-500'
                                                }`}>
                                                {competition.scope.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                            <div>
                                                <p className="text-white/40 text-xs mb-1">Sport</p>
                                                <p className="font-semibold">{competition.sport}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/40 text-xs mb-1">Level</p>
                                                <p className="font-semibold capitalize">{competition.level?.replace('-', ' ') || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/40 text-xs mb-1">Format</p>
                                                <p className="font-semibold capitalize">{competition.format?.replace('-', ' ') || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/40 text-xs mb-1">Season</p>
                                                <p className="font-semibold">{competition.season}</p>
                                            </div>
                                        </div>
                                        {competition.numberOfTeams && (
                                            <div className="flex items-center gap-6 mt-4 text-sm">
                                                <span className="text-white/60">
                                                    <span className="font-bold text-white">{competition.numberOfTeams}</span> teams
                                                </span>
                                                {competition.numberOfGroups && (
                                                    <span className="text-white/60">
                                                        <span className="font-bold text-white">{competition.numberOfGroups}</span> groups
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col md:flex-row items-center gap-2">
                                        <Link 
                                            href={`/admin/competitions/${competition.id}`}
                                            className="flex items-center gap-2 bg-white/5 hover:bg-primary hover:text-black px-4 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest border border-white/10"
                                        >
                                            <Users size={14} />
                                            Manage Teams
                                        </Link>
                                        <div className="flex items-center gap-1">
                                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors group">
                                                <Edit size={18} className="text-white/40 group-hover:text-white" />
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(competition.id, competition.name)}
                                                className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors opacity-40 hover:opacity-100"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
                            <Trophy size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="text-white/40 font-bold text-lg">No competitions found</p>
                            <p className="text-white/20">Create your first competition to get started</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Competition Modal */}
            {
                showCreateModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-[#0a0a0a] rounded-2xl border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        >
                            <div className="p-6 border-b border-white/10">
                                <h2 className="text-2xl font-bold">Create New Competition</h2>
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Competition Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                        placeholder="e.g., BUSA LEAGUE (FOOTBALL)"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Sport</label>
                                        <select
                                            value={formData.sport}
                                            onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary disabled:opacity-50"
                                            disabled={formData.isMultiSport}
                                        >
                                            <option value="Football">Football</option>
                                            <option value="Basketball">Basketball</option>
                                            <option value="Volleyball">Volleyball</option>
                                            <option value="Track">Track & Field</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Scope</label>
                                        <select
                                            value={formData.scope}
                                            onChange={(e) => setFormData({ ...formData, scope: e.target.value as any })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                        >
                                            <option value="internal">Internal</option>
                                            <option value="external">External</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mb-6">
                                    <input
                                        type="checkbox"
                                        id="isMultiSport"
                                        checked={formData.isMultiSport}
                                        onChange={(e) => setFormData({ ...formData, isMultiSport: e.target.checked })}
                                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary"
                                    />
                                    <label htmlFor="isMultiSport" className="text-sm font-semibold">Multi-Sport Competition</label>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Level</label>
                                        <select
                                            value={formData.level}
                                            onChange={(e) => setFormData({ ...formData, level: e.target.value as any })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                        >
                                            <option value="busa-league">BUSA League</option>
                                            <option value="college">College (INTERCOLLEGE)</option>
                                            <option value="department">Department</option>
                                            <option value="year-level">Year Level</option>
                                            <option value="inter-university">Inter-University</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Format</label>
                                        <select
                                            value={formData.format}
                                            onChange={(e) => setFormData({ ...formData, format: e.target.value as any })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                        >
                                            <option value="league">League</option>
                                            <option value="knockout">Knockout</option>
                                            <option value="group-knockout">Group + Knockout</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Season</label>
                                        <input
                                            type="text"
                                            value={formData.season}
                                            onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                            placeholder="2024/2025"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                        >
                                            <option value="upcoming">Upcoming</option>
                                            <option value="ongoing">Ongoing</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Number of Teams</label>
                                        <input
                                            type="number"
                                            value={formData.numberOfTeams}
                                            onChange={(e) => setFormData({ ...formData, numberOfTeams: parseInt(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Number of Groups</label>
                                        <input
                                            type="number"
                                            value={formData.numberOfGroups}
                                            onChange={(e) => setFormData({ ...formData, numberOfGroups: parseInt(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Teams per Group</label>
                                        <input
                                            type="number"
                                            value={formData.teamsPerGroup}
                                            onChange={(e) => setFormData({ ...formData, teamsPerGroup: parseInt(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                            min="0"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        disabled={isCreating}
                                        className="flex-1 bg-white/5 hover:bg-white/10 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isCreating}
                                        className="flex-1 bg-primary text-black px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                                    >
                                        {isCreating ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                Creating...
                                            </span>
                                        ) : (
                                            'Create Competition'
                                        )}
                                    </button>
                                </div>
                            </form >
                        </motion.div >
                    </div >
                )
            }

            {/* Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteDialog.isOpen}
                onClose={() => setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false })}
                onConfirm={handleDelete}
                title="Delete Competition?"
                message={`Are you sure you want to delete "${deleteDialog.itemName}"? This action cannot be undone and will permanently remove all associated data.`}
                confirmText="Delete Competition"
                variant="danger"
                isLoading={deleteDialog.isDeleting}
            />
        </>
    );
}

export default function AdminCompetitionsPage() {
    return (
        <ErrorBoundary>
            <AdminCompetitionsPageContent />
        </ErrorBoundary>
    );
}
