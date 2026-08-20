'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trophy, Calendar, Users, Settings, Edit, Trash2, Eye, X, ChevronDown, ChevronUp } from 'lucide-react';
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
    description?: string;
}

const defaultFormData = {
    name: '',
    sport: 'Football',
    scope: 'internal',
    level: 'busa-league',
    format: 'league',
    season: '2026/2027',
    status: 'upcoming',
    numberOfTeams: 0,
    numberOfGroups: 0,
    teamsPerGroup: 0,
    isMultiSport: false,
    description: ''
};

const defaultMatchSettings = {
    halfDuration: 45,
    playersPerSide: 11,
    maxSubstitutions: 5 as number | null,
    unlimitedSubs: false,
    allowSubbedOutReentry: false,
    extraTimeEnabled: false,
    penaltiesEnabled: false,
    allowDraws: true,
    pointsForWin: 3,
    pointsForDraw: 1,
};

type MatchSettingsForm = typeof defaultMatchSettings;

interface CompetitionModalProps {
    mode: 'create' | 'edit';
    initialData: typeof defaultFormData;
    initialMatchSettings?: MatchSettingsForm;
    onSubmit: (data: typeof defaultFormData, matchSettings: MatchSettingsForm) => Promise<void>;
    onClose: () => void;
    isSubmitting: boolean;
}

function derivePlayersOption(n: number): '11' | '5' | 'custom' {
    if (n === 11) return '11';
    if (n === 5) return '5';
    return 'custom';
}

