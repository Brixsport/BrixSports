'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Plus,
    Trash2,
    Upload,
    CheckCircle2,
    AlertCircle,
    ChevronDown,
    School,
    UserPlus,
    Shirt,
    Copy,
    Download,
    Loader2,
    Sparkles,
    X,
    ArrowLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────
interface PlayerRow {
    id: string;
    name: string;
    jerseyName: string;
    number: number | '';
    position: string;
    age: number | '';
    height: string;
    weight: string;
    nationality: string;
    college: string;
    department: string;
    email: string;
}

interface Team {
    id: string;
    name: string;
    shortName: string;
    university: string;
    color: string;
    sport: string;
}

interface Competition {
    id: string;
    name: string;
    sport: string;
    playersPerSide: number | null;
    status: string | null;
}

interface SubmitResult {
    success: boolean;
    teamId?: string;
    created?: number;
    skipped?: number;
    createdPlayers?: { id: string; name: string; number: number }[];
    skippedPlayers?: { name: string; number: number; reason: string }[];
    message?: string;
    error?: string;
}

// ─── Constants ───────────────────────────────────────────────────
const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];
const POSITIONS_5ASIDE = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];

const SPORTS = ['Football', 'Basketball', 'Scrabble', 'Chess', 'Table Tennis'];

const createEmptyPlayer = (): PlayerRow => ({
    id: crypto.randomUUID(),
    name: '',
    jerseyName: '',
    number: '',
    position: '',
    age: '',
    height: '',
    weight: '',
    nationality: 'Nigeria',
    college: '',
    department: '',
    email: '',
});

