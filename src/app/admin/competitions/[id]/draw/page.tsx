'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowUp, ArrowDown, Repeat, CheckCircle, AlertCircle, Shuffle, Send, Undo2 } from 'lucide-react';
import { TeamLogo } from '@/lib/utils/team-logo';

interface Team {
    id: string;
    name: string;
    shortName?: string | null;
    logo?: string | null;
    color?: string | null;
}

interface Pairing {
    round: number;
    index: number;
    homeTeamId: string;
    awayTeamId: string;
    startTime?: string | null;
    venue?: string | null;
}

interface Draw {
    id: string;
    competitionId: string;
    sport: string;
    algorithm: string;
    seedOrder: string[];
    pots: string[][] | null;
    pairings: Pairing[];
    status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
    publishedMatchIds: string[] | null;
}

// BACKLOG-279: seed-order editor (up/down reorder -- no drag-and-drop library,
// keeps this dependency-free) + Compute, then a review grid grouped by
// matchday with per-pairing swap and per-match startTime/venue, then Publish
// behind an explicit confirm. Flagged by the architect as the highest-risk
// piece of the whole Swiss-engine plan -- this is where a draft becomes real
// `matches` rows.
export default function CompetitionDrawPage() {
    const params = useParams();
    const competitionId = params.id as string;

    const [teams, setTeams] = useState<Team[]>([]);
    const [teamsById, setTeamsById] = useState<Record<string, Team>>({});
    const [seedOrder, setSeedOrder] = useState<string[]>([]);
    const [draw, setDraw] = useState<Draw | null>(null);

    const [loading, setLoading] = useState(true);
    const [computing, setComputing] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [teamsRes, drawsRes] = await Promise.all([
                    fetch(`/api/competitions/${competitionId}/teams`),
                    fetch(`/api/admin/competitions/${competitionId}/draws`),
                ]);
                const teamsBody = await teamsRes.json();
                const drawsBody = await drawsRes.json();

                const fetchedTeams: Team[] = teamsBody.teams ?? [];
                setTeams(fetchedTeams);
                setTeamsById(Object.fromEntries(fetchedTeams.map((t: Team) => [t.id, t])));

                const active = (drawsBody.draws ?? []).find((d: Draw) => d.status === 'DRAFT' || d.status === 'PUBLISHED');
                if (active) {
                    setDraw(active);
                    setSeedOrder(active.seedOrder);
                } else {
                    setSeedOrder(fetchedTeams.map((t: Team) => t.id));
                }
            } catch {
                setMessage({ type: 'error', text: 'Failed to load competition data.' });
            } finally {
                setLoading(false);
            }
        })();
    }, [competitionId]);

    const moveSeed = (index: number, dir: -1 | 1) => {
        const next = [...seedOrder];
        const target = index + dir;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        setSeedOrder(next);
    };

    const computeDraw = async () => {
        setComputing(true);
        setMessage(null);
        try {
            const isRecompute = !!draw;
            const url = isRecompute
                ? `/api/admin/competitions/${competitionId}/draws/${draw!.id}`
                : `/api/admin/competitions/${competitionId}/draws`;
            const res = await fetch(url, {
                method: isRecompute ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seedOrder }),
            });
            const body = await res.json();
            if (res.ok) {
                setDraw(body.draw);
                setMessage({ type: 'success', text: isRecompute ? 'Draw recomputed.' : 'Draw computed. Review pairings below before publishing.' });
            } else {
                setMessage({ type: 'error', text: body.error || 'Failed to compute draw' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error while computing the draw.' });
        } finally {
            setComputing(false);
        }
    };

    const updatePairing = async (round: number, index: number, updates: Partial<Pick<Pairing, 'startTime' | 'venue'>> & { swapHomeAway?: boolean }) => {
        if (!draw) return;
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/competitions/${competitionId}/draws/${draw.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pairingUpdates: [{ round, index, ...updates }] }),
            });
            const body = await res.json();
            if (res.ok) {
                setDraw(body.draw);
            } else {
                setMessage({ type: 'error', text: body.error || 'Failed to update pairing' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error while updating the pairing.' });
        }
    };

    const publish = async () => {
        if (!draw) return;
        const missing = draw.pairings.filter(p => !p.startTime || !p.venue).length;
        if (missing > 0) {
            setMessage({ type: 'error', text: `${missing} match(es) still need a kickoff time and venue before publishing.` });
            return;
        }
        if (!window.confirm(`Publish this draw? This creates ${draw.pairings.length} real matches for this competition.`)) return;

        setPublishing(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/competitions/${competitionId}/draws/${draw.id}/publish`, { method: 'POST' });
            const body = await res.json();
            if (res.ok) {
                setDraw(body.draw);
                setMessage({ type: 'success', text: `Published ${body.matchCount} matches.` });
            } else {
                setMessage({ type: 'error', text: body.error || 'Failed to publish draw' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error while publishing.' });
        } finally {
            setPublishing(false);
        }
    };

    const unpublish = async () => {
        if (!draw) return;
        if (!window.confirm('Unpublish this draw? Its UPCOMING matches will be deleted so you can edit and republish. Any match already LIVE or FINISHED blocks this entirely.')) return;

        setPublishing(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/competitions/${competitionId}/draws/${draw.id}/publish`, { method: 'DELETE' });
            const body = await res.json();
            if (res.ok) {
                setDraw(body.draw);
                setMessage({ type: 'success', text: 'Unpublished. You can now edit and republish.' });
            } else {
                setMessage({ type: 'error', text: body.error || 'Failed to unpublish draw' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error while unpublishing.' });
        } finally {
            setPublishing(false);
        }
    };

    const pairingsByRound = useMemo(() => {
        if (!draw) return {};
        return draw.pairings.reduce((acc, p) => {
            (acc[p.round] ??= []).push(p);
            return acc;
        }, {} as Record<number, Pairing[]>);
    }, [draw]);

    const teamName = (id: string) => teamsById[id]?.name ?? id;

    if (loading) {
        return <div className="min-h-screen bg-neutral-950 text-white p-6 flex items-center justify-center text-white/40 text-sm">Loading...</div>;
    }

    const isPublished = draw?.status === 'PUBLISHED';
    const isDraft = draw?.status === 'DRAFT';

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-1">Competition Draw</h1>
            <p className="text-white/50 text-sm mb-6">
                Predetermined league-phase draw ({teams.length} teams registered). {isPublished ? 'Published — real matches exist for this draw.' : isDraft ? 'Draft — review and publish when ready.' : 'Set the seed order and compute the draw.'}
            </p>

            {message && (
                <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {message.text}
                </div>
            )}

            {!isPublished && (
                <div className="bg-neutral-900 border border-white/10 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-semibold text-sm">Seed Order {draw ? '(recompute will replace all pairings)' : ''}</h2>
                        <button
                            onClick={computeDraw}
                            disabled={computing || seedOrder.length === 0}
                            className="flex items-center gap-2 bg-primary text-black font-semibold rounded-lg px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                        >
                            {computing ? 'Computing...' : (<><Shuffle className="w-4 h-4" /> {draw ? 'Recompute' : 'Compute Draw'}</>)}
                        </button>
                    </div>
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                        {seedOrder.map((teamId, i) => (
                            <div key={teamId} className="flex items-center gap-3 bg-neutral-800/50 rounded-lg px-3 py-2">
                                <span className="text-xs text-white/40 w-8">Pot {Math.floor(i / (seedOrder.length / 4)) + 1}</span>
                                <TeamLogo logo={teamsById[teamId]?.logo} name={teamName(teamId)} color={teamsById[teamId]?.color} size="sm" />
                                <span className="flex-1 text-sm">{teamName(teamId)}</span>
                                <button onClick={() => moveSeed(i, -1)} disabled={i === 0} className="p-1 text-white/40 hover:text-white disabled:opacity-20"><ArrowUp className="w-4 h-4" /></button>
                                <button onClick={() => moveSeed(i, 1)} disabled={i === seedOrder.length - 1} className="p-1 text-white/40 hover:text-white disabled:opacity-20"><ArrowDown className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {draw && (
                <div className="space-y-6">
                    {Object.entries(pairingsByRound).sort(([a], [b]) => Number(a) - Number(b)).map(([round, pairings]) => (
                        <div key={round} className="bg-neutral-900 border border-white/10 rounded-xl p-4">
                            <h3 className="font-semibold text-sm mb-3">Matchday {round}</h3>
                            <div className="space-y-2">
                                {pairings.sort((a, b) => a.index - b.index).map(p => (
                                    <div key={p.index} className="bg-neutral-800/50 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TeamLogo logo={teamsById[p.homeTeamId]?.logo} name={teamName(p.homeTeamId)} color={teamsById[p.homeTeamId]?.color} size="sm" />
                                            <span className="text-sm font-medium flex-1">{teamName(p.homeTeamId)}</span>
                                            {!isPublished && (
                                                <button
                                                    onClick={() => updatePairing(p.round, p.index, { swapHomeAway: true })}
                                                    title="Swap home/away"
                                                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-md"
                                                >
                                                    <Repeat className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <span className="text-xs text-white/30">vs</span>
                                            <span className="text-sm font-medium flex-1 text-right">{teamName(p.awayTeamId)}</span>
                                            <TeamLogo logo={teamsById[p.awayTeamId]?.logo} name={teamName(p.awayTeamId)} color={teamsById[p.awayTeamId]?.color} size="sm" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="datetime-local"
                                                disabled={isPublished}
                                                defaultValue={p.startTime ? p.startTime.slice(0, 16) : ''}
                                                onBlur={(e) => updatePairing(p.round, p.index, { startTime: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                                className="bg-neutral-900 border border-white/10 rounded-md px-2 py-1.5 text-xs disabled:opacity-50"
                                            />
                                            <input
                                                type="text"
                                                disabled={isPublished}
                                                placeholder="Venue"
                                                defaultValue={p.venue ?? ''}
                                                onBlur={(e) => updatePairing(p.round, p.index, { venue: e.target.value || null })}
                                                className="bg-neutral-900 border border-white/10 rounded-md px-2 py-1.5 text-xs disabled:opacity-50"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="flex justify-end">
                        {isPublished ? (
                            <button
                                onClick={unpublish}
                                disabled={publishing}
                                className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/30 font-semibold rounded-xl px-6 py-3 text-sm disabled:opacity-40 hover:bg-red-500/20 transition-colors"
                            >
                                <Undo2 className="w-4 h-4" /> {publishing ? 'Unpublishing...' : 'Unpublish'}
                            </button>
                        ) : (
                            <button
                                onClick={publish}
                                disabled={publishing}
                                className="flex items-center gap-2 bg-primary text-black font-semibold rounded-xl px-6 py-3 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                            >
                                <Send className="w-4 h-4" /> {publishing ? 'Publishing...' : 'Publish Draw'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
