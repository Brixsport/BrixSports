'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { TeamLogo } from '@/lib/utils/team-logo';
import {
    ArrowLeft, Edit, Save, X, Star, User,
    Building2, Shield, Activity, AlertCircle, Loader2
} from 'lucide-react';

interface Player {
    id: string;
    name: string;
    jerseyName: string | null;
    number: number | null;
    teamId: string | null;
    position: string | null;
    rating: number | null;
    eyePoints: number | null;
    marketValue: number | null;
    age: number | null;
    height: string | null;
    weight: string | null;
    nationality: string | null;
    college: string | null;
    department: string | null;
    university: string | null;
    image: string | null;
    profileId: string | null;
    email: string | null;
    team?: { id: string; name: string; shortName: string; sport: string; logo?: string | null } | null;
    memberships?: Membership[];
    organizationAffiliations?: OrgAffiliation[];
}

interface Membership {
    affiliation: {
        id: string;
        teamId: string;
        affiliationType: string | null;
        isPrimary: boolean | null;
        isActive: boolean | null;
        jerseyNumber: number | null;
        nicknames: string[] | null;
        position: string | null;
    };
    team: {
        id: string;
        name: string;
        shortName: string;
        sport: string;
        logo?: string | null;
    };
}

interface OrgAffiliation {
    affiliation: {
        affiliationType: string | null;
        isPrimary: boolean | null;
        role: string | null;
        status: string | null;
    };
    organization: {
        id: string;
        name: string;
        shortName: string | null;
        type: string;
    };
}

interface RecentMatch {
    match: {
        id: string;
        homeScore: number | null;
        awayScore: number | null;
        competition: string;
        startTime: string;
        homeTeam?: { name: string; shortName: string } | null;
        awayTeam?: { name: string; shortName: string } | null;
    } | null;
    events: { id: string; type: string; minute: number | null }[];
}

