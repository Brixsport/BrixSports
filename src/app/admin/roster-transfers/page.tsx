'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Search, CheckCircle, AlertCircle, History } from 'lucide-react';

// BACKLOG-227: sw-admin.js's stale-while-revalidate policy on /api/players*
// (added for near-static fields like name/position) also covers the
// genuinely mutation-adjacent affiliationHistory this page reads right after
// a write -- serving the pre-transfer cached copy for one read cycle. Fix
// option 2 from that entry: evict the specific cached reads a transfer
// affects, rather than narrowing the SWR pattern (which would lose the
// speed benefit for the read-heavy public player profile page too). The
// cache name carries a build-time-injected version, so match by suffix
// instead of hardcoding it.
async function evictStaleAdminApiCache(urls: string[]) {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    try {
        const cacheNames = await caches.keys();
        // Cache Storage is origin-scoped, not per-SW -- sw-user.js's cache also
        // ends in "-api" and can sort first, which would silently evict the
        // wrong service worker's cache on this admin-only page (caught live,
        // session 59: brixsport-user-*-api existed alongside brixsport-admin-*-api).
        const apiCacheName = cacheNames.find((n) => n.includes('-admin-') && n.endsWith('-api'));
        if (!apiCacheName) return;
        const cache = await caches.open(apiCacheName);
        await Promise.all(urls.map((url) => cache.delete(url)));
    } catch {
        // Best-effort only -- a failed eviction just means the existing
        // one-cycle staleness (already documented, low priority) persists.
    }
}

interface PlayerResult {
    id: string;
    name: string;
    jerseyName: string | null;
    position: string;
    college: string | null;
    university: string;
    currentTeams: {
        teamId: string;
        teamName: string;
        affiliationType: string;
        isPrimary: boolean;
    }[];
}

interface Team {
    id: string;
    name: string;
    shortName?: string;
    sport?: string;
}

interface HistoryEntry {
    affiliation: {
        id: string;
        affiliationType: string;
        isActive: boolean;
        startDate: string | null;
        endDate: string | null;
        season: string | null;
        jerseyNumber: number | null;
        position: string | null;
    };
    team: {
        id: string;
        name: string;
        sport?: string;
    };
}

function formatDate(value: string | null) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// BACKLOG-126 step 5 + follow-up: pick player, pick new team, confirm -- plus a
// full employment-history timeline (every past + current club/team affiliation,
// across sports, not just the currently-active one) sourced from GET
// /api/players/[id]'s affiliationHistory field. No bulk-transfer mode; one
// transfer at a time, matching the original plan's "minimal" scope.
export default function RosterTransfersPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-neutral-950 text-white p-6 flex items-center justify-center text-white/40 text-sm">Loading...</div>}>
            <RosterTransfersInner />
        </Suspense>
    );
}