function CompetitionModal({ mode, initialData, initialMatchSettings, onSubmit, onClose, isSubmitting }: CompetitionModalProps) {
    const [form, setForm] = useState(initialData);
    const [matchSettings, setMatchSettings] = useState<MatchSettingsForm>(initialMatchSettings ?? defaultMatchSettings);
    const [showMatchSettings, setShowMatchSettings] = useState(false);
    const [playersOption, setPlayersOption] = useState<'11' | '5' | 'custom'>(
        derivePlayersOption(initialMatchSettings?.playersPerSide ?? 11)
    );
    const [playersCustom, setPlayersCustom] = useState(
        (initialMatchSettings?.playersPerSide && initialMatchSettings.playersPerSide !== 11 && initialMatchSettings.playersPerSide !== 5)
            ? initialMatchSettings.playersPerSide
            : 7
    );

    useEffect(() => {
        if (!initialMatchSettings) return;
        setMatchSettings(initialMatchSettings);
        setPlayersOption(derivePlayersOption(initialMatchSettings.playersPerSide ?? 11));
        if (initialMatchSettings.playersPerSide && initialMatchSettings.playersPerSide !== 11 && initialMatchSettings.playersPerSide !== 5) {
            setPlayersCustom(initialMatchSettings.playersPerSide);
        }
    }, [initialMatchSettings]);

    const setMs = (patch: Partial<MatchSettingsForm>) => setMatchSettings(prev => ({ ...prev, ...patch }));

    const handlePlayersOption = (opt: '11' | '5' | 'custom') => {
        setPlayersOption(opt);
        if (opt !== 'custom') setMs({ playersPerSide: parseInt(opt) });
        else setMs({ playersPerSide: playersCustom });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(form, matchSettings);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0a0a0a] rounded-[32px] border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between p-8 pb-4">
                    <h2 className="text-2xl font-display italic uppercase">
                        {mode === 'create' ? 'Create Competition' : 'Edit Competition'}
                    </h2>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Competition Name</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                                placeholder="e.g., BUSA LEAGUE (FOOTBALL)"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Sport</label>
                            <select
                                value={form.sport}
                                onChange={(e) => setForm({ ...form, sport: e.target.value })}
                                className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                            >
                                <option value="Football">Football</option>
                                <option value="Basketball">Basketball</option>
                                <option value="Volleyball">Volleyball</option>
                                <option value="Track & Field">Track & Field</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Scope</label>
                            <select
                                value={form.scope}
                                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                                className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                            >
                                <option value="internal">Internal</option>
                                <option value="external">External</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Level</label>
                            <select
                                value={form.level}
                                onChange={(e) => setForm({ ...form, level: e.target.value })}
                                className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                            >
                                <option value="busa-league">BUSA League</option>
                                <option value="college">College (INTERCOLLEGE)</option>
                                <option value="department">Department</option>
                                <option value="year-level">Year Level</option>
                                <option value="inter-university">Inter-University</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Format</label>
                            <select
                                value={form.format}
                                onChange={(e) => setForm({ ...form, format: e.target.value })}
                                className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                            >
                                <option value="league">League</option>
                                <option value="knockout">Knockout</option>
                                <option value="league-knockout">League + Knockout</option>
                                <option value="group-knockout">Group + Knockout</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Season</label>
                            <input
                                type="text"
                                value={form.season}
                                onChange={(e) => setForm({ ...form, season: e.target.value })}
                                className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                                placeholder="2024/2025"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Status</label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value })}
                                className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                            >
                                <option value="upcoming">Upcoming</option>
                                <option value="ongoing">Ongoing</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Number of Teams</label>
                            <input
                                type="number" min="0"
                                value={form.numberOfTeams}
                                onChange={(e) => setForm({ ...form, numberOfTeams: parseInt(e.target.value) || 0 })}
                                className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Number of Groups</label>
                            <input
                                type="number" min="0"
                                value={form.numberOfGroups}
                                onChange={(e) => setForm({ ...form, numberOfGroups: parseInt(e.target.value) || 0 })}
                                className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Teams per Group</label>
                            <input
                                type="number" min="0"
                                value={form.teamsPerGroup}
                                onChange={(e) => setForm({ ...form, teamsPerGroup: parseInt(e.target.value) || 0 })}
                                className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white h-24 resize-none"
                                placeholder="Optional description..."
                            />
                        </div>

                        <div className="md:col-span-2 flex items-center gap-3">
                            <input
                                type="checkbox"
                                id={`isMultiSport-${mode}`}
                                checked={form.isMultiSport}
                                onChange={(e) => setForm({ ...form, isMultiSport: e.target.checked })}
                                className="w-4 h-4 rounded border-white/10 bg-[#121212] text-primary focus:ring-primary"
                            />
                            <label htmlFor={`isMultiSport-${mode}`} className="text-sm font-bold text-white/60">
                                Multi-Sport Competition
                            </label>
                        </div>
                    </div>

                    {/* Match Settings — collapsible */}
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowMatchSettings(v => !v)}
                            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Match Settings</span>
                            {showMatchSettings ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
                        </button>

                        {showMatchSettings && (
                            <div className="px-5 pb-6 space-y-5 border-t border-white/10 pt-5">
                                {/* Duration */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Half Duration (mins)</label>
                                        <input type="number" min="1"
                                            value={matchSettings.halfDuration}
                                            onChange={e => setMs({ halfDuration: parseInt(e.target.value) || 45 })}
                                            className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Players Per Side</label>
                                        <div className="flex gap-2">
                                            {(['11', '5', 'custom'] as const).map(opt => (
                                                <button key={opt} type="button"
                                                    onClick={() => handlePlayersOption(opt)}
                                                    className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-colors ${playersOption === opt ? 'border-primary text-primary bg-primary/10' : 'border-white/10 text-white/40 hover:border-white/30'}`}
                                                >
                                                    {opt === '11' ? 'Standard' : opt === '5' ? '5-aside' : 'Custom'}
                                                </button>
                                            ))}
                                        </div>
                                        {playersOption === 'custom' && (
                                            <input type="number" min="1" className="mt-2 w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                                                value={playersCustom}
                                                onChange={e => {
                                                    const v = parseInt(e.target.value) || 7;
                                                    setPlayersCustom(v);
                                                    setMs({ playersPerSide: v });
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Substitutions */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Substitutions</label>
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <label className="flex items-center gap-2 text-sm font-bold text-white/60 cursor-pointer">
                                            <input type="checkbox"
                                                checked={matchSettings.allowSubbedOutReentry}
                                                onChange={e => setMs({ allowSubbedOutReentry: e.target.checked, unlimitedSubs: e.target.checked ? true : matchSettings.unlimitedSubs, maxSubstitutions: e.target.checked ? null : (matchSettings.maxSubstitutions ?? 5) })}
                                                className="w-4 h-4 rounded border-white/10 bg-[#121212] text-primary focus:ring-primary"
                                            />
                                            Rolling subs
                                        </label>
                                        {!matchSettings.allowSubbedOutReentry && (
                                            <>
                                                <input type="number" min="0"
                                                    value={matchSettings.unlimitedSubs ? '' : (matchSettings.maxSubstitutions ?? '')}
                                                    disabled={matchSettings.unlimitedSubs}
                                                    onChange={e => setMs({ maxSubstitutions: parseInt(e.target.value) || 0 })}
                                                    className="w-24 bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white disabled:opacity-30"
                                                    placeholder="Max"
                                                />
                                                <label className="flex items-center gap-2 text-sm font-bold text-white/60 cursor-pointer">
                                                    <input type="checkbox"
                                                        checked={matchSettings.unlimitedSubs}
                                                        onChange={e => setMs({ unlimitedSubs: e.target.checked, maxSubstitutions: e.target.checked ? null : 5 })}
                                                        className="w-4 h-4 rounded border-white/10 bg-[#121212] text-primary focus:ring-primary"
                                                    />
                                                    Unlimited
                                                </label>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Extra time + Penalties */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-bold text-white/60 cursor-pointer">
                                            <input type="checkbox"
                                                checked={matchSettings.extraTimeEnabled}
                                                onChange={e => setMs({ extraTimeEnabled: e.target.checked })}
                                                className="w-4 h-4 rounded border-white/10 bg-[#121212] text-primary focus:ring-primary"
                                            />
                                            Extra Time
                                        </label>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm font-bold text-white/60 cursor-pointer self-start pt-1">
                                        <input type="checkbox"
                                            checked={matchSettings.penaltiesEnabled}
                                            onChange={e => setMs({ penaltiesEnabled: e.target.checked })}
                                            className="w-4 h-4 rounded border-white/10 bg-[#121212] text-primary focus:ring-primary"
                                        />
                                        Penalties
                                    </label>
                                </div>

                                {/* Points */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-bold text-white/60 cursor-pointer mb-3">
                                            <input type="checkbox"
                                                checked={matchSettings.allowDraws}
                                                onChange={e => setMs({ allowDraws: e.target.checked })}
                                                className="w-4 h-4 rounded border-white/10 bg-[#121212] text-primary focus:ring-primary"
                                            />
                                            {matchSettings.allowDraws ? 'Draws allowed' : 'Must produce winner'}
                                        </label>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Points for Win</label>
                                        <input type="number" min="0"
                                            value={matchSettings.pointsForWin}
                                            onChange={e => setMs({ pointsForWin: parseInt(e.target.value) || 3 })}
                                            className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Points for Draw</label>
                                        <input type="number" min="0"
                                            value={matchSettings.pointsForDraw}
                                            disabled={!matchSettings.allowDraws}
                                            onChange={e => setMs({ pointsForDraw: parseInt(e.target.value) || 1 })}
                                            className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary text-white disabled:opacity-30"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 mt-8">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl border border-white/10 text-sm font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 bg-primary text-black px-8 py-3 rounded-xl font-black text-sm uppercase italic hover:scale-105 transition-transform disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Competition' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
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

    const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
    const [editingMatchSettings, setEditingMatchSettings] = useState<MatchSettingsForm | undefined>(undefined);
    const [isEditSubmitting, setIsEditSubmitting] = useState(false);

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

    const saveMatchSettings = async (competitionId: string, sport: string, ms: MatchSettingsForm) => {
        await fetch(`/api/competitions/${competitionId}/match-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sport,
                playersPerSide: ms.playersPerSide,
                halfDuration: ms.halfDuration,
                maxSubstitutions: ms.unlimitedSubs ? null : ms.maxSubstitutions,
                allowSubbedOutReentry: ms.allowSubbedOutReentry,
                extraTimeEnabled: ms.extraTimeEnabled,
                penaltiesEnabled: ms.penaltiesEnabled,
                allowDraws: ms.allowDraws,
                pointsForWin: ms.pointsForWin,
                pointsForDraw: ms.pointsForDraw,
            }),
        });
    };

    const handleSubmit = async (data: typeof defaultFormData, ms: MatchSettingsForm) => {
        setIsCreating(true);

        try {
            const response = await fetch('/api/competitions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                const newComp = await response.json();
                await saveMatchSettings(newComp.id, data.sport, ms);
                setCompetitions([...competitions, {
                    ...newComp,
                    scope: newComp.level === 'inter-university' ? 'external' : 'internal'
                }]);
                setShowCreateModal(false);
                success('Competition created successfully!');
            } else {
                const responseData = await response.json();
                error(responseData.error || 'Failed to create competition');
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

    const handleEditClick = async (comp: Competition) => {
        setEditingCompetition(comp);
        setEditingMatchSettings(undefined);
        try {
            const res = await fetch(`/api/competitions/${comp.id}/match-settings`);
            if (res.ok) {
                const data = await res.json();
                const s = Array.isArray(data.settings) ? data.settings[0] : data.settings;
                if (s) {
                    setEditingMatchSettings({
                        halfDuration: s.halfDuration ?? 45,
                        playersPerSide: s.playersPerSide ?? 11,
                        maxSubstitutions: s.maxSubstitutions ?? 5,
                        unlimitedSubs: s.maxSubstitutions === null,
                        allowSubbedOutReentry: !!s.allowSubbedOutReentry,
                        extraTimeEnabled: !!s.extraTimeEnabled,
                        penaltiesEnabled: !!s.penaltiesEnabled,
                        allowDraws: s.allowDraws ?? true,
                        pointsForWin: s.pointsForWin ?? 3,
                        pointsForDraw: s.pointsForDraw ?? 1,
                    });
                }
            }
        } catch {
            // falls back to defaultMatchSettings inside modal
        }
    };

    const handleEditSubmit = async (data: typeof defaultFormData, ms: MatchSettingsForm) => {
        if (!editingCompetition) return;
        setIsEditSubmitting(true);
        try {
            const res = await fetch(
                `/api/competitions/${editingCompetition.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                }
            );
            if (res.ok) {
                await saveMatchSettings(editingCompetition.id, data.sport, ms);
                success('Competition updated successfully.');
                setEditingCompetition(null);
                fetchCompetitions();
            } else {
                const responseData = await res.json();
                error(responseData.error || 'Failed to update competition.');
            }
        } catch {
            error('Network error. Try again.');
        } finally {
            setIsEditSubmitting(false);
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
                                            <button
                                                onClick={() => handleEditClick(competition)}
                                                className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
                                            >
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

            {showCreateModal && (
                <CompetitionModal
                    mode="create"
                    initialData={defaultFormData}
                    onSubmit={async (data, ms) => {
                        await handleSubmit(data, ms);
                    }}
                    onClose={() => setShowCreateModal(false)}
                    isSubmitting={isCreating}
                />
            )}

            {editingCompetition && (
                <CompetitionModal
                    mode="edit"
                    initialMatchSettings={editingMatchSettings}
                    initialData={{
                        name: editingCompetition.name,
                        sport: editingCompetition.sport || 'Football',
                        scope: editingCompetition.scope || 'internal',
                        level: editingCompetition.level || 'busa-league',
                        format: editingCompetition.format || 'league',
                        season: editingCompetition.season || '2024/2025',
                        status: editingCompetition.status || 'upcoming',
                        numberOfTeams: editingCompetition.numberOfTeams || 0,
                        numberOfGroups: editingCompetition.numberOfGroups || 0,
                        teamsPerGroup: editingCompetition.teamsPerGroup || 0,
                        isMultiSport: editingCompetition.isMultiSport || false,
                        description: editingCompetition.description || ''
                    }}
                    onSubmit={async (data, ms) => {
                        await handleEditSubmit(data, ms);
                    }}
                    onClose={() => setEditingCompetition(null)}
                    isSubmitting={isEditSubmitting}
                />
            )}

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
