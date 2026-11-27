'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Shield, Calendar, AlertCircle, Lock as LockIcon } from 'lucide-react';
import { MatchLineupEditor } from '@/components/lineup/MatchLineupEditor';

interface Match {
    id: string;
    sport: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam: { name: string; shortName: string; logo: string };
    awayTeam: { name: string; shortName: string; logo: string };
    startTime: string;
    venue: string;
    competition: string;
    competitionLevel?: string;
    status: string;
    loggerId?: string;
}

// BUG-125: this entire page is a football/5-a-side formation-pitch builder --
// positions, formations, everything below assumes a football-shaped roster.
// It was never sport-aware at all (playersPerSide came only from the
// competition row, defaulting to 11 for any sport that didn't have it set),
// so a basketball match silently got a broken 11-starter "lineup" UI. Rather
// than build a second, formation-free lineup UI here (real duplicate scope --
// BasketballLogger's own lineup wizard already does this correctly and now
// persists it for real, BACKLOG-141), gate basketball matches out with a
// clear redirect instead of letting them through broken.
const isBasketballMatch = (match: Match) => (match.sport || '').toLowerCase().includes('basketball');

export default function AdminMatchLineupsPage() {
    const { user, loading, isAuthenticated } = useAuth();
    const router = useRouter();
    const [matches, setMatches] = useState<Match[]>([]);
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'UPCOMING'>('ALL');
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    // Check authentication and role
    useEffect(() => {
        if (!loading) {
            if (!isAuthenticated) {
                // Redirect to login if not authenticated
                router.push('/login');
            } else if (user?.role !== 'admin' && user?.role !== 'logger') {
                // Show error if authenticated but not authorized
                router.push('/admin');
            }
        }
    }, [loading, isAuthenticated, user, router]);

    // Load matches assigned to logger or all matches for admin
    useEffect(() => {
        if (user) {
            loadMatches();
        }
    }, [user]);

    // Deep link from the admin Matches list: /admin/match-lineups?matchId=... opens that match's lineup
    // directly. Read once, after the list loads (window.location, not useSearchParams, to avoid a Suspense boundary).
    const deepLinkHandled = useRef(false);
    const [deepLinkMissing, setDeepLinkMissing] = useState(false);
    useEffect(() => {
        if (deepLinkHandled.current || matches.length === 0) return;
        deepLinkHandled.current = true;
        const id = new URLSearchParams(window.location.search).get('matchId');
        if (!id) return;
        const target = matches.find(m => m.id === id);
        if (target) handleMatchSelect(target);
        else setDeepLinkMissing(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matches]);

    const loadMatches = async () => {
        try {
            const response = await fetch('/api/admin/assigned-matches');
            const data = await response.json();
            if (data.success) {
                setMatches(data.matches);
            }
        } catch (error) {
            console.error('Error loading matches:', error);
        }
    };

    const handleMatchSelect = (match: Match) => {
        setSelectedMatch(match);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'logger')) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md text-center">
                    <Shield className="mx-auto mb-4 text-red-500" size={48} />
                    <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
                    <p className="text-white/60 mb-4">
                        This page is only accessible to admins and loggers.
                    </p>
                    <Link
                        href="/admin"
                        className="inline-block bg-primary text-black px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors"
                    >
                        Back to Admin
                    </Link>
                </div>
            </div>
        );
    }

    // Soonest first (live matches lead); the API already orders by start time, this keeps it true after filtering.
    const visibleMatches = matches
        .filter(m => statusFilter === 'ALL' || (statusFilter === 'LIVE' ? (m.status === 'LIVE' || m.status === 'HALF_TIME') : m.status === statusFilter))
        .sort((a, b) => {
            const aLive = a.status === 'LIVE' || a.status === 'HALF_TIME';
            const bLive = b.status === 'LIVE' || b.status === 'HALF_TIME';
            if (aLive !== bLive) return aLive ? -1 : 1;
            return (Date.parse(a.startTime) || 0) - (Date.parse(b.startTime) || 0);
        });
    const dayLabel = (t: string) => {
        const d = new Date(t);
        return isNaN(d.getTime()) ? 'Date unknown' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Shield className="text-primary" size={32} />
                        <h1 className="font-display text-4xl tracking-tighter italic uppercase">
                            Official Match Lineups
                        </h1>
                    </div>
                    <p className="text-white/60">
                        Publish official team lineups for your assigned matches
                    </p>
                </div>

                {!selectedMatch ? (
                    /* Match Selection */
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold mb-4">Select a Match</h2>
                        {deepLinkMissing && (
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                                That match is not open for lineups (it may be finished or not assigned to you). Pick one from the list.
                            </div>
                        )}
                        {/* Same format as the admin Matches list: status tabs, soonest first, grouped by day. */}
                        <div className="flex gap-2 mb-2">
                            {(['ALL', 'LIVE', 'UPCOMING'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-primary text-black' : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        {visibleMatches.length === 0 ? (
                            <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
                                <Calendar className="mx-auto mb-4 text-white/40" size={48} />
                                <p className="text-white/60">No matches assigned to you</p>
                            </div>
                        ) : (
                            visibleMatches.map((match, i) => (
                                <div key={match.id} className="space-y-2">
                                {(i === 0 || dayLabel(visibleMatches[i - 1].startTime) !== dayLabel(match.startTime)) && (
                                    <p className="pt-2 text-[10px] font-black uppercase tracking-widest text-white/40">{dayLabel(match.startTime)}</p>
                                )}
                                <button
                                    onClick={() => handleMatchSelect(match)}
                                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-6 transition-colors text-left"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-4 mb-2">
                                                <span className="font-bold">{match.homeTeam?.name ?? 'TBD'}</span>
                                                <span className="text-white/40">vs</span>
                                                <span className="font-bold">{match.awayTeam?.name ?? 'TBD'}</span>
                                            </div>
                                            <div className="text-sm text-white/60">
                                                {match.competition} • {new Date(match.startTime).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${match.status === 'UPCOMING' ? 'bg-blue-500/20 text-blue-400' :
                                            (match.status === 'LIVE' || match.status === 'HALF_TIME') ? 'bg-green-500/20 text-green-400' :
                                                'bg-white/10 text-white/60'
                                            }`}>
                                            {match.status}
                                        </div>
                                    </div>
                                </button>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    /* Lineup Builder */
                    <div className="space-y-6">
                        {/* Match Info */}
                        <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold mb-1">
                                        {selectedMatch.homeTeam.shortName} vs {selectedMatch.awayTeam.shortName}
                                    </h2>
                                    <p className="text-white/60 text-sm">
                                        {selectedMatch.competition} • {new Date(selectedMatch.startTime).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    {selectedMatch.status !== 'UPCOMING' && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs font-bold">
                                            <LockIcon size={14} /> Match Started
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setSelectedMatch(null)}
                                        className="text-white/60 hover:text-white"
                                    >
                                        ← Back to matches
                                    </button>
                                </div>
                            </div>

                            {isBasketballMatch(selectedMatch) && (
                                <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-300 text-sm flex items-start gap-2">
                                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                    <span>
                                        This tool is a football formation builder and doesn&apos;t support basketball rosters (no formation/position concept applies).
                                        Basketball lineups are managed directly in the Logger for this match, where they now save to the server.
                                    </span>
                                </div>
                            )}
                        </div>

                        {isBasketballMatch(selectedMatch) ? null : (
                            <MatchLineupEditor
                                match={{
                                    id: selectedMatch.id,
                                    homeTeamId: selectedMatch.homeTeamId,
                                    awayTeamId: selectedMatch.awayTeamId,
                                    homeTeam: selectedMatch.homeTeam,
                                    awayTeam: selectedMatch.awayTeam,
                                    competitionLevel: selectedMatch.competitionLevel,
                                    status: selectedMatch.status,
                                }}
                                role={user?.role === 'admin' ? 'admin' : 'logger'}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