function RosterTransfersInner() {
    const searchParams = useSearchParams();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PlayerResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null);

    const [teams, setTeams] = useState<Team[]>([]);
    const [newTeamId, setNewTeamId] = useState('');
    const [jerseyNumber, setJerseyNumber] = useState('');
    const [position, setPosition] = useState('');

    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetch('/api/teams')
            .then((res) => res.json())
            .then((data) => setTeams(Array.isArray(data) ? data : []))
            .catch(() => setTeams([]));
    }, []);

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }
        const timeout = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`/api/players/search?q=${encodeURIComponent(query.trim())}&limit=15`);
                const data = await res.json();
                setResults(res.ok ? data.players ?? [] : []);
            } catch {
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [query]);

    const fetchHistory = async (playerId: string) => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/players/${playerId}`);
            const data = await res.json();
            setHistory(res.ok ? data.player?.affiliationHistory ?? [] : []);
        } catch {
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const selectPlayer = (player: PlayerResult) => {
        setSelectedPlayer(player);
        setResults([]);
        setQuery(player.name);
        setMessage(null);
        fetchHistory(player.id);
    };

    // Entry point from a player's own admin profile (/admin/players/[id]'s
    // "Transfer" button) -- carries playerId through so the admin doesn't have
    // to re-search for the player they were just looking at. Uses the admin
    // player-detail endpoint directly (memberships, already isActive-filtered
    // at the query level) rather than /api/players/search, since we already
    // have the exact id and don't need fuzzy matching.
    useEffect(() => {
        const playerId = searchParams.get('playerId');
        if (!playerId) return;
        fetch(`/api/players/${playerId}`)
            .then((res) => res.json())
            .then((data) => {
                const p = data.player;
                if (!p) return;
                const currentTeams = (p.memberships ?? []).map((m: any) => ({
                    teamId: m.team.id,
                    teamName: m.team.name,
                    affiliationType: m.affiliation.affiliationType,
                    isPrimary: !!m.affiliation.isPrimary,
                }));
                selectPlayer({
                    id: p.id,
                    name: p.name,
                    jerseyName: p.jerseyName ?? null,
                    position: p.position,
                    college: p.college ?? null,
                    university: p.university,
                    currentTeams,
                });
            })
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resetForm = () => {
        setSelectedPlayer(null);
        setQuery('');
        setNewTeamId('');
        setJerseyNumber('');
        setPosition('');
        setHistory([]);
    };

    const submitTransfer = async () => {
        if (!selectedPlayer || !newTeamId) return;
        setSubmitting(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/players/${selectedPlayer.id}/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    newTeamId,
                    jerseyNumber: jerseyNumber ? Number(jerseyNumber) : undefined,
                    position: position || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: `${data.playerName} transferred to ${data.toTeamName}.` });
                setNewTeamId('');
                setJerseyNumber('');
                setPosition('');
                await evictStaleAdminApiCache([
                    `/api/players/${selectedPlayer.id}`,
                    `/api/players/search?q=${encodeURIComponent(query.trim())}&limit=15`,
                ]);
                await fetchHistory(selectedPlayer.id);
            } else {
                setMessage({ type: 'error', text: data.error || 'Transfer failed' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please check your connection.' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-1">Roster Transfer</h1>
            <p className="text-white/50 text-sm mb-6">Move a player to a new team. Closes their current affiliation and opens a new one for {' '}
                <span className="text-white/70">2026/2027</span>.
            </p>

            {message && (
                <div
                    className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                        message.type === 'success'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                >
                    {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {message.text}
                </div>
            )}

            <div className="space-y-5">
                <div>
                    <label className="block text-sm text-white/60 mb-2">Player</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setSelectedPlayer(null);
                            }}
                            placeholder="Search player by name..."
                            className="w-full bg-neutral-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary"
                        />
                    </div>
                    {searching && <p className="text-xs text-white/40 mt-1">Searching...</p>}
                    {results.length > 0 && (
                        <div className="mt-2 bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
                            {results.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => selectPlayer(p)}
                                    className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0"
                                >
                                    <div className="font-medium">{p.name}</div>
                                    <div className="text-xs text-white/40">
                                        {p.position} · {p.currentTeams.map((t) => t.teamName).join(', ') || 'No current team'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {selectedPlayer && (
                    <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
                        <div className="text-sm text-white/50 mb-1">Selected player</div>
                        <div className="font-semibold">{selectedPlayer.name}</div>
                        <div className="text-xs text-white/40 mt-1">
                            Current: {selectedPlayer.currentTeams.map((t) => `${t.teamName} (${t.affiliationType})`).join(', ') || 'None'}
                        </div>
                    </div>
                )}

                {selectedPlayer && (
                    <div>
                        <div className="flex items-center gap-2 text-sm text-white/60 mb-2">
                            <History className="w-4 h-4" />
                            Transfer history
                        </div>
                        {historyLoading ? (
                            <p className="text-xs text-white/40">Loading history...</p>
                        ) : history.length === 0 ? (
                            <p className="text-xs text-white/40">No affiliation history found.</p>
                        ) : (
                            <div className="space-y-2">
                                {history.map((h) => {
                                    const start = formatDate(h.affiliation.startDate);
                                    const end = formatDate(h.affiliation.endDate);
                                    return (
                                        <div
                                            key={h.affiliation.id}
                                            className="bg-neutral-900 border border-white/10 rounded-xl p-3 flex items-start justify-between gap-3"
                                        >
                                            <div>
                                                <div className="font-medium text-sm">
                                                    {h.team.name}
                                                    {h.team.sport ? <span className="text-white/40"> · {h.team.sport}</span> : null}
                                                </div>
                                                <div className="text-xs text-white/40 mt-0.5">
                                                    {h.affiliation.affiliationType}
                                                    {h.affiliation.season ? ` · ${h.affiliation.season}` : ''}
                                                    {start ? ` · ${start} – ${end ?? 'present'}` : ''}
                                                </div>
                                            </div>
                                            <span
                                                className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
                                                    h.affiliation.isActive
                                                        ? 'bg-green-500/10 text-green-400'
                                                        : 'bg-white/5 text-white/40'
                                                }`}
                                            >
                                                {h.affiliation.isActive ? 'Active' : 'Past'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <div>
                    <label className="block text-sm text-white/60 mb-2">New team</label>
                    <select
                        value={newTeamId}
                        onChange={(e) => setNewTeamId(e.target.value)}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                    >
                        <option value="">Select a team...</option>
                        {teams.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}{t.sport ? ` (${t.sport})` : ''}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-white/60 mb-2">Jersey number (optional)</label>
                        <input
                            type="number"
                            value={jerseyNumber}
                            onChange={(e) => setJerseyNumber(e.target.value)}
                            className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-white/60 mb-2">Position (optional)</label>
                        <input
                            type="text"
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>

                <button
                    onClick={submitTransfer}
                    disabled={!selectedPlayer || !newTeamId || submitting}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-black font-semibold rounded-xl py-3 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                    {submitting ? 'Transferring...' : (
                        <>Confirm Transfer <ArrowRight className="w-4 h-4" /></>
                    )}
                </button>
            </div>
        </div>
    );
}
