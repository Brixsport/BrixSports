'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
    User, Mail, Calendar, Trophy, Heart, Settings, Edit2, Camera,
    Star, TrendingUp, Activity, Award, Shield, Loader2, LogOut, Check, X
} from 'lucide-react';

interface Team {
    id: string;
    name: string;
    logo: string;
    color: string;
    university: string;
}

interface UserProfile {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    coverImage: string | null;
    bio: string | null;
    createdAt: string;
    favoriteTeam: Team | null;
    // Temporary mocked stats structure until backend implementation
    stats?: {
        matchesWatched?: number;
        favoritePlayers?: number;
        favoriteTeams?: number;
        predictions?: number;
        accuracy?: number;
    };
    recentActivity?: Array<{
        type: string;
        title: string;
        date: string;
    }>;
}

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const fetchTeams = async () => {
        try {
            const response = await fetch('/api/teams');
            if (response.ok) {
                const data = await response.json();
                setAllTeams(data);
            }
        } catch (error) {
            console.error('Error fetching teams:', error);
        }
    };

    const handleSelectTeam = async (team: Team) => {
        if (!user) return;

        // Optimistic update
        const updatedUser = { ...user, favoriteTeam: team };
        setUser(updatedUser);
        setShowTeamModal(false);

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/users/${user.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ favoriteTeamId: team.id })
            });

            if (!response.ok) throw new Error("Failed to update favorite team");

            toast.success(`Favorite team set to ${team.name}`);

            // Update local storage user
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                const parsed = JSON.parse(storedUser);
                localStorage.setItem('user', JSON.stringify({ ...parsed, favoriteTeamId: team.id }));
            }
        } catch (error) {
            toast.error("Failed to save favorite team.");
            // Refresh to revert
            window.location.reload();
        }
    };

    const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size too large. Max 5MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;

            if (user) {
                setUser({ ...user, coverImage: base64 });
            }

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch(`/api/users/${user?.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ coverImage: base64 })
                });

                if (!response.ok) throw new Error("Failed to upload cover");

                toast.success("Cover photo updated!");
            } catch (error) {
                toast.error("Upload failed. Please try again.");
            }
        };
        reader.readAsDataURL(file);
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (file.size > 2 * 1024 * 1024) {
            toast.error("File size too large. Max 2MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;

            // Optimistic update
            if (user) {
                setUser({ ...user, avatar: base64 });
            }

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch(`/api/users/${user?.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ avatar: base64 })
                });

                if (!response.ok) throw new Error("Failed to upload avatar");

                toast.success("Profile picture updated!");

                // Update local storage user if needed
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    const parsed = JSON.parse(storedUser);
                    localStorage.setItem('user', JSON.stringify({ ...parsed, avatar: base64 }));
                }
            } catch (error) {
                toast.error("Upload failed. Please try again.");
                // Revert or refresh
            }
        };
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem('authToken');
            if (!token) {
                router.push('/login');
                return;
            }

            try {
                const response = await fetch('/api/auth/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch user');
                }

                const data = await response.json();

                // Add default stats for UI demo purposes if they don't exist
                const userData = {
                    ...data.user,
                    stats: {
                        matchesWatched: 0,
                        favoritePlayers: 0,
                        favoriteTeams: data.user.favoriteTeam ? 1 : 0,
                        predictions: 0,
                        accuracy: 0,
                    },
                    recentActivity: []
                };

                setUser(userData);
            } catch (error) {
                console.error('Error fetching user:', error);
                localStorage.removeItem('token'); // Clear invalid token
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 lg:p-12 pb-24">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header with Cover */}
                <div className="relative">
                    {/* Cover Image */}
                    <div className="h-48 md:h-64 bg-gradient-to-br from-primary/20 via-blue-900/20 to-purple-900/20 rounded-[40px] overflow-hidden relative border border-white/5">
                        {user.coverImage ? (
                            <img src={user.coverImage} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
                        )}
                        <div className="absolute top-6 right-6">
                            <input
                                type="file"
                                ref={coverInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleCoverChange}
                            />
                            <button
                                onClick={() => coverInputRef.current?.click()}
                                className="px-4 py-2 md:px-6 md:py-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl hover:bg-black/60 transition-all flex items-center gap-2 text-xs md:text-sm font-black uppercase tracking-widest"
                            >
                                <Camera size={16} />
                                <span className="hidden md:inline">Change Cover</span>
                            </button>
                        </div>
                    </div>

                    {/* Profile Info */}
                    <div className="relative -mt-16 md:-mt-20 px-4 md:px-8">
                        <div className="flex flex-col md:flex-row gap-6 items-center md:items-end">
                            {/* Avatar */}
                            <div className="relative group">
                                <input
                                    type="file"
                                    ref={avatarInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                />
                                <div
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="w-32 h-32 md:w-40 md:h-40 rounded-[32px] bg-gradient-to-br from-[#0A0A0A] to-[#1A1A1A] flex items-center justify-center text-4xl md:text-6xl font-display border-[6px] border-[#050505] relative overflow-hidden shadow-2xl cursor-pointer"
                                >
                                    {user.avatar ? (
                                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-white/20 font-black">{user.name.charAt(0)}</span>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Camera size={32} />
                                    </div>
                                </div>
                                <button
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="absolute bottom-2 right-2 w-8 h-8 md:w-10 md:h-10 bg-primary text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-primary/20"
                                >
                                    <Edit2 size={14} className="md:w-4 md:h-4" />
                                </button>
                            </div>

                            {/* User Info */}
                            <div className="flex-1 text-center md:text-left">
                                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[32px] p-6 shadow-xl">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h1 className="text-3xl md:text-4xl font-display italic uppercase tracking-tight mb-2 text-white">
                                                {user.name}
                                            </h1>
                                            <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 text-sm text-white/50 font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Mail size={14} />
                                                    {user.email}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} />
                                                    Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                                </div>
                                                {user.favoriteTeam && (
                                                    <div className="flex items-center gap-2 text-primary">
                                                        <Heart size={14} className="fill-current" />
                                                        Fan of {user.favoriteTeam.name}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setIsEditing(!isEditing)}
                                                className="px-6 py-3 bg-white text-black rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] md:text-xs shadow-lg shadow-white/5"
                                            >
                                                <Edit2 size={14} />
                                                Edit Profile
                                            </button>
                                            <button
                                                onClick={() => {
                                                    localStorage.removeItem('authToken');
                                                    localStorage.removeItem('user');
                                                    window.location.href = '/login';
                                                }}
                                                className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] md:text-xs"
                                            >
                                                <LogOut size={14} />
                                                Log Out
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - About & Favorite Team */}
                    <div className="space-y-6">
                        {/* About */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 md:p-8">
                            <h2 className="text-xs font-black uppercase tracking-widest text-white/40 mb-6 flex items-center gap-2">
                                <User size={14} className="text-primary" />
                                About
                            </h2>
                            {isEditing ? (
                                <div className="space-y-4">
                                    <textarea
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-primary/50 transition-all min-h-[120px]"
                                        value={user.bio || ""}
                                        onChange={(e) => setUser({ ...user, bio: e.target.value })}
                                        placeholder="Tell us about yourself..."
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                const token = localStorage.getItem('authToken');
                                                await fetch(`/api/users/${user.id}`, {
                                                    method: 'PATCH',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        'Authorization': `Bearer ${token}`
                                                    },
                                                    body: JSON.stringify({ bio: user.bio })
                                                });
                                                setIsEditing(false);
                                                toast.success("Bio updated!");
                                            }}
                                            className="px-4 py-2 bg-primary text-black rounded-lg text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-4 py-2 bg-white/5 text-white rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-white/80 leading-relaxed text-sm">
                                    {user.bio || "No bio yet. Click edit profile to add one!"}
                                </p>
                            )}
                        </div>

                        {/* Favorite Team */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 md:p-8">
                            <h2 className="text-xs font-black uppercase tracking-widest text-white/40 mb-6 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Heart size={14} className="text-primary" />
                                    Favorite Team
                                </div>
                                {(user.favoriteTeam || isEditing) && (
                                    <button
                                        onClick={() => {
                                            fetchTeams();
                                            setShowTeamModal(true);
                                        }}
                                        className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline"
                                    >
                                        {user.favoriteTeam ? 'Change' : 'Select'}
                                    </button>
                                )}
                            </h2>

                            {user.favoriteTeam ? (
                                <div
                                    onClick={() => isEditing && setShowTeamModal(true)}
                                    className={`bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-primary/30 transition-all ${isEditing ? 'cursor-pointer' : ''}`}
                                >
                                    <div className="flex items-center gap-6 relative z-10">
                                        <div className="w-16 h-16 md:w-20 md:h-20 bg-white/5 rounded-2xl flex items-center justify-center p-2">
                                            <img src={user.favoriteTeam.logo} alt={user.favoriteTeam.name} className="w-full h-full object-contain" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xl md:text-2xl font-black uppercase tracking-tight leading-none mb-1 group-hover:text-primary transition-colors">{user.favoriteTeam.name}</p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{user.favoriteTeam.university}</p>
                                        </div>
                                    </div>
                                    {/* Ambient Background */}
                                    <div
                                        className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-[80px] opacity-20"
                                        style={{ backgroundColor: user.favoriteTeam.color }}
                                    />
                                </div>
                            ) : (
                                <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 text-center">
                                    <Heart size={32} className="mx-auto text-white/20 mb-4" />
                                    <h3 className="text-lg font-bold text-white mb-2">No Favorite Team</h3>
                                    <p className="text-white/40 text-sm mb-4">Select your favorite university team to support them!</p>
                                    <button
                                        onClick={() => {
                                            fetchTeams();
                                            setShowTeamModal(true);
                                        }}
                                        className="text-primary text-xs font-black uppercase tracking-widest hover:underline"
                                    >
                                        Select Team
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 md:p-8">
                            <h2 className="text-xs font-black uppercase tracking-widest text-white/40 mb-6 flex items-center gap-2">
                                <Settings size={14} className="text-primary" />
                                Quick Actions
                            </h2>
                            <div className="space-y-2">
                                <QuickActionButton icon={<Settings size={16} />} label="System Settings" href="/profile/settings" />
                                <QuickActionButton icon={<Heart size={16} />} label="Manage Favorites" href="/profile/favorites" />
                                <QuickActionButton icon={<Trophy size={16} />} label="My Predictions" href="/predictions" />
                                <QuickActionButton icon={<Shield size={16} />} label="Privacy & Security" href="/profile/settings#privacy" />
                            </div>
                        </div>
                    </div>

                    {/* Middle Column - Stats */}
                    <div className="space-y-6">
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 md:p-8">
                            <h2 className="text-xs font-black uppercase tracking-widest text-white/40 mb-6 flex items-center gap-2">
                                <TrendingUp size={14} className="text-primary" />
                                Statistics
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                <StatCard
                                    icon={<Activity size={20} className="text-blue-500" />}
                                    label="Matches Watched"
                                    value={user.stats?.matchesWatched || 0}
                                />
                                <StatCard
                                    icon={<Star size={20} className="text-yellow-500" />}
                                    label="Favorite Players"
                                    value={user.stats?.favoritePlayers || 0}
                                />
                                <StatCard
                                    icon={<Heart size={20} className="text-red-500" />}
                                    label="Favorite Teams"
                                    value={user.stats?.favoriteTeams || 0}
                                />
                                <StatCard
                                    icon={<Trophy size={20} className="text-emerald-500" />}
                                    label="Predictions"
                                    value={user.stats?.predictions || 0}
                                />
                            </div>

                            {/* Prediction Accuracy */}
                            <div className="mt-8 bg-black/20 border border-white/5 rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Prediction Accuracy</span>
                                    <span className="text-2xl font-display italic text-primary">{user.stats?.accuracy || 0}%</span>
                                </div>
                                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${user.stats?.accuracy || 0}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                        className="h-full bg-gradient-to-r from-primary to-blue-500"
                                    ></motion.div>
                                </div>
                            </div>
                        </div>

                        {/* Achievements */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 md:p-8">
                            <h2 className="text-xs font-black uppercase tracking-widest text-white/40 mb-6 flex items-center gap-2">
                                <Award size={14} className="text-primary" />
                                Achievements
                            </h2>
                            <div className="grid grid-cols-4 md:grid-cols-4 gap-3">
                                <AchievementBadge emoji="🏆" label="First Win" unlocked={false} />
                                <AchievementBadge emoji="⭐" label="10 Votes" unlocked={false} />
                                <AchievementBadge emoji="🎯" label="Sharpshooter" unlocked={false} />
                                <AchievementBadge emoji="🔥" label="On Fire" unlocked={false} />
                                <AchievementBadge emoji="👑" label="Top Fan" unlocked={false} />
                                <AchievementBadge emoji="💎" label="Premium" unlocked={false} />
                                <AchievementBadge emoji="🎫" label="Ticket Holder" unlocked={false} />
                                <AchievementBadge emoji="🗣️" label="Commentator" unlocked={false} />
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Recent Activity */}
                    <div className="space-y-6">
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 md:p-8">
                            <h2 className="text-xs font-black uppercase tracking-widest text-white/40 mb-6 flex items-center gap-2">
                                <Activity size={14} className="text-primary" />
                                Recent Activity
                            </h2>

                            {user.recentActivity && user.recentActivity.length > 0 ? (
                                <div className="space-y-3">
                                    {user.recentActivity.map((activity, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
                                                    {activity.type === 'match' && <Activity size={14} />}
                                                    {activity.type === 'favorite' && <Heart size={14} />}
                                                    {activity.type === 'prediction' && <Trophy size={14} />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-white">{activity.title}</p>
                                                    <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">{activity.date}</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-12 text-center">
                                    <p className="text-white/20 text-xs font-black uppercase tracking-widest mb-2">No Recent Activity</p>
                                    <p className="text-white/40 text-xs">Start Interacting with matches to see your history here.</p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
            {/* Team Selector Modal */}
            <TeamSelectorModal
                isOpen={showTeamModal}
                onClose={() => setShowTeamModal(false)}
                teams={allTeams}
                onSelect={handleSelectTeam}
            />
        </div>
    );
}

function TeamSelectorModal({ isOpen, onClose, teams, onSelect }: { isOpen: boolean, onClose: () => void, teams: Team[], onSelect: (team: Team) => void }) {
    const [search, setSearch] = useState("");

    const filteredTeams = teams.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.university.toLowerCase().includes(search.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#0A0A0A] border border-white/10 rounded-[40px] w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
            >
                <div className="p-8 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-display italic uppercase tracking-tighter">Support Your Team</h2>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Select your primary favorite university</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 bg-white/5 flex items-center gap-4">
                    <div className="flex-1 bg-black/40 rounded-2xl border border-white/10 px-6 py-3 flex items-center gap-3">
                        <Activity size={18} className="text-white/20" />
                        <input
                            type="text"
                            placeholder="Search by team or university..."
                            className="bg-transparent border-none outline-none text-sm w-full font-medium"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                    {filteredTeams.length > 0 ? (
                        filteredTeams.map((team) => (
                            <button
                                key={team.id}
                                onClick={() => onSelect(team)}
                                className="w-full group bg-white/5 border border-white/5 rounded-3xl p-4 md:p-6 flex items-center gap-6 hover:bg-white/10 hover:border-primary/30 transition-all text-left"
                            >
                                <div className="w-12 h-12 md:w-16 md:h-16 bg-black/40 rounded-2xl flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                                    <img src={team.logo} alt={team.name} className="w-full h-full object-contain" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-lg md:text-xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">{team.name}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{team.university}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all">
                                    <Check size={16} className="text-white group-hover:text-black transition-colors" />
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="py-20 text-center opacity-40">
                            <Activity size={40} className="mx-auto mb-4" />
                            <p className="font-black uppercase tracking-widest text-xs">No teams found matching "{search}"</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
    return (
        <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-all group">
            <div className="flex items-center justify-between mb-3">
                <div className="opacity-60 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0">
                    {icon}
                </div>
                <span className="text-xl font-display italic text-white">{value}</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 group-hover:text-white/50 transition-colors">{label}</p>
        </div>
    );
}

function AchievementBadge({ emoji, label, unlocked = false }: { emoji: string; label: string; unlocked?: boolean }) {
    return (
        <div className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 transition-all cursor-help ${unlocked
            ? 'bg-gradient-to-br from-primary/20 to-purple-600/20 border-2 border-primary/50 hover:scale-105'
            : 'bg-white/5 border border-white/5 opacity-30 grayscale hover:opacity-50 hover:grayscale-0'
            }`}>
            <span className="text-2xl mb-2 filter drop-shadow-lg">{emoji}</span>
            <p className="text-[7px] font-black uppercase tracking-widest text-center leading-tight truncate w-full">{label}</p>
        </div>
    );
}

function QuickActionButton({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
    return (
        <a
            href={href}
            className="flex items-center gap-4 px-5 py-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition-all group"
        >
            <div className="text-white/40 group-hover:text-primary transition-colors">
                {icon}
            </div>
            <span className="text-xs font-bold text-white/60 group-hover:text-white transition-colors uppercase tracking-wide">{label}</span>
        </a>
    );
}
