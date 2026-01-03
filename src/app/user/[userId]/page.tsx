'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    User,
    Mail,
    Calendar,
    Heart,
    MessageCircle,
    Bookmark,
    Trophy,
    Star,
    TrendingUp,
    Edit,
    Settings,
    ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface UserProfile {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    bio: string | null;
    createdAt: string;
    stats: {
        commentsCount: number;
        likesGiven: number;
        bookmarksCount: number;
        articlesRead: number;
    };
}

export default function UserProfilePage() {
    const params = useParams();
    const userId = params.userId as string;

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('activity');

    // Mock user ID - replace with actual auth
    const currentUserId = 'user-1';
    const isOwnProfile = userId === currentUserId;

    useEffect(() => {
        fetchProfile();
    }, [userId]);

    const fetchProfile = async () => {
        try {
            // Mock data - replace with actual API call
            setProfile({
                id: userId,
                name: 'John Doe',
                email: 'john@example.com',
                avatar: null,
                bio: 'Sports enthusiast and avid reader. Love following NUGA and university sports!',
                createdAt: new Date().toISOString(),
                stats: {
                    commentsCount: 42,
                    likesGiven: 128,
                    bookmarksCount: 15,
                    articlesRead: 234,
                },
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">User not found</h1>
                    <Link href="/" className="text-cyan-400 hover:text-cyan-300">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Home
                    </Link>
                </div>
            </div>

            {/* Profile Header */}
            <div className="max-w-6xl mx-auto px-6 py-12">
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 mb-8">
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-6">
                            {/* Avatar */}
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-3xl font-bold">
                                {profile.name.charAt(0).toUpperCase()}
                            </div>

                            {/* Info */}
                            <div>
                                <h1 className="text-3xl font-black text-white mb-2">
                                    {profile.name}
                                </h1>
                                <div className="flex items-center gap-4 text-sm text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Mail className="w-4 h-4" />
                                        {profile.email}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        Joined {new Date(profile.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                {profile.bio && (
                                    <p className="text-slate-300 mt-3 max-w-2xl">
                                        {profile.bio}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        {isOwnProfile && (
                            <div className="flex items-center gap-2">
                                <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors">
                                    <Edit className="w-4 h-4" />
                                    Edit Profile
                                </button>
                                <button className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors">
                                    <Settings className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            icon={<MessageCircle className="w-5 h-5" />}
                            label="Comments"
                            value={profile.stats.commentsCount}
                            color="from-blue-500 to-cyan-500"
                        />
                        <StatCard
                            icon={<Heart className="w-5 h-5" />}
                            label="Likes Given"
                            value={profile.stats.likesGiven}
                            color="from-red-500 to-pink-500"
                        />
                        <StatCard
                            icon={<Bookmark className="w-5 h-5" />}
                            label="Bookmarks"
                            value={profile.stats.bookmarksCount}
                            color="from-yellow-500 to-orange-500"
                        />
                        <StatCard
                            icon={<TrendingUp className="w-5 h-5" />}
                            label="Articles Read"
                            value={profile.stats.articlesRead}
                            color="from-green-500 to-emerald-500"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="mb-6">
                    <div className="flex gap-2 border-b border-slate-800">
                        {['activity', 'comments', 'bookmarks'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-3 font-semibold capitalize transition-all ${activeTab === tab
                                        ? 'text-cyan-400 border-b-2 border-cyan-400'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8">
                    {activeTab === 'activity' && (
                        <div className="text-center py-12">
                            <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-400 mb-2">
                                Recent Activity
                            </h3>
                            <p className="text-slate-500">
                                Activity feed coming soon...
                            </p>
                        </div>
                    )}

                    {activeTab === 'comments' && (
                        <div className="text-center py-12">
                            <MessageCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-400 mb-2">
                                Your Comments
                            </h3>
                            <p className="text-slate-500">
                                {profile.stats.commentsCount} comments made
                            </p>
                        </div>
                    )}

                    {activeTab === 'bookmarks' && (
                        <div className="text-center py-12">
                            <Bookmark className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-400 mb-2">
                                Saved Articles
                            </h3>
                            <p className="text-slate-500">
                                {profile.stats.bookmarksCount} articles bookmarked
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: string;
}) {
    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            className="p-4 bg-slate-700/50 rounded-xl border border-slate-600/50"
        >
            <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${color} mb-2`}>
                {icon}
            </div>
            <div className="text-2xl font-bold text-white mb-1">{value}</div>
            <div className="text-sm text-slate-400">{label}</div>
        </motion.div>
    );
}
