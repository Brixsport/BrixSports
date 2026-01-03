'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Activity, Heart, Trophy, Users, TrendingUp, Calendar,
    Star, Zap, Award, Clock, ArrowRight, Filter, Bell
} from 'lucide-react';
import Link from 'next/link';

// Mock data - will be replaced with real API calls
const mockDashboardData = {
    user: {
        name: 'Alex Johnson',
        favoriteTeam: { name: 'UNILAG Marines', logo: '🌊' },
        stats: {
            matchesWatched: 45,
            favoriteTeams: 3,
            favoritePlayers: 8,
            predictions: 32,
        }
    },
    recentActivity: [
        {
            id: '1',
            type: 'match_watched',
            title: 'Watched UNILAG vs UNIBEN',
            subtitle: 'Football • Final Score: 3-2',
            time: '2 hours ago',
            icon: '⚽',
            color: 'blue'
        },
        {
            id: '2',
            type: 'team_followed',
            title: 'Started following UI Lions',
            subtitle: 'Basketball Team',
            time: '1 day ago',
            icon: '🏀',
            color: 'orange'
        },
        {
            id: '3',
            type: 'favorite_added',
            title: 'Added Tunde Adeyemi to favorites',
            subtitle: 'UNILAG Marines • Striker',
            time: '2 days ago',
            icon: '⭐',
            color: 'yellow'
        },
        {
            id: '4',
            type: 'prediction_made',
            title: 'Predicted UI win vs OAU',
            subtitle: 'NUGA Football Championship',
            time: '3 days ago',
            icon: '🎯',
            color: 'blue'
        },
    ],
    upcomingMatches: [
        {
            id: 'm1',
            home: { name: 'UNILAG Marines', logo: '🌊', score: null },
            away: { name: 'UNIBEN Royals', logo: '🦁', score: null },
            sport: 'Football',
            competition: 'NUGA 2024',
            date: '2024-03-25',
            time: '16:00',
            venue: 'UNILAG Sports Complex',
            isFollowing: true,
        },
        {
            id: 'm2',
            home: { name: 'UI Lions', logo: '🦁', score: null },
            away: { name: 'OAU Giants', logo: '⚡', score: null },
            sport: 'Basketball',
            competition: 'NUGA Basketball',
            date: '2024-03-26',
            time: '14:00',
            venue: 'UI Indoor Arena',
            isFollowing: true,
        },
    ],
    personalizedFeed: [
        {
            id: 'f1',
            type: 'team_news',
            title: 'UNILAG Marines announce new signing',
            description: 'Star striker joins from UNIBEN',
            image: '🌊',
            time: '5 hours ago',
            category: 'Team News'
        },
        {
            id: 'f2',
            type: 'match_highlight',
            title: 'Incredible comeback in yesterday\'s match',
            description: 'UNILAG scored 3 goals in final 10 minutes',
            image: '⚽',
            time: '1 day ago',
            category: 'Highlights'
        },
        {
            id: 'f3',
            type: 'player_milestone',
            title: 'Tunde Adeyemi reaches 50 goals',
            description: 'Becomes all-time top scorer for UNILAG',
            image: '🏆',
            time: '2 days ago',
            category: 'Milestone'
        },
    ],
    quickStats: {
        liveMatches: 3,
        todayMatches: 8,
        followedTeams: 3,
        notifications: 5,
    }
};

