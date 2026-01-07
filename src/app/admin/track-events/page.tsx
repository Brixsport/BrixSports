'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Calendar, Users, MapPin, Trophy, Edit, Trash2, Eye, Filter, Timer, Flag } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import ErrorBoundary from '@/components/admin/ErrorBoundary';

interface TrackEvent {
    id: string;
    sport: 'Track';
    meetName: string;
    venue: string;
    startTime: string;
    status: 'UPCOMING' | 'LIVE' | 'FINISHED';
    competition: string;
    participatingTeams: string[]; // Array of team IDs
    eventCategories: string[]; // e.g., ['Sprint', 'Distance', 'Jump', 'Throw']
}

interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    sport: string;
}

function AdminTrackEventsPageContent() {
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [trackEvents, setTrackEvents] = useState<TrackEvent[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const { toasts, removeToast, success, error } = useToast();

    const [deleteDialog, setDeleteDialog] = useState({
        isOpen: false,
        itemId: null as string | null,
        itemName: '',
        isDeleting: false,
    });

    const [formData, setFormData] = useState({
        meetName: '',
        venue: '',
        startTime: '',
        competition: '',
        participatingTeams: [] as string[],
        eventCategories: [] as string[],
        status: 'UPCOMING' as const,
    });

    const eventCategoryOptions = [
        'Sprint',
        'Distance',
        'Hurdles',
        'Relay',
        'Jump',
        'Throw'
    ];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [matchesRes, teamsRes] = await Promise.all([
                fetch('/api/matches?sport=Track'),
                fetch('/api/teams?sport=Track')
            ]);

            if (matchesRes.ok) {
                const matchesData = await matchesRes.json();
                // Convert matches to track events format
                const events = (Array.isArray(matchesData) ? matchesData : matchesData.matches || [])
                    .filter((m: any) => m.sport === 'Track')
                    .map((m: any) => ({
                        id: m.id,
                        sport: 'Track',
                        meetName: m.competition || 'Track Meet',
                        venue: m.venue,
                        startTime: m.startTime,
                        status: m.status,
                        competition: m.competition,
                        participatingTeams: [m.homeTeamId, m.awayTeamId].filter(Boolean),
                        eventCategories: []
                    }));
                setTrackEvents(events);
            }

            if (teamsRes.ok) {
                const teamsData = await teamsRes.json();
                setTeams(Array.isArray(teamsData) ? teamsData : teamsData.teams || []);
            }
        } catch (err) {
            error('Failed to load track events data. Please try again.');
            console.error('Error fetching data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);

        // For track events, we'll use the first two teams as homeTeam/awayTeam
        // This is a workaround since the current schema requires these fields
        const [homeTeamId, awayTeamId] = formData.participatingTeams;

        if (!homeTeamId) {
            error('Please select at least one participating team');
            setIsCreating(false);
            return;
        }

        const trackEventPayload = {
            id: nanoid(),
            sport: 'Track',
            homeTeamId: homeTeamId,
            awayTeamId: awayTeamId || homeTeamId, // Use same team if only one selected
            homeScore: 0,
            awayScore: 0,
            status: formData.status,
            startTime: formData.startTime,
            venue: formData.venue,
            competition: formData.meetName,
            matchType: 'competition',
        };

        try {
            const response = await fetch('/api/matches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(trackEventPayload),
            });

            if (response.ok) {
                await fetchData();
                setShowCreateModal(false);
                setFormData({
                    meetName: '',
                    venue: '',
                    startTime: '',
                    competition: '',
                    participatingTeams: [],
                    eventCategories: [],
                    status: 'UPCOMING',
                });
                success('Track event created successfully!');
            } else {
                const data = await response.json();
                error(data.error || 'Failed to create track event');
            }
        } catch (err) {
            error('Network error. Please check your connection.');
            console.error('Error creating track event:', err);
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
                setTrackEvents(trackEvents.filter(e => e.id !== deleteDialog.itemId));
                success('Track event deleted successfully!');
                setDeleteDialog({ isOpen: false, itemId: null, itemName: '', isDeleting: false });
            } else {
                const data = await response.json();
                error(data.error || 'Failed to delete track event');
                setDeleteDialog(prev => ({ ...prev, isDeleting: false }));
            }
        } catch (err) {
            error('Network error. Please try again.');
            console.error('Error deleting track event:', err);
            setDeleteDialog(prev => ({ ...prev, isDeleting: false }));
        }
    };

    const toggleTeamSelection = (teamId: string) => {
        setFormData(prev => ({
            ...prev,
            participatingTeams: prev.participatingTeams.includes(teamId)
                ? prev.participatingTeams.filter(id => id !== teamId)
                : [...prev.participatingTeams, teamId]
        }));
    };

    const toggleEventCategory = (category: string) => {
        setFormData(prev => ({
            ...prev,
            eventCategories: prev.eventCategories.includes(category)
                ? prev.eventCategories.filter(c => c !== category)
                : [...prev.eventCategories, category]
        }));
    };

    const filteredEvents = trackEvents.filter(event => {
        if (filterStatus === 'all') return true;
        return event.status === filterStatus;
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
                                <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                                    <Timer className="text-primary" size={28} />
                                    Track & Field Events
                                </h1>
                                <p className="text-sm text-white/60">Create and manage track meets</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary/90 transition-colors"
                        >
                            <Plus size={18} />
                            Create Track Event
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
                            <span className="text-white/60 text-sm">Total Events</span>
                        </div>
                        <p className="text-3xl font-bold">{trackEvents.length}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-white/60 text-sm">Live</span>
                        </div>
                        <p className="text-3xl font-bold">{trackEvents.filter(e => e.status === 'LIVE').length}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                            <Calendar className="text-blue-500" size={24} />
                            <span className="text-white/60 text-sm">Upcoming</span>
                        </div>
                        <p className="text-3xl font-bold">{trackEvents.filter(e => e.status === 'UPCOMING').length}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                            <Trophy className="text-blue-500" size={24} />
                            <span className="text-white/60 text-sm">Finished</span>
                        </div>
                        <p className="text-3xl font-bold">{trackEvents.filter(e => e.status === 'FINISHED').length}</p>
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

                {/* Events List */}
                <div className="space-y-4">
                    {isLoading ? (
                        <SkeletonLoader type="card" count={5} />
                    ) : (
                        <>
                            {filteredEvents.map((event) => (
                                <motion.div
                                    key={event.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-primary/50 transition-all"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${event.status === 'LIVE' ? 'bg-red-500/20 text-red-500 animate-pulse' :
                                                        event.status === 'UPCOMING' ? 'bg-blue-500/20 text-blue-500' :
                                                            'bg-white/20 text-white/60'
                                                    }`}>
                                                    {event.status}
                                                </span>
                                                <Timer className="text-primary" size={18} />
                                                <span className="text-white/60 text-sm">Track & Field</span>
                                            </div>

                                            {/* Meet Name */}
                                            <h3 className="text-2xl font-bold mb-2">{event.meetName}</h3>

                                            {/* Event Info */}
                                            <div className="flex items-center gap-6 text-sm text-white/60 mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} />
                                                    <span>{new Date(event.startTime).toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={14} />
                                                    <span>{event.venue}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Users size={14} />
                                                    <span>{event.participatingTeams.length} Teams</span>
                                                </div>
                                            </div>

                                            {/* Participating Teams */}
                                            {event.participatingTeams.length > 0 && (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs text-white/40 font-bold uppercase">Teams:</span>
                                                    {event.participatingTeams.map(teamId => {
                                                        const team = teams.find(t => t.id === teamId);
                                                        return team ? (
                                                            <div key={teamId} className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-lg">
                                                                {team.logo && <img src={team.logo} alt={team.name} className="w-4 h-4 object-contain" />}
                                                                <span className="text-xs font-bold">{team.shortName}</span>
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/logger?matchId=${event.id}`}
                                                className="p-2 hover:bg-white/10 rounded-lg transition-colors group relative"
                                            >
                                                <Eye size={18} />
                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                    Logger
                                                </span>
                                            </Link>
                                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(event.id, event.meetName)}
                                                className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {filteredEvents.length === 0 && (
                                <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
                                    <Timer size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-white/40 font-bold text-lg">No track events found</p>
                                    <p className="text-white/20">Create your first track meet to get started</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Create Event Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#0a0a0a] rounded-2xl border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                    >
                        <div className="p-6 border-b border-white/10">
                            <h2 className="text-2xl font-bold">Create Track & Field Event</h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-semibold mb-2">Meet Name</label>
                                <input
                                    type="text"
                                    value={formData.meetName}
                                    onChange={(e) => setFormData({ ...formData, meetName: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
                                    placeholder="e.g., BUSA Track & Field Championship 2026"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
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
                                    <label className="block text-sm font-semibold mb-2">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
                                    >
                                        <option value="UPCOMING" className="bg-[#0a0a0a] text-white">Upcoming</option>
                                        <option value="LIVE" className="bg-[#0a0a0a] text-white">Live</option>
                                        <option value="FINISHED" className="bg-[#0a0a0a] text-white">Finished</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2">Venue</label>
                                <input
                                    type="text"
                                    value={formData.venue}
                                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
                                    placeholder="e.g., Bells University Track & Field Stadium"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2">Participating Teams</label>
                                <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-3 bg-white/5 rounded-lg border border-white/10">
                                    {teams.length === 0 ? (
                                        <p className="col-span-2 text-center text-white/40 py-4">No teams available. Create teams first.</p>
                                    ) : (
                                        teams.map(team => (
                                            <label
                                                key={team.id}
                                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${formData.participatingTeams.includes(team.id)
                                                        ? 'bg-primary/20 border-2 border-primary'
                                                        : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.participatingTeams.includes(team.id)}
                                                    onChange={() => toggleTeamSelection(team.id)}
                                                    className="w-5 h-5 rounded border-white/10 text-primary focus:ring-primary"
                                                />
                                                {team.logo && <img src={team.logo} alt={team.name} className="w-6 h-6 object-contain" />}
                                                <span className="text-sm font-bold">{team.shortName}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2">Event Categories (Optional)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {eventCategoryOptions.map(category => (
                                        <label
                                            key={category}
                                            className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${formData.eventCategories.includes(category)
                                                    ? 'bg-primary/20 border border-primary'
                                                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.eventCategories.includes(category)}
                                                onChange={() => toggleEventCategory(category)}
                                                className="w-4 h-4 rounded border-white/10 text-primary focus:ring-primary"
                                            />
                                            <span className="text-xs font-bold">{category}</span>
                                        </label>
                                    ))}
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
                                        'Create Event'
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
                title="Delete Track Event?"
                message={`Are you sure you want to delete "${deleteDialog.itemName}"? This action cannot be undone and will permanently remove all associated data.`}
                confirmText="Delete Event"
                variant="danger"
                isLoading={deleteDialog.isDeleting}
            />
        </div>
    );
}

export default function AdminTrackEventsPage() {
    return (
        <ErrorBoundary>
            <AdminTrackEventsPageContent />
        </ErrorBoundary>
    );
}
