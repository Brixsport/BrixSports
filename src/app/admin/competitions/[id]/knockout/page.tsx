'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, AlertCircle, AlertTriangle, Send } from 'lucide-react';
import { TeamLogo } from '@/lib/utils/team-logo';
import { suggestSeedPairings } from '@/lib/competitionDraw';

interface Team {
    id: string;
    name: string;
    logo?: string | null;
    color?: string | null;
}

interface StandingRow {
    teamId: string;
    points: number;
    goalDifference: number;
    goalsFor: number;
    yellowCards: number;
    redCards: number;
    team: Team;
}

interface QFForm {
    homeTeamId: string;
    awayTeamId: string;
    startTime: string;
    venue: string;
}

interface BracketNode {
    id: string;
    round: string;
    title: string;
    homeTeam: Team | null;
    awayTeam: Team | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
}

// BACKLOG-280: manual top-8 knockout bracket creation. Pre-fills the 1v8/2v7/
// 3v6/4v5 seeding from the live standings table (STANDINGS_ORDER_BY, already
// server-sorted) via suggestSeedPairings, but every slot is admin-editable --
// pure manual entry, no bracket algorithm, competition-agnostic. Flags (not
// blocks) a genuine tie for 8th place per BACKLOG-267's resolved answer.
export default function KnockoutBracketPage() {
    const params = useParams();
    const competitionId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [teams, setTeams] = useState<Team[]>([]);
    const [teamsById, setTeamsById] = useState<Record<string, Team>>({});
    const [top8, setTop8] = useState<StandingRow[]>([]);
    const [tieWarning, setTieWarning] = useState(false);
    const [qf, setQf] = useState<QFForm[]>([]);
    const [existingRounds, setExistingRounds] = useState<{ round: string; matches: BracketNode[] }[] | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [teamsRes, standingsRes, bracketRes] = await Promise.all([
                    fetch(`/api/competitions/${competitionId}/teams`),
                    fetch(`/api/standings?competitionId=${competitionId}`),
                    fetch(`/api/brackets?competitionId=${competitionId}`),
                ]);
                const teamsBody = await teamsRes.json();
                const standingsBody: StandingRow[] = await standingsRes.json();
                const bracketBody = await bracketRes.json();

                const fetchedTeams: Team[] = teamsBody.teams ?? [];
                setTeams(fetchedTeams);
                setTeamsById(Object.fromEntries(fetchedTeams.map((t: Team) => [t.id, t])));

                if (bracketBody.totalMatches > 0) {
                    setExistingRounds(bracketBody.rounds ?? []);
                } else {
                    const top = standingsBody.slice(0, 8);
                    setTop8(top);

                    if (standingsBody.length > 8) {
                        const a = top[7], b = standingsBody[8];
                        if (a && b && a.points === b.points && a.goalDifference === b.goalDifference && a.goalsFor === b.goalsFor && a.yellowCards === b.yellowCards && a.redCards === b.redCards) {
                            setTieWarning(true);
                        }
                    }

                    if (top.length === 8) {
                        const suggested = suggestSeedPairings(top.map(t => t.teamId));
                        setQf(suggested.map(p => ({ homeTeamId: p.teamId, awayTeamId: p.opponentTeamId, startTime: '', venue: '' })));
                    }
                }
            } catch {
                setMessage({ type: 'error', text: 'Failed to load competition data.' });
            } finally {
                setLoading(false);
            }
        })();
    }, [competitionId]);

    const updateQf = (i: number, patch: Partial<QFForm>) => {
        setQf(prev => prev.map((slot, idx) => idx === i ? { ...slot, ...patch } : slot));
    };

    const create = async () => {
        const missing = qf.some(s => !s.homeTeamId || !s.awayTeamId || !s.startTime || !s.venue);
        if (missing) {
            setMessage({ type: 'error', text: 'Every QF slot needs both teams, a kickoff time, and a venue.' });
            return;
        }
        const allIds = qf.flatMap(s => [s.homeTeamId, s.awayTeamId]);
        if (new Set(allIds).size !== 8) {
            setMessage({ type: 'error', text: 'The 8 QF slots must be 8 distinct teams.' });
            return;
        }
        if (!window.confirm('Create the knockout bracket? This creates 4 real Quarter-Final matches now, plus the Semi-Final/3rd Place/Final structure (created automatically as results come in).')) return;

        setSubmitting(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/competitions/${competitionId}/knockout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qf: qf.map(s => ({ ...s, startTime: new Date(s.startTime).toISOString() })),
                }),
            });
            const body = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'Knockout bracket created — 4 Quarter-Finals are now real matches.' });
                const bracketRes = await fetch(`/api/brackets?competitionId=${competitionId}`);
                const bracketBody = await bracketRes.json();
                setExistingRounds(bracketBody.rounds ?? []);
            } else {
                setMessage({ type: 'error', text: body.error || 'Failed to create bracket' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error while creating the bracket.' });
        } finally {
            setSubmitting(false);
        }
    };

    const teamName = (id: string) => teamsById[id]?.name ?? id;

    if (loading) {
        return <div className="min-h-screen bg-neutral-950 text-white p-6 flex items-center justify-center text-white/40 text-sm">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-1">Knockout Bracket</h1>
            <p className="text-white/50 text-sm mb-6">Top 8 → Quarter-Finals → Semi-Finals → 3rd Place / Final.</p>

            {message && (
                <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {message.text}
                </div>
            )}

            {existingRounds ? (
                <div className="space-y-4">
                    {existingRounds.map(r => (
                        <div key={r.round} className="bg-neutral-900 border border-white/10 rounded-xl p-4">
                            <h3 className="font-semibold text-sm mb-3">{r.round.replace(/_/g, ' ')}</h3>
                            <div className="space-y-2">
                                {r.matches.map(m => (
                                    <div key={m.id} className="bg-neutral-800/50 rounded-lg p-3 flex items-center gap-3">
                                        <TeamLogo logo={m.homeTeam?.logo} name={m.homeTeam?.name ?? 'TBD'} color={m.homeTeam?.color} size="sm" />
                                        <span className="text-sm flex-1">{m.homeTeam?.name ?? 'TBD'}</span>
                                        <span className="text-xs text-white/30">{m.homeScore ?? '-'} : {m.awayScore ?? '-'}</span>
                                        <span className="text-sm flex-1 text-right">{m.awayTeam?.name ?? 'TBD'}</span>
                                        <TeamLogo logo={m.awayTeam?.logo} name={m.awayTeam?.name ?? 'TBD'} color={m.awayTeam?.color} size="sm" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : top8.length < 8 ? (
                <div className="bg-neutral-900 border border-white/10 rounded-xl p-4 text-sm text-white/50">
                    This competition has {top8.length} team(s) in its standings table — need at least 8 to seed a top-8 knockout bracket.
                </div>
            ) : (
                <>
                    {tieWarning && (
                        <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            8th and 9th place are tied on every tiebreaker — the suggested 8th seed below is only the tiebreaker's final (arbitrary) fallback. Double-check before publishing.
                        </div>
                    )}
                    <div className="space-y-3 mb-6">
                        {qf.map((slot, i) => (
                            <div key={i} className="bg-neutral-900 border border-white/10 rounded-xl p-4">
                                <h3 className="text-xs text-white/40 uppercase tracking-wide mb-2">Quarter-Final {i + 1}</h3>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <select
                                        value={slot.homeTeamId}
                                        onChange={(e) => updateQf(i, { homeTeamId: e.target.value })}
                                        className="bg-neutral-800 border border-white/10 rounded-md px-2 py-2 text-sm"
                                    >
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    <select
                                        value={slot.awayTeamId}
                                        onChange={(e) => updateQf(i, { awayTeamId: e.target.value })}
                                        className="bg-neutral-800 border border-white/10 rounded-md px-2 py-2 text-sm"
                                    >
                                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="datetime-local"
                                        value={slot.startTime}
                                        onChange={(e) => updateQf(i, { startTime: e.target.value })}
                                        className="bg-neutral-800 border border-white/10 rounded-md px-2 py-1.5 text-xs"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Venue"
                                        value={slot.venue}
                                        onChange={(e) => updateQf(i, { venue: e.target.value })}
                                        className="bg-neutral-800 border border-white/10 rounded-md px-2 py-1.5 text-xs"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={create}
                            disabled={submitting}
                            className="flex items-center gap-2 bg-primary text-black font-semibold rounded-xl px-6 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                        >
                            <Send className="w-4 h-4" /> {submitting ? 'Creating...' : 'Create Bracket'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
