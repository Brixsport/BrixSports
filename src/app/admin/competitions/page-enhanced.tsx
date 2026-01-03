/**
 * Enhanced Admin Competitions Page
 * Features: Bulk operations, Template selection, Import/Export
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Plus,
    Trophy,
    Calendar,
    Users,
    Settings,
    Edit,
    Trash2,
    Eye,
    Upload,
    Download,
    Copy,
    CheckSquare,
    Square,
    Sparkles,
} from 'lucide-react';
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
}

interface CompetitionTemplate {
    id: string;
    name: string;
    description: string;
    sport: string;
    format: string;
    numberOfTeams: number;
    level: string;
}

function AdminCompetitionsPageContent() {
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [templates, setTemplates] = useState<CompetitionTemplate[]>([]);
    const [selectedCompetitions, setSelectedCompetitions] = useState<Set<string>>(new Set());
    const { toasts, removeToast, success, error } = useToast();

    const [deleteDialog, setDeleteDialog] = useState({
        isOpen: false,
        itemId: null as string | null,
        itemName: '',
        isDeleting: false,
    });

    const [bulkDeleteDialog, setBulkDeleteDialog] = useState({
        isOpen: false,
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
    });

    useEffect(() => {
        fetchCompetitions();
        fetchTemplates();
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
                scope: c.level === 'inter-university' ? 'external' : 'internal',
            }));
            setCompetitions(mappedCompetitions);
        } catch (err) {
            error('Failed to load competitions. Please try again.');
            console.error('Error fetching competitions:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/competitions/templates');
            if (response.ok) {
                const data = await response.json();
                setTemplates(data.templates || []);
            }
        } catch (err) {
            console.error('Error fetching templates:', err);
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
                setCompetitions([
                    ...competitions,
                    {
                        ...newComp,
                        scope: newComp.level === 'inter-university' ? 'external' : 'internal',
                    },
                ]);
                setShowCreateModal(false);
                resetForm();
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

    const handleApplyTemplate = async (templateId: string) => {
        setIsCreating(true);
        try {
            const response = await fetch('/api/competitions/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId,
                    season: formData.season,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setCompetitions([
                    ...competitions,
                    {
                        ...data.competition,
                        scope: data.competition.level === 'inter-university' ? 'external' : 'internal',
                    },
                ]);
                setShowTemplateModal(false);
                success(`Competition created from template: ${data.appliedTemplate}`);
            } else {
                const data = await response.json();
                error(data.error || 'Failed to apply template');
            }
        } catch (err) {
            error('Network error. Please check your connection.');
            console.error('Error applying template:', err);
        } finally {
            setIsCreating(false);
        }
    };

    const handleBulkDelete = async () => {
        setBulkDeleteDialog((prev) => ({ ...prev, isDeleting: true }));

        try {
            const response = await fetch('/api/competitions/bulk', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedCompetitions) }),
            });

            if (response.ok) {
                setCompetitions(competitions.filter((c) => !selectedCompetitions.has(c.id)));
                setSelectedCompetitions(new Set());
                success(`Successfully deleted ${selectedCompetitions.size} competitions`);
                setBulkDeleteDialog({ isOpen: false, isDeleting: false });
            } else {
                const data = await response.json();
                error(data.error || 'Failed to delete competitions');
                setBulkDeleteDialog((prev) => ({ ...prev, isDeleting: false }));
            }
        } catch (err) {
            error('Network error. Please try again.');
            console.error('Error bulk deleting:', err);
            setBulkDeleteDialog((prev) => ({ ...prev, isDeleting: false }));
        }
    };

    const handleExport = () => {
        const dataStr = JSON.stringify(competitions, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `competitions_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        success('Competitions exported successfully!');
    };

    const toggleSelection = (id: string) => {
        const newSelection = new Set(selectedCompetitions);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedCompetitions(newSelection);
    };

    const toggleSelectAll = () => {
        if (selectedCompetitions.size === competitions.length) {
            setSelectedCompetitions(new Set());
        } else {
            setSelectedCompetitions(new Set(competitions.map((c) => c.id)));
        }
    };

    const resetForm = () => {
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
        });
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

        setDeleteDialog((prev) => ({ ...prev, isDeleting: true }));

        try {
            const response = await fetch(`/api/competitions/${deleteDialog.itemId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setCompetitions(competitions.filter((c) => c.id !== deleteDialog.itemId));
                success('Competition deleted successfully!');
                setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false });
            } else {
                const data = await response.json();
                error(data.error || 'Failed to delete competition');
                setDeleteDialog((prev) => ({ ...prev, isDeleting: false }));
            }
        } catch (err) {
            error('Network error. Please try again.');
            console.error('Error deleting competition:', err);
            setDeleteDialog((prev) => ({ ...prev, isDeleting: false }));
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Toast Container */}
            <ToastContainer toasts={toasts} onClose={removeToast} />

            {/* Header */}
            <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-40">
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
                        <div className="flex items-center gap-2">
                            {selectedCompetitions.size > 0 && (
                                <button
                                    onClick={() => setBulkDeleteDialog({ isOpen: true, isDeleting: false })}
                                    className="flex items-center gap-2 bg-red-500/20 text-red-500 px-4 py-2 rounded-lg font-bold hover:bg-red-500/30 transition-colors"
                                >
                                    <Trash2 size={18} />
                                    Delete ({selectedCompetitions.size})
                                </button>
                            )}
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg font-bold transition-colors"
                            >
                                <Download size={18} />
                                Export
                            </button>
                            <button
                                onClick={() => setShowTemplateModal(true)}
                                className="flex items-center gap-2 bg-purple-500/20 text-purple-400 px-4 py-2 rounded-lg font-bold hover:bg-purple-500/30 transition-colors"
                            >
                                <Sparkles size={18} />
                                Use Template
                            </button>
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
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats */}
                {isLoading ? (
                    <SkeletonLoader type="stat" />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                                <Trophy className="text-primary" size={24} />
                                <span className="text-white/60 text-sm">Total</span>
                            </div>
                            <p className="text-3xl font-bold">{competitions.length}</p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                                <Calendar className="text-blue-500" size={24} />
                                <span className="text-white/60 text-sm">Ongoing</span>
                            </div>
                            <p className="text-3xl font-bold">
                                {competitions.filter((c) => c.status === 'ongoing').length}
                            </p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                                <Users className="text-blue-500" size={24} />
                                <span className="text-white/60 text-sm">Internal</span>
                            </div>
                            <p className="text-3xl font-bold">
                                {competitions.filter((c) => c.scope === 'internal').length}
                            </p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                                <Settings className="text-purple-500" size={24} />
                                <span className="text-white/60 text-sm">External</span>
                            </div>
                            <p className="text-3xl font-bold">
                                {competitions.filter((c) => c.scope === 'external').length}
                            </p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                                <CheckSquare className="text-green-500" size={24} />
                                <span className="text-white/60 text-sm">Selected</span>
                            </div>
                            <p className="text-3xl font-bold">{selectedCompetitions.size}</p>
                        </div>
                    </div>
                )}

                {/* Bulk Selection */}
                {competitions.length > 0 && (
                    <div className="mb-4 flex items-center gap-3">
                        <button
                            onClick={toggleSelectAll}
                            className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
                        >
                            {selectedCompetitions.size === competitions.length ? (
                                <CheckSquare size={18} className="text-primary" />
                            ) : (
                                <Square size={18} />
                            )}
                            Select All
                        </button>
                        {selectedCompetitions.size > 0 && (
                            <span className="text-sm text-white/40">
                                {selectedCompetitions.size} of {competitions.length} selected
                            </span>
                        )}
                    </div>
                )}

                {/* Competitions List */}
                <div className="space-y-4">
                    {isLoading ? (
                        <SkeletonLoader type="card" count={5} />
                    ) : competitions.length > 0 ? (
                        <>
                            {competitions.map((competition) => (
                                <motion.div
                                    key={competition.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`bg-white/5 rounded-2xl p-6 border transition-all ${selectedCompetitions.has(competition.id)
                                            ? 'border-primary bg-primary/5'
                                            : 'border-white/10 hover:border-primary/50'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4 flex-1">
                                            <button
                                                onClick={() => toggleSelection(competition.id)}
                                                className="mt-1"
                                            >
                                                {selectedCompetitions.has(competition.id) ? (
                                                    <CheckSquare size={20} className="text-primary" />
                                                ) : (
                                                    <Square size={20} className="text-white/40" />
                                                )}
                                            </button>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-xl font-bold">{competition.name}</h3>
                                                    <span
                                                        className={`px-3 py-1 rounded-full text-xs font-bold ${competition.status === 'ongoing'
                                                                ? 'bg-blue-500/20 text-blue-500'
                                                                : competition.status === 'upcoming'
                                                                    ? 'bg-blue-500/20 text-blue-500'
                                                                    : 'bg-white/20 text-white/60'
                                                            }`}
                                                    >
                                                        {competition.status.toUpperCase()}
                                                    </span>
                                                    <span
                                                        className={`px-3 py-1 rounded-full text-xs font-bold ${competition.scope === 'internal'
                                                                ? 'bg-primary/20 text-primary'
                                                                : 'bg-purple-500/20 text-purple-500'
                                                            }`}
                                                    >
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
                                                        <p className="font-semibold capitalize">
                                                            {competition.level.replace('-', ' ')}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-white/40 text-xs mb-1">Format</p>
                                                        <p className="font-semibold capitalize">
                                                            {competition.format.replace('-', ' ')}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-white/40 text-xs mb-1">Season</p>
                                                        <p className="font-semibold">{competition.season}</p>
                                                    </div>
                                                </div>
                                                {competition.numberOfTeams && (
                                                    <div className="flex items-center gap-6 mt-4 text-sm">
                                                        <span className="text-white/60">
                                                            <span className="font-bold text-white">
                                                                {competition.numberOfTeams}
                                                            </span>{' '}
                                                            teams
                                                        </span>
                                                        {competition.numberOfGroups && (
                                                            <span className="text-white/60">
                                                                <span className="font-bold text-white">
                                                                    {competition.numberOfGroups}
                                                                </span>{' '}
                                                                groups
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/admin/competitions/${competition.id}`}
                                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                            >
                                                <Eye size={18} />
                                            </Link>
                                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(competition.id, competition.name)}
                                                className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </>
                    ) : (
                        <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
                            <Trophy size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="text-white/40 font-bold text-lg">No competitions found</p>
                            <p className="text-white/20">Create your first competition to get started</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Template Selection Modal */}
            {showTemplateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#0a0a0a] rounded-2xl border border-white/10 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                    >
                        <div className="p-6 border-b border-white/10">
                            <h2 className="text-2xl font-bold">Choose a Template</h2>
                            <p className="text-white/60 text-sm mt-1">
                                Select a predefined template to quickly create a competition
                            </p>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {templates.map((template) => (
                                    <motion.button
                                        key={template.id}
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => handleApplyTemplate(template.id)}
                                        className="bg-white/5 border border-white/10 rounded-xl p-6 text-left hover:border-primary/50 transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <h3 className="font-bold text-lg">{template.name}</h3>
                                            <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-bold rounded">
                                                {template.sport}
                                            </span>
                                        </div>
                                        <p className="text-white/60 text-sm mb-4">{template.description}</p>
                                        <div className="flex items-center gap-4 text-xs text-white/40">
                                            <span>{template.numberOfTeams} teams</span>
                                            <span>•</span>
                                            <span className="capitalize">{template.format}</span>
                                            <span>•</span>
                                            <span className="capitalize">{template.level.replace('-', ' ')}</span>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                            <div className="mt-6">
                                <button
                                    onClick={() => setShowTemplateModal(false)}
                                    className="w-full bg-white/5 hover:bg-white/10 px-6 py-3 rounded-lg font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Create Competition Modal - Keep existing modal code */}
            {/* ... (existing create modal code) ... */}

            {/* Bulk Delete Confirmation */}
            <ConfirmDialog
                isOpen={bulkDeleteDialog.isOpen}
                onClose={() => setBulkDeleteDialog({ isOpen: false, isDeleting: false })}
                onConfirm={handleBulkDelete}
                title="Delete Multiple Competitions?"
                message={`Are you sure you want to delete ${selectedCompetitions.size} competitions? This action cannot be undone.`}
                confirmText={`Delete ${selectedCompetitions.size} Competitions`}
                variant="danger"
                isLoading={bulkDeleteDialog.isDeleting}
            />

            {/* Single Delete Confirmation */}
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
        </div>
    );
}

export default function AdminCompetitionsPage() {
    return (
        <ErrorBoundary>
            <AdminCompetitionsPageContent />
        </ErrorBoundary>
    );
}
