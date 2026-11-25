'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Search, RotateCcw, Eye, Save, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { BACKFILL_EVENT_TYPES } from '@/lib/event-backfill';
import {
    playerLabel,
    rowsToPayload,
    scoreFromRows,
    scorerOptions,
    searchRoster,
    type EventRow,
    type RosterPlayer,
    type Side,
} from '@/lib/backfill-ui';

interface MatchTeam { name: string; shortName: string }
interface MatchItem {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam?: MatchTeam | null;
    awayTeam?: MatchTeam | null;
    homeScore: number;
    awayScore: number;
    status: string;
    startTime: string;
    competition?: string;
    matchType?: string;
}
interface Effect { playerId: string; deltas: Record<string, number> }
interface Preview {
    mode: string;
    score: { home: number; away: number };
    eventsScore: { home: number; away: number };
    scoreWarning: string | null;
    statsApplied: boolean;
    statEffects: Effect[];
}

const inputCls = 'bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-primary';
const STAT_LABELS: Record<string, string> = {
    goals: 'Goals', assists: 'Assists', shotsOnTarget: 'Shots on target', penaltiesScored: 'Penalties scored',
    yellowCards: 'Yellow cards', redCards: 'Red cards', ownGoals: 'Own goals',
};
const statLabel = (k: string) => STAT_LABELS[k] ?? k.replace(/([A-Z])/g, ' $1').toLowerCase();
const shortDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };
let rowCounter = 0;
const newRow = (side: Side): EventRow => ({ key: `r${++rowCounter}`, type: 'Goal', side, playerId: '', relatedPlayerId: '' });

const teamName = (m: MatchItem, side: Side) => (side === 'home' ? m.homeTeam?.shortName || m.homeTeam?.name || m.homeTeamId : m.awayTeam?.shortName || m.awayTeam?.name || m.awayTeamId);

