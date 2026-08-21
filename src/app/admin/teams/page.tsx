'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Layers, Search, Loader2, Users, ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import ErrorBoundary from '@/components/admin/ErrorBoundary';

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

const SPORT_FILTERS = ['All', 'Football', 'Basketball', 'Volleyball', 'Track & Field'] as const;

function InitialsAvatar({ name, color }: { name: string; color: string }) {
    const initials = name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-black text-lg text-white shrink-0"
            style={{ backgroundColor: color || '#1a1a1a' }}
        >
            {initials}
        </div>
    );
}

function TeamsPageContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [teams, setTeams] = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sportFilter, setSportFilter] = useState<string>('All');

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/login?callbackUrl=/admin/teams');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const res = await fetch('/api/teams');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) setTeams(data);
                }
            } catch (err) {
                console.error('Teams fetch failed:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTeams();
    }, []);

    const filtered = useMemo(() => {
        return teams.filter((t) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch =
                !q ||
                t.name.toLowerCase().includes(q) ||
                t.shortName.toLowerCase().includes(q) ||
                t.university.toLowerCase().includes(q);

            const matchesSport =
                sportFilter === 'All' || t.sport === sportFilter;

            return matchesSearch && matchesSport;
        });
    }, [teams, searchQuery, sportFilter]);

    if (authLoading) return null;

    return (
        <div className="min-h-screen bg-black text-white selection:bg-primary selection:text-black">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5 py-4 md:py-6 px-4 md:px-8">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div>
                            <h1 className="text-xl md:text-2xl font-display font-black uppercase italic tracking-tighter flex items-center gap-2 md:gap-3">
                                <Layers className="text-primary" size={24} />
                                Teams
                                {!isLoading && (
                                    <span className="text-sm font-bold text-white/30 not-italic normal-case tracking-normal">
                                        {filtered.length}
                                    </span>
                                )}
                            </h1>
                            <p className="text-[8px] md:text-[10px] uppercase tracking-widest font-bold text-white/40">
                                Roster Builder — Manage team squads
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
                {/* Search + Sport filter */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative group flex-1">
                        <Search
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Search teams..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3 md:py-4 focus:outline-none focus:border-primary/50 transition-all font-bold text-xs md:text-sm"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 shrink-0">
                        {SPORT_FILTERS.map((s) => (
                            <button
                                key={s}
                                onClick={() => setSportFilter(s)}
                                className={`px-4 py-3 rounded-2xl font-black uppercase italic text-[10px] tracking-widest whitespace-nowrap transition-all border ${
                                    sportFilter === s
                                        ? 'bg-primary text-black border-transparent'
                                        : 'bg-white/5 text-white/40 border-white/10 hover:text-white hover:bg-white/10'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <Loader2 className="animate-spin text-primary" size={40} />
                        <p className="text-white/40 font-bold uppercase tracking-widest text-[10px]">
                            Loading teams...
                        </p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/5">
                            <Users size={40} className="text-white/10" />
                        </div>
                        <h3 className="text-xl font-display font-black italic uppercase">No Teams Found</h3>
                        <p className="text-white/30 text-xs font-bold uppercase tracking-widest">
                            Refine your search or sport filter
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((team) => (
                            <div
                                key={team.id}
                                className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 hover:border-white/20 hover:bg-white/[0.05] transition-all group"
                            >
                                <div className="flex items-start gap-4 mb-5">
                                    {team.logo && team.logo !== '' && !team.logo.startsWith('placeholder') ? (
                                        <img
                                            src={team.logo}
                                            alt={team.name}
                                            className="w-14 h-14 rounded-2xl object-contain bg-white/5 shrink-0"
                                        />
                                    ) : (
                                        <InitialsAvatar name={team.name} color={team.color} />
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <div className="font-display font-black text-base uppercase italic tracking-tight leading-tight truncate">
                                            {team.name}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="px-2 py-0.5 bg-white/10 text-white/60 text-[9px] font-black rounded uppercase tracking-wider">
                                                {team.shortName}
                                            </span>
                                            <span
                                                className="px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider text-black"
                                                style={{ backgroundColor: team.color || '#888' }}
                                            >
                                                {team.sport}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-[10px] font-bold text-white/30 uppercase tracking-wide mb-5 truncate">
                                    {team.university}
                                </div>

                                <Link
                                    href={`/admin/teams/${team.id}`}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-primary/10 border border-primary/20 text-primary rounded-xl font-black uppercase italic text-[10px] tracking-widest hover:bg-primary hover:text-black transition-all group/btn"
                                >
                                    Manage Roster
                                    <ArrowRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AdminTeamsPage() {
    return (
        <ErrorBoundary>
            <TeamsPageContent />
        </ErrorBoundary>
    );
}
