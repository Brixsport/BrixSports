'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    Trophy,
    Calendar,
    Users,
    ArrowRight,
    Clock,
    CheckCircle,
    Medal,
    Sparkles,
    UserPlus
} from 'lucide-react';

interface Competition {
    id: string;
    name: string;
    sport: string;
    format: string;
    status: string;
    startDate: string;
    endDate: string;
    playersPerSide: number;
    gender: string;
    registrationOpen: boolean;
    registrationDeadline: string;
    hostOrganization: string;
    isFeatured: boolean;
    winnerId?: string;
    winner?: { name: string; logo: string };
    runnerUp?: { name: string; logo: string };
    highlights?: string;
}

interface OrganizedCompetitions {
    featured: Competition[];
    upcoming: Competition[];
    ongoing: Competition[];
    completed: Competition[];
    registrationClosed: Competition[];
}

export default function CompetitionsShowcase() {
    const [competitions, setCompetitions] = useState<OrganizedCompetitions>({
        featured: [],
        upcoming: [],
        ongoing: [],
        completed: [],
        registrationClosed: [],
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCompetitions();
    }, []);

    const fetchCompetitions = async () => {
        try {
            const response = await fetch('/api/competitions/organized');
            const data = await response.json();
            setCompetitions(data.competitions);
        } catch (error) {
            console.error('Error fetching competitions:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-12">
            {/* Featured/Ongoing Competitions */}
            {(competitions.featured.length > 0 || competitions.ongoing.length > 0) && (
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <Sparkles className="w-6 h-6 text-yellow-400" />
                        <h2 className="text-3xl font-bold text-white">Active Competitions</h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                        {[...competitions.featured, ...competitions.ongoing].map((comp, index) => (
                            <motion.div
                                key={comp.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Link href={`/competitions/${comp.id}`}>
                                    <div className="group relative bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-6 hover:border-purple-400 transition-all cursor-pointer overflow-hidden">
                                        {/* Live indicator */}
                                        <div className="absolute top-4 right-4">
                                            <div className="flex items-center gap-2 bg-red-500/20 backdrop-blur-sm px-3 py-1 rounded-full">
                                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                <span className="text-red-400 text-xs font-semibold">LIVE</span>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <Trophy className="w-8 h-8 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                                                    {comp.name}
                                                </h3>
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                                                        {comp.playersPerSide}-aside
                                                    </span>
                                                    <span className="px-2 py-1 bg-pink-500/20 text-pink-300 text-xs rounded-full">
                                                        {comp.gender}
                                                    </span>
                                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                                                        {comp.format}
                                                    </span>
                                                </div>
                                                {comp.hostOrganization && (
                                                    <p className="text-gray-400 text-sm">
                                                        Hosted by {comp.hostOrganization}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </section>
            )}

            {/* Open for Registration */}
            {competitions.upcoming.length > 0 && (
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <UserPlus className="w-6 h-6 text-green-400" />
                        <h2 className="text-3xl font-bold text-white">Open for Registration</h2>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {competitions.upcoming.map((comp, index) => (
                            <motion.div
                                key={comp.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <div className="bg-white/5 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-green-500/50 transition-all">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                                            <Trophy className="w-6 h-6 text-green-400" />
                                        </div>
                                        <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full">
                                            OPEN
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">{comp.name}</h3>
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <Calendar className="w-4 h-4" />
                                            <span>
                                                {new Date(comp.startDate).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <Clock className="w-4 h-4" />
                                            <span>
                                                Register by {new Date(comp.registrationDeadline).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <Users className="w-4 h-4" />
                                            <span>{comp.playersPerSide}-aside • {comp.gender}</span>
                                        </div>
                                    </div>
                                    <Link href={`/competitions/${comp.id}/register`}>
                                        <button className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2">
                                            Register Team
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>
            )}

            {/* Completed Competitions */}
            {competitions.completed.length > 0 && (
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <Medal className="w-6 h-6 text-yellow-400" />
                        <h2 className="text-3xl font-bold text-white">Recent Champions</h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                        {competitions.completed.slice(0, 4).map((comp, index) => (
                            <motion.div
                                key={comp.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Link href={`/competitions/${comp.id}`}>
                                    <div className="group bg-white/5 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-yellow-500/50 transition-all cursor-pointer">
                                        <div className="flex items-center gap-2 mb-4">
                                            <CheckCircle className="w-5 h-5 text-green-400" />
                                            <span className="text-green-400 text-sm font-semibold">COMPLETED</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-yellow-300 transition-colors">
                                            {comp.name}
                                        </h3>
                                        {comp.winner && (
                                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-3">
                                                <div className="flex items-center gap-3">
                                                    <Trophy className="w-8 h-8 text-yellow-400" />
                                                    <div>
                                                        <p className="text-xs text-yellow-400 mb-1">CHAMPION</p>
                                                        <p className="text-white font-bold text-lg">{comp.winner.name}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {comp.highlights && (
                                            <p className="text-gray-400 text-sm">{comp.highlights}</p>
                                        )}
                                        <div className="mt-4 flex items-center gap-2 text-purple-400 text-sm font-medium">
                                            View Details
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                    {competitions.completed.length > 4 && (
                        <div className="text-center mt-6">
                            <Link href="/competitions?filter=completed">
                                <button className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all">
                                    View All Completed Competitions
                                </button>
                            </Link>
                        </div>
                    )}
                </section>
            )}

            {/* Empty State */}
            {competitions.featured.length === 0 &&
                competitions.upcoming.length === 0 &&
                competitions.ongoing.length === 0 &&
                competitions.completed.length === 0 && (
                    <div className="text-center py-20">
                        <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-white mb-2">No Competitions Yet</h3>
                        <p className="text-gray-400">Check back soon for upcoming tournaments!</p>
                    </div>
                )}
        </div>
    );
}
