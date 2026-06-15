'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft, Layers, Plus, X, Search, Loader2,
    CheckCircle, AlertCircle, SkipForward, AlertTriangle,
    Users, Info, Upload, Pencil, Save, XCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import ErrorBoundary from '@/components/admin/ErrorBoundary';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    university: string;
    sport: string;
    gender: string;
    color: string;
}

interface RosterPlayer {
    affiliationId: string;
    playerId: string;
    name: string;
    jerseyName: string | null;
    position: string | null;
    jerseyNumber: number | null;
    affiliationType: string;
    isPrimary: boolean | null;
    isActive: boolean | null;
    nicknames: string[];
    college: string | null;
    university: string;
}

interface PlayerSearchResult {
    id: string;
    name: string;
    jerseyName: string | null;
    position: string;
    college: string | null;
    university: string;
    currentTeams: { teamId: string; teamName: string; shortName: string; sport: string }[];
    matchedOn: 'name' | 'jerseyName' | 'nickname';
}

interface EntryResult {
    index: number;
    mode: 'existing' | 'new';
    status: 'inserted' | 'skipped' | 'error';
    reason?: string;
    matchedPlayerId?: string;
}

type EntryMode = 'existing' | 'new';

interface EntryRow {
    rowId: string;
    mode: EntryMode;
    // existing mode
    searchQuery: string;
    searchResults: PlayerSearchResult[];
    isSearching: boolean;
    selectedPlayer: PlayerSearchResult | null;
    overrideJerseyNumber: string;
    overridePosition: string;
    // new mode
    newName: string;
    newJerseyName: string;
    newNumber: string;
    newPosition: string;
    newCollege: string;
    newUniversity: string;
    newNicknames: string;
    // submit result
    result: EntryResult | null;
}

// ─── CSV Import Types ──────────────────────────────────────────────────────────

type CSVRaw = {
    name: string;
    jerseyNumber: string;
    position: string;
};

type MatchResult =
    | { type: 'high'; player: RosterPlayer }
    | { type: 'medium'; player: RosterPlayer }
    | { type: 'none' };

type Resolution =
    | { mode: 'existing'; playerId: string }
    | { mode: 'new' }
    | { mode: 'pending' };

type CSVPreviewRow = {
    index: number;
    raw: CSVRaw;
    match: MatchResult;
    resolution: Resolution;
    positionValid: boolean;
    linkSearch: string;
};

// ─── Squad Types ──────────────────────────────────────────────────────────────

type SquadPlayer = {
    squadPlayerId: string;
    playerId: string;
    name: string;
    jerseyName: string | null;
    position: string;
    role: string;
    status: string;
    squadNumber: number | null;
};

