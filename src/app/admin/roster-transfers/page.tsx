'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Search, CheckCircle, AlertCircle } from 'lucide-react';

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

// BACKLOG-126 step 5: minimal admin roster transfer -- pick player, pick new team,
// confirm. No history browser, no bulk mode -- one transfer at a time, matching the
// plan's explicit "minimal" scope. Full roster history display remains a separate,
// still-open gap noted in this entry.
export default function RosterTransfersPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PlayerResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null);

    const [teams, setTeams] = useState<Team[]>([]);
    const [newTeamId, setNewTeamId] = useState('');
    const [jerseyNumber, setJerseyNumber] = useState('');
    const [position, setPosition] = useState('');

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

    const selectPlayer = (player: PlayerResult) => {
        setSelectedPlayer(player);
        setResults([]);
        setQuery(player.name);
        setMessage(null);
    };

    const resetForm = () => {
        setSelectedPlayer(null);
        setQuery('');
        setNewTeamId('');
        setJerseyNumber('');
        setPosition('');
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
                resetForm();
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
