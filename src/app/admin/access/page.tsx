'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FeatureGate } from '@/components/admin/FeatureGate';
import {
    Shield,
    Users,
    UserPlus,
    Search,
    Filter,
    MoreVertical,
    Crown,
    Eye,
    User as UserIcon,
    CheckCircle2,
    XCircle
} from 'lucide-react';

interface User {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'admin' | 'logger';
    avatar: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface UsersData {
    users: User[];
    total: number;
    timestamp: string;
}

export default function AccessControlPage() {
    return (
        <FeatureGate flagKey="features.usermanagement.enabled" featureName="User Management">
            <AccessControlPageContent />
        </FeatureGate>
    );
}

function AccessControlPageContent() {
    const [data, setData] = useState<UsersData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/users');
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const updateUserRole = async (userId: string, newRole: string) => {
        try {
            setUpdatingUserId(userId);
            const response = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole }),
            });

            if (response.ok) {
                await fetchData();
            } else {
                alert('Failed to update user role');
            }
        } catch (error) {
            console.error('Failed to update user role:', error);
            alert('Failed to update user role');
        } finally {
            setUpdatingUserId(null);
        }
    };

    const filteredUsers = data?.users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesSearch && matchesRole;
    }) || [];

    const roleStats = {
        total: data?.total || 0,
        admins: data?.users.filter(u => u.role === 'admin').length || 0,
        loggers: data?.users.filter(u => u.role === 'logger').length || 0,
        users: data?.users.filter(u => u.role === 'user').length || 0,
    };

    return (
        <div className="p-6 lg:p-12">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="font-display text-4xl tracking-tight italic uppercase leading-none mb-2">
                        Access Control
                    </h1>
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                        User roles & permissions management
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard
                        icon={<Users size={20} />}
                        label="Total Users"
                        value={roleStats.total}
                        color="blue"
                    />
                    <StatCard
                        icon={<Crown size={20} />}
                        label="Administrators"
                        value={roleStats.admins}
                        color="yellow"
                    />
                    <StatCard
                        icon={<Eye size={20} />}
                        label="Loggers"
                        value={roleStats.loggers}
                        color="purple"
                    />
                    <StatCard
                        icon={<UserIcon size={20} />}
                        label="Regular Users"
                        value={roleStats.users}
                        color="green"
                    />
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                        <input
                            type="text"
                            placeholder="Search users by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm font-bold outline-none focus:border-primary transition-all"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all"
                    >
                        <option value="all">All Roles</option>
                        <option value="admin">Admins</option>
                        <option value="logger">Loggers</option>
                        <option value="user">Users</option>
                    </select>
                </div>

                {/* Users Table */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/30">
                                    <th className="p-6">User</th>
                                    <th className="p-6">Email</th>
                                    <th className="p-6">Role</th>
                                    <th className="p-6">Joined</th>
                                    <th className="p-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredUsers.map((user) => (
                                    <motion.tr
                                        key={user.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="group hover:bg-white/5 transition-colors"
                                    >
                                        <td className="p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-sm font-black">
                                                    {user.avatar ? (
                                                        <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                                                    ) : (
                                                        user.name.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">{user.name}</p>
                                                    <p className="text-[10px] text-white/40 uppercase tracking-widest">
                                                        ID: {user.id.slice(0, 8)}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <p className="text-sm text-white/60">{user.email}</p>
                                        </td>
                                        <td className="p-6">
                                            <RoleBadge role={user.role} />
                                        </td>
                                        <td className="p-6">
                                            <p className="text-xs text-white/40">
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </p>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center justify-end gap-2">
                                                <select
                                                    value={user.role}
                                                    onChange={(e) => updateUserRole(user.id, e.target.value)}
                                                    disabled={updatingUserId === user.id}
                                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-primary transition-all disabled:opacity-50"
                                                >
                                                    <option value="user">User</option>
                                                    <option value="logger">Logger</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredUsers.length === 0 && (
                            <div className="text-center py-12 text-white/40">
                                No users found matching your criteria
                            </div>
                        )}
                    </div>
                )}

                {/* Role Descriptions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <RoleCard
                        icon={<Crown size={24} />}
                        title="Administrator"
                        description="Full system access including user management, content moderation, and system configuration."
                        permissions={['Manage users', 'Edit all content', 'System settings', 'View analytics']}
                        color="yellow"
                    />
                    <RoleCard
                        icon={<Eye size={24} />}
                        title="Logger"
                        description="Match event logging access with ability to record live match data and statistics."
                        permissions={['Log match events', 'Update scores', 'Record statistics', 'View assigned matches']}
                        color="purple"
                    />
                    <RoleCard
                        icon={<UserIcon size={24} />}
                        title="User"
                        description="Standard user access for viewing content, making predictions, and engaging with the platform."
                        permissions={['View content', 'Make predictions', 'Comment & like', 'Manage profile']}
                        color="green"
                    />
                </div>
            </div>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    color
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: 'blue' | 'yellow' | 'purple' | 'green';
}) {
    const colorClasses = {
        blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
        yellow: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/20',
        purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20',
        green: 'from-green-500/20 to-green-500/5 border-green-500/20',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-gradient-to-br ${colorClasses[color]} border rounded-[32px] p-6`}
        >
            <div className="flex items-center gap-3 mb-4">
                <div className="text-white/60">{icon}</div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    {label}
                </span>
            </div>
            <p className="text-4xl font-display italic">{value}</p>
        </motion.div>
    );
}

function RoleBadge({ role }: { role: string }) {
    const roleConfig = {
        admin: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: <Crown size={12} /> },
        logger: { color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', icon: <Eye size={12} /> },
        user: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: <UserIcon size={12} /> },
    };

    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.user;

    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${config.color}`}>
            {config.icon}
            {role}
        </span>
    );
}

function RoleCard({
    icon,
    title,
    description,
    permissions,
    color
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    permissions: string[];
    color: 'yellow' | 'purple' | 'green';
}) {
    const colorClasses = {
        yellow: 'border-yellow-500/20',
        purple: 'border-purple-500/20',
        green: 'border-green-500/20',
    };

    return (
        <div className={`bg-white/5 border ${colorClasses[color]} rounded-[32px] p-6`}>
            <div className="flex items-center gap-3 mb-4">
                <div className="text-primary">{icon}</div>
                <h3 className="font-display text-xl italic uppercase">{title}</h3>
            </div>
            <p className="text-sm text-white/60 mb-4">{description}</p>
            <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Permissions</p>
                {permissions.map((permission, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                        <CheckCircle2 size={14} className="text-green-500" />
                        <span className="text-white/80">{permission}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