type TeamCompetition = {
    id: string;
    name: string;
    sport: string | null;
    status: string;
    season: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRow(): EntryRow {
    return {
        rowId: Math.random().toString(36).slice(2),
        mode: 'existing',
        searchQuery: '',
        searchResults: [],
        isSearching: false,
        selectedPlayer: null,
        overrideJerseyNumber: '',
        overridePosition: '',
        newName: '',
        newJerseyName: '',
        newNumber: '',
        newPosition: '',
        newCollege: '',
        newUniversity: 'Bells University of Technology',
        newNicknames: '',
        result: null,
    };
}

function InitialsAvatar({ name, color, size = 'md' }: { name: string; color: string; size?: 'sm' | 'md' }) {
    const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const cls = size === 'sm' ? 'w-10 h-10 text-sm rounded-xl' : 'w-14 h-14 text-lg rounded-2xl';
    return (
        <div
            className={`${cls} flex items-center justify-center font-display font-black text-white shrink-0`}
            style={{ backgroundColor: color || '#1a1a1a' }}
        >
            {initials}
        </div>
    );
}

function AffiliationBadge({ type }: { type: string }) {
    const map: Record<string, string> = {
        college: 'bg-blue-500/20 text-blue-400',
        university: 'bg-purple-500/20 text-purple-400',
        club: 'bg-primary/20 text-primary',
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${map[type] ?? 'bg-white/10 text-white/40'}`}>
            {type}
        </span>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EntryRowUI({
    row,
    index,
    teamId,
    submitted,
    onChange,
    onRemove,
}: {
    row: EntryRow;
    index: number;
    teamId: string;
    submitted: boolean;
    onChange: (patch: Partial<EntryRow>) => void;
    onRemove: () => void;
}) {
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearchChange = useCallback(
        (q: string) => {
            onChange({ searchQuery: q, selectedPlayer: null, searchResults: [] });
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (q.length < 2) return;
            onChange({ isSearching: true });
            debounceRef.current = setTimeout(async () => {
                try {
                    const res = await fetch(
                        `/api/players/search?q=${encodeURIComponent(q)}&excludeTeamId=${teamId}`,
                    );
                    if (res.ok) {
                        const data = await res.json();
                        onChange({ searchResults: data.players ?? [], isSearching: false });
                    } else {
                        onChange({ isSearching: false });
                    }
                } catch {
                    onChange({ isSearching: false });
                }
            }, 300);
        },
        [teamId, onChange],
    );

    const resultIcon = row.result?.status === 'inserted'
        ? <CheckCircle size={16} className="text-green-400" />
        : row.result?.status === 'skipped'
        ? <SkipForward size={16} className="text-yellow-400" />
        : row.result?.status === 'error'
        ? <AlertCircle size={16} className="text-red-400" />
        : null;

    return (
        <div className={`relative rounded-2xl border p-5 space-y-4 transition-colors ${
            row.result?.status === 'inserted' ? 'border-green-500/30 bg-green-500/5'
            : row.result?.status === 'skipped' ? 'border-yellow-500/30 bg-yellow-500/5'
            : row.result?.status === 'error' ? 'border-red-500/30 bg-red-500/5'
            : 'border-white/10 bg-white/[0.02]'
        }`}>
            {/* Row header */}
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
                    Player {index + 1}
                </span>
                <div className="flex items-center gap-3">
                    {resultIcon && (
                        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase">
                            {resultIcon}
                            <span className={
                                row.result?.status === 'inserted' ? 'text-green-400'
                                : row.result?.status === 'skipped' ? 'text-yellow-400'
                                : 'text-red-400'
                            }>
                                {row.result?.status === 'inserted' ? 'Added'
                                    : row.result?.status === 'skipped' ? `Skipped${row.result.reason ? ` — ${row.result.reason.replace(/_/g, ' ')}` : ''}`
                                    : `Error${row.result?.reason ? ` — ${row.result.reason}` : ''}`}
                            </span>
                        </span>
                    )}
                    {!submitted && (
                        <button
                            onClick={onRemove}
                            className="p-1.5 hover:bg-white/5 rounded-xl transition-colors text-white/30 hover:text-white"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Mode toggle */}
            {!submitted && (
                <div className="flex gap-2">
                    {(['existing', 'new'] as EntryMode[]).map((m) => (
                        <button
                            key={m}
                            onClick={() => onChange({ mode: m, selectedPlayer: null, searchQuery: '', searchResults: [] })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase italic tracking-widest transition-all border ${
                                row.mode === m
                                    ? 'bg-primary text-black border-transparent'
                                    : 'bg-white/5 text-white/40 border-white/10 hover:text-white'
                            }`}
                        >
                            {m === 'existing' ? 'Existing Player' : 'New Player'}
                        </button>
                    ))}
                </div>
            )}

            {/* Existing mode */}
            {row.mode === 'existing' && (
                <div className="space-y-3">
                    {row.selectedPlayer ? (
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                            <div>
                                <div className="font-bold text-sm">{row.selectedPlayer.name}</div>
                                <div className="text-[10px] text-white/40 uppercase tracking-wide">
                                    {row.selectedPlayer.position} · {row.selectedPlayer.college ?? row.selectedPlayer.university}
                                </div>
                            </div>
                            {!submitted && (
                                <button
                                    onClick={() => onChange({ selectedPlayer: null, searchQuery: '', searchResults: [] })}
                                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/30 hover:text-white transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                            {row.isSearching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 animate-spin" size={14} />
                            )}
                            <input
                                type="text"
                                placeholder="Search by name, jersey name, or nickname..."
                                value={row.searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-9 py-3 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                                disabled={submitted}
                            />
                            {row.searchResults.length > 0 && !row.selectedPlayer && (
                                <div className="absolute z-20 top-full mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                                    {row.searchResults.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => onChange({
                                                selectedPlayer: p,
                                                searchQuery: p.name,
                                                searchResults: [],
                                                overridePosition: p.position,
                                            })}
                                            className="w-full flex items-start justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                                        >
                                            <div>
                                                <div className="font-bold text-sm">{p.name}</div>
                                                <div className="text-[10px] text-white/40 uppercase tracking-wide mt-0.5">
                                                    {p.position}
                                                    {p.college ? ` · ${p.college}` : ''}
                                                    {p.currentTeams.length > 0
                                                        ? ` · ${p.currentTeams.map((t) => t.shortName).join(', ')}`
                                                        : ' · No current team'}
                                                </div>
                                            </div>
                                            <span className={`shrink-0 ml-3 px-1.5 py-0.5 text-[9px] font-black rounded uppercase ${
                                                p.matchedOn === 'nickname'
                                                    ? 'bg-yellow-500/20 text-yellow-400'
                                                    : 'bg-primary/20 text-primary'
                                            }`}>
                                                {p.matchedOn}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {row.selectedPlayer?.matchedOn === 'nickname' && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                            <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
                            <p className="text-[10px] font-bold text-yellow-300">
                                Matched via nickname — verify this is the correct player
                            </p>
                        </div>
                    )}

                    {row.selectedPlayer && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">
                                    Jersey # (optional)
                                </label>
                                <input
                                    type="number"
                                    value={row.overrideJerseyNumber}
                                    onChange={(e) => onChange({ overrideJerseyNumber: e.target.value })}
                                    placeholder="—"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                                    disabled={submitted}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">
                                    Position (optional)
                                </label>
                                <input
                                    type="text"
                                    value={row.overridePosition}
                                    onChange={(e) => onChange({ overridePosition: e.target.value })}
                                    placeholder={row.selectedPlayer?.position ?? '—'}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                                    disabled={submitted}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* New mode */}
            {row.mode === 'new' && (
                <div className="space-y-3">
                    {row.result?.status === 'skipped' && row.result.reason === 'possible_duplicate' && (
                        <div className="flex items-start gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                            <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                            <div className="text-[10px] font-bold text-yellow-300">
                                Similar player found in DB (ID: {row.result.matchedPlayerId?.slice(0, 8)}).
                                Switch to &quot;Existing Player&quot; to link them instead.
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">
                                Full Name *
                            </label>
                            <input
                                type="text"
                                value={row.newName}
                                onChange={(e) => onChange({ newName: e.target.value })}
                                placeholder="e.g. Chukwuemeka Obi"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                                disabled={submitted}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">
                                Jersey Name
                            </label>
                            <input
                                type="text"
                                value={row.newJerseyName}
                                onChange={(e) => onChange({ newJerseyName: e.target.value })}
                                placeholder="e.g. OBI"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                                disabled={submitted}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">
                                Jersey # *
                            </label>
                            <input
                                type="number"
                                value={row.newNumber}
                                onChange={(e) => onChange({ newNumber: e.target.value })}
                                placeholder="10"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                                disabled={submitted}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">
                                Position *
                            </label>
                            <select
                                value={row.newPosition}
                                onChange={(e) => onChange({ newPosition: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all appearance-none"
                                disabled={submitted}
                            >
                                <option value="">Select position...</option>
                                <option value="GK">GK — Goalkeeper</option>
                                <option value="CB">CB — Centre Back</option>
                                <option value="LB">LB — Left Back</option>
                                <option value="RB">RB — Right Back</option>
                                <option value="CM">CM — Centre Mid</option>
                                <option value="DM">DM — Defensive Mid</option>
                                <option value="AM">AM — Attacking Mid</option>
                                <option value="LW">LW — Left Wing</option>
                                <option value="RW">RW — Right Wing</option>
                                <option value="ST">ST — Striker</option>
                                <option value="CF">CF — Centre Forward</option>
                                <option value="FWD">FWD — Forward</option>
                                <option value="MID">MID — Midfielder</option>
                                <option value="DEF">DEF — Defender</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">
                                College
                            </label>
                            <input
                                type="text"
                                value={row.newCollege}
                                onChange={(e) => onChange({ newCollege: e.target.value })}
                                placeholder="e.g. COLENG"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                                disabled={submitted}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">
                                University
                            </label>
                            <input
                                type="text"
                                value={row.newUniversity}
                                onChange={(e) => onChange({ newUniversity: e.target.value })}
                                placeholder="Bells University of Technology"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                                disabled={submitted}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">
                            Nicknames / Field Names
                        </label>
                        <input
                            type="text"
                            value={row.newNicknames}
                            onChange={(e) => onChange({ newNicknames: e.target.value })}
                            placeholder="e.g. Blacko, No.9, Small (comma-separated)"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary/50 transition-all"
                            disabled={submitted}
                        />
                        <p className="text-[9px] text-white/20 mt-1 font-bold">
                            Field aliases used by loggers during live matches
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function TeamDetailContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const teamId = params.id as string;

    const [team, setTeam] = useState<Team | null>(null);
    const [roster, setRoster] = useState<RosterPlayer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'roster' | 'csv' | 'squad' | 'info'>('roster');

    // Add-players panel
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [entries, setEntries] = useState<EntryRow[]>([makeRow()]);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // CSV Import
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvRows, setCsvRows] = useState<CSVPreviewRow[]>([]);
    const [csvImporting, setCsvImporting] = useState(false);
    const [csvResults, setCsvResults] = useState<EntryResult[] | null>(null);

    // Squad
    const [editingAffiliationId, setEditingAffiliationId] = useState<string | null>(null);
    const [affiliationForm, setAffiliationForm] = useState<{
        jerseyNumber: string;
        position: string;
        nicknames: string;
    }>({ jerseyNumber: '', position: '', nicknames: '' });
    const [affiliationSaving, setAffiliationSaving] = useState(false);

    const [squadCompetitions, setSquadCompetitions] = useState<TeamCompetition[]>([]);
    const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);
    const [squad, setSquad] = useState<SquadPlayer[]>([]);
    const [squadLoading, setSquadLoading] = useState(false);
    const [squadSaving, setSquadSaving] = useState(false);
    const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);

    const { toasts, removeToast, success, error: showError } = useToast();

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace(`/login?callbackUrl=/admin/teams/${teamId}`);
        }
    }, [user, authLoading, router, teamId]);

    useEffect(() => {
        const load = async () => {
            try {
                const [teamRes, rosterRes] = await Promise.all([
                    fetch(`/api/teams/${teamId}`),
                    fetch(`/api/admin/teams/${teamId}/roster`),
                ]);
                fetchSquadCompetitions();
                if (teamRes.ok) {
                    const data = await teamRes.json();
                    setTeam(data.team ?? data);
                }
                if (rosterRes.ok) {
                    const data = await rosterRes.json();
                    setRoster(data.roster ?? []);
                }
            } catch {
                showError('Failed to load team data');
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [teamId]);

    useEffect(() => {
        if (selectedCompetitionId) {
            fetchSquad(selectedCompetitionId);
        }
    }, [selectedCompetitionId]);

    const updateEntry = useCallback((rowId: string, patch: Partial<EntryRow>) => {
        setEntries((prev) => prev.map((r) => r.rowId === rowId ? { ...r, ...patch } : r));
    }, []);

    const removeEntry = useCallback((rowId: string) => {
        setEntries((prev) => prev.filter((r) => r.rowId !== rowId));
    }, []);

    const handleSubmit = async () => {
        const apiEntries = entries.map((row) => {
            if (row.mode === 'existing') {
                if (!row.selectedPlayer) return null;
                return {
                    mode: 'existing' as const,
                    playerId: row.selectedPlayer.id,
                    jerseyNumber: row.overrideJerseyNumber ? parseInt(row.overrideJerseyNumber, 10) : undefined,
                    position: row.overridePosition || undefined,
                };
            } else {
                const nicknames = row.newNicknames
                    ? row.newNicknames.split(',').map((n) => n.trim()).filter(Boolean)
                    : [];
                return {
                    mode: 'new' as const,
                    name: row.newName,
                    jerseyName: row.newJerseyName || undefined,
                    number: parseInt(row.newNumber, 10),
                    position: row.newPosition,
                    college: row.newCollege || undefined,
                    university: row.newUniversity || 'Bells University of Technology',
                    nicknames,
                };
            }
        });

        const validEntries = apiEntries.filter(Boolean);
        if (validEntries.length === 0) {
            showError('No valid entries to submit');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`/api/admin/teams/${teamId}/roster`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries: validEntries }),
            });

            const data = await res.json();

            if (!res.ok) {
                showError(data.error ?? 'Submission failed');
                return;
            }

            const results: EntryResult[] = data.results ?? [];

            // Map results back to rows by index
            let resultIndex = 0;
            setEntries((prev) =>
                prev.map((row) => {
                    const apiEntry = apiEntries[prev.indexOf(row)];
                    if (!apiEntry) return row;
                    const result = results[resultIndex++] ?? null;
                    return { ...row, result };
                }),
            );

            setSubmitted(true);

            const { inserted, skipped, errors } = data.summary ?? {};
            if (inserted > 0) {
                success(`${inserted} player${inserted !== 1 ? 's' : ''} added${skipped > 0 ? `, ${skipped} skipped` : ''}`);
                // Refresh roster
                const rosterRes = await fetch(`/api/admin/teams/${teamId}/roster`);
                if (rosterRes.ok) {
                    const rosterData = await rosterRes.json();
                    setRoster(rosterData.roster ?? []);
                }
            } else if (errors > 0) {
                showError(`All ${errors} entries failed — check details below`);
            } else {
                success(`${skipped} entry${skipped !== 1 ? 'entries' : ''} skipped (already affiliated or duplicate)`);
            }
        } catch {
            showError('Network error — please try again');
        } finally {
            setSubmitting(false);
        }
    };

    const updateCsvRow = (index: number, patch: Partial<CSVPreviewRow>) => {
        setCsvRows((prev) => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
    };

    function parseAndMatchCSV(file: File) {
        const VALID_POSITIONS = [
            'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB',
            'CDM', 'CM', 'CAM', 'LM', 'RM',
            'LW', 'RW', 'CF', 'ST', 'SS',
            'PG', 'SG', 'SF', 'PF', 'C',
            'Forward', 'Midfielder', 'Defender', 'Goalkeeper',
            'DM', 'AM', 'FWD', 'MID', 'DEF',
        ];

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean);

            // Skip header if second column of first row is non-numeric
            const firstSecondCol = lines[0]?.split(',')[1]?.trim();
            const dataLines =
                firstSecondCol && isNaN(Number(firstSecondCol))
                    ? lines.slice(1)
                    : lines;

            const rows: CSVPreviewRow[] = dataLines.map((line, i) => {
                const parts = line.split(',').map((p) => p.trim());
                const raw: CSVRaw = {
                    name: parts[0] ?? '',
                    jerseyNumber: parts[1] ?? '',
                    position: parts[2] ?? '',
                };

                const nameLower = raw.name.toLowerCase();
                let match: MatchResult = { type: 'none' };

                // Priority: exact name → jerseyName → nickname
                const exactName = roster.find(
                    (p) => p.name.toLowerCase() === nameLower,
                );
                if (exactName) {
                    match = { type: 'high', player: exactName };
                } else {
                    const jerseyMatch = roster.find(
                        (p) => p.jerseyName?.toLowerCase() === nameLower,
                    );
                    if (jerseyMatch) {
                        match = { type: 'medium', player: jerseyMatch };
                    } else {
                        // nicknames is already string[] after roster fetch
                        const nicknameMatch = roster.find((p) =>
                            p.nicknames.some(
                                (n) => n.toLowerCase() === nameLower,
                            ),
                        );
                        if (nicknameMatch) {
                            match = { type: 'medium', player: nicknameMatch };
                        }
                    }
                }

                // Auto-resolve: high → existing, none → new, medium → pending
                const resolution: Resolution =
                    match.type === 'high'
                        ? { mode: 'existing', playerId: match.player.playerId }
                        : match.type === 'none'
                        ? { mode: 'new' }
                        : { mode: 'pending' };

                const positionValid =
                    raw.position.length > 0 &&
                    VALID_POSITIONS.map((p) => p.toLowerCase()).includes(
                        raw.position.toLowerCase(),
                    );

                return { index: i, raw, match, resolution, positionValid, linkSearch: '' };
            });

            setCsvRows(rows);
        };
        reader.readAsText(file);
    }

    async function handleCSVImport() {
        const hasBlockers = csvRows.some(
            (r) =>
                r.resolution.mode === 'pending' ||
                (r.resolution.mode === 'new' && !r.positionValid),
        );
        if (hasBlockers) return;

        setCsvImporting(true);
        setCsvResults(null);

        const entries = csvRows.map((r) => {
            if (r.resolution.mode === 'existing') {
                return {
                    mode: 'existing' as const,
                    playerId: r.resolution.playerId,
                    jerseyNumber: Number(r.raw.jerseyNumber) || undefined,
                    position: r.raw.position || undefined,
                };
            } else {
                return {
                    mode: 'new' as const,
                    name: r.raw.name,
                    number: Number(r.raw.jerseyNumber) || 0,
                    position: r.raw.position,
                };
            }
        });

        try {
            const res = await fetch(`/api/admin/teams/${teamId}/roster`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries }),
            });
            const data = await res.json();
            if (!res.ok) {
                showError(data.error ?? 'Import failed');
                return;
            }
            setCsvResults(data.results ?? []);
            const { inserted, skipped } = data.summary ?? {};
            if (inserted > 0) {
                success(`${inserted} player${inserted !== 1 ? 's' : ''} added${skipped > 0 ? `, ${skipped} skipped` : ''}`);
            }
            // Refresh roster
            const rosterRes = await fetch(`/api/admin/teams/${teamId}/roster`);
            if (rosterRes.ok) {
                const rosterData = await rosterRes.json();
                setRoster(rosterData.roster ?? []);
            }
        } catch {
            showError('Network error — please try again');
        } finally {
            setCsvImporting(false);
        }
    }

    const resetPanel = () => {
        setEntries([makeRow()]);
        setSubmitted(false);
        setShowAddPanel(false);
    };

    async function fetchSquadCompetitions() {
        const res = await fetch(`/api/admin/teams/${teamId}/competitions`);
        if (!res.ok) return;
        const data = await res.json();
        setSquadCompetitions(data.competitions);
        if (data.competitions.length === 1) {
            setSelectedCompetitionId(data.competitions[0].id);
        }
    }

    async function fetchSquad(competitionId: string) {
        setSquadLoading(true);
        const res = await fetch(
            `/api/admin/teams/${teamId}/squad?competitionId=${competitionId}`,
        );
        if (res.ok) {
            const data = await res.json();
            setSquad(data.squad);
        }
        setSquadLoading(false);
    }

    async function handleAddToSquad(playerId: string) {
        if (!selectedCompetitionId) return;
        setSquadSaving(true);
        const res = await fetch(`/api/admin/teams/${teamId}/squad`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                competitionId: selectedCompetitionId,
                playerIds: [playerId],
            }),
        });
        if (res.ok) {
            await fetchSquad(selectedCompetitionId);
        }
        setSquadSaving(false);
    }

    async function handleSaveAffiliation(affiliationId: string) {
        setAffiliationSaving(true);
        const body: Record<string, unknown> = {};

        if (affiliationForm.jerseyNumber !== '') {
            body.jerseyNumber = Number(affiliationForm.jerseyNumber) || null;
        }
        if (affiliationForm.position !== '') {
            body.position = affiliationForm.position;
        }
        body.nicknames = affiliationForm.nicknames
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean);

        const res = await fetch(`/api/admin/teams/${teamId}/roster/${affiliationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (res.ok) {
            const rosterRes = await fetch(`/api/admin/teams/${teamId}/roster`);
            if (rosterRes.ok) {
                const data = await rosterRes.json();
                setRoster(data.roster ?? []);
            }
            setEditingAffiliationId(null);
        }
        setAffiliationSaving(false);
    }

    async function handleRemoveFromSquad(squadPlayerId: string) {
        if (!selectedCompetitionId) return;
        setSquadSaving(true);
        const res = await fetch(
            `/api/admin/teams/${teamId}/squad/${squadPlayerId}`,
            { method: 'DELETE' },
        );
        if (res.ok) {
            setSquad((prev) => prev.filter((p) => p.squadPlayerId !== squadPlayerId));
        }
        setConfirmingRemove(null);
        setSquadSaving(false);
    }

    const squadPlayerIds = new Set(squad.map((p) => p.playerId));
    const availablePlayers = roster.filter((p) => !squadPlayerIds.has(p.playerId));
    const availableCount = availablePlayers.length;

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        );
    }

    if (!team) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
                <p className="text-white/40 font-bold uppercase tracking-widest text-sm">Team not found</p>
                <Link href="/admin/teams" className="text-primary underline text-sm font-bold">
                    Back to Teams
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-primary selection:text-black">
            <ToastContainer toasts={toasts} onClose={removeToast} />

            {/* Header */}
            <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5 py-4 md:py-5 px-4 md:px-8">
                <div className="max-w-5xl mx-auto flex items-center gap-4">
                    <Link
                        href="/admin/teams"
                        className="p-2 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10 group shrink-0"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    </Link>

                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        {team.logo && team.logo !== '' ? (
                            <img
                                src={team.logo}
                                alt={team.name}
                                className="w-12 h-12 rounded-2xl object-contain bg-white/5 shrink-0"
                            />
                        ) : (
                            <InitialsAvatar name={team.name} color={team.color} size="sm" />
                        )}
                        <div className="min-w-0">
                            <h1 className="text-lg md:text-xl font-display font-black uppercase italic tracking-tighter truncate">
                                {team.name}
                            </h1>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                                    {team.university}
                                </span>
                                <span className="px-2 py-0.5 bg-primary/20 text-primary text-[9px] font-black rounded uppercase tracking-wider">
                                    {team.sport}
                                </span>
                                <span className="px-2 py-0.5 bg-white/10 text-white/50 text-[9px] font-black rounded uppercase tracking-wider">
                                    {team.shortName}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-4 md:p-8">
                {/* Tabs */}
                <div className="flex gap-2 mb-8 flex-wrap">
                    {(['roster', 'squad', 'csv', 'info'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black uppercase italic text-[10px] tracking-widest transition-all border ${
                                activeTab === tab
                                    ? 'bg-primary text-black border-transparent'
                                    : 'bg-white/5 text-white/40 border-white/10 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            {tab === 'roster' ? <Users size={14} />
                                : tab === 'csv' ? <Upload size={14} />
                                : tab === 'squad' ? <Layers size={14} />
                                : <Info size={14} />}
                            {tab === 'roster' ? `Roster (${roster.length})`
                                : tab === 'csv' ? 'CSV Import'
                                : tab === 'squad' ? 'Squad'
                                : 'Info'}
                        </button>
                    ))}
                </div>

                {/* ── ROSTER TAB ─────────────────────────────────────────── */}
                {activeTab === 'roster' && (
                    <div className="space-y-8">
                        {/* Current roster */}
                        <section>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-4">
                                Full Squad
                            </h2>

                            {roster.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 bg-white/[0.02] rounded-[2rem] border border-white/5 gap-4">
                                    <Users size={40} className="text-white/10" />
                                    <p className="text-white/30 text-xs font-bold uppercase tracking-widest">
                                        No players rostered yet
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-white/5">
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">#</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">Name</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">Position</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">Jersey</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">Type</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">Primary</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">Nicknames</th>
                                                    <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {roster.map((p, i) => {
                                                    const isEditing = editingAffiliationId === p.affiliationId;
                                                    return (
                                                        <tr key={p.affiliationId} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                                            <td className="px-6 py-4 text-white/30 font-bold text-sm">{i + 1}</td>
                                                            <td className="px-6 py-4">
                                                                <div className="font-bold text-sm">{p.name}</div>
                                                                {p.jerseyName && (
                                                                    <div className="text-[10px] text-white/30 font-bold uppercase">{p.jerseyName}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm font-bold text-white/60">
                                                                {isEditing ? (
                                                                    <input
                                                                        value={affiliationForm.position}
                                                                        onChange={(e) => setAffiliationForm((f) => ({ ...f, position: e.target.value }))}
                                                                        placeholder="e.g. CB"
                                                                        className="w-20 bg-transparent border-b border-white/30 text-sm outline-none"
                                                                    />
                                                                ) : (
                                                                    p.position ?? '—'
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        value={affiliationForm.jerseyNumber}
                                                                        onChange={(e) => setAffiliationForm((f) => ({ ...f, jerseyNumber: e.target.value }))}
                                                                        placeholder="—"
                                                                        className="w-12 bg-transparent border-b border-white/30 text-sm outline-none"
                                                                    />
                                                                ) : p.jerseyNumber != null ? (
                                                                    <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-black rounded uppercase">
                                                                        #{p.jerseyNumber}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-white/20 text-sm">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <AffiliationBadge type={p.affiliationType} />
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {p.isPrimary ? (
                                                                    <span className="w-2 h-2 bg-green-400 rounded-full inline-block" title="Primary team" />
                                                                ) : (
                                                                    <span className="w-2 h-2 bg-white/10 rounded-full inline-block" />
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-[10px] text-white/40 font-bold max-w-[160px]">
                                                                {isEditing ? (
                                                                    <input
                                                                        value={affiliationForm.nicknames}
                                                                        onChange={(e) => setAffiliationForm((f) => ({ ...f, nicknames: e.target.value }))}
                                                                        placeholder="comma separated"
                                                                        className="w-32 bg-transparent border-b border-white/30 text-sm outline-none"
                                                                    />
                                                                ) : (
                                                                    <span className="truncate block">{p.nicknames.length > 0 ? p.nicknames.join(', ') : '—'}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {isEditing ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => handleSaveAffiliation(p.affiliationId)}
                                                                            disabled={affiliationSaving}
                                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/20 text-primary rounded-lg text-[9px] font-black uppercase hover:bg-primary hover:text-black transition-all disabled:opacity-40"
                                                                        >
                                                                            <Save size={11} />
                                                                            Save
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setEditingAffiliationId(null)}
                                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 text-white/40 rounded-lg text-[9px] font-black uppercase hover:bg-white/20 transition-all"
                                                                        >
                                                                            <XCircle size={11} />
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingAffiliationId(p.affiliationId);
                                                                            setAffiliationForm({
                                                                                jerseyNumber: p.jerseyNumber?.toString() ?? '',
                                                                                position: p.position ?? '',
                                                                                nicknames: p.nicknames.join(', '),
                                                                            });
                                                                        }}
                                                                        className="p-1.5 hover:bg-white/5 rounded-lg transition-all border border-transparent hover:border-white/10 group/edit"
                                                                        title="Edit affiliation"
                                                                    >
                                                                        <Pencil size={14} className="text-white/30 group-hover/edit:text-white" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Add players panel */}
                        <section>
                            {!showAddPanel ? (
                                <button
                                    onClick={() => setShowAddPanel(true)}
                                    className="flex items-center gap-2 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl font-black uppercase italic text-xs tracking-widest hover:bg-primary hover:text-black hover:border-transparent transition-all"
                                >
                                    <Plus size={16} strokeWidth={3} />
                                    Add to Squad
                                </button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                                            Add Players to Squad
                                        </h2>
                                        {!submitted && (
                                            <button
                                                onClick={resetPanel}
                                                className="text-[10px] font-black uppercase text-white/30 hover:text-white transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>

                                    {entries.map((row, i) => (
                                        <EntryRowUI
                                            key={row.rowId}
                                            row={row}
                                            index={i}
                                            teamId={teamId}
                                            submitted={submitted}
                                            onChange={(patch) => updateEntry(row.rowId, patch)}
                                            onRemove={() => removeEntry(row.rowId)}
                                        />
                                    ))}

                                    {!submitted && (
                                        <button
                                            onClick={() => setEntries((prev) => [...prev, makeRow()])}
                                            className="flex items-center gap-2 w-full py-3 border border-dashed border-white/10 rounded-2xl font-black uppercase italic text-[10px] tracking-widest text-white/30 hover:text-white hover:border-white/30 transition-all justify-center"
                                        >
                                            <Plus size={14} strokeWidth={3} />
                                            Add Another Player
                                        </button>
                                    )}

                                    <div className="flex items-center gap-3 pt-2">
                                        {!submitted ? (
                                            <button
                                                onClick={handleSubmit}
                                                disabled={submitting}
                                                className="flex items-center gap-2 px-8 py-4 bg-primary text-black rounded-2xl font-black uppercase italic text-xs tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]"
                                            >
                                                {submitting ? <Loader2 className="animate-spin" size={16} /> : <Layers size={16} />}
                                                {submitting ? 'Submitting...' : `Submit ${entries.length} Player${entries.length !== 1 ? 's' : ''}`}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={resetPanel}
                                                className="flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-black uppercase italic text-xs tracking-widest hover:bg-white/10 transition-all"
                                            >
                                                <Plus size={16} strokeWidth={3} />
                                                Add More Players
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {/* ── CSV IMPORT TAB ──────────────────────────────────────── */}
                {activeTab === 'csv' && (() => {
                    const matched = csvRows.filter((r) => r.resolution.mode === 'existing').length;
                    const toCreate = csvRows.filter((r) => r.resolution.mode === 'new').length;
                    const needReview = csvRows.filter(
                        (r) =>
                            r.resolution.mode === 'pending' ||
                            (r.resolution.mode === 'new' && !r.positionValid),
                    ).length;
                    const hasBlockers =
                        needReview > 0 ||
                        csvRows.some((r) => r.resolution.mode === 'pending');

                    return (
                        <div className="space-y-8">
                            {/* SECTION A — File upload */}
                            <section className="space-y-4">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                                    Import from CSV
                                </h2>
                                <label className="flex flex-col items-center justify-center gap-3 p-8 bg-white/[0.02] border-2 border-dashed border-white/10 rounded-[2rem] cursor-pointer hover:border-primary/30 hover:bg-white/[0.04] transition-all">
                                    <Upload size={28} className="text-white/20" />
                                    <span className="font-black text-sm text-white/40 uppercase italic tracking-widest">
                                        {csvFile ? csvFile.name : 'Choose CSV file'}
                                    </span>
                                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                                        Columns: name, jersey number, position
                                    </span>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            setCsvFile(file);
                                            setCsvResults(null);
                                            parseAndMatchCSV(file);
                                        }}
                                    />
                                </label>
                            </section>

                            {/* SECTION B — Preview table */}
                            {csvRows.length > 0 && (
                                <section className="space-y-3">
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                                        Preview — {csvRows.length} rows
                                    </h2>
                                    <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-white/5">
                                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">#</th>
                                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">CSV Name</th>
                                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">Jersey</th>
                                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">Position</th>
                                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">Match</th>
                                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-primary/60 italic">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {csvRows.map((row, i) => {
                                                        const isBlocked =
                                                            row.resolution.mode === 'pending' ||
                                                            (row.resolution.mode === 'new' && !row.positionValid);
                                                        const rowBg = row.resolution.mode === 'pending'
                                                            ? 'bg-yellow-500/5'
                                                            : row.resolution.mode === 'new' && !row.positionValid
                                                            ? 'bg-red-500/5'
                                                            : '';
                                                        const filteredRoster = row.linkSearch.length >= 1
                                                            ? roster.filter(
                                                                (p) =>
                                                                    p.name.toLowerCase().includes(row.linkSearch.toLowerCase()) ||
                                                                    p.jerseyName?.toLowerCase().includes(row.linkSearch.toLowerCase()),
                                                              ).slice(0, 5)
                                                            : [];
                                                        return (
                                                            <tr
                                                                key={i}
                                                                className={`border-b border-white/5 last:border-0 transition-colors ${rowBg}`}
                                                            >
                                                                <td className="px-4 py-3 text-white/30 font-bold text-sm">{i + 1}</td>
                                                                <td className="px-4 py-3 font-bold text-sm">{row.raw.name}</td>
                                                                <td className="px-4 py-3 font-bold text-sm text-white/60">{row.raw.jerseyNumber || '—'}</td>
                                                                <td className={`px-4 py-3 font-bold text-sm ${!row.positionValid ? 'text-red-400' : 'text-white/60'}`}>
                                                                    {row.raw.position || '—'}
                                                                    {!row.positionValid && row.raw.position && (
                                                                        <span className="ml-1 text-[9px] text-red-400/60">invalid</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {row.match.type === 'high' && (
                                                                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[9px] font-black rounded uppercase tracking-wider">
                                                                            ✓ {row.match.player.name}
                                                                        </span>
                                                                    )}
                                                                    {row.match.type === 'medium' && (
                                                                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[9px] font-black rounded uppercase tracking-wider">
                                                                            ~ {row.match.player.name}
                                                                        </span>
                                                                    )}
                                                                    {row.match.type === 'none' && (
                                                                        <span className="text-white/20 text-[10px] font-bold">No match</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 min-w-[200px]">
                                                                    {/* pending — medium confidence, admin must choose */}
                                                                    {row.resolution.mode === 'pending' && row.match.type === 'medium' && (
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <div className="flex gap-2">
                                                                                <button
                                                                                    onClick={() => updateCsvRow(i, { resolution: { mode: 'existing', playerId: (row.match as { type: 'medium'; player: RosterPlayer }).player.playerId } })}
                                                                                    className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-xl text-[9px] font-black uppercase hover:bg-green-500/30 transition-colors"
                                                                                >
                                                                                    Link to {(row.match as { type: 'medium'; player: RosterPlayer }).player.name}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => updateCsvRow(i, { resolution: { mode: 'new' } })}
                                                                                    className="px-3 py-1.5 bg-white/10 text-white/60 rounded-xl text-[9px] font-black uppercase hover:bg-white/20 transition-colors"
                                                                                >
                                                                                    Create New
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* existing — resolved */}
                                                                    {row.resolution.mode === 'existing' && (
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] font-bold text-white/60 truncate max-w-[120px]">
                                                                                {roster.find((p) => p.playerId === row.resolution.playerId)?.name ?? row.resolution.playerId.slice(0, 8)}
                                                                            </span>
                                                                            <button
                                                                                onClick={() => updateCsvRow(i, { resolution: { mode: 'new' }, linkSearch: '' })}
                                                                                className="shrink-0 text-[9px] font-black text-white/30 hover:text-red-400 transition-colors uppercase"
                                                                            >
                                                                                ✕ unlink
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    {/* new — allow linking to existing */}
                                                                    {row.resolution.mode === 'new' && (
                                                                        <div className="space-y-1.5">
                                                                            <span className="inline-block px-2 py-0.5 bg-white/10 text-white/40 text-[9px] font-black rounded uppercase tracking-wider">
                                                                                Create New
                                                                            </span>
                                                                            <div className="relative">
                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="Link to existing..."
                                                                                    value={row.linkSearch}
                                                                                    onChange={(e) => updateCsvRow(i, { linkSearch: e.target.value })}
                                                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:border-primary/50 transition-all"
                                                                                />
                                                                                {filteredRoster.length > 0 && (
                                                                                    <div className="absolute z-20 top-full mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                                                                                        {filteredRoster.map((p) => (
                                                                                            <button
                                                                                                key={p.playerId}
                                                                                                onClick={() => updateCsvRow(i, {
                                                                                                    resolution: { mode: 'existing', playerId: p.playerId },
                                                                                                    linkSearch: '',
                                                                                                })}
                                                                                                className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                                                                                            >
                                                                                                <div className="text-[10px] font-bold">{p.name}</div>
                                                                                                {p.jerseyName && (
                                                                                                    <div className="text-[9px] text-white/30 uppercase">{p.jerseyName}</div>
                                                                                                )}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* SECTION C — Summary bar */}
                            {csvRows.length > 0 && (
                                <div className="flex items-center gap-4 px-2 text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-green-400">{matched} matched</span>
                                    <span className="text-white/30">·</span>
                                    <span className="text-white/60">{toCreate} to create</span>
                                    {needReview > 0 && (
                                        <>
                                            <span className="text-white/30">·</span>
                                            <span className="text-yellow-400">{needReview} need review</span>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* SECTION D — Import button */}
                            {csvRows.length > 0 && (
                                <button
                                    onClick={handleCSVImport}
                                    disabled={hasBlockers || csvImporting}
                                    className="flex items-center gap-2 px-8 py-4 bg-primary text-black rounded-2xl font-black uppercase italic text-xs tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]"
                                >
                                    {csvImporting ? (
                                        <><Loader2 className="animate-spin" size={16} /> Importing...</>
                                    ) : (
                                        <><Upload size={16} /> Import {csvRows.length} Player{csvRows.length !== 1 ? 's' : ''}</>
                                    )}
                                </button>
                            )}

                            {/* SECTION E — Results */}
                            {csvResults && (() => {
                                const ins = csvResults.filter((r) => r.status === 'inserted').length;
                                const skp = csvResults.filter((r) => r.status === 'skipped').length;
                                const err = csvResults.filter((r) => r.status === 'error');
                                return (
                                    <section className="space-y-4">
                                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                                            Import Results
                                        </h2>
                                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-green-400">{ins} inserted</span>
                                            <span className="text-white/30">·</span>
                                            <span className="text-yellow-400">{skp} skipped</span>
                                            <span className="text-white/30">·</span>
                                            <span className="text-red-400">{err.length} errors</span>
                                        </div>
                                        {err.length > 0 && (
                                            <div className="space-y-2">
                                                {err.map((r) => (
                                                    <div
                                                        key={r.index}
                                                        className="flex items-center gap-3 px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-xl"
                                                    >
                                                        <AlertCircle size={14} className="text-red-400 shrink-0" />
                                                        <span className="text-[10px] font-bold text-red-300">
                                                            Row {r.index + 1} — {r.reason?.replace(/_/g, ' ') ?? 'unknown error'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                );
                            })()}
                        </div>
                    );
                })()}

                {/* ── SQUAD TAB ───────────────────────────────────────────── */}
                {activeTab === 'squad' && (
                    <div className="space-y-8">
                        {/* SECTION A — Competition selector */}
                        <section className="space-y-3">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                                Select Competition
                            </h2>
                            {squadCompetitions.length === 0 ? (
                                <p className="text-white/30 text-xs font-bold uppercase tracking-widest py-8 text-center">
                                    This team is not enrolled in any competitions.
                                </p>
                            ) : (
                                <select
                                    value={selectedCompetitionId ?? ''}
                                    onChange={(e) => setSelectedCompetitionId(e.target.value || null)}
                                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-primary/50 transition-all w-full max-w-md"
                                >
                                    <option value="" disabled>— select a competition —</option>
                                    {squadCompetitions.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} · {c.season}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </section>

                        {/* SECTION B — Dual panel */}
                        {selectedCompetitionId && (
                            <section className="flex flex-col md:flex-row gap-6">
                                {/* LEFT — Available Players */}
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                                            Full Squad ({availableCount})
                                        </h3>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-0.5">
                                            Players in squad not yet on this roster
                                        </p>
                                    </div>
                                    <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] overflow-hidden">
                                        {availablePlayers.length === 0 ? (
                                            <p className="text-center text-white/20 text-xs font-bold uppercase tracking-widest py-10">
                                                All squad players are on the roster.
                                            </p>
                                        ) : (
                                            <ul className="divide-y divide-white/5">
                                                {availablePlayers.map((p) => (
                                                    <li key={p.playerId} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-sm truncate">{p.name}</div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                {p.position && (
                                                                    <span className="px-1.5 py-0.5 bg-white/10 text-white/40 text-[9px] font-black rounded uppercase tracking-wider">
                                                                        {p.position}
                                                                    </span>
                                                                )}
                                                                {p.jerseyName && (
                                                                    <span className="text-[10px] text-white/30 font-bold uppercase truncate">
                                                                        {p.jerseyName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleAddToSquad(p.playerId)}
                                                            disabled={squadSaving}
                                                            className="shrink-0 ml-3 px-3 py-1.5 bg-primary/20 text-primary rounded-xl text-[9px] font-black uppercase hover:bg-primary hover:text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                        >
                                                            Add
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>

                                {/* RIGHT — Squad */}
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                                            Roster ({squad.length})
                                        </h3>
                                    </div>
                                    <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] overflow-hidden min-h-[80px]">
                                        {squadLoading ? (
                                            <div className="flex items-center justify-center py-10">
                                                <Loader2 className="animate-spin text-primary" size={20} />
                                            </div>
                                        ) : squad.length === 0 ? (
                                            <p className="text-center text-white/20 text-xs font-bold uppercase tracking-widest py-10">
                                                No players on roster yet. Add from the squad.
                                            </p>
                                        ) : (
                                            <ul className="divide-y divide-white/5">
                                                {squad.map((p) => (
                                                    <li key={p.squadPlayerId} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-sm truncate">{p.name}</div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                {p.position && (
                                                                    <span className="px-1.5 py-0.5 bg-white/10 text-white/40 text-[9px] font-black rounded uppercase tracking-wider">
                                                                        {p.position}
                                                                    </span>
                                                                )}
                                                                {p.role !== 'player' && (
                                                                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded uppercase tracking-wider ${
                                                                        p.role === 'captain' ? 'bg-yellow-500/20 text-yellow-400'
                                                                        : p.role === 'vice_captain' ? 'bg-blue-500/20 text-blue-400'
                                                                        : p.role === 'goalkeeper' ? 'bg-green-500/20 text-green-400'
                                                                        : 'bg-white/10 text-white/40'
                                                                    }`}>
                                                                        {p.role.replace('_', ' ')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {confirmingRemove === p.squadPlayerId ? (
                                                            <div className="flex items-center gap-2 shrink-0 ml-3">
                                                                <button
                                                                    onClick={() => handleRemoveFromSquad(p.squadPlayerId)}
                                                                    disabled={squadSaving}
                                                                    className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-xl text-[9px] font-black uppercase hover:bg-red-500/40 transition-all disabled:opacity-40"
                                                                >
                                                                    Confirm
                                                                </button>
                                                                <button
                                                                    onClick={() => setConfirmingRemove(null)}
                                                                    className="px-3 py-1.5 bg-white/10 text-white/40 rounded-xl text-[9px] font-black uppercase hover:bg-white/20 transition-all"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setConfirmingRemove(p.squadPlayerId)}
                                                                disabled={squadSaving}
                                                                className="shrink-0 ml-3 px-3 py-1.5 bg-red-500/10 text-red-400/60 rounded-xl text-[9px] font-black uppercase hover:bg-red-500/20 hover:text-red-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                            >
                                                                Remove
                                                            </button>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* SECTION C — Summary bar */}
                        {selectedCompetitionId && (
                            <div className="flex items-center gap-3 px-2 text-[10px] font-black uppercase tracking-widest text-white/30">
                                <span className="text-white/60">{squad.length} players on roster</span>
                                <span>·</span>
                                <span>{availableCount} available from squad</span>
                            </div>
                        )}
                    </div>
                )}

                {/* ── INFO TAB ────────────────────────────────────────────── */}
                {activeTab === 'info' && (
                    <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { label: 'Full Name', value: team.name },
                                { label: 'Short Name', value: team.shortName },
                                { label: 'Sport', value: team.sport },
                                { label: 'Gender', value: team.gender },
                                { label: 'University', value: team.university },
                            ].map(({ label, value }) => (
                                <div key={label}>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">
                                        {label}
                                    </label>
                                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white/70">
                                        {value}
                                    </div>
                                </div>
                            ))}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">
                                    Team Colour
                                </label>
                                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                    <div
                                        className="w-6 h-6 rounded-lg border border-white/20 shrink-0"
                                        style={{ backgroundColor: team.color || '#888' }}
                                    />
                                    <span className="text-sm font-bold text-white/70">{team.color || '—'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                disabled
                                title="Coming soon"
                                className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl font-black uppercase italic text-xs tracking-widest text-white/20 cursor-not-allowed"
                            >
                                Edit Team — Coming Soon
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AdminTeamDetailPage() {
    return (
        <ErrorBoundary>
            <TeamDetailContent />
        </ErrorBoundary>
    );
}
