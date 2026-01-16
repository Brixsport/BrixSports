'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Activity, CheckCircle2, AlertCircle, Clock,
    Settings, Search, Filter, MoreVertical, Shield,
    Award, Zap, Calendar, MapPin, ChevronRight, UserPlus,
    BarChart3, PieChart, TrendingUp, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import ErrorBoundary from '@/components/admin/ErrorBoundary';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Logger {
    id: string;
    name: string;
    email: string;
    role: string;
    status: 'active' | 'inactive' | 'on_break';
    isAvailable: boolean;
    assignedMatches: any[];
}

interface Match {
    id: string;
    sport: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    status: string;
    startTime: string;
    competition: string;
    loggerId: string | null;
    assignedLoggers?: {
        id: string;
        name: string;
        email: string;
        role: string;
    }[];
    homeTeam?: any;
    awayTeam?: any;
}

function AdminLoggersPageContent() {
    const [loggers, setLoggers] = useState<Logger[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [analytics, setAnalytics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'management' | 'coverage' | 'analytics'>('management');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerForm, setRegisterForm] = useState({
        name: '',
        email: '',
        password: ''
    });
    const [isRegistering, setIsRegistering] = useState(false);
    const { toasts, removeToast, success, error } = useToast();
    const { socket, isConnected } = useWebSocket({ autoConnect: true });

    useEffect(() => {
        if (isConnected && socket) {
            socket.emit('admin:subscribe');

            const handleUpdate = (data: any) => {
                setLoggers(prev => prev.map(l => {
                    if (l.id === data.loggerId) {
                        return {
                            ...l,
                            status: data.status || l.status,
                            isAvailable: data.isAvailable !== undefined ? data.isAvailable : l.isAvailable
                        };
                    }
                    return l;
                }));
            };

            socket.on('logger:updated', handleUpdate);

            return () => {
                socket.off('logger:updated', handleUpdate);
            };
        }
    }, [isConnected, socket]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [loggersRes, matchesRes, analyticsRes] = await Promise.all([
                fetch('/api/loggers'),
                fetch('/api/matches'),
                fetch('/api/analytics/loggers')
            ]);

            const loggersData = await loggersRes.json();
            const matchesData = await matchesRes.json();
            const analyticsData = await analyticsRes.json();

            setLoggers(loggersData);
            setMatches(matchesData);
            setAnalytics(analyticsData);
        } catch (err) {
            error('Failed to load logger data. Please try again.');
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleAvailability = async (loggerId: string, current: boolean) => {
        try {
            const res = await fetch(`/api/loggers/${loggerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isAvailable: !current })
            });

            if (res.ok) {
                setLoggers(prev => prev.map(l =>
                    l.id === loggerId ? { ...l, isAvailable: !current } : l
                ));
                success(`Logger ${!current ? 'available' : 'unavailable'}`);
            } else {
                error('Failed to update logger status');
            }
        } catch (err) {
            error('Failed to update status');
            console.error('Error updating logger:', err);
        }
    };

    const assignLogger = async (matchId: string, loggerId: string, role: string = 'primary') => {
        try {
            const res = await fetch(`/api/matches/${matchId}/assign-logger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loggerId, role })
            });

            if (res.ok) {
                success('Logger assigned successfully');
                fetchData();
                setShowAssignModal(false);
            } else {
                const data = await res.json();
                error(data.error || 'Failed to assign logger');
            }
        } catch (err) {
            error('Failed to assign logger');
            console.error('Error assigning logger:', err);
        }
    };

    const removeLogger = async (matchId: string, loggerId: string) => {
        try {
            const res = await fetch(`/api/matches/${matchId}/remove-logger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loggerId })
            });

            if (res.ok) {
                success('Logger removed successfully');
                fetchData();
            } else {
                const data = await res.json();
                error(data.error || 'Failed to remove logger');
            }
        } catch (err) {
            error('Failed to remove logger');
            console.error('Error removing logger:', err);
        }
    };

    const registerLogger = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsRegistering(true);

        try {
            const res = await fetch('/api/loggers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerForm)
            });

            if (res.ok) {
                success('Logger registered successfully!');
                setShowRegisterModal(false);
                setRegisterForm({ name: '', email: '', password: '' });
                fetchData();
            } else {
                const data = await res.json();
                error(data.error || 'Failed to register logger');
            }
        } catch (err) {
            error('Failed to register logger');
            console.error('Error registering logger:', err);
        } finally {
            setIsRegistering(false);
        }
    };


    const filteredLoggers = loggers.filter(l =>
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeMatches = matches.filter(m => m.status !== 'FINISHED');
    const coverageStats = {
        total: activeMatches.length,
        assigned: activeMatches.filter(m => m.assignedLoggers && m.assignedLoggers.length > 0).length,
        unassigned: activeMatches.filter(m => !m.assignedLoggers || m.assignedLoggers.length === 0).length,
        live: activeMatches.filter(m => m.status === 'LIVE').length,
        liveAssigned: activeMatches.filter(m => m.status === 'LIVE' && m.assignedLoggers && m.assignedLoggers.length > 0).length
    };

    if (loading && !loggers.length) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Synchronizing Nexus...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Toast Container */}
            <ToastContainer toasts={toasts} onClose={removeToast} />
            {/* Sidebar - Same as main admin page */}
            <aside className="fixed left-0 top-0 bottom-0 w-64 bg-black border-r border-white/5 hidden lg:flex flex-col p-6 space-y-8">
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-black font-display text-xl -skew-x-12">B</div>
                    <span className="font-display text-xl tracking-tight italic uppercase">Command</span>
                </div>

                <nav className="flex-1 space-y-1">
                    <NavItem icon={<Activity size={18} />} label="Live Monitor" href="/admin" />
                    <NavItem icon={<Calendar size={18} />} label="Matches" href="/admin/matches" />
                    <NavItem icon={<Users size={18} />} label="Loggers" active />
                    <NavItem icon={<Shield size={18} />} label="Access Control" href="/admin/access" />
                </nav>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Nexus Core</span>
                    </div>
                    <p className="text-[10px] text-white/60 font-bold">Health: Optimal</p>
                </div>
            </aside>

            <main className="lg:pl-64 pt-8 p-6 lg:p-12">
                <div className="max-w-6xl mx-auto space-y-12">
                    <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="font-display text-4xl tracking-tight italic uppercase leading-none mb-2">Logger Management</h1>
                            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Performance & Coverage Oversight</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={fetchData}
                                className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                                title="Refresh Data"
                            >
                                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                            </button>
                            <button
                                onClick={() => setShowRegisterModal(true)}
                                className="flex items-center gap-2 bg-primary text-black px-6 py-3 rounded-xl font-bold text-xs uppercase italic transition-transform hover:scale-105"
                            >
                                <UserPlus size={16} />
                                Register Logger
                            </button>
                        </div>
                    </header>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <StatCard label="Total Loggers" value={loggers.length.toString()} subValue={`${loggers.filter(l => l.isAvailable).length} Available`} icon={<Users className="text-primary" size={24} />} />
                        <StatCard label="Match Coverage" value={`${Math.round((coverageStats.assigned / coverageStats.total) * 100)}%`} subValue={`${coverageStats.assigned}/${coverageStats.total} Matches`} icon={<Shield className="text-blue-500" size={24} />} />
                        <StatCard label="Live Handling" value={`${coverageStats.liveAssigned}/${coverageStats.live}`} subValue="Active Matches" icon={<Activity className="text-red-500" size={24} />} />
                        <StatCard label="Avg Quality" value={analytics?.loggers ? `${Math.round(analytics.loggers.reduce((acc: number, l: any) => acc + l.metrics.qualityScore, 0) / (analytics.loggers.length || 1))}%` : '0%'} subValue="Metric score" icon={<Award className="text-yellow-500" size={24} />} />
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl w-fit">
                        <TabButton active={activeTab === 'management'} onClick={() => setActiveTab('management')} label="Management" icon={<Users size={14} />} />
                        <TabButton active={activeTab === 'coverage'} onClick={() => setActiveTab('coverage')} label="Match Coverage" icon={<Calendar size={14} />} />
                        <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} label="Analytics" icon={<BarChart3 size={14} />} />
                    </div>

                    {/* Tab Content */}
                    <AnimatePresence mode="wait">
                        {activeTab === 'management' && (
                            <motion.div
                                key="management"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search loggers by name or email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-primary transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/30">
                                                <th className="p-6">Logger</th>
                                                <th className="p-6">Status</th>
                                                <th className="p-6">Availability</th>
                                                <th className="p-6">Performance</th>
                                                <th className="p-6">Matches</th>
                                                <th className="p-6 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredLoggers.map((logger) => {
                                                const loggerAnalytics = analytics?.loggers?.find((a: any) => a.logger.id === logger.id);
                                                return (
                                                    <tr key={logger.id} className="group hover:bg-white/5 transition-colors">
                                                        <td className="p-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center border border-white/10">
                                                                    <span className="text-xs font-black italic">{logger.name.split(' ').map(n => n[0]).join('')}</span>
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold italic">{logger.name}</p>
                                                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-tighter">{logger.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-6">
                                                            <StatusBadge status={logger.status} />
                                                        </td>
                                                        <td className="p-6">
                                                            <button
                                                                onClick={() => toggleAvailability(logger.id, logger.isAvailable)}
                                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${logger.isAvailable
                                                                    ? 'bg-primary/10 border-primary/20 text-primary'
                                                                    : 'bg-white/5 border-white/10 text-white/40'
                                                                    }`}
                                                            >
                                                                <div className={`w-1.5 h-1.5 rounded-full ${logger.isAvailable ? 'bg-primary' : 'bg-white/20'}`}></div>
                                                                <span className="text-[10px] font-black uppercase tracking-widest">
                                                                    {logger.isAvailable ? 'Available' : 'Busy'}
                                                                </span>
                                                            </button>
                                                        </td>
                                                        <td className="p-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex-1 max-w-[100px] h-1 bg-white/10 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-primary"
                                                                        style={{ width: `${loggerAnalytics?.metrics?.qualityScore || 0}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs font-bold italic">{loggerAnalytics?.metrics?.qualityScore || 0}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-6">
                                                            <div className="flex -space-x-2">
                                                                {logger.assignedMatches?.filter(m => m.status !== 'FINISHED').slice(0, 3).map((m, i) => (
                                                                    <div key={i} className="w-6 h-6 rounded-full bg-black border border-white/20 flex items-center justify-center text-[10px] font-bold" title={m.competition}>
                                                                        {m.sport[0]}
                                                                    </div>
                                                                ))}
                                                                {logger.assignedMatches?.filter(m => m.status !== 'FINISHED').length > 3 && (
                                                                    <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/40">
                                                                        +{logger.assignedMatches.filter(m => m.status !== 'FINISHED').length - 3}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-6 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white">
                                                                    <Settings size={16} />
                                                                </button>
                                                                <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white">
                                                                    <MoreVertical size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'coverage' && (
                            <motion.div
                                key="coverage"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-8"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Unassigned Matches */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-display italic uppercase tracking-tighter text-2xl">Unassigned Matches</h3>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500 px-3 py-1 bg-red-500/10 rounded border border-red-500/20">
                                                Attention Required
                                            </span>
                                        </div>
                                        <div className="space-y-4">
                                            {activeMatches.filter(m => !m.assignedLoggers || m.assignedLoggers.length === 0).length === 0 ? (
                                                <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
                                                    <CheckCircle2 size={32} className="text-primary mx-auto mb-4 opacity-20" />
                                                    <p className="text-xs font-bold uppercase tracking-widest text-white/40 italic">All matches covered</p>
                                                </div>
                                            ) : (
                                                activeMatches.filter(m => !m.assignedLoggers || m.assignedLoggers.length === 0).map((match) => (
                                                    <div key={match.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-white/20 transition-all group">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center border border-white/10 italic font-black text-xl">
                                                                    {match.sport[0]}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold italic">{match.competition}</p>
                                                                    <div className="flex items-center gap-2 text-[10px] text-white/30 font-bold uppercase tracking-widest">
                                                                        <Clock size={10} />
                                                                        <span>{new Date(match.startTime).toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedMatch(match);
                                                                    setShowAssignModal(true);
                                                                }}
                                                                className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-black hover:border-primary transition-all"
                                                            >
                                                                Assign
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Recently Assigned */}
                                    <div className="space-y-6">
                                        <h3 className="font-display italic uppercase tracking-tighter text-2xl">Covered Matches</h3>
                                        <div className="space-y-4">
                                            {activeMatches.filter(m => m.assignedLoggers && m.assignedLoggers.length > 0).slice(0, 5).map((match) => {
                                                return (
                                                    <div key={match.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 opacity-80 hover:opacity-100 transition-all">
                                                        <div className="flex flex-col gap-4">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-10 h-10 rounded-full bg-white/10 border-2 border-black flex items-center justify-center text-xl">
                                                                        {match.sport === 'Football' ? '⚽' : match.sport === 'Basketball' ? '🏀' : '🎮'}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-bold italic">{match.competition}</p>
                                                                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{new Date(match.startTime).toLocaleString()}</p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedMatch(match);
                                                                        setShowAssignModal(true);
                                                                    }}
                                                                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                                                >
                                                                    Manage
                                                                </button>
                                                            </div>

                                                            <div className="flex flex-wrap gap-2">
                                                                {match.assignedLoggers?.map(logger => (
                                                                    <div key={logger.id} className="flex items-center gap-2 bg-black/40 rounded-full pl-1 pr-3 py-1 border border-white/5">
                                                                        <div className="w-6 h-6 rounded-full bg-primary text-black flex items-center justify-center text-[10px] font-black italic">
                                                                            {logger.name[0]}
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[10px] font-bold text-white leading-none">{logger.name}</span>
                                                                            <span className="text-[8px] text-primary uppercase font-black leading-none">{logger.role}</span>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => {
                                                                                if (confirm(`Remove ${logger.name} from this match?`)) {
                                                                                    removeLogger(match.id, logger.id);
                                                                                }
                                                                            }}
                                                                            className="ml-1 p-1 hover:bg-white/10 rounded-full text-white/40 hover:text-red-500 transition-colors"
                                                                        >
                                                                            <RefreshCw size={8} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'analytics' && (
                            <motion.div
                                key="analytics"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-8"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-6">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Efficiency Leaderboard</h4>
                                        <div className="space-y-6">
                                            {analytics?.loggers?.slice(0, 5).map((l: any, i: number) => (
                                                <div key={l.logger.id} className="flex items-center gap-4">
                                                    <span className="text-2xl font-display italic text-white/10 w-8">0{i + 1}</span>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between mb-2">
                                                            <span className="text-sm font-bold italic">{l.logger.name}</span>
                                                            <span className="text-xs font-bold text-primary">{l.metrics.totalEvents} Events</span>
                                                        </div>
                                                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${l.metrics.qualityScore}%` }}
                                                                className="h-full bg-primary"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 flex flex-col justify-center items-center text-center space-y-4">
                                        <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary flex items-center justify-center animate-[spin_3s_linear_infinite]">
                                            <BarChart3 className="text-primary" size={32} />
                                        </div>
                                        <h4 className="font-display italic text-2xl uppercase">System Health</h4>
                                        <p className="text-xs text-white/40 max-w-[240px]">Overall logging consistency and data integrity metrics collected over the last 30 days.</p>
                                        <div className="grid grid-cols-2 gap-4 w-full mt-4">
                                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                                <p className="text-[10px] font-black uppercase text-white/20 mb-1">Consistency</p>
                                                <p className="text-xl font-display italic">92%</p>
                                            </div>
                                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                                <p className="text-[10px] font-black uppercase text-white/20 mb-1">Latency</p>
                                                <p className="text-xl font-display italic">280ms</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            {/* Assign Modal */}
            <AnimatePresence>
                {showAssignModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAssignModal(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

                            <h3 className="font-display italic text-2xl uppercase mb-6">Assign Logger</h3>

                            <div className="bg-white/5 rounded-2xl p-4 mb-8 border border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Match Selected</p>
                                <p className="text-sm font-bold italic">{selectedMatch?.competition}</p>
                                <p className="text-[10px] text-primary font-black uppercase mt-1">
                                    {selectedMatch ? new Date(selectedMatch.startTime).toLocaleString() : ''}
                                </p>
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {/* Available loggers */}
                                {loggers.filter(l => l.isAvailable).map(logger => (
                                    <button
                                        key={logger.id}
                                        onClick={() => assignLogger(selectedMatch!.id, logger.id)}
                                        className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary text-black flex items-center justify-center text-xs font-black italic">
                                                {logger.name[0]}
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold italic group-hover:text-primary transition-colors">{logger.name}</p>
                                                <p className="text-[10px] text-white/30 font-bold uppercase">{logger.assignedMatches.filter(m => m.status !== 'FINISHED').length} Active Matches</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-white/20 group-hover:text-primary transition-colors" />
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="w-full mt-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/20 hover:text-white transition-colors"
                            >
                                Cancel Assignment
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Register Logger Modal */}
            <AnimatePresence>
                {showRegisterModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowRegisterModal(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 shadow-2xl"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

                            <h3 className="font-display italic text-2xl uppercase mb-6">Register New Logger</h3>

                            <form onSubmit={registerLogger} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        value={registerForm.name}
                                        onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        value={registerForm.email}
                                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                                        placeholder="logger@brixsport.com"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">Password</label>
                                    <input
                                        type="password"
                                        value={registerForm.password}
                                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowRegisterModal(false)}
                                        disabled={isRegistering}
                                        className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isRegistering}
                                        className="flex-1 bg-primary text-black px-6 py-3 rounded-xl font-bold text-xs uppercase italic transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                        {isRegistering ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                Registering...
                                            </span>
                                        ) : (
                                            'Register Logger'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
        </div>
    );
}

function NavItem({ icon, label, active = false, href = '#' }: { icon: React.ReactNode, label: string, active?: boolean, href?: string }) {
    const className = `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-primary text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`;

    return (
        <Link href={href} className={className}>
            {icon}
            <span className="text-xs font-bold italic uppercase tracking-tight">{label}</span>
        </Link>
    );
}

function StatCard({ label, value, subValue, icon }: { label: string, value: string, subValue: string, icon: React.ReactNode }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                {icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</span>
            <p className="text-4xl font-display italic uppercase leading-none my-2">{value}</p>
            <p className="text-[10px] text-primary font-black uppercase tracking-[0.1em]">{subValue}</p>
        </div>
    );
}

function TabButton({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active
                ? 'bg-white/10 text-white shadow-lg'
                : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
        >
            {icon}
            {label}
        </button>
    );
}

function StatusBadge({ status }: { status: string }) {
    const configs = {
        active: { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', label: 'Active' },
        inactive: { color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10', label: 'Inactive' },
        on_break: { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'On Break' }
    };

    const config = configs[status as keyof typeof configs] || configs.inactive;

    return (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${config.bg} ${config.color} ${config.border}`}>
            {config.label}
        </span>
    );
}

export default function AdminLoggersPage() {
    return (
        <ErrorBoundary>
            <AdminLoggersPageContent />
        </ErrorBoundary>
    );
}
