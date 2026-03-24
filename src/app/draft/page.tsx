'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, TrendingUp, Award, Target, Zap, Users } from 'lucide-react';
import Link from 'next/link';
import { getPrimaryTeam } from '@/lib/player-affiliation-utils';

interface Player {
    id: string;
    name: string;
    number: number;
    teamId: string;
    team?: Team | null;
    position: string;
    rating: number;
    eyePoints: number;
    age?: number;
    attributes?: any;
}

interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
}

export default function DraftPage() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [playersRes, teamsRes] = await Promise.all([
                    fetch('/api/players'),
                    fetch('/api/teams')
                ]);

                const playersData = await playersRes.json();
                const teamsData = await teamsRes.json();

                setPlayers(playersData);
                setTeams(teamsData);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    // Sort players by Eye Points (draft value)
    const topProspects = [...players].sort((a, b) => b.eyePoints - a.eyePoints);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/60">Loading prospects...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-12">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Star size={16} className="text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">BUSA League</span>
                        </div>
                        <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none">Draft Prospects</h1>
                        <p className="text-white/60 mt-2 text-sm">Top performing athletes ranked by Eye Points</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 border border-primary/20 px-6 py-3 rounded-2xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Total Prospects</p>
                            <p className="font-display text-3xl italic text-primary">{players.length}</p>
                        </div>
                    </div>
                </header>

                {/* Draft Board */}
                {topProspects.length > 0 ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-6">
                            <Award size={20} className="text-primary" />
                            <h2 className="font-display text-2xl tracking-tight italic uppercase">Top Prospects</h2>
                        </div>

                        {topProspects.map((player, idx) => {
                            const team = getPrimaryTeam(player, teams) as Team | null;
                            const rank = idx + 1;
                            const isTopPick = rank <= 3;

                            let attributes = null;
                            try {
                                attributes = typeof player.attributes === 'string'
                                    ? JSON.parse(player.attributes)
                                    : player.attributes;
                            } catch (e) {
                                // Ignore parse errors
                            }

                            return (
                                <motion.div
                                    key={player.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className={`bg-white/5 border rounded-3xl p-6 hover:bg-white/10 transition-all group ${isTopPick ? 'border-primary/30 bg-primary/5' : 'border-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-6">
                                        {/* Rank */}
                                        <div className={`flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center ${isTopPick ? 'bg-primary text-black' : 'bg-white/5 text-white/40'
                                            }`}>
                                            <span className="font-display text-2xl italic font-bold">#{rank}</span>
                                        </div>

                                        {/* Player Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4 mb-2">
                                                <div>
                                                    <h3 className="text-xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">
                                                        {player.name}
                                                    </h3>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-sm text-white/60">{player.position}</span>
                                                        <span className="text-white/20">•</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl">{team?.logo || '⚽'}</span>
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                                                                {team?.shortName || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Eye Points Badge */}
                                                <div className="flex-shrink-0 bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl">
                                                    <div className="flex items-center gap-2">
                                                        <Zap size={16} className="text-primary" fill="currentColor" />
                                                        <div>
                                                            <p className="text-[8px] font-bold uppercase tracking-widest text-white/40">Eye Points</p>
                                                            <p className="font-display text-xl italic text-primary">{player.eyePoints}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stats Bar */}
                                            {attributes && (
                                                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-4">
                                                    {Object.entries(attributes).map(([key, value]: [string, any]) => (
                                                        <div key={key}>
                                                            <p className="text-[8px] font-bold uppercase tracking-widest text-white/40 mb-1">
                                                                {key}
                                                            </p>
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                                    <div
                                                                        className="bg-primary h-full rounded-full"
                                                                        style={{ width: `${value}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] font-bold text-white/60 w-6">{value}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Performance Metrics */}
                                            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <Target size={14} className="text-primary" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                                                        Rating: <span className="text-white">{player.rating}</span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <TrendingUp size={14} className="text-primary" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                                                        Number: <span className="text-white">#{player.number}</span>
                                                    </span>
                                                </div>
                                                {player.age && (
                                                    <div className="flex items-center gap-2">
                                                        <Users size={14} className="text-white/40" />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                                                            Age: <span className="text-white">{player.age}</span>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <Users size={64} className="mx-auto text-white/10 mb-4" />
                        <h2 className="text-2xl font-bold mb-2">No Players Found</h2>
                        <p className="text-white/40">Add players to the database to see draft prospects</p>
                    </div>
                )}

                {/* Draft Insights */}
                {players.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                        <h3 className="font-display text-2xl tracking-tight italic uppercase mb-6">Draft Insights</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                            <div>
                                <Star size={32} className="mx-auto text-primary mb-3" fill="currentColor" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Top Prospect</p>
                                <p className="font-display text-2xl italic text-white">{topProspects[0]?.name || 'N/A'}</p>
                                <p className="text-sm text-white/60 mt-1">{topProspects[0]?.eyePoints || 0} Eye Points</p>
                            </div>
                            <div>
                                <Award size={32} className="mx-auto text-white/60 mb-3" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Avg Rating</p>
                                <p className="font-display text-2xl italic text-white">
                                    {(players.reduce((sum, p) => sum + p.rating, 0) / players.length).toFixed(1)}
                                </p>
                            </div>
                            <div>
                                <TrendingUp size={32} className="mx-auto text-white/60 mb-3" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Total Eye Points</p>
                                <p className="font-display text-2xl italic text-white">
                                    {players.reduce((sum, p) => sum + p.eyePoints, 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
