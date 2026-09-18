'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Activity, Play, Users, Clock } from 'lucide-react';

interface Match {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    status: string;
    startTime: string;
    venue: string;
    competition: string;
    round?: string;
    sport: string;
    homeTeam?: any;
    awayTeam?: any;
}

export default function LiveCenter() {
    const [liveMatches, setLiveMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLiveMatches() {
            try {
                const response = await fetch('/api/matches?status=LIVE');
                const data = await response.json();

                setLiveMatches(data);
            } catch (error) {
                console.error('Error fetching live matches:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchLiveMatches();

        // Poll every 15s — stopgap until WebSocket subscription is wired to the public viewer (BUG-020)
        const interval = setInterval(fetchLiveMatches, 15000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-foreground/60">Loading live matches...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <div className="border-b border-border bg-card sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="p-2 hover:bg-muted rounded-lg transition-colors">
                                <ArrowLeft size={20} />
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                                    <Play size={20} className="text-red-500 fill-red-500" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                        LIVE CENTER
                                    </h1>
                                    <p className="text-sm text-foreground/60">{liveMatches.length} matches live now</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
                            <Activity size={18} className="animate-pulse" />
                            <span className="text-xs font-bold uppercase tracking-widest">LIVE</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {liveMatches.length > 0 ? (
                    <div className="space-y-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/60 mb-6">
                            Live Matches ({liveMatches.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {liveMatches.map((match) => (
                                <Link
                                    key={match.id}
                                    href={`/matches/${match.id}`}
                                >
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-6 rounded-xl cursor-pointer transition-all bg-muted border border-border hover:border-primary/50 hover:bg-muted/80 group"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-xs text-foreground/60">{match.round ? `${match.competition} · ${match.round}` : match.competition}</span>
                                            <div className="flex items-center gap-1.5 text-red-500 text-xs font-bold">
                                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                                LIVE
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1">
                                                    {match.homeTeam?.logo && (
                                                        <img
                                                            src={match.homeTeam.logo}
                                                            alt={match.homeTeam.name}
                                                            className="w-8 h-8 object-contain"
                                                        />
                                                    )}
                                                    <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                                                        {match.homeTeam?.name || 'Home Team'}
                                                    </span>
                                                </div>
                                                <span className={`text-2xl font-bold ml-4 ${match.homeScore > match.awayScore ? 'text-primary' : 'text-foreground/60'}`}>
                                                    {match.homeScore}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1">
                                                    {match.awayTeam?.logo && (
                                                        <img
                                                            src={match.awayTeam.logo}
                                                            alt={match.awayTeam.name}
                                                            className="w-8 h-8 object-contain"
                                                        />
                                                    )}
                                                    <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                                                        {match.awayTeam?.name || 'Away Team'}
                                                    </span>
                                                </div>
                                                <span className={`text-2xl font-bold ml-4 ${match.awayScore > match.homeScore ? 'text-primary' : 'text-foreground/60'}`}>
                                                    {match.awayScore}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-foreground/40">
                                            <div className="flex items-center gap-2">
                                                <Users size={14} />
                                                <span>{match.venue}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} />
                                                {/* BACKLOG-401 #1: a malformed startTime (confirmed live: a
                                                    stringified-epoch value like "1788963960000.0" instead of ISO)
                                                    makes `new Date(...)` an Invalid Date -- toLocaleTimeString()
                                                    on that silently returns the literal string "Invalid Date"
                                                    rather than throwing, so it rendered unguarded on a real public
                                                    match card. Defensive coercion: degrade to "TBD" instead. */}
                                                <span>{(() => {
                                                    const d = new Date(match.startTime);
                                                    // No locale arg -- uses the viewer's own device locale (and
                                                    // always the device's local timezone regardless, per Date's
                                                    // own semantics) rather than assuming 'en-US' formatting for
                                                    // every viewer.
                                                    return isNaN(d.getTime())
                                                        ? 'TBD'
                                                        : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                                                })()}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="py-20 text-center">
                        <Activity size={64} className="mx-auto text-foreground/10 mb-4" />
                        <h2 className="text-2xl font-bold mb-2">No Live Matches</h2>
                        <p className="text-foreground/40">Check back later for live action!</p>
                        <Link href="/" className="inline-block mt-6 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors">
                            Back to Home
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
