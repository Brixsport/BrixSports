'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, Shield, Users, Server, Settings, Globe,
    Trophy, Calendar, Video, Newspaper, TrendingUp,
    Timer, Menu, X, ChevronRight, LogOut, UserPlus, Briefcase, User, Megaphone
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
    { icon: <Activity size={18} />, label: "Live Monitor", href: "/admin" },
    { icon: <Briefcase size={18} />, label: "Manager Center", href: "/admin/manager" },
    { icon: <Trophy size={18} />, label: "Competitions", href: "/admin/competitions" },
    { icon: <Globe size={18} />, label: "Organizations", href: "/admin/organizations", adminOnly: true },
    { icon: <User size={18} />, label: "Player Profiles", href: "/admin/players" },
    { icon: <Calendar size={18} />, label: "Matches", href: "/admin/matches" },
    { icon: <Timer size={18} />, label: "Track Events", href: "/admin/track-events" },
    { icon: <Video size={18} />, label: "Livestreams", href: "/admin/livestreams", adminOnly: true },
    { icon: <Newspaper size={18} />, label: "News", href: "/admin/news", adminOnly: true },
    { icon: <TrendingUp size={18} />, label: "Transfers", href: "/admin/transfers", adminOnly: true },
    { icon: <Megaphone size={18} />, label: "Advertisements", href: "/admin/advertisements", adminOnly: true },
    { icon: <UserPlus size={18} />, label: "Bulk Register", href: "/admin/bulk-register" },
    { icon: <Users size={18} />, label: "Loggers", href: "/admin/loggers" },
    { icon: <Server size={18} />, label: "Infrastructure", href: "/admin/infrastructure", adminOnly: true },
    { icon: <Shield size={18} />, label: "Access Control", href: "/admin/access", adminOnly: true },
    { icon: <Settings size={18} />, label: "Algorithm Setup", href: "/admin/settings", adminOnly: true },
];

export function AdminSidebar() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const filteredNavItems = navItems.filter(item => {
        if (item.adminOnly && user?.role !== 'admin') return false;
        return true;
    });

    // Close sidebar on navigation
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    return (
        <>
            {/* Mobile Toggle Button */}
            <div className="fixed top-4 right-4 z-[60]">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-3 bg-primary text-black rounded-xl shadow-lg border border-black/10 transition-transform active:scale-95"
                >
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Backdrop for Mobile */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[50]"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Content */}
            <aside className={`
        fixed left-0 top-0 bottom-0 w-72 bg-black border-r border-white/5 z-[55] 
        transition-transform duration-500 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col p-6 space-y-8
      `}>
                <div className="flex items-center justify-between mb-10">
                    <Link href="/admin" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-black font-display text-2xl -skew-x-12 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]">B</div>
                        <div className="flex flex-col">
                            <span className="font-display text-xl tracking-tight italic uppercase leading-none">Command</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Nexus v2.4</span>
                        </div>
                    </Link>
                    <button className="text-white/40 hover:text-white" onClick={() => setIsOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
                    {filteredNavItems.map((item) => {
                        const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`
                  flex items-center justify-between group px-4 py-3 rounded-2xl transition-all
                  ${active
                                        ? 'bg-primary text-black'
                                        : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'}
                `}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`${active ? 'text-black' : 'text-primary/60 group-hover:text-primary'} transition-colors`}>
                                        {item.icon}
                                    </span>
                                    <span className="text-xs font-bold italic uppercase tracking-tight">{item.label}</span>
                                </div>
                                {active && <ChevronRight size={14} className="opacity-50" />}
                            </Link>
                        );
                    })}
                </nav>

                <div className="space-y-4">
                    <div className="p-5 bg-gradient-to-br from-white/10 to-transparent rounded-3xl border border-white/10 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors" />
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Nexus Core</span>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <p className="text-[10px] text-white/60 font-bold uppercase">Latency</p>
                                <p className="text-[10px] text-primary font-black">14ms</p>
                            </div>
                            <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                                <motion.div
                                    initial={{ width: "0%" }}
                                    animate={{ width: "100%" }}
                                    className="h-full bg-blue-500 opacity-40"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            // Handle logout logic if needed, or link to /logout
                            window.location.href = '/login';
                        }}
                        className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-red-500/60 hover:text-red-500 hover:bg-red-500/5 hover:border-red-500/20 transition-all font-bold text-xs uppercase italic"
                    >
                        <LogOut size={16} />
                        Exit Command
                    </button>
                </div>
            </aside>
        </>
    );
}
