'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User,
    Mail,
    Calendar,
    Heart,
    Trophy,
    Target,
    TrendingUp,
    Flame,
    ArrowLeft,
    Shield,
    Users,
    ChevronRight,
    Star,
    Award,
    Activity,
    Settings
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface UserProfile {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    coverImage: string | null;
    bio: string | null;
    createdAt: string;
    favoriteTeam?: {
        id: string;
        name: string;
        logo: string;
        color: string;
    };
    stats: {
        totalPoints: number;
        accuracy: number;
        rank: number;
        streak: number;
        totalPredictions: number;
        correctPredictions: number;
    };
    privacy: {
        profileVisibility: 'public' | 'friends' | 'private';
        showStats: boolean;
        showActivity: boolean;
    };
}

export default function UserProfilePage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.userId as string;

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'predictions' | 'favorites'>('overview');

    // In a real app, this would come from an auth hook
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setCurrentUser(JSON.parse(storedUser));
        }
    }, []);

    const isOwnProfile = currentUser?.id === userId;

    useEffect(() => {
        fetchProfile();
    }, [userId]);

    const fetchProfile = async () => {
        try {
            setLoading(true);

            // 1. Fetch user core info and preferences
            const userResponse = await fetch(`/api/users/${userId}?includeStats=true`);
            if (!userResponse.ok) throw new Error('User not found');
            const userData = await userResponse.json();

            // 2. Fetch prediction stats
            const statsResponse = await fetch(`/api/predictions/stats?userId=${userId}`);
            const statsData = await statsResponse.json();

            const privacy = {
                profileVisibility: userData.preferences?.profileVisibility || 'public',
                showStats: userData.preferences?.showStats ?? true,
                showActivity: userData.preferences?.showActivity ?? true,
            };

            setProfile({
                id: userData.user.id,
                name: userData.user.name,
                email: userData.user.email,
                avatar: userData.user.avatar,
                coverImage: userData.user.coverImage,
                bio: userData.user.bio,
                createdAt: userData.user.createdAt,
                favoriteTeam: userData.stats?.favoriteTeam,
                stats: statsData.stats || {
                    totalPoints: 0,
                    accuracy: 0,
                    rank: 0,
                    streak: 0,
                    totalPredictions: 0,
                    correctPredictions: 0,
                },
                privacy,
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
            // toast.error('Failed to load user profile');
            // If failed, use fallback UI or handle 404
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="font-display italic uppercase tracking-widest text-white/40 text-xs">Loading Profile...</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
                <div className="max-w-md">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 text-white/20">
                        <User size={32} />
                    </div>
                    <h1 className="font-display text-4xl italic uppercase tracking-tighter mb-4">User Not Found</h1>
                    <p className="text-white/40 text-sm mb-8">The profile you're looking for doesn't exist or has been deactivated.</p>
                    <Link href="/" className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all">
                        <ArrowLeft size={16} />
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    const isPrivate = profile.privacy.profileVisibility === 'private' && !isOwnProfile;

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Nav */}
            <div className="fixed top-0 left-0 right-0 z-50 p-6 pointer-events-none">
                <button
                    onClick={() => router.back()}
                    className="pointer-events-auto w-12 h-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all hover:scale-110"
                >
                    <ArrowLeft size={20} />
                </button>
            </div>

            {/* Cover and Profile Header */}
            <div className="relative">
                {/* Cover Image */}
                <div className="h-[30vh] md:h-[40vh] bg-[#0a0a0a] relative overflow-hidden">
                    {profile.coverImage ? (
                        <img src={profile.coverImage} alt="Cover" className="w-full h-full object-cover opacity-40" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 via-[#050505] to-primary/5" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
                </div>

                {/* Profile Info Card */}
                <div className="max-w-7xl mx-auto px-6 -mt-24 relative z-10 pb-12">
                    <div className="flex flex-col md:flex-row items-end gap-8 mb-12">
                        {/* Avatar */}
                        <div className="relative group">
                            <div className="w-32 h-32 md:w-48 md:h-48 rounded-[40px] bg-[#0a0a0a] border-4 border-[#050505] overflow-hidden shadow-2xl relative">
                                {profile.avatar ? (
                                    <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-primary/40 text-black text-6xl font-black italic">
                                        {profile.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            {profile.stats.rank <= 10 && profile.stats.rank > 0 && (
                                <div className="absolute -top-3 -right-3 w-12 h-12 bg-yellow-500 rounded-2xl flex items-center justify-center text-black shadow-lg shadow-yellow-500/50 rotate-12 border-4 border-[#050505]">
                                    <Trophy size={20} />
                                </div>
                            )}
                        </div>

                        {/* Name & Basic Info */}
                        <div className="flex-1 pb-4">
                            <div className="flex flex-wrap items-center gap-4 mb-3">
                                <h1 className="font-display text-5xl md:text-7xl italic uppercase tracking-tighter leading-none">{profile.name}</h1>
                                {profile.stats.rank > 0 && (
                                    <div className="px-4 py-1.5 rounded-full bg-primary text-black text-[10px] font-black uppercase tracking-widest">
                                        Rank #{profile.stats.rank}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-6 text-white/40">
                                <span className="flex items-center gap-2 text-sm font-bold">
                                    <Calendar size={14} />
                                    Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                </span>
                                {profile.favoriteTeam && (
                                    <span className="flex items-center gap-2 text-sm font-bold text-primary">
                                        <Heart size={14} className="fill-primary" />
                                        Supports {profile.favoriteTeam.name}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 pb-8">
                            {isOwnProfile ? (
                                <Link href="/profile/settings" className="px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-all flex items-center gap-2">
                                    <Settings size={18} />
                                    Settings
                                </Link>
                            ) : (
                                <button className="px-8 py-4 bg-primary text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20">
                                    Follow Fan
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Bio & Extended Stats Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Bio Sidebar */}
                        <div className="lg:col-span-1 space-y-8">
                            <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 md:p-10">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6">About Fan</h2>
                                <p className="text-lg text-white/80 leading-relaxed font-medium italic">
                                    {isPrivate ? "This user's profile is private." : profile.bio || "No bio yet. This fan prefers to let their predictions do the talking."}
                                </p>

                                <div className="mt-10 pt-10 border-t border-white/10 flex flex-wrap gap-3">
                                    <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60">
                                        Level 12 Fan
                                    </div>
                                    <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60">
                                        Alpha Tester
                                    </div>
                                </div>
                            </div>

                            {profile.favoriteTeam && (
                                <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 overflow-hidden relative group">
                                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all" />
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6 relative z-10">Favorite Team</h2>
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center p-2">
                                            <img src={profile.favoriteTeam.logo} alt={profile.favoriteTeam.name} className="w-full h-full object-contain" />
                                        </div>
                                        <div>
                                            <p className="font-display text-2xl italic uppercase tracking-tighter text-white">{profile.favoriteTeam.name}</p>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Main Club</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Stats & Activity Area */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Prediction Stats Grid */}
                            {!isPrivate && profile.privacy.showStats ? (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <QuickStat
                                        icon={<Trophy className="text-primary" />}
                                        label="Predicted Points"
                                        value={profile.stats.totalPoints}
                                    />
                                    <QuickStat
                                        icon={<Target className="text-blue-500" />}
                                        label="Accuracy Rate"
                                        value={`${profile.stats.accuracy}%`}
                                    />
                                    <QuickStat
                                        icon={<Flame className="text-orange-500" />}
                                        label="Current Streak"
                                        value={profile.stats.streak}
                                    />
                                    <QuickStat
                                        icon={<Activity className="text-green-500" />}
                                        label="Matches Called"
                                        value={profile.stats.totalPredictions}
                                    />
                                </div>
                            ) : (
                                <div className="bg-white/5 border border-white/10 rounded-[40px] p-12 text-center">
                                    <Shield size={48} className="text-white/10 mx-auto mb-4" />
                                    <h3 className="font-display text-2xl italic uppercase tracking-tight text-white/40">Stats are hidden</h3>
                                    <p className="text-white/20 text-sm">This fan has set their performance statistics to private.</p>
                                </div>
                            )}

                            {/* Recent Activity / Predictions */}
                            <div className="bg-white/5 border border-white/10 rounded-[40px] overflow-hidden">
                                <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
                                    <h2 className="font-display text-3xl italic uppercase tracking-tighter">Fan Activity</h2>
                                    <div className="flex gap-2">
                                        {['All', 'Predictions', 'Achievements'].map(filter => (
                                            <button
                                                key={filter}
                                                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all bg-white/5"
                                            >
                                                {filter}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-8">
                                    {isPrivate ? (
                                        <div className="text-center py-20">
                                            <p className="text-white/20 text-sm italic">Activity feed is private</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6 text-center py-20">
                                            <Activity size={48} className="text-white/5 mx-auto mb-4 shadow-sm" />
                                            <p className="text-sm font-bold text-white/20 uppercase tracking-[0.3em]">No Public Activity Recorded</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function QuickStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all group">
            <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-all">
                {icon}
            </div>
            <p className="text-3xl font-black italic text-white tracking-tighter mb-1">{value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30">{label}</p>
        </div>
    );
}
