'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Player } from '@/types';
import { useScreenSize } from '@/hooks/useScreenSize';
import { FullPitchLineups } from '@/components/FullPitchLineups';

interface TeamData {
    name: string;
    logo: string;
    color: string;
    formation?: string;
}

interface ResponsiveLineupProps {
    homeTeam: TeamData;
    awayTeam: TeamData;
    homePlayers: Record<string, Player>;
    awayPlayers: Record<string, Player>;
    homeLineup: any[];
    awayLineup: any[];
    homeSubs?: any[];
    awaySubs?: any[];
    events?: any[];
    onPlayerClick?: (player: Player) => void;
}

// Bench Section Component (Used in List View)
function BenchSection({
    team,
    players,
    subs,
    events = [],
    onPlayerClick,
    className = ""
}: {
    team: TeamData;
    players: Record<string, Player>;
    subs: any[];
    events?: any[];
    onPlayerClick: (player: Player) => void;
    className?: string;
}) {
    if (!subs || subs.length === 0) return null;

    return (
        <div className={`space-y-2 ${className}`}>
            <h4 className="text-white/60 text-xs font-bold uppercase tracking-wider px-2">Substitutes</h4>
            <div className="grid grid-cols-1 gap-2">
                {subs.map((sub) => {
                    const player = players[sub.playerId];
                    if (!player) return null;

                    // Check if substituted IN
                    const subEvent = events.find(e =>
                        e.type === 'Substitution' &&
                        e.assistPlayerId === player.id
                    );

                    return (
                        <div
                            key={player.id}
                            onClick={() => onPlayerClick(player)}
                            className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors cursor-pointer relative overflow-hidden"
                        >
                            {/* Sub In Indicator */}
                            {subEvent && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />
                            )}

                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border border-white/20 relative"
                                style={{ backgroundColor: team.color }}
                            >
                                {player.number}
                                {subEvent && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center border border-black/50">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-2 h-2 text-black font-bold" strokeWidth="4">
                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium truncate block ${subEvent ? 'text-green-400' : 'text-white'}`}>
                                        {player.jerseyName || player.name}
                                    </span>
                                    {subEvent && (
                                        <span className="text-[10px] bg-green-500/20 text-green-400 px-1 rounded font-bold">
                                            {subEvent.minute}'
                                        </span>
                                    )}
                                </div>
                                <span className="text-white/40 text-xs truncate block">
                                    {player.position}
                                </span>
                            </div>
                            {sub.rating && (
                                <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sub.rating >= 7 ? 'bg-green-500/20 text-green-400' :
                                    sub.rating >= 6 ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-white/10 text-white/60'
                                    }`}>
                                    {sub.rating.toFixed(1)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// List View Component
function ListView({
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    homeLineup,
    awayLineup,
    homeSubs = [],
    awaySubs = [],
    events = [],
    onPlayerClick
}: ResponsiveLineupProps & { onPlayerClick: (player: Player) => void }) {
    const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home');
    const currentTeam = activeTeam === 'home' ? homeTeam : awayTeam;
    const currentPlayers = activeTeam === 'home' ? homePlayers : awayPlayers;
    const currentLineup = activeTeam === 'home' ? homeLineup : awayLineup;

    return (
        <div className="space-y-4">
            {/* Team Toggle */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
                <button
                    onClick={() => setActiveTeam('home')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${activeTeam === 'home' ? 'bg-white/10 text-white' : 'text-white/60'
                        }`}
                >
                    {homeTeam.name}
                </button>
                <button
                    onClick={() => setActiveTeam('away')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${activeTeam === 'away' ? 'bg-white/10 text-white' : 'text-white/60'
                        }`}
                >
                    {awayTeam.name}
                </button>
            </div>

            {/* Player List */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-2">
                <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2 px-2">Starting XI</div>
                <div className="space-y-2">
                    {currentLineup.map((lineupPlayer) => {
                        const player = currentPlayers[lineupPlayer.playerId];
                        if (!player) return null;

                        const subOutEvent = events.find(e => e.type === 'Substitution' && e.playerId === player.id);

                        return (
                            <div
                                key={player.id}
                                onClick={() => onPlayerClick(player)}
                                className="flex items-center gap-4 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer relative overflow-hidden"
                            >
                                {/* Sub Out Indicator */}
                                {subOutEvent && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                                )}

                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold border-2 border-white/30 relative"
                                    style={{ backgroundColor: currentTeam.color }}
                                >
                                    {player.number}
                                    {subOutEvent && (
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border border-white shadow-sm z-10">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-2.5 h-2.5 text-white font-bold" strokeWidth="4">
                                                <path d="M12 5v14M19 12l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-white text-sm">{player.jerseyName || player.name}</h4>
                                        {subOutEvent && (
                                            <span className="text-[10px] bg-red-500/20 text-red-400 px-1 rounded font-bold">
                                                {subOutEvent.minute}'
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-white/60">{player.position}</p>
                                </div>
                                {lineupPlayer.rating && (
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-white">{lineupPlayer.rating.toFixed(1)}</div>
                                        <div className="text-[10px] text-white/60">Rating</div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <BenchSection
                team={currentTeam}
                players={currentPlayers}
                subs={activeTeam === 'home' ? homeSubs : awaySubs}
                events={events} // Pass events
                onPlayerClick={onPlayerClick}
                className="bg-white/5 rounded-xl border border-white/10 p-2"
            />
        </div>
    );
}

// Main Component
export function ResponsiveLineup({
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    homeLineup,
    awayLineup,
    homeSubs = [],
    awaySubs = [],
    events = [],
    onPlayerClick,
    variant
}: ResponsiveLineupProps & { variant?: '11-a-side' | '5-a-side' | 'basketball' | '3x3' }) {
    const { isMobile } = useScreenSize();
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [viewMode, setViewMode] = useState<'pitch' | 'list'>('pitch');


    // Auto-switch to list view on very small screens
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 375) {
            setViewMode('list');
        }
    }, []);

    const handlePlayerClick = (player: Player) => {
        setSelectedPlayer(player);
        if (onPlayerClick) {
            onPlayerClick(player);
        }
    };

    return (
        <div className="w-full">
            {/* View Toggle - Sticky with Backdrop Blur */}
            <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/10 p-4 mb-4">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <h3 className="font-bold text-lg text-white">Lineups</h3>
                    <div className="flex gap-2 bg-white/5 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('pitch')}
                            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${viewMode === 'pitch'
                                ? 'bg-primary text-black shadow-lg'
                                : 'bg-transparent text-white/60 hover:text-white'
                                }`}
                        >
                            Pitch
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${viewMode === 'list'
                                ? 'bg-primary text-black shadow-lg'
                                : 'bg-transparent text-white/60 hover:text-white'
                                }`}
                        >
                            List
                        </button>
                    </div>
                </div>
            </div>

            {/* Content - Fixed min-height to prevent layout shift */}
            <div className="min-h-[600px] relative">
                <AnimatePresence mode="wait">
                    {viewMode === 'list' ? (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="pb-8 absolute inset-0"
                        >
                            <ListView
                                homeTeam={homeTeam}
                                awayTeam={awayTeam}
                                homePlayers={homePlayers}
                                awayPlayers={awayPlayers}
                                homeLineup={homeLineup}
                                awayLineup={awayLineup}
                                homeSubs={homeSubs}
                                awaySubs={awaySubs}
                                events={events}
                                onPlayerClick={handlePlayerClick}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="pitch"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="pb-8 absolute inset-0"
                        >
                            <FullPitchLineups
                                homeTeam={homeTeam}
                                awayTeam={awayTeam}
                                homePlayers={homePlayers}
                                awayPlayers={awayPlayers}
                                homeLineup={homeLineup}
                                awayLineup={awayLineup}
                                homeSubs={homeSubs}
                                awaySubs={awaySubs}
                                onPlayerClick={handlePlayerClick}
                                variant={variant}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
