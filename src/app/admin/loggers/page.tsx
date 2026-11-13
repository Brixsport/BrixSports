'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Activity, CheckCircle2, AlertCircle, Clock,
    Settings, Search, Filter, Shield,
    Award, Zap, Calendar, MapPin, ChevronRight, UserPlus,
    BarChart3, PieChart, TrendingUp, RefreshCw, X
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import ErrorBoundary from '@/components/admin/ErrorBoundary';
import { useWebSocket } from '@/hooks/useWebSocket';
import { getClientErrorMessage } from '@/lib/client-error';
import { safeToLocale } from '@/lib/safe-date';

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
    const [coverageScope, setCoverageScope] = useState<'week' | 'all'>('week');
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<{ matchId: string; loggerId: string; loggerName: string } | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);
    const [showAllCovered, setShowAllCovered] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerForm, setRegisterForm] = useState({
        name: '',
        email: '',
        password: ''
    });
    const [isRegistering, setIsRegistering] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        id: '',
        name: '',
        email: '',
        password: '',
        role: 'logger',
        status: 'active',
        isAvailable: true
    });
    const [isUpdating, setIsUpdating] = useState(false);
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

    // BACKLOG-283: this page previously fetched a bare `/api/matches` (default
    // limit 50, newest-first), which could silently drop older active matches
    // from coverage once total matches (finished + active) exceeded 50 -- this
    // page only ever uses `matches` as "active matches" (see coverageStats/
    // activeMatches below), so fetching directly by status is both correct and
    // simpler than paginating through the full bare list.
    const fetchData = async () => {
        setLoading(true);
        try {
            const [liveRes, upcomingRes, halfTimeRes, loggersRes, analyticsRes] = await Promise.all([
                fetch('/api/matches?status=LIVE&limit=200'),
                fetch('/api/matches?status=UPCOMING&limit=200&order=start_asc'),
                fetch('/api/matches?status=HALF_TIME&limit=200'),
                fetch('/api/loggers'),
                fetch('/api/analytics/loggers')
            ]);

            if (!loggersRes.ok) {
                const body = await loggersRes.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to load loggers');
            }
            for (const [label, res] of [['live', liveRes], ['upcoming', upcomingRes], ['half-time', halfTimeRes]] as const) {
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.error || `Failed to load ${label} matches`);
                }
            }

            const loggersData = await loggersRes.json();
            const [liveData, upcomingData, halfTimeData] = await Promise.all([
                liveRes.json(), upcomingRes.json(), halfTimeRes.json()
            ]);
            const matchesData = [...liveData, ...upcomingData, ...halfTimeData];
            // Soonest-first with a 200 cap: if the cap is hit, stale past fixtures may have pushed real ones out.
            if (Array.isArray(upcomingData) && upcomingData.length >= 200) {
                error('Coverage list is capped at 200 upcoming matches; some may be missing.');
            }
            const analyticsData = analyticsRes.ok ? await analyticsRes.json() : null;

            setLoggers(Array.isArray(loggersData) ? loggersData : []);
            setMatches(Array.isArray(matchesData) ? matchesData : []);
            setAnalytics(analyticsData);
        } catch (err) {
            error(getClientErrorMessage(err, 'Failed to load logger data. Please try again.'));
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
        setIsRemoving(true);
        try {
            const res = await fetch(`/api/matches/${matchId}/remove-logger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loggerId })
            });

            if (res.ok) {
                success('Logger removed successfully');
                setRemoveTarget(null);
                fetchData();
            } else {
                const data = await res.json().catch(() => ({}));
                error(data.error || 'Failed to remove logger');
            }
        } catch (err) {
            error('Failed to remove logger');
            console.error('Error removing logger:', err);
        } finally {
            setIsRemoving(false);
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

    const handleEditClick = (logger: Logger) => {
        setEditForm({
            id: logger.id,
            name: logger.name,
            email: logger.email,
            password: '', // Reset password field
            role: logger.role,
            status: logger.status,
            isAvailable: logger.isAvailable
        });
        setShowEditModal(true);
    };

    const updateLogger = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdating(true);

        try {
            const body: any = {
                name: editForm.name,
                email: editForm.email,
                role: editForm.role,
                status: editForm.status,
                isAvailable: editForm.isAvailable
            };
            if (editForm.password) {
                body.password = editForm.password;
            }

            const res = await fetch(`/api/loggers/${editForm.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                success('Logger updated successfully');
                setShowEditModal(false);
                fetchData();
            } else {
                const data = await res.json();
                error(data.error || 'Failed to update logger');
            }
        } catch (err) {
            error('Failed to update logger');
            console.error('Error updating logger:', err);
        } finally {
            setIsUpdating(false);
        }
    };


    const filteredLoggers = loggers.filter(l =>
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // A full season of future fixtures made "Match Coverage" read as a permanent emergency. Default scope is
    // what needs a logger soon: live, half-time, overdue (still UPCOMING past kick-off) and the next 7 days.
    const COVERAGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
    const allActiveMatches = matches
        .filter(m => m.status !== 'FINISHED')
        .sort((a, b) => (Date.parse(a.startTime) || 0) - (Date.parse(b.startTime) || 0));
    const windowEnd = Date.now() + COVERAGE_WINDOW_MS;
    const activeMatches = coverageScope === 'all'
        ? allActiveMatches
        : allActiveMatches.filter(m => m.status !== 'UPCOMING' || !(Date.parse(m.startTime) > windowEnd));
    const hiddenLaterCount = allActiveMatches.length - activeMatches.length;
    const nowMs = Date.now();
    const isOverdue = (m: any) => m.status === 'UPCOMING' && Date.parse(m.startTime) < nowMs - 24 * 60 * 60 * 1000;
    const coverageStats = {
        total: activeMatches.length,
        assigned: activeMatches.filter(m => m.assignedLoggers && m.assignedLoggers.length > 0).length,
        unassigned: activeMatches.filter(m => !m.assignedLoggers || m.assignedLoggers.length === 0).length,
        live: activeMatches.filter(m => m.status === 'LIVE').length,
        liveAssigned: activeMatches.filter(m => m.status === 'LIVE' && m.assignedLoggers && m.assignedLoggers.length > 0).length
    };

    const unassignedMatches = activeMatches.filter(m => !m.assignedLoggers || m.assignedLoggers.length === 0);
    const coveredMatches = activeMatches.filter(m => m.assignedLoggers && m.assignedLoggers.length > 0);
    const COVERED_PREVIEW = 5;
    const visibleCovered = showAllCovered ? coveredMatches : coveredMatches.slice(0, COVERED_PREVIEW);
    // The assign modal works on the live row (not the copy captured on click) so it reflects an assign/remove right away.
    const modalMatch = selectedMatch ? (matches.find(m => m.id === selectedMatch.id) ?? selectedMatch) : null;
    const modalAssigned = modalMatch?.assignedLoggers ?? [];
    const modalAssignedIds = new Set(modalAssigned.map(l => l.id));
    const modalCandidates = loggers.filter(l => l.isAvailable && !modalAssignedIds.has(l.id));
    const matchTitle = (m: Match | null | undefined) => `${m?.homeTeam?.name ?? 'TBD'} vs ${m?.awayTeam?.name ?? 'TBD'}`;

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
        <>
            <div className="p-4 sm:p-6 lg:p-12">
                <div className="max-w-6xl mx-auto space-y-6 sm:space-y-12">
                    <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="font-display text-2xl sm:text-4xl tracking-tight italic uppercase leading-none mb-2">Logger Management</h1>
                            <p className="hidden sm:block text-white/40 text-xs font-bold uppercase tracking-widest">Performance & Coverage Oversight</p>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4">
                            <button
                                onClick={fetchData}
                                aria-label="Refresh data"
                                className="min-h-11 min-w-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                                title="Refresh Data"
                            >
                                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                            </button>
                            <button
                                onClick={() => setShowRegisterModal(true)}
                                className="flex-1 sm:flex-none min-h-11 justify-center flex items-center gap-2 bg-primary text-black px-6 py-3 rounded-xl font-bold text-xs uppercase italic transition-transform hover:scale-105"
                            >
                                <UserPlus size={16} />
                                Register Logger
                            </button>
                        </div>
                    </header>

                    {/* Stats Overview */}
                    <div className="hidden md:grid grid-cols-4 gap-6">
                        <StatCard label="Total Loggers" value={loggers.length.toString()} subValue={`${loggers.filter(l => l.isAvailable).length} Available`} icon={<Users className="text-primary" size={24} />} />
                        <StatCard label="Match Coverage" value={coverageStats.total === 0 ? '—' : `${Math.round((coverageStats.assigned / coverageStats.total) * 100)}%`} subValue={`${coverageStats.assigned}/${coverageStats.total} ${coverageScope === 'week' ? 'Live + next 7 days' : 'Matches'}`} icon={<Shield className="text-blue-500" size={24} />} />
                        <StatCard label="Live Handling" value={`${coverageStats.liveAssigned}/${coverageStats.live}`} subValue="Active Matches" icon={<Activity className="text-red-500" size={24} />} />
                        <StatCard label="Avg Quality" value={analytics?.loggers?.length ? `${Math.round(analytics.loggers.reduce((acc: number, l: any) => acc + l.metrics.qualityScore, 0) / analytics.loggers.length)}%` : '—'} subValue="Metric score" icon={<Award className="text-yellow-500" size={24} />} />
                    </div>

                    {/* Navigation Tabs. BACKLOG-336: was a fixed-width px-6/py-3 pill row
                        (447px natural width) inside a w-fit container -- didn't wrap or
                        shrink, so it pushed the whole page's horizontal scroll out on
                        mobile. Same treatment as the match-detail page's tab bar: tight
                        padding by default, full desktop sizing from sm:, and
                        overflow-x-auto + scrollbar-hide as the safety net if labels still
                        don't fit (rather than truncating/abbreviating real nav labels). */}
                    <div className="flex items-center gap-1 sm:gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl w-full sm:w-fit overflow-x-auto scrollbar-hide">
                        <TabButton active={activeTab === 'management'} onClick={() => setActiveTab('management')} label="Management" badge={loggers.length} icon={<Users size={12} className="sm:w-3.5 sm:h-3.5" />} />
                        <TabButton active={activeTab === 'coverage'} onClick={() => setActiveTab('coverage')} label="Match Coverage" badge={unassignedMatches.length} badgeAlert={unassignedMatches.length > 0} icon={<Calendar size={12} className="sm:w-3.5 sm:h-3.5" />} />
                        <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} label="Analytics" icon={<BarChart3 size={12} className="sm:w-3.5 sm:h-3.5" />} />
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
                                            aria-label="Search loggers"
                                            placeholder="Search loggers by name or email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 sm:py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-primary transition-all"
                                        />
                                    </div>
                                </div>

                                {/* BACKLOG-336: was overflow-hidden, which on mobile silently
                                    clipped Availability/Performance/Matches/Actions with no way
                                    to reach them -- unreachable, not just off-screen. Fixed by
                                    shrinking to fit instead of scrolling: smaller padding/text at
                                    the default (mobile) breakpoint, full desktop sizing from sm:
                                    up, and the Matches column hidden below sm: (least essential
                                    column, avatars-only, redundant with the Actions "manage" flow). */}
                                {/* Phones: one card per logger (the six-column table can't fit 375px). */}
                                <div className="sm:hidden space-y-3">
                                    {filteredLoggers.map((logger) => {
                                        const loggerAnalytics = analytics?.loggers?.find((a: any) => a.logger.id === logger.id);
                                        const activeCount = (logger.assignedMatches ?? []).filter(m => m.status !== 'FINISHED').length;
                                        return (
                                            <div key={logger.id} className="bg-white/5 border border-white/10 rounded-3xl p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center border border-white/10 shrink-0">
                                                        <span className="text-xs font-black italic">{logger.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-bold italic break-words [overflow-wrap:anywhere]">{logger.name}</p>
                                                        <p className="text-[10px] text-white/40 font-bold break-all">{logger.email}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleEditClick(logger)}
                                                        aria-label={`Edit ${logger.name}`}
                                                        className="shrink-0 min-h-11 min-w-11 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                                                    >
                                                        <Settings size={18} />
                                                    </button>
                                                </div>
                                                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                                                    <StatusBadge status={logger.status} />
                                                    <button
                                                        onClick={() => toggleAvailability(logger.id, logger.isAvailable)}
                                                        aria-pressed={logger.isAvailable}
                                                        className={`min-h-11 flex items-center gap-2 px-4 rounded-full border transition-all ${logger.isAvailable
                                                            ? 'bg-primary/10 border-primary/20 text-primary'
                                                            : 'bg-white/5 border-white/10 text-white/40'
                                                            }`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${logger.isAvailable ? 'bg-primary' : 'bg-white/20'}`} />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">{logger.isAvailable ? 'Available' : 'Busy'}</span>
                                                    </button>
                                                </div>
                                                <div className="mt-3 flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-white/40">
                                                    <span>Quality <span className="text-white tabular-nums">{loggerAnalytics ? `${loggerAnalytics.metrics.qualityScore}%` : '—'}</span></span>
                                                    <span>Active matches <span className="text-white tabular-nums">{activeCount}</span></span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {filteredLoggers.length === 0 && (
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
                                        <p className="text-xs font-bold uppercase tracking-widest text-white/40 italic">
                                            {loggers.length === 0 ? 'No loggers registered yet' : 'No loggers match your search'}
                                        </p>
                                    </div>
                                )}

                                <div className="hidden sm:block bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/30">
                                                <th className="p-1 sm:p-6">Logger</th>
                                                <th className="p-1 sm:p-6">Status</th>
                                                <th className="p-1 sm:p-6">Avail.<span className="hidden sm:inline">ability</span></th>
                                                <th className="p-1 sm:p-6">Perf.<span className="hidden sm:inline">ormance</span></th>
                                                <th className="hidden sm:table-cell p-1 sm:p-6">Matches</th>
                                                <th className="p-1 sm:p-6 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredLoggers.map((logger) => {
                                                const loggerAnalytics = analytics?.loggers?.find((a: any) => a.logger.id === logger.id);
                                                return (
                                                    <tr key={logger.id} className="group hover:bg-white/5 transition-colors">
                                                        <td className="p-1 sm:p-6">
                                                            <div className="flex items-center gap-2 sm:gap-3">
                                                                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center border border-white/10 shrink-0">
                                                                    <span className="text-[10px] sm:text-xs font-black italic">{logger.name.split(' ').map(n => n[0]).join('')}</span>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs sm:text-sm font-bold italic truncate max-w-[90px] sm:max-w-none">{logger.name}</p>
                                                                    <p className="hidden sm:block text-[10px] text-white/30 font-bold uppercase tracking-tighter">{logger.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-1 sm:p-6">
                                                            <StatusBadge status={logger.status} />
                                                        </td>
                                                        <td className="p-1 sm:p-6">
                                                            <button
                                                                onClick={() => toggleAvailability(logger.id, logger.isAvailable)}
                                                                className={`flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-full border transition-all ${logger.isAvailable
                                                                    ? 'bg-primary/10 border-primary/20 text-primary'
                                                                    : 'bg-white/5 border-white/10 text-white/40'
                                                                    }`}
                                                            >
                                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${logger.isAvailable ? 'bg-primary' : 'bg-white/20'}`}></div>
                                                                {/* BACKLOG-336: full word on desktop, single-letter on mobile -- the
                                                                    pill + dot already carries the state, the label is a label not
                                                                    the only signal, so abbreviating it costs nothing real. */}
                                                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                                                                    <span className="sm:hidden">{logger.isAvailable ? 'A' : 'B'}</span>
                                                                    <span className="hidden sm:inline">{logger.isAvailable ? 'Available' : 'Busy'}</span>
                                                                </span>
                                                            </button>
                                                        </td>
                                                        <td className="p-1 sm:p-6">
                                                            <div className="flex items-center gap-1 sm:gap-4">
                                                                <div className="hidden sm:block flex-1 max-w-[100px] h-1 bg-white/10 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-primary"
                                                                        style={{ width: `${loggerAnalytics?.metrics?.qualityScore || 0}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-[10px] sm:text-xs font-bold italic">{loggerAnalytics?.metrics?.qualityScore || 0}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="hidden sm:table-cell p-2 sm:p-6">
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
                                                        <td className="p-1 sm:p-6 text-right">
                                                            <div className="flex items-center justify-end">
                                                                <button
                                                                    onClick={() => handleEditClick(logger)}
                                                                    aria-label={`Edit ${logger.name}`}
                                                                    className="min-h-11 min-w-11 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                                                                >
                                                                    <Settings size={16} />
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
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="font-display italic uppercase tracking-tighter text-2xl">
                                                Unassigned <span className="text-white/40 tabular-nums">{unassignedMatches.length}</span>
                                            </h3>
                                            {unassignedMatches.length > 0 && (
                                                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-red-500 px-3 py-1 bg-red-500/10 rounded border border-red-500/20">
                                                    Attention Required
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest text-white/40">
                                            <span>{coverageScope === 'week' ? 'Live + next 7 days' : 'All upcoming matches'}</span>
                                            {(hiddenLaterCount > 0 || coverageScope === 'all') && (
                                                <button
                                                    onClick={() => setCoverageScope(coverageScope === 'week' ? 'all' : 'week')}
                                                    className="min-h-11 underline hover:text-white"
                                                >
                                                    {coverageScope === 'week' ? `Show ${hiddenLaterCount} later` : 'Back to next 7 days'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-4">
                                            {unassignedMatches.length === 0 ? (
                                                <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
                                                    <CheckCircle2 size={32} className="text-primary mx-auto mb-4 opacity-20" />
                                                    <p className="text-xs font-bold uppercase tracking-widest text-white/40 italic">All matches covered</p>
                                                </div>
                                            ) : (
                                                unassignedMatches.map((match) => (
                                                    <div key={match.id} className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 hover:border-white/20 transition-all group">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                                                                <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-black flex items-center justify-center border border-white/10 italic font-black text-lg sm:text-xl">
                                                                    {match.sport[0]}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-sm font-bold break-words [overflow-wrap:anywhere]">{match.homeTeam?.name ?? 'TBD'} <span className="text-white/40 font-normal">vs</span> {match.awayTeam?.name ?? 'TBD'}</p>
                                                                    <p className="text-[10px] text-white/30 font-bold italic break-words">{match.competition}</p>
                                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-white/30 font-bold uppercase tracking-widest">
                                                                        <span className="flex items-center gap-1.5"><Clock size={10} />{safeToLocale(match.startTime, 'datetime', undefined, '—')}</span>
                                                                        {isOverdue(match) && <span className="text-amber-500">Overdue: status never updated</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedMatch(match);
                                                                    setShowAssignModal(true);
                                                                }}
                                                                className="shrink-0 min-h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-black hover:border-primary transition-all"
                                                            >
                                                                Assign
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Covered */}
                                    <div className="space-y-4">
                                        <h3 className="font-display italic uppercase tracking-tighter text-2xl">
                                            Covered <span className="text-white/40 tabular-nums">{coveredMatches.length}</span>
                                        </h3>
                                        <div className="space-y-4">
                                            {coveredMatches.length === 0 && (
                                                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
                                                    <p className="text-xs font-bold uppercase tracking-widest text-white/40 italic">No matches have a logger yet</p>
                                                </div>
                                            )}
                                            {visibleCovered.map((match) => (
                                                <div key={match.id} className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 opacity-80 hover:opacity-100 transition-all">
                                                    <div className="flex flex-col gap-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                                                                <div className="w-10 h-10 shrink-0 rounded-full bg-white/10 border-2 border-black flex items-center justify-center text-xl">
                                                                    {match.sport === 'Football' ? '⚽' : match.sport === 'Basketball' ? '🏀' : '🎮'}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-xs font-bold break-words [overflow-wrap:anywhere]">{match.homeTeam?.name ?? 'TBD'} <span className="text-white/40 font-normal">vs</span> {match.awayTeam?.name ?? 'TBD'}</p>
                                                                    <p className="text-[10px] text-white/30 font-bold italic break-words">{match.competition}</p>
                                                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{safeToLocale(match.startTime, 'datetime', undefined, '—')}</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedMatch(match);
                                                                    setShowAssignModal(true);
                                                                }}
                                                                className="shrink-0 min-h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                                            >
                                                                Manage
                                                            </button>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2">
                                                            {match.assignedLoggers?.map(logger => (
                                                                <div key={logger.id} className="flex items-center gap-2 bg-black/40 rounded-full pl-1 pr-1 py-1 border border-white/5 max-w-full">
                                                                    <div className="w-6 h-6 shrink-0 rounded-full bg-primary text-black flex items-center justify-center text-[10px] font-black italic">
                                                                        {logger.name[0]}
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-[10px] font-bold text-white leading-none truncate">{logger.name}</span>
                                                                        <span className="text-[9px] text-primary uppercase font-black leading-none">{logger.role}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => setRemoveTarget({ matchId: match.id, loggerId: logger.id, loggerName: logger.name })}
                                                                        aria-label={`Remove ${logger.name} from this match`}
                                                                        title="Remove from match"
                                                                        className="-my-2 -mr-1 w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-white/40 hover:text-red-500 hover:bg-white/10 transition-colors"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {coveredMatches.length > COVERED_PREVIEW && (
                                                <button
                                                    onClick={() => setShowAllCovered(v => !v)}
                                                    className="w-full min-h-11 text-[10px] font-black uppercase tracking-widest text-white/40 underline hover:text-white"
                                                >
                                                    {showAllCovered ? 'Show fewer' : `Show all ${coveredMatches.length}`}
                                                </button>
                                            )}
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
                                            {!analytics?.loggers?.length && (
                                                <p className="text-xs text-white/40">No logger activity recorded yet.</p>
                                            )}
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

                                    <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-6">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
                                            Activity{analytics?.timeframe ? ` · last ${analytics.timeframe}` : ''}
                                        </h4>
                                        {analytics?.loggers ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                                    <p className="text-[10px] font-black uppercase text-white/30 mb-1">Events logged</p>
                                                    <p className="text-2xl font-display italic tabular-nums">{analytics.loggers.reduce((n: number, l: any) => n + (l.metrics.recentEvents || 0), 0)}</p>
                                                </div>
                                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                                    <p className="text-[10px] font-black uppercase text-white/30 mb-1">Active loggers</p>
                                                    <p className="text-2xl font-display italic tabular-nums">{analytics.loggers.filter((l: any) => (l.metrics.recentEvents || 0) > 0).length}<span className="text-white/30 text-base">/{analytics.loggers.length}</span></p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-white/40">Analytics could not be loaded. Refresh to try again.</p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Assign Modal: shows who is already on the match (removable) and only offers loggers that can still be added. */}
            <AnimatePresence>
                {showAssignModal && modalMatch && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
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
                            role="dialog"
                            aria-modal="true"
                            aria-label="Assign logger"
                            className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#0a0a0a] border border-white/10 rounded-[32px] p-5 sm:p-8 shadow-2xl"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

                            <h3 className="font-display italic text-2xl uppercase mb-6">{modalAssigned.length > 0 ? 'Manage Loggers' : 'Assign Logger'}</h3>

                            <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Match Selected</p>
                                <p className="text-sm font-bold break-words [overflow-wrap:anywhere]">{modalMatch.homeTeam?.name ?? 'TBD'} <span className="text-white/40 font-normal">vs</span> {modalMatch.awayTeam?.name ?? 'TBD'}</p>
                                <p className="text-[10px] text-white/40 font-bold italic">{modalMatch.competition}</p>
                                <p className="text-[10px] text-primary font-black uppercase mt-1">{safeToLocale(modalMatch.startTime, 'datetime', undefined, '—')}</p>
                            </div>

                            {modalAssigned.length > 0 && (
                                <div className="mb-6">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Assigned ({modalAssigned.length})</p>
                                    <div className="space-y-2">
                                        {modalAssigned.map(l => (
                                            <div key={l.id} className="flex items-center justify-between gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-9 h-9 shrink-0 rounded-full bg-primary text-black flex items-center justify-center text-xs font-black italic">{l.name[0]}</div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold italic truncate">{l.name}</p>
                                                        <p className="text-[10px] text-primary font-black uppercase">{l.role}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setRemoveTarget({ matchId: modalMatch.id, loggerId: l.id, loggerName: l.name })}
                                                    className="shrink-0 min-h-11 px-3 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-red-500 hover:border-red-500/40 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Add a logger</p>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {modalCandidates.length === 0 && (
                                    <p className="text-xs text-white/40 py-4 text-center">
                                        {loggers.some(l => l.isAvailable)
                                            ? 'Every available logger is already on this match.'
                                            : 'No logger is marked available. Set one to Available on the Management tab.'}
                                    </p>
                                )}
                                {modalCandidates.map(logger => (
                                    <button
                                        key={logger.id}
                                        onClick={() => assignLogger(modalMatch.id, logger.id)}
                                        className="w-full min-h-11 flex items-center justify-between gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 shrink-0 rounded-full bg-primary text-black flex items-center justify-center text-xs font-black italic">
                                                {logger.name[0]}
                                            </div>
                                            <div className="text-left min-w-0">
                                                <p className="text-sm font-bold italic truncate group-hover:text-primary transition-colors">{logger.name}</p>
                                                <p className="text-[10px] text-white/30 font-bold uppercase">{(logger.assignedMatches ?? []).filter(m => m.status !== 'FINISHED').length} Active Matches</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="shrink-0 text-white/20 group-hover:text-primary transition-colors" />
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="w-full mt-6 min-h-11 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
                            >
                                Close
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmDialog
                isOpen={removeTarget !== null}
                onClose={() => !isRemoving && setRemoveTarget(null)}
                onConfirm={() => removeTarget && removeLogger(removeTarget.matchId, removeTarget.loggerId)}
                title="Remove logger?"
                message={removeTarget ? `${removeTarget.loggerName} will no longer be able to log ${matchTitle(matches.find(m => m.id === removeTarget.matchId))}.` : ''}
                confirmText="Remove"
                isLoading={isRemoving}
            />

            {/* Register Logger Modal */}
            <AnimatePresence>
                {showRegisterModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
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
                            role="dialog" aria-modal="true" className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#0a0a0a] border border-white/10 rounded-[32px] p-5 sm:p-8 shadow-2xl"
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
                                        className="flex-1 min-h-11 text-xs font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isRegistering}
                                        className="flex-1 min-h-11 bg-primary text-black px-6 py-3 rounded-xl font-bold text-xs uppercase italic transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
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

            {/* Edit Logger Modal */}
            <AnimatePresence>
                {showEditModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowEditModal(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            role="dialog" aria-modal="true" className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#0a0a0a] border border-white/10 rounded-[32px] p-5 sm:p-8 shadow-2xl"
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

                            <h3 className="font-display italic text-2xl uppercase mb-6">Edit Logger</h3>

                            <form onSubmit={updateLogger} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                                        placeholder="logger@brixsport.com"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">
                                        Password <span className="text-[10px] normal-case tracking-normal opacity-50">(Leave blank to keep current)</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={editForm.password}
                                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors"
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">Status</label>
                                        <select
                                            value={editForm.status}
                                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white"
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                            <option value="on_break">On Break</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2">Role</label>
                                        <select
                                            value={editForm.role}
                                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white"
                                        >
                                            <option value="logger">Logger</option>
                                            <option value="logger_manager">Logger manager</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        disabled={isUpdating}
                                        className="flex-1 min-h-11 text-xs font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isUpdating}
                                        className="flex-1 min-h-11 bg-primary text-black px-6 py-3 rounded-xl font-bold text-xs uppercase italic transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                        {isUpdating ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                Updating...
                                            </span>
                                        ) : (
                                            'Save Changes'
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
        </>
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

function TabButton({ active, onClick, label, icon, badge, badgeAlert }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode, badge?: number, badgeAlert?: boolean }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shrink-0 min-h-11 ${active
                ? 'bg-white/10 text-white shadow-lg'
                : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
        >
            {icon}
            {label}
            {badge !== undefined && (
                <span className={`tabular-nums ${badgeAlert ? 'text-red-500' : 'opacity-60'}`}>{badge}</span>
            )}
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
        <span className={`px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest border whitespace-nowrap ${config.bg} ${config.color} ${config.border}`}>
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
