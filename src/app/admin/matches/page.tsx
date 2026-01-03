'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Calendar, Users, MapPin, Trophy, Edit, Trash2, Eye, Filter } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import ErrorBoundary from '@/components/admin/ErrorBoundary';

interface Match {
    id: string;
    sport: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    status: 'LIVE' | 'FINISHED' | 'UPCOMING' | 'HALF_TIME';
    startTime: string;
    venue: string;
    matchType: 'competition' | 'friendly';
    competition: string;
    competitionLevel?: 'busa-league' | 'college' | 'department' | 'year-level' | 'external';
    friendlyType?: 'internal' | 'external';
    friendlyDescription?: string;
}

interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    sport: string;
}

interface Competition {
    id: string;
    name: string;
    sport: string;
}

function AdminMatchesPageContent() {
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
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

    const [formData, setFormData] = useState({
        sport: 'Football',
        homeTeamId: '',
        awayTeamId: '',
        startTime: '',
        venue: '',
        matchType: 'competition',
        competition: '',
        competitionLevel: 'busa-league',
        friendlyType: 'internal',
        friendlyDescription: '',
        status: 'UPCOMING'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
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
                    competitionLevel: 'busa-league',
                    friendlyType: 'internal',
                    friendlyDescription: '',
                    status: 'UPCOMING'
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

    const getTeamName = (teamId: string) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : teamId;
    };

    const filteredMatches = matches.filter(match => {
        if (filterStatus === 'all') return true;
        return match.status === filterStatus;
    });

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
                                <h1 className="text-2xl font-display font-bold">Match Management</h1>
                                <p className="text-sm text-white/60">Create and manage matches</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary/90 transition-colors"
                        >
                            <Plus size={18} />
                            Create Match
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                            <Calendar className="text-primary" size={24} />
                            <span className="text-white/60 text-sm">Total Matches</span>
                        </div>
                        <p className="text-3xl font-bold">{matches.length}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-white/60 text-sm">Live</span>
                        </div>
                        <p className="text-3xl font-bold">{matches.filter(m => m.status === 'LIVE').length}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                            <Calendar className="text-blue-500" size={24} />
                            <span className="text-white/60 text-sm">Upcoming</span>
                        </div>
                        <p className="text-3xl font-bold">{matches.filter(m => m.status === 'UPCOMING').length}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                            <Trophy className="text-blue-500" size={24} />
                            <span className="text-white/60 text-sm">Finished</span>
                        </div>
                        <p className="text-3xl font-bold">{matches.filter(m => m.status === 'FINISHED').length}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 mb-6">
                    <Filter size={18} className="text-white/60" />
                    <div className="flex gap-2">
                        {['all', 'LIVE', 'UPCOMING', 'FINISHED'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filterStatus === status
                                    ? 'bg-primary text-black'
                                    : 'bg-white/5 hover:bg-white/10'
                                    }`}
                            >
                                {status.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Matches List */}
                <div className="space-y-4">
                    {isLoading ? (
                        <SkeletonLoader type="card" count={5} />
                    ) : (
                        <>
                            {filteredMatches.map((match) => (
                                <motion.div
                                    key={match.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-primary/50 transition-all"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${match.status === 'LIVE' ? 'bg-red-500/20 text-red-500 animate-pulse' :
                                                    match.status === 'UPCOMING' ? 'bg-blue-500/20 text-blue-500' :
                                                        'bg-white/20 text-white/60'
                                                    }`}>
                                                    {match.status}
                                                </span>
                                                <span className="text-white/60 text-sm">{match.sport}</span>
                                                <span className="text-white/40 text-sm">•</span>
                                                <span className="text-white/60 text-sm">{match.competition}</span>
                                            </div>

                                            {/* Teams */}
                                            <div className="grid grid-cols-3 gap-4 items-center mb-4">
                                                <div className="text-right">
                                                    <p className="font-bold text-lg">{getTeamName(match.homeTeamId)}</p>
                                                </div>
                                                <div className="text-center">
                                                    {match.status === 'UPCOMING' ? (
                                                        <p className="text-white/40 text-sm">vs</p>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-3">
                                                            <span className="text-3xl font-bold">{match.homeScore}</span>
                                                            <span className="text-white/40">-</span>
                                                            <span className="text-3xl font-bold">{match.awayScore}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-bold text-lg">{getTeamName(match.awayTeamId)}</p>
                                                </div>
                                            </div>

                                            {/* Match Info */}
                                            <div className="flex items-center gap-6 text-sm text-white/60">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} />
                                                    <span>{new Date(match.startTime).toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={14} />
                                                    <span>{match.venue}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Link href={`/logger?matchId=${match.id}`} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                                <Eye size={18} />
                                            </Link>
                                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(match.id, `${getTeamName(match.homeTeamId)} vs ${getTeamName(match.awayTeamId)}`)}
                                                className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {filteredMatches.length === 0 && (
                                <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
                                    <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-white/40 font-bold text-lg">No matches found</p>
                                    <p className="text-white/20">Schedule your first match to get started</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Create Match Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#0a0a0a] rounded-2xl border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                    >
                        <div className="p-6 border-b border-white/10">
                            <h2 className="text-2xl font-bold">Create New Match</h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Sport</label>
                                    <select
                                        value={formData.sport}
                                        onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                    >
                                        <option value="Football">Football</option>
                                        <option value="Basketball">Basketball</option>
                                        <option value="Volleyball">Volleyball</option>
                                        <option value="Track">Track & Field</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                    >
                                        <option value="UPCOMING">Upcoming</option>
                                        <option value="LIVE">Live</option>
                                        <option value="HALF_TIME">Half Time</option>
                                        <option value="FINISHED">Finished</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Home Team</label>
                                    <select
                                        value={formData.homeTeamId}
                                        onChange={(e) => setFormData({ ...formData, homeTeamId: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                        required
                                    >
                                        <option value="">Select Home Team</option>
                                        {teams.filter(t => t.sport === formData.sport).map(team => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Away Team</label>
                                    <select
                                        value={formData.awayTeamId}
                                        onChange={(e) => setFormData({ ...formData, awayTeamId: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                        required
                                    >
                                        <option value="">Select Away Team</option>
                                        {teams.filter(t => t.sport === formData.sport).map(team => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2">Competition</label>
                                <select
                                    value={formData.competition}
                                    onChange={(e) => setFormData({ ...formData, competition: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                    required
                                >
                                    <option value="">Select Competition</option>
                                    {competitions.filter(c => c.sport === formData.sport).map(comp => (
                                        <option key={comp.id} value={comp.name}>{comp.name}</option>
                                    ))}
                                    <option value="Friendly Match">Friendly Match</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2">Competition Level</label>
                                <select
                                    value={formData.competitionLevel}
                                    onChange={(e) => setFormData({ ...formData, competitionLevel: e.target.value as any })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                >
                                    <option value="busa-league">BUSA League</option>
                                    <option value="college">College (INTERCOLLEGE)</option>
                                    <option value="department">Department</option>
                                    <option value="year-level">Year Level</option>
                                    <option value="external">External (vs Other Universities)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2">Start Time</label>
                                <input
                                    type="datetime-local"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2">Venue</label>
                                <input
                                    type="text"
                                    value={formData.venue}
                                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary"
                                    placeholder="e.g., Bells University Main Pitch"
                                    required
                                />
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
                                        'Create Match'
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteDialog.isOpen}
                onClose={() => setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false })}
                onConfirm={handleDelete}
                title="Delete Match?"
                message={`Are you sure you want to delete "${deleteDialog.itemName}"? This action cannot be undone and will permanently remove all associated data.`}
                confirmText="Delete Match"
                variant="danger"
                isLoading={deleteDialog.isDeleting}
            />
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