// ─── Component ───────────────────────────────────────────────────
export default function BulkRegisterPage() {
    const router = useRouter();

    // Data state
    const [teams, setTeams] = useState<Team[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [mode, setMode] = useState<'existing' | 'new'>('existing');
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedSport, setSelectedSport] = useState('Football');
    const [selectedCompetitionId, setSelectedCompetitionId] = useState('');
    const [newTeamName, setNewTeamName] = useState('');
    const [newUniversity, setNewUniversity] = useState('');
    const [newShortName, setNewShortName] = useState('');
    const [newTeamColor, setNewTeamColor] = useState('#6366F1');
    const [players, setPlayers] = useState<PlayerRow[]>([
        createEmptyPlayer(),
        createEmptyPlayer(),
        createEmptyPlayer(),
        createEmptyPlayer(),
        createEmptyPlayer(),
    ]);

    // Submit state
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<SubmitResult | null>(null);
    const [showResult, setShowResult] = useState(false);

    // Fetch teams & competitions
    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/players/bulk-register?sport=${encodeURIComponent(selectedSport)}`);
                if (res.ok) {
                    const data = await res.json();
                    setTeams(data.teams || []);
                    setCompetitions(data.competitions || []);
                    // reset selected team/competition when sport changes
                    setSelectedTeamId('');
                    setSelectedCompetitionId('');
                }
            } catch (e) {
                console.error('Failed to fetch data:', e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [selectedSport]);

    // Player management
    const addPlayer = useCallback(() => {
        setPlayers(prev => [...prev, createEmptyPlayer()]);
    }, []);

    const addMultiplePlayers = useCallback((count: number) => {
        const newPlayers = Array.from({ length: count }, () => createEmptyPlayer());
        setPlayers(prev => [...prev, ...newPlayers]);
    }, []);

    const removePlayer = useCallback((id: string) => {
        setPlayers(prev => prev.filter(p => p.id !== id));
    }, []);

    const updatePlayer = useCallback((id: string, field: keyof PlayerRow, value: any) => {
        setPlayers(prev => prev.map(p =>
            p.id === id ? { ...p, [field]: value } : p
        ));
    }, []);

    const duplicatePlayer = useCallback((id: string) => {
        setPlayers(prev => {
            const idx = prev.findIndex(p => p.id === id);
            if (idx === -1) return prev;
            const clone = { ...prev[idx], id: crypto.randomUUID(), name: '', jerseyName: '', number: '' as any };
            const next = [...prev];
            next.splice(idx + 1, 0, clone);
            return next;
        });
    }, []);

    // Auto-generate jersey names
    const autoFillJerseyNames = useCallback(() => {
        setPlayers(prev => prev.map(p => ({
            ...p,
            jerseyName: p.jerseyName || (p.name ? p.name.split(' ').pop()?.toUpperCase() || '' : ''),
        })));
    }, []);

    // Validation
    const getValidPlayers = useCallback(() => {
        return players.filter(p => p.name.trim() && p.number !== '' && p.position);
    }, [players]);

    const getValidationErrors = useCallback(() => {
        const errors: string[] = [];
        if (mode === 'existing' && !selectedTeamId) errors.push('Select a team');
        if (mode === 'new') {
            if (!newTeamName.trim()) errors.push('Enter team name');
            if (!newUniversity.trim()) errors.push('Enter university');
            if (!newShortName.trim()) errors.push('Enter short name');
        }
        const valid = getValidPlayers();
        if (valid.length === 0) errors.push('Add at least one complete player');

        // Check for duplicate jersey numbers
        const numbers = valid.map(p => p.number);
        const dupes = numbers.filter((n, i) => numbers.indexOf(n) !== i);
        if (dupes.length > 0) errors.push(`Duplicate jersey numbers: ${[...new Set(dupes)].join(', ')}`);

        return errors;
    }, [mode, selectedTeamId, newTeamName, newUniversity, newShortName, getValidPlayers]);

    // Submit
    const handleSubmit = async () => {
        const errors = getValidationErrors();
        if (errors.length > 0) return;

        setSubmitting(true);
        setResult(null);

        const validPlayers = getValidPlayers();

        const payload: any = {
            players: validPlayers.map(p => ({
                name: p.name.trim(),
                jerseyName: p.jerseyName.trim() || undefined,
                number: Number(p.number),
                position: p.position,
                age: p.age ? Number(p.age) : undefined,
                height: p.height.trim() || undefined,
                weight: p.weight.trim() || undefined,
                nationality: p.nationality.trim() || 'Nigeria',
                college: p.college.trim() || undefined,
                department: p.department.trim() || undefined,
                email: p.email.trim() || undefined,
            })),
        };

        if (selectedCompetitionId) {
            payload.competitionId = selectedCompetitionId;
        }

        if (mode === 'existing') {
            payload.teamId = selectedTeamId;
        } else {
            payload.teamName = newTeamName.trim();
            payload.university = newUniversity.trim();
            payload.shortName = newShortName.trim();
            payload.teamColor = newTeamColor;
            payload.sport = 'Football';
        }

        try {
            const res = await fetch('/api/players/bulk-register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            setResult(data);
            setShowResult(true);

            if (data.success) {
                // Clear the form for next batch
                setPlayers([
                    createEmptyPlayer(),
                    createEmptyPlayer(),
                    createEmptyPlayer(),
                    createEmptyPlayer(),
                    createEmptyPlayer(),
                ]);
            }
        } catch (error) {
            setResult({ success: false, error: 'Network error. Please try again.' });
            setShowResult(true);
        } finally {
            setSubmitting(false);
        }
    };

    const validPlayersCount = getValidPlayers().length;
    const validationErrors = getValidationErrors();
    const selectedTeam = teams.find(t => t.id === selectedTeamId);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* ── Header ──────────────────────────────────────────── */}
            <div className="sticky top-0 z-30 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-white/60" />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                Bulk Player Registration
                            </h1>
                            <p className="text-sm text-white/40 mt-0.5">
                                Register multiple players under a university team
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                <Users className="w-4 h-4 text-indigo-400" />
                                <span className="text-sm font-medium text-indigo-300">
                                    {validPlayersCount} player{validPlayersCount !== 1 ? 's' : ''} ready
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* ── Team Selection ──────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
                >
                    <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-500/10">
                            <School className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-white">Team / University</h2>
                            <p className="text-xs text-white/40">Select existing or create new</p>
                        </div>
                    </div>

                    <div className="p-5 space-y-4">
                        {/* Mode toggle */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMode('existing')}
                                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${mode === 'existing'
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    : 'bg-white/[0.03] text-white/50 border border-white/[0.06] hover:bg-white/[0.05]'
                                    }`}
                            >
                                Existing Team
                            </button>
                            <button
                                onClick={() => setMode('new')}
                                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${mode === 'new'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'bg-white/[0.03] text-white/50 border border-white/[0.06] hover:bg-white/[0.05]'
                                    }`}
                            >
                                New Team
                            </button>
                        </div>

                        {mode === 'existing' ? (
                            <div className="space-y-3">
                                {/* Team select */}
                                <div className="relative">
                                    <select
                                        value={selectedTeamId}
                                        onChange={(e) => setSelectedTeamId(e.target.value)}
                                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                                    >
                                        <option value="" className="bg-[#151515]">Select a university team...</option>
                                        {teams.map(team => (
                                            <option key={team.id} value={team.id} className="bg-[#151515]">
                                                {team.name} ({team.shortName}) — {team.university}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                </div>

                                {selectedTeam && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                                    >
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                                            style={{ backgroundColor: selectedTeam.color + '40', borderColor: selectedTeam.color }}
                                        >
                                            {selectedTeam.shortName.slice(0, 3)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">{selectedTeam.name}</p>
                                            <p className="text-xs text-white/40">{selectedTeam.university}</p>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Competition select (optional) */}
                                <div className="relative">
                                    <select
                                        value={selectedCompetitionId}
                                        onChange={(e) => setSelectedCompetitionId(e.target.value)}
                                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
                                    >
                                        <option value="" className="bg-[#151515]">Competition (optional)...</option>
                                        {competitions.map(comp => (
                                            <option key={comp.id} value={comp.id} className="bg-[#151515]">
                                                {comp.name} ({comp.status})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="text-xs text-white/40 mb-1 block">Team Name *</label>
                                    <input
                                        type="text"
                                        value={newTeamName}
                                        onChange={(e) => setNewTeamName(e.target.value)}
                                        placeholder="e.g. Bells University"
                                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-white/40 mb-1 block">University / Location *</label>
                                    <input
                                        type="text"
                                        value={newUniversity}
                                        onChange={(e) => setNewUniversity(e.target.value)}
                                        placeholder="e.g. Ota, Ogun State"
                                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-white/40 mb-1 block">Short Name *</label>
                                    <input
                                        type="text"
                                        value={newShortName}
                                        onChange={(e) => setNewShortName(e.target.value.toUpperCase())}
                                        placeholder="e.g. BELLS"
                                        maxLength={5}
                                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 uppercase focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-white/40 mb-1 block">Team Color</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={newTeamColor}
                                            onChange={(e) => setNewTeamColor(e.target.value)}
                                            className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent"
                                        />
                                        <input
                                            type="text"
                                            value={newTeamColor}
                                            onChange={(e) => setNewTeamColor(e.target.value)}
                                            className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="relative">
                                    <label className="text-xs text-white/40 mb-1 block">Competition (optional)</label>
                                    <select
                                        value={selectedCompetitionId}
                                        onChange={(e) => setSelectedCompetitionId(e.target.value)}
                                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all"
                                    >
                                        <option value="" className="bg-[#151515]">Select competition...</option>
                                        {competitions.map(comp => (
                                            <option key={comp.id} value={comp.id} className="bg-[#151515]">
                                                {comp.name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 bottom-3 w-4 h-4 text-white/30 pointer-events-none" />
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* ── Player Roster ───────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
                >
                    <div className="p-5 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="p-2 rounded-xl bg-purple-500/10">
                                <Users className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-white">Player Roster</h2>
                                <p className="text-xs text-white/40">{players.length} slots · {validPlayersCount} complete</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={autoFillJerseyNames}
                                className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white/60 hover:bg-white/[0.08] hover:text-white transition-all flex items-center gap-1.5"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Auto-fill Jersey Names
                            </button>
                            <button
                                onClick={() => addMultiplePlayers(5)}
                                className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white/60 hover:bg-white/[0.08] hover:text-white transition-all flex items-center gap-1.5"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                +5 Rows
                            </button>
                            <button
                                onClick={addPlayer}
                                className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 hover:bg-indigo-500/20 transition-all flex items-center gap-1.5"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                Add Player
                            </button>
                        </div>
                    </div>

                    {/* Player Table / Cards */}
                    <div className="overflow-x-auto">
                        {/* Desktop table */}
                        <table className="w-full hidden lg:table">
                            <thead>
                                <tr className="border-b border-white/[0.06]">
                                    <th className="text-left text-xs text-white/30 font-medium px-4 py-3 w-8">#</th>
                                    <th className="text-left text-xs text-white/30 font-medium px-2 py-3">Name *</th>
                                    <th className="text-left text-xs text-white/30 font-medium px-2 py-3">Jersey Name</th>
                                    <th className="text-left text-xs text-white/30 font-medium px-2 py-3 w-20">No. *</th>
                                    <th className="text-left text-xs text-white/30 font-medium px-2 py-3 w-36">Position *</th>
                                    <th className="text-left text-xs text-white/30 font-medium px-2 py-3 w-20">Age</th>
                                    <th className="text-left text-xs text-white/30 font-medium px-2 py-3 w-24">Height</th>
                                    <th className="text-left text-xs text-white/30 font-medium px-2 py-3 w-24">Weight</th>
                                    <th className="text-left text-xs text-white/30 font-medium px-2 py-3">College/Faculty</th>
                                    <th className="text-left text-xs text-white/30 font-medium px-2 py-3">Dept/Course</th>
                                    <th className="text-left text-xs text-white/30 font-medium px-2 py-3">Email</th>
                                    <th className="text-left text-xs text-white/30 font-medium px-2 py-3 w-16"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {players.map((player, index) => {
                                        const isComplete = player.name.trim() && player.number !== '' && player.position;
                                        return (
                                            <motion.tr
                                                key={player.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20, height: 0 }}
                                                transition={{ delay: Math.min(index * 0.02, 0.3) }}
                                                className={`border-b border-white/[0.03] group ${isComplete ? 'bg-emerald-500/[0.02]' : ''
                                                    }`}
                                            >
                                                <td className="px-4 py-2">
                                                    <span className={`text-xs font-mono ${isComplete ? 'text-emerald-400' : 'text-white/20'}`}>
                                                        {index + 1}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="text"
                                                        value={player.name}
                                                        onChange={(e) => updatePlayer(player.id, 'name', e.target.value)}
                                                        placeholder="Full name"
                                                        className="w-full bg-transparent border-0 text-sm text-white placeholder-white/15 focus:outline-none focus:bg-white/[0.03] rounded px-2 py-1 transition-colors"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="text"
                                                        value={player.jerseyName}
                                                        onChange={(e) => updatePlayer(player.id, 'jerseyName', e.target.value.toUpperCase())}
                                                        placeholder="Auto"
                                                        className="w-full bg-transparent border-0 text-sm text-white/60 placeholder-white/15 uppercase focus:outline-none focus:bg-white/[0.03] rounded px-2 py-1 transition-colors font-mono"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        value={player.number}
                                                        onChange={(e) => updatePlayer(player.id, 'number', e.target.value ? parseInt(e.target.value) : '')}
                                                        placeholder="#"
                                                        min={1}
                                                        max={99}
                                                        className="w-full bg-transparent border-0 text-sm text-white placeholder-white/15 focus:outline-none focus:bg-white/[0.03] rounded px-2 py-1 transition-colors text-center font-mono"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <select
                                                        value={player.position}
                                                        onChange={(e) => updatePlayer(player.id, 'position', e.target.value)}
                                                        className="w-full bg-transparent border-0 text-sm text-white focus:outline-none focus:bg-white/[0.03] rounded px-2 py-1 transition-colors appearance-none"
                                                    >
                                                        <option value="" className="bg-[#151515] text-white/40">Position</option>
                                                        {POSITIONS.map(pos => (
                                                            <option key={pos} value={pos} className="bg-[#151515]">{pos}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        value={player.age}
                                                        onChange={(e) => updatePlayer(player.id, 'age', e.target.value ? parseInt(e.target.value) : '')}
                                                        placeholder="–"
                                                        min={15}
                                                        max={45}
                                                        className="w-full bg-transparent border-0 text-sm text-white/60 placeholder-white/15 focus:outline-none focus:bg-white/[0.03] rounded px-2 py-1 transition-colors text-center"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="text"
                                                        value={player.height}
                                                        onChange={(e) => updatePlayer(player.id, 'height', e.target.value)}
                                                        placeholder="e.g. 180cm"
                                                        className="w-full bg-transparent border-0 text-sm text-white/60 placeholder-white/15 focus:outline-none focus:bg-white/[0.03] rounded px-2 py-1 transition-colors"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="text"
                                                        value={player.weight}
                                                        onChange={(e) => updatePlayer(player.id, 'weight', e.target.value)}
                                                        placeholder="75kg"
                                                        className="w-full bg-transparent border-0 text-sm text-white/60 placeholder-white/15 focus:outline-none focus:bg-white/[0.03] rounded px-2 py-1 transition-colors"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="text"
                                                        value={player.college}
                                                        onChange={(e) => updatePlayer(player.id, 'college', e.target.value)}
                                                        placeholder="College/Faculty"
                                                        className="w-full bg-transparent border-0 text-sm text-white/60 placeholder-white/15 focus:outline-none focus:bg-white/[0.03] rounded px-2 py-1 transition-colors"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="text"
                                                        value={player.department}
                                                        onChange={(e) => updatePlayer(player.id, 'department', e.target.value)}
                                                        placeholder="Dept/Course"
                                                        className="w-full bg-transparent border-0 text-sm text-white/60 placeholder-white/15 focus:outline-none focus:bg-white/[0.03] rounded px-2 py-1 transition-colors"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="email"
                                                        value={player.email}
                                                        onChange={(e) => updatePlayer(player.id, 'email', e.target.value)}
                                                        placeholder="email@uni.edu"
                                                        className="w-full bg-transparent border-0 text-sm text-white/60 placeholder-white/15 focus:outline-none focus:bg-white/[0.03] rounded px-2 py-1 transition-colors"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => duplicatePlayer(player.id)}
                                                            className="p-1 rounded hover:bg-white/[0.05] text-white/30 hover:text-white/60 transition-colors"
                                                            title="Duplicate row"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => removePlayer(player.id)}
                                                            className="p-1 rounded hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"
                                                            title="Remove"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>

                        {/* Mobile cards */}
                        <div className="lg:hidden space-y-3 p-4">
                            <AnimatePresence>
                                {players.map((player, index) => {
                                    const isComplete = player.name.trim() && player.number !== '' && player.position;
                                    return (
                                        <motion.div
                                            key={player.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className={`rounded-xl border p-4 space-y-3 ${isComplete
                                                ? 'bg-emerald-500/[0.03] border-emerald-500/10'
                                                : 'bg-white/[0.02] border-white/[0.06]'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className={`text-xs font-mono px-2 py-0.5 rounded ${isComplete ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/30'
                                                    }`}>
                                                    #{index + 1}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => duplicatePlayer(player.id)}
                                                        className="p-1.5 rounded-lg hover:bg-white/5 text-white/30"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => removePlayer(player.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="col-span-2">
                                                    <input
                                                        type="text"
                                                        value={player.name}
                                                        onChange={(e) => updatePlayer(player.id, 'name', e.target.value)}
                                                        placeholder="Full Name *"
                                                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={player.jerseyName}
                                                    onChange={(e) => updatePlayer(player.id, 'jerseyName', e.target.value.toUpperCase())}
                                                    placeholder="Jersey Name"
                                                    className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/60 placeholder-white/20 uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500/40 font-mono"
                                                />
                                                <input
                                                    type="number"
                                                    value={player.number}
                                                    onChange={(e) => updatePlayer(player.id, 'number', e.target.value ? parseInt(e.target.value) : '')}
                                                    placeholder="Jersey # *"
                                                    min={1}
                                                    max={99}
                                                    className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 text-center font-mono"
                                                />
                                                <select
                                                    value={player.position}
                                                    onChange={(e) => updatePlayer(player.id, 'position', e.target.value)}
                                                    className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/40 appearance-none"
                                                >
                                                    <option value="" className="bg-[#151515]">Position *</option>
                                                    {POSITIONS.map(pos => (
                                                        <option key={pos} value={pos} className="bg-[#151515]">{pos}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="number"
                                                    value={player.age}
                                                    onChange={(e) => updatePlayer(player.id, 'age', e.target.value ? parseInt(e.target.value) : '')}
                                                    placeholder="Age"
                                                    min={15}
                                                    max={45}
                                                    className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/60 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 text-center"
                                                />
                                                <input
                                                    type="text"
                                                    value={player.height}
                                                    onChange={(e) => updatePlayer(player.id, 'height', e.target.value)}
                                                    placeholder="Height"
                                                    className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/60 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                                                />
                                                <input
                                                    type="text"
                                                    value={player.weight}
                                                    onChange={(e) => updatePlayer(player.id, 'weight', e.target.value)}
                                                    placeholder="Weight"
                                                    className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/60 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                                                />
                                                <input
                                                    type="text"
                                                    value={player.college}
                                                    onChange={(e) => updatePlayer(player.id, 'college', e.target.value)}
                                                    placeholder="College/Faculty/School"
                                                    className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/60 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                                                />
                                                <input
                                                    type="text"
                                                    value={player.department}
                                                    onChange={(e) => updatePlayer(player.id, 'department', e.target.value)}
                                                    placeholder="Dept/Course/Program"
                                                    className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/60 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                                                />
                                                <input
                                                    type="email"
                                                    value={player.email}
                                                    onChange={(e) => updatePlayer(player.id, 'email', e.target.value)}
                                                    placeholder="Email (multi-sport link)"
                                                    className="col-span-2 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/60 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                                                />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>

                            <button
                                onClick={addPlayer}
                                className="w-full py-3 rounded-xl border-2 border-dashed border-white/[0.08] text-white/30 hover:border-indigo-500/30 hover:text-indigo-400 transition-colors flex items-center justify-center gap-2 text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Add Player
                            </button>
                        </div>
                    </div>

                    {/* Add more row for desktop */}
                    <div className="hidden lg:block border-t border-white/[0.04] p-3">
                        <button
                            onClick={addPlayer}
                            className="w-full py-2.5 rounded-xl border-2 border-dashed border-white/[0.06] text-white/20 hover:border-indigo-500/30 hover:text-indigo-400 transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Another Player Row
                        </button>
                    </div>
                </motion.div>

                {/* ── Submit Section ──────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5"
                >
                    {/* Validation errors */}
                    {validationErrors.length > 0 && (
                        <div className="mb-4 p-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/10">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                <div className="space-y-1">
                                    {validationErrors.map((err, i) => (
                                        <p key={i} className="text-xs text-amber-300/80">{err}</p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex-1 text-center sm:text-left">
                            <p className="text-sm text-white/60">
                                Ready to register <span className="font-semibold text-white">{validPlayersCount}</span> player{validPlayersCount !== 1 ? 's' : ''}
                                {mode === 'existing' && selectedTeam ? (
                                    <> for <span className="font-semibold text-white">{selectedTeam.name}</span></>
                                ) : mode === 'new' && newTeamName ? (
                                    <> for <span className="font-semibold text-white">{newTeamName}</span></>
                                ) : null}
                            </p>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting || validationErrors.length > 0}
                            className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${submitting || validationErrors.length > 0
                                ? 'bg-white/[0.05] text-white/20 cursor-not-allowed'
                                : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30'
                                }`}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Registering...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    Register {validPlayersCount} Player{validPlayersCount !== 1 ? 's' : ''}
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* ── Result Modal ────────────────────────────────────── */}
            <AnimatePresence>
                {showResult && result && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowResult(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full max-w-lg rounded-2xl bg-[#111] border border-white/[0.08] overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className={`p-6 text-center ${result.success ? 'bg-emerald-500/[0.05]' : 'bg-red-500/[0.05]'
                                }`}>
                                <div className={`inline-flex p-3 rounded-full mb-3 ${result.success ? 'bg-emerald-500/10' : 'bg-red-500/10'
                                    }`}>
                                    {result.success ? (
                                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                    ) : (
                                        <AlertCircle className="w-8 h-8 text-red-400" />
                                    )}
                                </div>
                                <h3 className={`text-lg font-semibold ${result.success ? 'text-emerald-300' : 'text-red-300'
                                    }`}>
                                    {result.success ? 'Registration Successful!' : 'Registration Failed'}
                                </h3>
                                <p className="text-sm text-white/50 mt-1">{result.message || result.error}</p>
                            </div>

                            {result.success && (
                                <div className="p-5 space-y-4">
                                    {/* Summary */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/10 text-center">
                                            <p className="text-2xl font-bold text-emerald-400">{result.created}</p>
                                            <p className="text-xs text-white/40">Registered</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/10 text-center">
                                            <p className="text-2xl font-bold text-amber-400">{result.skipped}</p>
                                            <p className="text-xs text-white/40">Skipped</p>
                                        </div>
                                    </div>

                                    {/* Created players list */}
                                    {result.createdPlayers && result.createdPlayers.length > 0 && (
                                        <div>
                                            <p className="text-xs text-white/40 mb-2">Created Players:</p>
                                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                                {result.createdPlayers.map(p => (
                                                    <div key={p.id} className="flex items-center gap-2 text-xs">
                                                        <span className="text-emerald-400">✓</span>
                                                        <span className="font-mono text-white/40">#{p.number}</span>
                                                        <span className="text-white/70">{p.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Skipped players */}
                                    {result.skippedPlayers && result.skippedPlayers.length > 0 && (
                                        <div>
                                            <p className="text-xs text-white/40 mb-2">Skipped Players:</p>
                                            <div className="space-y-1">
                                                {result.skippedPlayers.map((p, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-xs">
                                                        <span className="text-amber-400">⚠</span>
                                                        <span className="font-mono text-white/40">#{p.number}</span>
                                                        <span className="text-white/70">{p.name}</span>
                                                        <span className="text-white/30">— {p.reason}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="p-4 border-t border-white/[0.06] flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowResult(false)}
                                    className="px-4 py-2 rounded-xl bg-white/[0.05] text-sm text-white/60 hover:bg-white/[0.08] transition-colors"
                                >
                                    {result.success ? 'Register More' : 'Try Again'}
                                </button>
                                {result.success && (
                                    <button
                                        onClick={() => router.push('/admin')}
                                        className="px-4 py-2 rounded-xl bg-indigo-500/20 text-sm text-indigo-300 hover:bg-indigo-500/30 transition-colors"
                                    >
                                        Back to Admin
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
