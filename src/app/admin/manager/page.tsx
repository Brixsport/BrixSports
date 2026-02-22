'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Users, Calendar, CheckCircle2, AlertCircle,
    Clock, Search, Filter, MoreVertical, Shield,
    Zap, Radio, BarChart3, MessageSquare, Briefcase,
    LayoutDashboard, ClipboardList, UserCheck, Send, ThumbsUp, ThumbsDown, Eye
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function ManagerDashboard() {
    const { user } = useAuth();
    const [matches, setMatches] = useState<any[]>([]);
    const [loggers, setLoggers] = useState<any[]>([]);
    const [comms, setComms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMatch, setSelectedMatch] = useState<any>(null);
    const [noteContent, setNoteContent] = useState('');

    useEffect(() => {
        async function fetchData() {
            try {
                const [matchesRes, loggersRes] = await Promise.all([
                    fetch('/api/matches'),
                    fetch('/api/loggers')
                ]);

                const matchesData = await matchesRes.json();
                const loggersData = await loggersRes.json();

                setMatches(matchesData);
                setLoggers(loggersData);

                // Fetch comms for the most active match or a general feed if we had one
                // For now, let's just fetch for the first unapproved finished match if it exists
                const finishedUnapproved = matchesData.find((m: any) => m.status === 'FINISHED' && m.approvalStatus === 'PENDING');
                if (finishedUnapproved) {
                    const commsRes = await fetch(`/api/staff-comms?matchId=${finishedUnapproved.id}`);
                    const commsData = await commsRes.json();
                    setComms(commsData);
                }
            } catch (error) {
                console.error('Error fetching manager data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const activeOps = matches.filter(m => m.status === 'LIVE');
    const approvalQueue = matches.filter(m => m.status === 'FINISHED' && (m.approvalStatus === 'PENDING' || !m.approvalStatus));
    const personnelAvailable = loggers.filter(l => l.isAvailable);

    const handleApprove = async (matchId: string) => {
        try {
            await fetch(`/api/matches/${matchId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    approvalStatus: 'APPROVED',
                    approvedBy: user?.id,
                    approvedAt: new Date()
                })
            });
            // Refresh local state
            setMatches(prev => prev.map(m => m.id === matchId ? { ...m, approvalStatus: 'APPROVED' } : m));
        } catch (error) {
            console.error('Approval failed:', error);
        }
    };

    const handleSendNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMatch || !noteContent || !user) return;

        try {
            await fetch('/api/staff-comms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId: selectedMatch.id,
                    userId: user.id,
                    content: noteContent,
                    type: 'note'
                })
            });
            setNoteContent('');
            // Refresh comms
            const commsRes = await fetch(`/api/staff-comms?matchId=${selectedMatch.id}`);
            const commsData = await commsRes.json();
            setComms(commsData);
        } catch (error) {
            console.error('Failed to send note:', error);
        }
    };

    return (
        <div className="p-6 lg:p-12 min-h-screen bg-[#050505]">
            <div className="max-w-7xl mx-auto space-y-10">
                {/* Premium Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-[10px] font-black text-primary uppercase tracking-widest">
                                Managerial Suite
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
                                Operations v2.0
                            </div>
                        </div>
                        <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none">
                            Nexus <span className="text-primary">Ops</span>
                        </h1>
                        <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em]">Deployment & Data Verification Hub</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={14} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Locate ops or personnel..."
                                className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-6 text-xs font-bold outline-none focus:border-primary/50 focus:bg-white/[0.07] transition-all w-72"
                            />
                        </div>
                        <button className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors border-dashed">
                            <Filter size={18} className="text-white/60" />
                        </button>
                    </div>
                </header>

                {/* Tactical Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <TacticalCard
                        label="In-Game"
                        value={activeOps.length}
                        subLabel="Live Feeds"
                        icon={<Radio size={20} className="text-primary" />}
                        trend="+2 since lockout"
                    />
                    <TacticalCard
                        label="To Validate"
                        value={approvalQueue.length}
                        subLabel="Awaiting Review"
                        icon={<ClipboardList size={20} className="text-orange-400" />}
                        trend="Priority Focus"
                        critical={approvalQueue.length > 0}
                    />
                    <TacticalCard
                        label="Deployable"
                        value={personnelAvailable.length}
                        subLabel="Ready Loggers"
                        icon={<UserCheck size={20} className="text-blue-400" />}
                        trend={`${loggers.length} total active`}
                    />
                    <TacticalCard
                        label="Staff Comms"
                        value={comms.length}
                        subLabel="Internal Events"
                        icon={<MessageSquare size={20} className="text-green-400" />}
                        trend="Recent activity"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Workflow Area */}
                    <div className="lg:col-span-2 space-y-12">

                        {/* Approval & Validation Section */}
                        <section className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="font-display text-2xl italic uppercase tracking-tighter flex items-center gap-3">
                                    <Shield size={20} className="text-orange-400" />
                                    Validation Queue
                                </h2>
                                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Data Integrity Check</span>
                            </div>

                            <div className="space-y-4">
                                {approvalQueue.length === 0 ? (
                                    <div className="p-12 bg-white/5 border border-white/10 border-dashed rounded-[32px] text-center">
                                        <CheckCircle2 size={32} className="mx-auto text-white/10 mb-4" />
                                        <p className="text-sm font-bold text-white/40 uppercase tracking-widest">Queue Clear</p>
                                    </div>
                                ) : (
                                    approvalQueue.map(match => (
                                        <ValidationRow
                                            key={match.id}
                                            match={match}
                                            onApprove={() => handleApprove(match.id)}
                                            onSelect={() => {
                                                setSelectedMatch(match);
                                                // Fetch comms for this match
                                                fetch(`/api/staff-comms?matchId=${match.id}`).then(res => res.json()).then(setComms);
                                            }}
                                            isSelected={selectedMatch?.id === match.id}
                                        />
                                    ))
                                )}
                            </div>
                        </section>

                        {/* Live Monitoring Section */}
                        <section className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="font-display text-2xl italic uppercase tracking-tighter flex items-center gap-3">
                                    <Activity size={20} className="text-primary" />
                                    Live Operations
                                </h2>
                                <Link href="/admin/matches" className="text-[10px] font-black text-white/40 hover:text-primary uppercase tracking-widest transition-colors">
                                    All Matches →
                                </Link>
                            </div>

                            <div className="space-y-4">
                                {activeOps.map(match => (
                                    <LiveOperationCard key={match.id} match={match} loggers={loggers} />
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Communication & Staff Sidebar */}
                    <aside className="space-y-8">
                        {/* Internal Comms Panel */}
                        <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 space-y-8 flex flex-col h-[700px]">
                            <div className="space-y-2">
                                <h3 className="font-display text-2xl italic uppercase tracking-tighter flex items-center gap-3">
                                    <MessageSquare size={20} className="text-primary" />
                                    Staff Comms
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Internal Channel</p>
                                </div>
                            </div>

                            {/* Comms Feed */}
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                {selectedMatch ? (
                                    <>
                                        <div className="p-3 bg-white/5 border border-white/10 rounded-2xl mb-6">
                                            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Active Thread</p>
                                            <p className="text-xs font-bold truncate">{selectedMatch.homeTeam?.shortName} vs {selectedMatch.awayTeam?.shortName}</p>
                                        </div>
                                        {comms.length === 0 ? (
                                            <p className="text-center text-[10px] text-white/20 uppercase py-8">No internal notes for this match</p>
                                        ) : (
                                            comms.map((comm: any) => (
                                                <div key={comm.id} className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-[8px] font-black uppercase text-primary">
                                                                {comm.user?.name?.[0] || 'S'}
                                                            </div>
                                                            <span className="text-[10px] font-black uppercase text-white/60">{comm.user?.name}</span>
                                                        </div>
                                                        <span className="text-[9px] text-white/20">{new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl rounded-tl-none">
                                                        <p className="text-xs leading-relaxed text-white/80">{comm.content}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-4">
                                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                                            <Eye size={20} className="text-white/20" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white/40 uppercase tracking-widest">Select an Op</p>
                                            <p className="text-[10px] text-white/20 uppercase mt-1">View staff conversation for details</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Message Entry */}
                            <form onSubmit={handleSendNote} className="pt-4 border-t border-white/10 space-y-3">
                                <textarea
                                    value={noteContent}
                                    onChange={(e) => setNoteContent(e.target.value)}
                                    disabled={!selectedMatch}
                                    placeholder={selectedMatch ? "Send directive to staff..." : "Select match to communicate"}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold outline-none focus:border-primary/50 transition-all resize-none h-24 disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                    disabled={!selectedMatch || !noteContent}
                                    className="w-full h-12 bg-primary text-black rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 disabled:grayscale"
                                >
                                    Transmit Directive
                                    <Send size={14} />
                                </button>
                            </form>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}

function TacticalCard({ label, value, subLabel, icon, trend, critical = false }: any) {
    return (
        <div className={`bg-white/5 border ${critical ? 'border-orange-500/30' : 'border-white/10'} rounded-[32px] p-8 space-y-4 hover:bg-white/[0.07] transition-all group`}>
            <div className="flex items-start justify-between">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 group-hover:border-white/20 transition-all">
                    {icon}
                </div>
                <div className="text-right">
                    <p className="text-3xl font-display italic uppercase text-white leading-none">{value}</p>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">{label}</p>
                </div>
            </div>
            <div className="pt-2 space-y-1">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">{subLabel}</p>
                <p className={`text-[9px] font-bold ${critical ? 'text-orange-400' : 'text-white/20'} uppercase tracking-tighter`}>{trend}</p>
            </div>
        </div>
    );
}

function ValidationRow({ match, onApprove, onSelect, isSelected }: any) {
    return (
        <div
            onClick={onSelect}
            className={`
                bg-white/5 border ${isSelected ? 'border-primary/50 bg-white/[0.07]' : 'border-white/10'} 
                rounded-[32px] p-6 hover:bg-white/[0.07] transition-all group cursor-pointer
            `}
        >
            <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-lg font-display italic uppercase tracking-tighter">
                            {match.homeTeam?.name || 'Home'} vs {match.awayTeam?.name || 'Away'}
                        </span>
                        <span className="text-[10px] font-black text-white/20 uppercase px-2 py-0.5 border border-white/10 rounded">
                            {match.sport}
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-white/30 font-bold uppercase tracking-widest">
                        <span>Score: {match.homeScore} - {match.awayScore}</span>
                        <span>•</span>
                        <span>{match.competition}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={(e) => { e.stopPropagation(); onApprove(); }}
                        className="px-6 py-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-500 hover:text-black transition-all"
                    >
                        <div className="flex items-center gap-2">
                            <ThumbsUp size={14} />
                            Approve Result
                        </div>
                    </button>
                    <button className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl hover:bg-red-500 hover:text-black transition-all">
                        <ThumbsDown size={14} />
                    </button>
                    <Link
                        href={`/admin/matches/${match.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all"
                    >
                        <LayoutDashboard size={16} />
                    </Link>
                </div>
            </div>
        </div>
    );
}

function LiveOperationCard({ match, loggers }: any) {
    const logger = loggers.find((l: any) => l.id === match.loggerId);

    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 hover:bg-white/[0.07] transition-all group">
            <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden">
                        {match.homeTeam?.logo ? <img src={match.homeTeam.logo} className="w-8 h-8 object-contain" /> : <span className="text-xl">⚽</span>}
                    </div>
                    <div className="text-xl font-display italic text-white/20">VS</div>
                    <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden">
                        {match.awayTeam?.logo ? <img src={match.awayTeam.logo} className="w-8 h-8 object-contain" /> : <span className="text-xl">⚽</span>}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-lg font-display italic uppercase tracking-tighter">
                            {match.homeTeam?.shortName} {match.homeScore} - {match.awayScore} {match.awayTeam?.shortName}
                        </span>
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 rounded text-[8px] font-black text-primary uppercase">
                            <span className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                            Live
                        </div>
                    </div>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{match.venue} • {logger?.name || 'Auto-Sync'}</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                        <Clock size={16} className="text-primary/40" />
                    </div>
                    <Link href={`/admin/matches/${match.id}`} className="p-3 bg-white/10 rounded-2xl hover:bg-primary hover:text-black transition-all">
                        <LayoutDashboard size={18} />
                    </Link>
                </div>
            </div>
        </div>
    );
}