export default function DashboardPage() {
    const [activeFilter, setActiveFilter] = useState('all');
    const [data, setData] = useState(mockDashboardData);

    const filters = [
        { key: 'all', label: 'All Activity', icon: <Activity size={14} /> },
        { key: 'matches', label: 'Matches', icon: <Trophy size={14} /> },
        { key: 'teams', label: 'Teams', icon: <Users size={14} /> },
        { key: 'players', label: 'Players', icon: <Star size={14} /> },
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Zap size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                            Your Feed
                        </span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none">
                            Dashboard
                        </h1>
                        <Link
                            href="/profile"
                            className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2 text-sm font-black uppercase tracking-widest w-fit"
                        >
                            View Profile
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <QuickStatCard
                        icon={<Zap size={24} className="text-red-500" />}
                        label="Live Now"
                        value={data.quickStats.liveMatches}
                        color="red"
                        pulse
                    />
                    <QuickStatCard
                        icon={<Calendar size={24} className="text-blue-500" />}
                        label="Today's Matches"
                        value={data.quickStats.todayMatches}
                        color="blue"
                    />
                    <QuickStatCard
                        icon={<Heart size={24} className="text-pink-500" />}
                        label="Following"
                        value={data.quickStats.followedTeams}
                        color="pink"
                    />
                    <QuickStatCard
                        icon={<Bell size={24} className="text-yellow-500" />}
                        label="Notifications"
                        value={data.quickStats.notifications}
                        color="yellow"
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Activity Feed */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Filters */}
                        <div className="flex flex-wrap gap-2">
                            {filters.map((filter) => (
                                <button
                                    key={filter.key}
                                    onClick={() => setActiveFilter(filter.key)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-bold ${activeFilter === filter.key
                                        ? 'bg-primary text-black'
                                        : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    {filter.icon}
                                    {filter.label}
                                </button>
                            ))}
                        </div>

                        {/* Personalized Feed */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
                            <h2 className="text-sm font-black uppercase tracking-widest text-white/60 mb-4 flex items-center gap-2">
                                <TrendingUp size={16} className="text-primary" />
                                For You
                            </h2>
                            <div className="space-y-4">
                                {data.personalizedFeed.map((item, idx) => (
                                    <FeedItem key={item.id} item={item} delay={idx * 0.1} />
                                ))}
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
                            <h2 className="text-sm font-black uppercase tracking-widest text-white/60 mb-4 flex items-center gap-2">
                                <Activity size={16} className="text-primary" />
                                Recent Activity
                            </h2>
                            <div className="space-y-3">
                                {data.recentActivity.map((activity, idx) => (
                                    <ActivityItem key={activity.id} activity={activity} delay={idx * 0.1} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Upcoming Matches & Stats */}
                    <div className="space-y-6">
                        {/* Upcoming Matches */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-black uppercase tracking-widest text-white/60 flex items-center gap-2">
                                    <Calendar size={16} className="text-primary" />
                                    Upcoming
                                </h2>
                                <Link
                                    href="/fixtures"
                                    className="text-xs font-bold text-primary hover:underline"
                                >
                                    View All
                                </Link>
                            </div>
                            <div className="space-y-4">
                                {data.upcomingMatches.map((match) => (
                                    <UpcomingMatchCard key={match.id} match={match} />
                                ))}
                            </div>
                        </div>

                        {/* User Stats */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
                            <h2 className="text-sm font-black uppercase tracking-widest text-white/60 mb-4 flex items-center gap-2">
                                <Award size={16} className="text-primary" />
                                Your Stats
                            </h2>
                            <div className="space-y-3">
                                <StatRow label="Matches Watched" value={data.user.stats.matchesWatched} />
                                <StatRow label="Favorite Teams" value={data.user.stats.favoriteTeams} />
                                <StatRow label="Favorite Players" value={data.user.stats.favoritePlayers} />
                                <StatRow label="Predictions" value={data.user.stats.predictions} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function QuickStatCard({ icon, label, value, color, pulse = false }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: string;
    pulse?: boolean;
}) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 relative overflow-hidden"
        >
            {pulse && (
                <div className="absolute top-2 right-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                </div>
            )}
            <div className="flex items-center justify-between mb-2">
                {icon}
                <span className="text-3xl font-display italic text-primary">{value}</span>
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-white/60">{label}</p>
        </motion.div>
    );
}

function FeedItem({ item, delay }: { item: any; delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all cursor-pointer group"
        >
            <div className="flex items-start gap-4">
                <div className="text-4xl">{item.image}</div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-primary/20 border border-primary/30 rounded text-[10px] font-black uppercase text-primary">
                            {item.category}
                        </span>
                        <span className="text-xs text-white/40">{item.time}</span>
                    </div>
                    <h3 className="text-sm font-black text-white mb-1 group-hover:text-primary transition-colors">
                        {item.title}
                    </h3>
                    <p className="text-xs text-white/60">{item.description}</p>
                </div>
                <ArrowRight size={16} className="text-white/40 group-hover:text-primary transition-colors" />
            </div>
        </motion.div>
    );
}

function ActivityItem({ activity, delay }: { activity: any; delay: number }) {
    const colorClasses = {
        blue: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
        orange: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
        yellow: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
        green: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay }}
            className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border ${colorClasses[activity.color as keyof typeof colorClasses]}`}>
                {activity.icon}
            </div>
            <div className="flex-1">
                <p className="text-sm font-bold text-white">{activity.title}</p>
                <p className="text-xs text-white/60 mt-0.5">{activity.subtitle}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-white/40">
                    <Clock size={10} />
                    {activity.time}
                </div>
            </div>
        </motion.div>
    );
}

function UpcomingMatchCard({ match }: { match: any }) {
    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all cursor-pointer"
        >
            <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-primary/20 border border-primary/30 rounded text-[10px] font-black uppercase text-primary">
                    {match.sport}
                </span>
                <span className="text-xs text-white/40">{match.date} • {match.time}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{match.home.logo}</span>
                    <span className="text-sm font-black uppercase">{match.home.name}</span>
                </div>
            </div>
            <div className="text-center text-xs font-black text-white/40 my-2">VS</div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{match.away.logo}</span>
                    <span className="text-sm font-black uppercase">{match.away.name}</span>
                </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-white/60">{match.venue}</span>
                {match.isFollowing && (
                    <div className="flex items-center gap-1 text-xs text-primary">
                        <Bell size={12} />
                        Following
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function StatRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <span className="text-sm text-white/60">{label}</span>
            <span className="text-lg font-display italic text-primary">{value}</span>
        </div>
    );
}