export default function PlayerDetailPage() {
    const { user, loading: authLoading, isAuthenticated } = useAuth();
    const router = useRouter();
    const params = useParams();
    const playerId = params.id as string;

    const [player, setPlayer] = useState<Player | null>(null);
    const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState<Partial<Player>>({});
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!authLoading) {
            if (!isAuthenticated) {
                router.push('/login');
            } else if (user?.role !== 'admin') {
                router.push('/admin');
            }
        }
    }, [authLoading, isAuthenticated, user, router]);

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchPlayer();
        }
    }, [user, playerId]);

    const fetchPlayer = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/players/${playerId}`);
            if (!res.ok) {
                setErrorMsg('Player not found');
                return;
            }
            const data = await res.json();
            setPlayer(data.player);
            setForm(data.player);
            setRecentMatches(data.recentMatches ?? []);
        } catch {
            setErrorMsg('Failed to load player');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!player) return;
        setSaving(true);
        setErrorMsg('');
        try {
            const res = await fetch(`/api/players/${playerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name,
                    jerseyName: form.jerseyName,
                    number: form.number,
                    position: form.position,
                    age: form.age,
                    height: form.height,
                    weight: form.weight,
                    nationality: form.nationality,
                    college: form.college,
                    department: form.department,
                    university: form.university,
                    email: form.email,
                    rating: form.rating,
                    eyePoints: form.eyePoints,
                    marketValue: form.marketValue,
                }),
            });
            if (!res.ok) {
                const d = await res.json();
                setErrorMsg(d.error || 'Failed to save');
                return;
            }
            await fetchPlayer();
            setEditMode(false);
        } catch {
            setErrorMsg('Network error');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setForm(player ?? {});
        setEditMode(false);
        setErrorMsg('');
    };

    const field = (label: string, key: keyof Player, type: 'text' | 'number' = 'text') => {
        const value = editMode ? (form[key] ?? '') : (player?.[key] ?? '');
        const displayVal = value === '' || value === null || value === undefined ? '—' : String(value);
        if (!editMode) {
            return (
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">{label}</p>
                    <p className="font-bold text-sm">{displayVal}</p>
                </div>
            );
        }
        return (
            <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">{label}</label>
                <input
                    type={type}
                    value={value as string | number}
                    onChange={e => setForm(prev => ({
                        ...prev,
                        [key]: type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value,
                    }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary/50 font-bold text-sm transition-all"
                />
            </div>
        );
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        );
    }

    if (errorMsg && !player) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
                <div className="text-center">
                    <AlertCircle className="mx-auto mb-4 text-red-500" size={40} />
                    <p className="font-bold">{errorMsg}</p>
                    <Link href="/admin/players" className="mt-4 inline-block text-primary underline text-sm">
                        ← Back to Players
                    </Link>
                </div>
            </div>
        );
    }

    if (!player) return null;

    const nicknames = (str: string | string[] | null | undefined): string => {
        if (!str) return '—';
        if (Array.isArray(str)) return str.length > 0 ? str.join(', ') : '—';
        try { const p = JSON.parse(str); return Array.isArray(p) && p.length > 0 ? p.join(', ') : '—'; } catch { return str; }
    };

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5 py-4 px-4 md:px-8">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/players" className="p-2 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10 group">
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <TeamLogo logo={player.image} name={player.name} size="lg" />
                            <div>
                                <h1 className="text-xl font-display font-black uppercase italic tracking-tighter leading-none">{player.name}</h1>
                                {player.jerseyName && (
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-0.5">{player.jerseyName}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                    {player.position && (
                                        <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[9px] font-black rounded uppercase italic">
                                            {player.position}
                                        </span>
                                    )}
                                    {player.university && (
                                        <span className="px-1.5 py-0.5 bg-white/10 text-white/60 text-[9px] font-bold rounded uppercase">
                                            {player.university}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!editMode ? (
                            <button
                                onClick={() => setEditMode(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-xl font-black uppercase italic text-[10px] tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                <Edit size={14} strokeWidth={3} />
                                Edit Profile
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleCancel}
                                    className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-xl font-black uppercase italic text-[10px] tracking-widest hover:bg-white/5 transition-all"
                                >
                                    <X size={14} />
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-xl font-black uppercase italic text-[10px] tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                                >
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">
                {errorMsg && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-bold">
                        <AlertCircle size={16} />
                        {errorMsg}
                    </div>
                )}

                {/* Section C — Profile fields */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-6 flex items-center gap-2">
                        <User size={14} /> Player Profile
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-5">
                            {field('Full Name', 'name')}
                            {field('Jersey Name', 'jerseyName')}
                            {field('Jersey Number', 'number', 'number')}
                            {field('Position', 'position')}
                            {field('Age', 'age', 'number')}
                            {field('College', 'college')}
                            {field('Department', 'department')}
                            {field('University', 'university')}
                        </div>
                        <div className="space-y-5">
                            {field('Height', 'height')}
                            {field('Weight', 'weight')}
                            {field('Nationality', 'nationality')}
                            {field('Email', 'email')}
                            {field('Rating (0–10)', 'rating', 'number')}
                            {field('Eye Points', 'eyePoints', 'number')}
                            {field('Market Value', 'marketValue', 'number')}
                        </div>
                    </div>
                </div>

                {/* Section D — Team Memberships */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-6 flex items-center gap-2">
                        <Shield size={14} /> Team Affiliations
                    </h2>
                    {!player.memberships || player.memberships.length === 0 ? (
                        <p className="text-white/30 text-sm font-bold">No team affiliations recorded.</p>
                    ) : (
                        <div className="space-y-3">
                            {player.memberships.map((m, i) => (
                                <div key={m.affiliation.id ?? i} className="flex items-start gap-4 p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                                    <div className="shrink-0 mt-0.5">
                                        <TeamLogo logo={m.team.logo} name={m.team.name} size="sm" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-sm">{m.team.name}</span>
                                            <span className="px-1.5 py-0.5 bg-white/10 text-white/50 text-[9px] font-bold rounded uppercase">{m.team.sport}</span>
                                            {m.affiliation.affiliationType && (
                                                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-bold rounded uppercase">{m.affiliation.affiliationType}</span>
                                            )}
                                            {m.affiliation.isPrimary && (
                                                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                                            )}
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                                            <div>
                                                <span className="text-white/30 font-bold uppercase">Jersey #</span>
                                                <p className="font-bold mt-0.5">{m.affiliation.jerseyNumber ?? '—'}</p>
                                            </div>
                                            <div>
                                                <span className="text-white/30 font-bold uppercase">Position</span>
                                                <p className="font-bold mt-0.5">{m.affiliation.position ?? '—'}</p>
                                            </div>
                                            <div>
                                                <span className="text-white/30 font-bold uppercase">Nicknames</span>
                                                <p className="font-bold mt-0.5">{nicknames(m.affiliation.nicknames as string[] | null)}</p>
                                            </div>
                                            <div>
                                                <span className="text-white/30 font-bold uppercase">Active</span>
                                                <div className="mt-0.5 flex items-center gap-1">
                                                    <span
                                                        title="Inline deactivation coming in BACKLOG-053"
                                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase cursor-not-allowed opacity-60 ${m.affiliation.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                                                    >
                                                        {m.affiliation.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section E — Org Affiliations */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-6 flex items-center gap-2">
                        <Building2 size={14} /> Organisation Affiliations
                    </h2>
                    {!player.organizationAffiliations || player.organizationAffiliations.length === 0 ? (
                        <p className="text-white/30 text-sm font-bold">No organisation affiliations recorded.</p>
                    ) : (
                        <div className="space-y-2">
                            {player.organizationAffiliations.map((o, i) => (
                                <div key={o.organization.id ?? i} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                                    <div className="flex-1 min-w-0">
                                        <span className="font-bold text-sm">{o.organization.name}</span>
                                        {o.organization.shortName && (
                                            <span className="ml-2 text-white/40 text-xs font-bold">({o.organization.shortName})</span>
                                        )}
                                    </div>
                                    <span className="px-1.5 py-0.5 bg-white/10 text-white/50 text-[9px] font-bold rounded uppercase shrink-0">
                                        {o.organization.type}
                                    </span>
                                    {o.affiliation.isPrimary && (
                                        <Star size={12} className="text-yellow-400 fill-yellow-400 shrink-0" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section F — Recent Match Events */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-6 flex items-center gap-2">
                        <Activity size={14} /> Recent Match Events
                    </h2>
                    {recentMatches.length === 0 ? (
                        <p className="text-white/30 text-sm font-bold">No match events recorded.</p>
                    ) : (
                        <div className="space-y-4">
                            {recentMatches.map((rm, i) => {
                                const m = rm.match;
                                const matchName = m?.homeTeam && m?.awayTeam
                                    ? `${m.homeTeam.shortName ?? m.homeTeam.name} vs ${m.awayTeam.shortName ?? m.awayTeam.name}`
                                    : m?.competition ?? 'Unknown match';
                                return (
                                    <div key={m?.id ?? i} className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="text-sm font-bold truncate">{matchName}</span>
                                            {m && (
                                                <span className="text-white/50 text-xs font-bold shrink-0">{m.homeScore} - {m.awayScore}</span>
                                            )}
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            {rm.events.map(ev => (
                                                <span
                                                    key={ev.id}
                                                    className="px-2 py-0.5 bg-primary/20 text-primary text-[9px] font-black rounded uppercase italic"
                                                >
                                                    {ev.type} {ev.minute != null && ev.minute >= 0 ? `${ev.minute}'` : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
