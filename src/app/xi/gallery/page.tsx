'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Trophy,
    Heart,
    Eye,
    MessageCircle,
    Share2,
    ArrowLeft,
    Filter,
    TrendingUp,
    Clock,
    Users,
} from 'lucide-react';
import Link from 'next/link';

interface UserXI {
    id: string;
    userId: string;
    name: string;
    formation: string;
    players: string;
    isPublic: boolean;
    likes: number;
    views: number;
    createdAt: string;
}

export default function XIGalleryPage() {
    const [teams, setTeams] = useState<UserXI[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('recent');

    useEffect(() => {
        fetchTeams();
    }, [sortBy]);

    const fetchTeams = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/user/xi?public=true');
            const data = await response.json();
            let sortedTeams = data.teams || [];

            // Sort teams
            if (sortBy === 'popular') {
                sortedTeams.sort((a: UserXI, b: UserXI) => b.likes - a.likes);
            } else if (sortBy === 'views') {
                sortedTeams.sort((a: UserXI, b: UserXI) => b.views - a.views);
            }

            setTeams(sortedTeams);
        } catch (error) {
            console.error('Error fetching teams:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/xi"
                                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                Back to Builder
                            </Link>
                            <div className="h-6 w-px bg-slate-700" />
                            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                                XI Gallery
                            </h1>
                        </div>

                        <div className="flex items-center gap-3">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <option value="recent">Most Recent</option>
                                <option value="popular">Most Popular</option>
                                <option value="views">Most Viewed</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-12">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="animate-pulse bg-slate-800/50 rounded-2xl h-80" />
                        ))}
                    </div>
                ) : teams.length === 0 ? (
                    <div className="text-center py-20">
                        <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-slate-400 mb-2">No teams yet</h3>
                        <p className="text-slate-500 mb-6">Be the first to create and share your dream team!</p>
                        <Link
                            href="/xi"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-cyan-500/50 transition-all"
                        >
                            <Trophy className="w-5 h-5" />
                            Build Your XI
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teams.map((team, index) => (
                            <TeamCard key={team.id} team={team} index={index} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function TeamCard({ team, index }: { team: UserXI; index: number }) {
    const players = JSON.parse(team.players);
    const filledSlots = players.filter((p: any) => p.playerId).length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden hover:border-cyan-500/50 transition-all group"
        >
            {/* Team Preview */}
            <div className="relative h-48 bg-gradient-to-br from-blue-900 to-blue-800 p-4">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-white" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white rounded-full" />
                </div>
                <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                        <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-sm">
                            {team.formation}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold backdrop-blur-sm border border-cyan-500/20">
                            {filledSlots}/11
                        </span>
                    </div>
                    <h3 className="text-white font-bold text-lg mb-1 line-clamp-2">{team.name}</h3>
                </div>
            </div>

            {/* Team Info */}
            <div className="p-4">
                <div className="flex items-center justify-between text-sm text-slate-400 mb-4">
                    <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(team.createdAt).toLocaleDateString()}
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all">
                        <Heart className="w-4 h-4" />
                        <span className="font-semibold">{team.likes}</span>
                    </button>
                    <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors">
                        <Eye className="w-4 h-4" />
                        <span className="font-semibold">{team.views}</span>
                    </button>
                    <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors">
                        <MessageCircle className="w-4 h-4" />
                    </button>
                    <button className="ml-auto p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors">
                        <Share2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

