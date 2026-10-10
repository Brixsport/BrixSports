'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, User } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';

const PAGE_SIZE = 30;
const SPORTS = ['All', 'Football', 'Basketball'] as const;
type SportFilter = (typeof SPORTS)[number];

interface PlayerRow {
    id: string;
    name: string;
    number?: number | null;
    position?: string | null;
    university?: string | null;
    image?: string | null;
    teamId?: string | null;
}

// BACKLOG-406: Players had no browse entry point at all. GET /api/players returns a
// public-stripped DTO and pages in memory over the first 500 players only, which is
// fine at today's roster size; it needs DB-side search/paging before it passes 500.
export default function PlayersPage() {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [sport, setSport] = useState<SportFilter>('All');
    const [players, setPlayers] = useState<PlayerRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [teamNames, setTeamNames] = useState<Record<string, string>>({});
    const requestId = useRef(0);

    // The public players DTO strips `memberships`, so team names come from one
    // /api/teams call (a bare array) mapped by teamId. Enrichment only: a failure
    // just leaves the team name off each row.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/teams');
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled || !Array.isArray(data)) return;
                setTeamNames(Object.fromEntries(data.map((t: { id: string; name: string }) => [t.id, t.name])));
            } catch (err) {
                console.error('Error fetching teams for players list:', err);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
        return () => clearTimeout(t);
    }, [query]);

    const fetchPage = useCallback(async (offset: number, append: boolean) => {
        const id = ++requestId.current;
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
            if (debouncedQuery) params.set('search', debouncedQuery);
            if (sport !== 'All') params.set('sport', sport);
            const res = await fetch(`/api/players?${params.toString()}`);
            if (res.status === 429) throw new Error('Too many requests. Please try again in a moment.');
            if (!res.ok) throw new Error('Could not load players.');
            const data = await res.json();
            if (id !== requestId.current) return; // a newer request superseded this one
            const list: PlayerRow[] = Array.isArray(data.players) ? data.players : [];
            setPlayers((prev) => (append ? [...prev, ...list] : list));
            setTotal(typeof data.total === 'number' ? data.total : list.length);
        } catch (err) {
            if (id !== requestId.current) return;
            console.error('Error fetching players:', err);
            setError(err instanceof Error ? err.message : 'Could not load players.');
        } finally {
            if (id === requestId.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [debouncedQuery, sport]);

    useEffect(() => {
        fetchPage(0, false);
    }, [fetchPage]);

    const hasMore = players.length < total;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="max-w-3xl mx-auto px-4 pt-6 pb-8">
                <div className="flex items-center gap-2 mb-6">
                    <BackButton fallbackHref="/" forceShow />
                    <h1 className="font-display text-4xl md:text-5xl tracking-tighter italic uppercase leading-none">Players</h1>
                </div>

                <label htmlFor="players-search" className="sr-only">Search players</label>
                <div className="relative mb-4">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none" />
                    <input
                        id="players-search"
                        type="search"
                        value={query}
                        maxLength={100}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name, team or university"
                        className="w-full bg-muted border border-border rounded-xl pl-11 pr-4 py-3 text-sm font-medium outline-none focus:border-primary transition-colors"
                    />
                </div>

                <div role="group" aria-label="Filter by sport" className="flex gap-2 mb-6">
                    {SPORTS.map((s) => (
                        <button
                            key={s}
                            type="button"
                            aria-pressed={sport === s}
                            onClick={() => setSport(s)}
                            className={`min-h-11 px-4 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors ${sport === s
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted text-foreground/60 border-border hover:bg-muted/70'
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16 text-foreground/40" role="status">
                        <Loader2 size={24} className="animate-spin" />
                        <span className="sr-only">Loading players</span>
                    </div>
                ) : error && players.length === 0 ? (
                    <div className="text-center py-16" role="alert">
                        <p className="text-sm text-foreground/60 mb-4">{error}</p>
                        <button
                            type="button"
                            onClick={() => fetchPage(0, false)}
                            className="min-h-11 px-6 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider"
                        >
                            Try again
                        </button>
                    </div>
                ) : players.length === 0 ? (
                    <p className="text-center text-sm text-foreground/60 py-16">
                        {debouncedQuery ? `No players match "${debouncedQuery}".` : 'No players to show yet.'}
                    </p>
                ) : (
                    <>
                        <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-3" aria-live="polite">
                            {total} {total === 1 ? 'player' : 'players'}
                        </p>
                        <ul className="space-y-2">
                            {players.map((p) => {
                                const teamName = p.teamId ? teamNames[p.teamId] : undefined;
                                const detail = [p.position, teamName, p.university && p.university !== 'Unknown' ? p.university : null]
                                    .filter(Boolean)
                                    .join(' · ');
                                return (
                                    <li key={p.id}>
                                        <Link
                                            href={`/players/${p.id}`}
                                            className="min-h-14 flex items-center gap-3 p-3 bg-muted border border-border rounded-xl hover:bg-muted/70 transition-colors"
                                        >
                                            {p.image ? (
                                                <img src={p.image} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                    <User size={18} className="text-primary" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-sm truncate">{p.name}</p>
                                                {detail && <p className="text-xs text-foreground/60 truncate">{detail}</p>}
                                            </div>
                                            {p.number ? (
                                                <span className="text-xs font-bold text-foreground/60 shrink-0">#{p.number}</span>
                                            ) : null}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>

                        {error && (
                            <p className="text-center text-xs text-red-500 mt-4" role="alert">{error}</p>
                        )}

                        {hasMore && (
                            <div className="flex justify-center mt-6">
                                <button
                                    type="button"
                                    onClick={() => fetchPage(players.length, true)}
                                    disabled={loadingMore}
                                    className="min-h-11 px-6 rounded-xl bg-muted border border-border text-xs font-bold uppercase tracking-wider hover:bg-muted/70 transition-colors disabled:opacity-60 flex items-center gap-2"
                                >
                                    {loadingMore && <Loader2 size={14} className="animate-spin" />}
                                    {loadingMore ? 'Loading...' : 'Load more'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