/** Search box + dropdown of roster players, matching name, jersey name, nickname and number. */
function PlayerPicker({ roster, value, onChange, placeholder, label, allowedIds }: {
    roster: RosterPlayer[];
    value: string;
    onChange: (id: string) => void;
    placeholder: string;
    label: string;
    allowedIds?: string[];
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const pool = allowedIds ? roster.filter(p => allowedIds.includes(p.playerId)) : roster;
    const selected = roster.find(p => p.playerId === value);
    const results = useMemo(() => searchRoster(pool, query), [pool, query]);

    return (
        <div className="relative flex-1 min-w-[180px]">
            <span className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">{label}</span>
            <input
                role="combobox"
                aria-expanded={open}
                aria-autocomplete="list"
                aria-label={placeholder}
                value={open ? query : selected ? playerLabel(selected) : ''}
                onFocus={() => { setOpen(true); setQuery(''); }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className={`${inputCls} w-full`}
            />
            {open && (
                <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl">
                    {value && (
                        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(''); setOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-white/40 hover:bg-white/5">
                            Clear
                        </button>
                    )}
                    {results.length === 0 && <p className="px-3 py-2 text-xs text-white/30">No player matches</p>}
                    {results.map(p => (
                        <button key={p.playerId} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(p.playerId); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm font-bold text-white hover:bg-white/10">
                            {playerLabel(p)}
                            {p.nicknames.length > 0 && <span className="ml-2 text-[10px] text-white/30">{p.nicknames.join(', ')}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function BackfillEventsPage() {
    const { toasts, removeToast, success, error } = useToast();
    const [matches, setMatches] = useState<MatchItem[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'UPCOMING' | 'FINISHED'>('all');
    const [match, setMatch] = useState<MatchItem | null>(null);
    const [rosters, setRosters] = useState<{ home: RosterPlayer[]; away: RosterPlayer[] }>({ home: [], away: [] });
    const [rows, setRows] = useState<EventRow[]>([]);
    const [scoreOverride, setScoreOverride] = useState<{ home: string; away: string } | null>(null);
    const [allowMismatch, setAllowMismatch] = useState(false);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [problems, setProblems] = useState<string[]>([]);
    const [busy, setBusy] = useState<'preview' | 'save' | 'reopen' | null>(null);
    const [confirm, setConfirm] = useState<'save' | 'reopen' | null>(null);
    const [followUps, setFollowUps] = useState<Record<string, string> | null>(null);
    const listToken = useRef(0);

    const loadMatches = async () => {
        const my = ++listToken.current;
        setLoadingList(true);
        try {
            const [up, fin] = await Promise.all([
                fetch('/api/matches?sport=Football&status=UPCOMING&limit=200&order=start_asc'),
                fetch('/api/matches?sport=Football&status=FINISHED&limit=200&order=start_desc'),
            ]);
            if (!up.ok || !fin.ok) throw new Error('list failed');
            const list = [...(await up.json()), ...(await fin.json())] as MatchItem[];
            if (my === listToken.current) setMatches(list);
        } catch {
            error('Could not load matches. Refresh to try again.');
        } finally {
            if (my === listToken.current) setLoadingList(false);
        }
    };
    useEffect(() => { loadMatches(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    const shown = useMemo(() => {
        const q = filter.trim().toLowerCase();
        const byStatus = statusFilter === 'all' ? matches : matches.filter(m => m.status === statusFilter);
        if (!q) return byStatus;
        return byStatus.filter(m => [teamName(m, 'home'), teamName(m, 'away'), m.homeTeam?.name, m.awayTeam?.name, m.competition, m.id].some(v => v?.toLowerCase().includes(q)));
    }, [matches, filter, statusFilter]);

    const loadRoster = async (teamId: string): Promise<RosterPlayer[]> => {
        const res = await fetch(`/api/admin/teams/${teamId}/roster`);
        if (!res.ok) throw new Error(`roster ${res.status}`);
        const data = await res.json();
        const seen = new Set<string>();
        const list: RosterPlayer[] = [];
        for (const r of data.roster ?? []) {
            if (seen.has(r.playerId)) continue;
            seen.add(r.playerId);
            list.push({ playerId: r.playerId, name: r.name, jerseyName: r.jerseyName ?? null, jerseyNumber: r.jerseyNumber ?? null, nicknames: Array.isArray(r.nicknames) ? r.nicknames : [] });
        }
        return list;
    };

    const resetForm = () => { setRows([]); setScoreOverride(null); setAllowMismatch(false); setPreview(null); setProblems([]); setFollowUps(null); };

    const openMatch = async (m: MatchItem) => {
        resetForm();
        setMatch(m);
        setRosters({ home: [], away: [] });
        try {
            const [home, away] = await Promise.all([loadRoster(m.homeTeamId), loadRoster(m.awayTeamId)]);
            setRosters({ home, away });
        } catch {
            error('Could not load the team rosters for this match.');
        }
    };

    const isUpcoming = match?.status === 'UPCOMING';
    const computed = useMemo(() => scoreFromRows(rows), [rows]);
    const target = !match ? computed : isUpcoming
        ? { home: scoreOverride ? Number(scoreOverride.home) : computed.home, away: scoreOverride ? Number(scoreOverride.away) : computed.away }
        : { home: match.homeScore, away: match.awayScore };
    const mismatch = !!match && rows.length > 0 && (computed.home !== target.home || computed.away !== target.away);

    const updateRow = (key: string, patch: Partial<EventRow>) => { setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r))); setPreview(null); };

    const send = async (dryRun: boolean) => {
        if (!match) return null;
        const { events, problems: p } = rowsToPayload(rows, { home: match.homeTeamId, away: match.awayTeamId });
        if (events.length === 0) p.push('Add at least one event');
        setProblems(p);
        if (p.length > 0) return null;
        const res = await fetch(`/api/admin/matches/${match.id}/backfill-events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events, score: isUpcoming ? target : undefined, allowMismatch, dryRun }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            const detail = Array.isArray(json.details) ? ` ${json.details.join('; ')}` : '';
            setProblems([`${json.error ?? 'Request failed'}${detail}`]);
            if (json.code === 'SCORE_MISMATCH') setProblems([`${json.error}. Fix the events, change the score, or tick "save anyway".`]);
            return null;
        }
        return json;
    };

    const runPreview = async () => {
        setBusy('preview');
        try {
            const json = await send(true);
            if (json) { setPreview(json as Preview); }
        } catch { error('Preview failed. Check your connection and try again.'); }
        finally { setBusy(null); }
    };

    const runSave = async () => {
        setConfirm(null);
        setBusy('save');
        try {
            const json = await send(false);
            if (json) {
                success(`Saved ${json.eventsInserted} events. Final score ${json.score.home}-${json.score.away}.`);
                setFollowUps(json.followUps ?? {});
                setRows([]); setPreview(null); setScoreOverride(null); setAllowMismatch(false);
                setMatch(prev => prev ? { ...prev, status: 'FINISHED', homeScore: json.score.home, awayScore: json.score.away } : prev);
                loadMatches();
            }
        } catch { error('Save failed. Nothing may have been saved: reload the match and check before retrying.'); }
        finally { setBusy(null); }
    };

    const runReopen = async () => {
        if (!match) return;
        setConfirm(null);
        setBusy('reopen');
        try {
            const res = await fetch(`/api/admin/matches/${match.id}/backfill-events`, { method: 'DELETE' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) { error(json.error ?? 'Reopen failed'); return; }
            success(`Removed ${json.eventsRemoved} backfilled events and reversed their stats.`);
            setPreview(null); setFollowUps(null);
        } catch { error('Reopen failed. Reload the match and check its events before retrying.'); }
        finally { setBusy(null); }
    };

    const nameOf = (id: string) => [...rosters.home, ...rosters.away].find(p => p.playerId === id)?.name ?? id;

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-8 text-white">
            <ToastContainer toasts={toasts} onClose={removeToast} />
            <div className="pr-14 sm:pr-0 mb-6">
                <h1 className="text-2xl sm:text-4xl font-display italic uppercase tracking-tight leading-none mb-2">Add Match Events</h1>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Football matches that were not logged live</p>
                <p className="text-sm text-white/50 mt-2">Events are saved with no minute and update player stats. To change a score on its own, use Match Management instead.</p>
            </div>

            {!match && (
                <div>
                    <div className="relative mb-4">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search by team or competition" className={`${inputCls} w-full pl-9`} />
                    </div>
                    <div className="flex gap-2 mb-4" role="group" aria-label="Filter by status">
                        {(['all', 'UPCOMING', 'FINISHED'] as const).map(f => (
                            <button key={f} onClick={() => setStatusFilter(f)} aria-pressed={statusFilter === f} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${statusFilter === f ? 'bg-primary text-black border-primary' : 'border-white/10 text-white/50 hover:text-white'}`}>
                                {f === 'all' ? 'All' : f === 'UPCOMING' ? 'Upcoming' : 'Finished'}
                            </button>
                        ))}
                    </div>
                    {loadingList && <p className="text-white/30 text-sm">Loading matches…</p>}
                    {!loadingList && shown.length === 0 && <p className="text-white/30 text-sm">No football matches match this search. Only upcoming and finished matches can be backfilled.</p>}
                    <div className="space-y-2">
                        {shown.map(m => (
                            <button key={m.id} onClick={() => openMatch(m)} className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-black">{teamName(m, 'home')} <span className="text-white/40">{m.status === 'UPCOMING' ? 'vs' : `${m.homeScore}-${m.awayScore}`}</span> {teamName(m, 'away')}</p>
                                    <p className="text-xs text-white/40">{[m.competition ?? 'Friendly', shortDate(m.startTime)].filter(Boolean).join(' · ')}</p>
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${m.status === 'UPCOMING' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'}`}>{m.status}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {match && (
                <div>
                    <button onClick={() => { setMatch(null); resetForm(); }} className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-white/50 hover:text-white mb-4"><ChevronLeft size={14} /> Pick another match</button>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-lg font-black">{teamName(match, 'home')} vs {teamName(match, 'away')}</p>
                            <p className="text-xs text-white/40">{match.status === 'UPCOMING' ? 'Upcoming 0-0: saving will mark it finished' : `Finished ${match.homeScore}-${match.awayScore}: the stored score is kept`}</p>
                        </div>
                        {!isUpcoming && (
                            <button disabled={busy !== null} onClick={() => setConfirm('reopen')} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-400 hover:text-red-300 disabled:opacity-40"><RotateCcw size={14} /> Reopen (remove backfilled events)</button>
                        )}
                    </div>

                    {rows.length === 0 && (
                        <div className="border border-dashed border-white/10 rounded-2xl p-6 mb-3 text-center">
                            <p className="text-sm text-white/60 font-bold">No events yet</p>
                            <p className="text-xs text-white/30 mt-1">Add the goals first, then the assists linked to them, then cards.</p>
                        </div>
                    )}
                    {rows.map((row, i) => {
                        const roster = rosters[row.side];
                        const scorers = scorerOptions(rows, row.side);
                        return (
                            <div key={row.key} className="bg-white/5 border border-white/10 rounded-2xl p-3 mb-3 flex flex-wrap items-center gap-2">
                                <span className="text-xs font-black text-white/30 w-6">{i + 1}</span>
                                <select aria-label={`Event ${i + 1} type`} value={row.type} onChange={e => updateRow(row.key, { type: e.target.value as EventRow['type'], relatedPlayerId: '' })} className={inputCls}>
                                    {BACKFILL_EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select aria-label={`Event ${i + 1} team`} value={row.side} onChange={e => updateRow(row.key, { side: e.target.value as Side, playerId: '', relatedPlayerId: '' })} className={inputCls}>
                                    <option value="home">{teamName(match, 'home')}</option>
                                    <option value="away">{teamName(match, 'away')}</option>
                                </select>
                                <PlayerPicker roster={roster} value={row.playerId} label={row.type === 'Goal' || row.type === 'Penalty' ? 'Scorer' : row.type === 'Assist' ? 'Assisted by' : 'Player'} onChange={id => updateRow(row.key, { playerId: id })} placeholder={row.type === 'Goal' || row.type === 'Penalty' ? 'Scorer (leave empty if unknown)' : row.type === 'Assist' ? 'Assisted by' : 'Player'} />
                                {row.type === 'Assist' && (
                                    <PlayerPicker roster={roster} allowedIds={scorers} label="Scored by" value={row.relatedPlayerId} onChange={id => updateRow(row.key, { relatedPlayerId: id })} placeholder={scorers.length ? 'Scorer' : 'Add the goal first'} />
                                )}
                                <button onClick={() => { setRows(prev => prev.filter(r => r.key !== row.key)); setPreview(null); }} className="p-2 text-white/30 hover:text-red-400" aria-label={`Remove event ${i + 1}`}><Trash2 size={18} /></button>
                            </div>
                        );
                    })}

                    <div className="flex gap-4 mb-6">
                        <button onClick={() => { setRows(prev => [...prev, newRow(prev.length ? prev[prev.length - 1].side : 'home')]); setPreview(null); }} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary hover:text-white"><Plus size={14} /> Add event</button>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
                        <p className="text-xs font-black uppercase tracking-widest text-white/40 mb-2">Score</p>
                        {isUpcoming ? (
                            <div className="flex items-center gap-2">
                                <input type="number" min={0} max={99} value={scoreOverride ? scoreOverride.home : computed.home} onChange={e => { setScoreOverride({ home: e.target.value, away: scoreOverride ? scoreOverride.away : String(computed.away) }); setPreview(null); }} className={`${inputCls} w-20`} />
                                <span className="text-white/40">-</span>
                                <input type="number" min={0} max={99} value={scoreOverride ? scoreOverride.away : computed.away} onChange={e => { setScoreOverride({ home: scoreOverride ? scoreOverride.home : String(computed.home), away: e.target.value }); setPreview(null); }} className={`${inputCls} w-20`} />
                                <span className="text-xs text-white/30">Events add up to {computed.home}-{computed.away}</span>
                            </div>
                        ) : (
                            <p className="font-black">{match.homeScore}-{match.awayScore} <span className="text-xs font-normal text-white/30">events add up to {computed.home}-{computed.away}</span></p>
                        )}
                        {mismatch && (
                            <label className="mt-3 flex items-center gap-2 text-xs text-yellow-400">
                                <input type="checkbox" checked={allowMismatch} onChange={e => setAllowMismatch(e.target.checked)} />
                                Events do not add up to the score (e.g. unknown scorers). Save anyway.
                            </label>
                        )}
                    </div>

                    {problems.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4 text-sm text-red-300">
                            {problems.map((p, i) => <p key={i}>{p}</p>)}
                        </div>
                    )}

                    {preview && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
                            <p className="text-xs font-black uppercase tracking-widest text-white/40 mb-2">Preview: nothing saved yet</p>
                            <p className="text-sm mb-2">Final score {preview.score.home}-{preview.score.away}. {preview.statsApplied ? 'Player stats that will change:' : 'Friendly match: no player stats are credited.'}</p>
                            <ul className="text-sm space-y-1">
                                {preview.statEffects.map(e => (
                                    <li key={e.playerId}><span className="font-bold">{nameOf(e.playerId)}</span> <span className="text-white/50">{Object.entries(e.deltas).map(([k, v]) => `${statLabel(k)} +${v}`).join(', ')}</span></li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {followUps && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 mb-4 text-sm text-green-300">
                            Saved. {Object.entries(followUps).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'Score and standings were already final.'}
                            <div className="flex gap-4 mt-2">
                                <a href={`/matches/${match.id}`} target="_blank" rel="noreferrer" className="text-xs font-black uppercase tracking-widest text-green-200 underline">View match page</a>
                                <button onClick={() => { setMatch(null); resetForm(); }} className="text-xs font-black uppercase tracking-widest text-green-200 underline">Add events to another match</button>
                            </div>
                            {Object.values(followUps).includes('failed') && <p className="text-red-300 mt-1">A follow-up step failed. The events are saved; recalculate standings from the competition page.</p>}
                        </div>
                    )}

                    <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-[#050505]/95 backdrop-blur border-t border-white/10 sm:border-0 flex flex-wrap items-center gap-3">
                        <span className="text-xs text-white/40 w-full sm:w-auto sm:mr-auto">{rows.length} {rows.length === 1 ? 'event' : 'events'} · {target.home}-{target.away}</span>
                        <button disabled={busy !== null || rows.length === 0} onClick={runPreview} className="flex flex-1 sm:flex-none justify-center items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black uppercase tracking-widest disabled:opacity-40"><Eye size={14} /> {busy === 'preview' ? 'Checking…' : 'Preview'}</button>
                        <button disabled={busy !== null || rows.length === 0 || (mismatch && !allowMismatch)} onClick={() => { const { problems: p } = rowsToPayload(rows, { home: match.homeTeamId, away: match.awayTeamId }); setProblems(p); if (p.length === 0) setConfirm('save'); }} className="flex flex-1 sm:flex-none justify-center items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black text-xs font-black uppercase tracking-widest disabled:opacity-40"><Save size={14} /> {busy === 'save' ? 'Saving…' : 'Save events'}</button>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={confirm === 'save'}
                onClose={() => setConfirm(null)}
                onConfirm={runSave}
                title="Save these events?"
                message={`${rows.length} events will be saved${isUpcoming ? `, the match will be marked finished ${target.home}-${target.away}` : ''}, and player stats will be updated. You can undo this with Reopen.`}
                confirmText="Save events"
                variant="warning"
            />
            <ConfirmDialog
                isOpen={confirm === 'reopen'}
                onClose={() => setConfirm(null)}
                onConfirm={runReopen}
                title="Remove backfilled events?"
                message="This removes only events added by backfill (no minute) from this match and reverses their player stats. Live-logged events, the score and the status are left as they are."
                confirmText="Reopen"
                variant="danger"
            />
        </div>
    );
}
