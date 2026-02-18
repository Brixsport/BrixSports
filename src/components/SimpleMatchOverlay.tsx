'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Trophy, MapPin, Calendar, Clock, Users, ArrowRight, Share2, Heart, Award } from 'lucide-react';
import { Match } from '@/types';
import Image from 'next/image';

interface SimpleMatchOverlayProps {
    match: Match;
    onClose: () => void;
    onSelectTeam?: (team: any) => void;
}

const isValidImagePath = (path: string | undefined): boolean => {
    if (!path || path.trim() === '') return false;
    return path.startsWith('/') || path.startsWith('http');
};

export function SimpleMatchOverlay({ match, onClose, onSelectTeam }: SimpleMatchOverlayProps) {
    const [activeTab, setActiveTab] = useState('overview');

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Trophy },
        // Only show lineups if they exist
        ...(match.lineups ? [{ id: 'lineups', label: 'Players', icon: Users }] : []),
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md overflow-y-auto"
            onClick={onClose}
        >
            <div className="min-h-screen flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-white/10 py-4">
                    <div className="max-w-3xl mx-auto px-4">
                        <div className="flex items-center justify-between mb-8">
                            <button
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={20} className="text-white/80" />
                            </button>

                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase mb-1">
                                    {match.competition}
                                </span>
                                <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded">
                                    {match.sport || 'Match'}
                                </span>
                            </div>

                            <div className="w-10"></div>
                        </div>

                        {/* Scoreboard */}
                        <div className="flex items-center justify-between gap-4 md:gap-12 mb-8">
                            {/* Home Team */}
                            <div
                                className="flex flex-col items-center text-center flex-1 cursor-pointer group"
                                onClick={() => match.homeTeam && onSelectTeam?.(match.homeTeam)}
                            >
                                <div className="w-20 h-20 md:w-24 md:h-24 relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 mb-4 group-hover:border-primary/50 transition-colors shadow-lg shadow-black/50">
                                    {isValidImagePath(match.homeTeam?.logo) ? (
                                        <Image
                                            src={match.homeTeam!.logo}
                                            alt={match.homeTeam!.name}
                                            fill
                                            className="object-cover p-2"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white/20">
                                            {match.homeTeam?.shortName?.[0] || 'H'}
                                        </div>
                                    )}
                                </div>
                                <h2 className="font-bold text-lg md:text-xl text-white group-hover:text-primary transition-colors">
                                    {match.homeTeam?.name || 'Home'}
                                </h2>
                                {match.homeTeam?.college && (
                                    <span className="text-xs text-white/40 mt-1">{match.homeTeam.college}</span>
                                )}
                            </div>

                            {/* Score */}
                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-4 bg-white/5 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-sm mb-2">
                                    <span className={`text-4xl md:text-6xl font-black tabular-nums tracking-tighter ${match.homeScore > match.awayScore ? 'text-white' : 'text-white/60'}`}>
                                        {match.homeScore}
                                    </span>
                                    <span className="text-white/10 text-2xl md:text-4xl font-light mx-2">:</span>
                                    <span className={`text-4xl md:text-6xl font-black tabular-nums tracking-tighter ${match.awayScore > match.homeScore ? 'text-white' : 'text-white/60'}`}>
                                        {match.awayScore}
                                    </span>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${match.status === 'LIVE'
                                    ? 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse'
                                    : match.status === 'FINISHED'
                                        ? 'bg-white/10 text-white/60 border-white/10'
                                        : 'bg-primary/10 text-primary border-primary/20'
                                    }`}>
                                    {match.status === 'FINISHED' ? 'Final Score' : match.status}
                                </div>
                            </div>

                            {/* Away Team */}
                            <div
                                className="flex flex-col items-center text-center flex-1 cursor-pointer group"
                                onClick={() => match.awayTeam && onSelectTeam?.(match.awayTeam)}
                            >
                                <div className="w-20 h-20 md:w-24 md:h-24 relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 mb-4 group-hover:border-primary/50 transition-colors shadow-lg shadow-black/50">
                                    {isValidImagePath(match.awayTeam?.logo) ? (
                                        <Image
                                            src={match.awayTeam!.logo}
                                            alt={match.awayTeam!.name}
                                            fill
                                            className="object-cover p-2"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white/20">
                                            {match.awayTeam?.shortName?.[0] || 'A'}
                                        </div>
                                    )}
                                </div>
                                <h2 className="font-bold text-lg md:text-xl text-white group-hover:text-primary transition-colors">
                                    {match.awayTeam?.name || 'Away'}
                                </h2>
                                {match.awayTeam?.college && (
                                    <span className="text-xs text-white/40 mt-1">{match.awayTeam.college}</span>
                                )}
                            </div>
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center justify-center gap-6 text-xs text-white/40 pb-2 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <MapPin size={14} />
                                <span>{match.venue}</span>
                            </div>
                            <div className="w-1 h-1 bg-white/20 rounded-full" />
                            <div className="flex items-center gap-2">
                                <Calendar size={14} />
                                <span>{new Date(match.startTime).toLocaleDateString()}</span>
                            </div>
                            <div className="w-1 h-1 bg-white/20 rounded-full" />
                            <div className="flex items-center gap-2">
                                <Clock size={14} />
                                <span>{new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex justify-center gap-2 mt-4">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === tab.id
                                        ? 'bg-white text-black shadow-lg shadow-white/10'
                                        : 'text-white/40 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Winner Card (if finished) */}
                            {match.status === 'FINISHED' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/5 border border-yellow-500/20 rounded-2xl p-6 text-center relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Trophy size={100} />
                                    </div>
                                    <div className="relative z-10">
                                        <h3 className="text-yellow-500 font-bold uppercase tracking-widest text-sm mb-2">Winner</h3>
                                        <p className="text-2xl font-black text-white">
                                            {match.homeScore > match.awayScore ? match.homeTeam?.name : match.awayScore > match.homeScore ? match.awayTeam?.name : 'Draw'}
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Match Stats / Details */}
                            <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                                <div className="p-4 border-b border-white/5 bg-white/5">
                                    <h3 className="font-bold text-white/80 flex items-center gap-2">
                                        <Award size={16} className="text-primary" />
                                        Match Details
                                    </h3>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-white/40">Status</span>
                                        <span className="font-medium text-white">{match.status}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-white/40">Competition</span>
                                        <span className="font-medium text-white">{match.competition}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-white/40">Round</span>
                                        <span className="font-medium text-white">
                                            {/* Try to parse stats for round info if available, or just generic */}
                                            {(match.stats as any)?.round || 'Regular Season'}
                                        </span>
                                    </div>

                                    {/* Sport Specific Details */}
                                    {(match.sport as string) === 'Table Tennis' && (
                                        <div className="flex justify-between items-center py-2">
                                            <span className="text-white/40">Format</span>
                                            <span className="font-medium text-white">Best of 5 Sets</span>
                                        </div>
                                    )}
                                    {(match.sport as string) === 'Chess' && (
                                        <div className="flex justify-between items-center py-2">
                                            <span className="text-white/40">Time Control</span>
                                            <span className="font-medium text-white">Standard</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Additional "Sets" or scoring breakdown */}
                            {(['Table Tennis', 'Volleyball', 'Tennis'].includes(match.sport as string)) && (match.stats as any)?.sets && (
                                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                                    <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                        <h3 className="font-bold text-white/80">Set Scores</h3>
                                        <span className="text-xs text-white/40 font-mono tracking-wider">
                                            {(match.sport as string) === 'Table Tennis' ? 'BEST OF 5' : ''}
                                        </span>
                                    </div>
                                    <div className="p-4">
                                        {/* Horizontal Set Scoreboard */}
                                        <div className="flex flex-col gap-2">
                                            {/* Home Team Row */}
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 text-xs font-bold text-white/40 uppercase">Home</div>
                                                <div className="flex-1 flex gap-2">
                                                    {Array.isArray((match.stats as any).sets) && (match.stats as any).sets.map((set: [number, number], i: number) => (
                                                        <div key={`home-set-${i}`} className={`w-8 h-8 flex items-center justify-center rounded border ${set[0] > set[1]
                                                            ? 'bg-primary/20 border-primary/40 text-primary font-bold'
                                                            : 'bg-white/5 border-white/10 text-white/60'
                                                            }`}>
                                                            {set[0]}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Away Team Row */}
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 text-xs font-bold text-white/40 uppercase">Away</div>
                                                <div className="flex-1 flex gap-2">
                                                    {Array.isArray((match.stats as any).sets) && (match.stats as any).sets.map((set: [number, number], i: number) => (
                                                        <div key={`away-set-${i}`} className={`w-8 h-8 flex items-center justify-center rounded border ${set[1] > set[0]
                                                            ? 'bg-primary/20 border-primary/40 text-primary font-bold'
                                                            : 'bg-white/5 border-white/10 text-white/60'
                                                            }`}>
                                                            {set[1]}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Headers under the boxes just for clarity if needed, or simplified as above */}
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="w-10"></div>
                                            <div className="flex-1 flex gap-2">
                                                {Array.isArray((match.stats as any).sets) && (match.stats as any).sets.map((_: any, i: number) => (
                                                    <div key={`label-${i}`} className="w-8 text-center text-[10px] text-white/20 uppercase">
                                                        S{i + 1}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'lineups' && (
                        <div className="bg-white/5 rounded-2xl border border-white/10 p-8 text-center">
                            <Users size={48} className="mx-auto text-white/20 mb-4" />
                            <p className="text-white/60">Player lists not available for this match type yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
