'use client';

import React from 'react';
import { Player, LineupEntry, MatchEvent } from '@/types';
import { processLineup } from '@/lib/lineup-processing';
import { PitchMarkings } from './PitchMarkings';
import { PitchPlayer } from './PitchPlayer';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Interfaces ---

interface TeamData {
    id?: string;
    name: string;
    logo: string;
    color: string;
    formation?: string;
}

interface MatchLineupProps {
    homeTeam: TeamData;
    awayTeam: TeamData;
    homeLineup?: LineupEntry[];
    awayLineup?: LineupEntry[];
    homeSubs?: LineupEntry[];
    awaySubs?: LineupEntry[];
    homePlayers: Record<string, Player>;
    awayPlayers: Record<string, Player>;
    homeFormation?: string;
    awayFormation?: string;
    events?: MatchEvent[];
    onPlayerClick?: (player: Player) => void;
}

// --- Helper Components ---

function SubsList({
    team,
    players,
    subs,
    events = [],
    onPlayerClick
}: {
    team: TeamData;
    players: Record<string, Player>;
    subs: LineupEntry[];
    events: MatchEvent[];
    onPlayerClick?: (player: Player) => void;
}) {
    if (!subs || subs.length === 0) return null;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 px-2 py-1 opacity-60">
                {team.logo && <img src={team.logo} alt={team.name} className="w-4 h-4 object-contain" />}
                <span className="text-xs font-bold uppercase tracking-wider text-white">{team.name}</span>
            </div>
            <div className="grid grid-cols-1 gap-1">
                {subs.map((entry) => {
                    const player = players[entry.playerId];
                    if (!player) return null;

                    // Check for sub events
                    const subInEvent = events.find(e => e.type === 'Substitution' && e.playerId === player.id); // Assuming playerId is the one COMING IN or checking detail?
                    // Usually for 'Substitution', we need to check if this player was involved.
                    // If they are in `subs` list, they are bench. If event says "In", they played.

                    const rating = entry.rating || 0;

                    return (
                        <div
                            key={player.id}
                            onClick={() => onPlayerClick?.(player)}
                            className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                        >
                            <div className="relative">
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border border-white/20"
                                    style={{ backgroundColor: team.color }}
                                >
                                    {player.number}
                                </div>
                                {subInEvent && (
                                    <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5 border border-black z-10">
                                        <svg className="w-2 h-2 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-sm font-medium truncate", subInEvent ? "text-green-400" : "text-white")}>
                                        {player.jerseyName || player.name.split(' ').pop() || player.name}
                                    </span>
                                    {subInEvent && (
                                        <span className="text-[10px] bg-green-500/20 text-green-400 px-1 rounded font-bold">
                                            {subInEvent.minute}'
                                        </span>
                                    )}
                                </div>
                                <span className="text-[11px] text-white/40">{player.position}</span>
                            </div>

                            {rating > 0 && (
                                <div className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                    rating >= 7 ? "bg-green-500/20 text-green-400" :
                                        rating >= 6 ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10 text-white/60"
                                )}>
                                    {rating.toFixed(1)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// --- Main Component ---

export function MatchLineup({
    homeTeam,
    awayTeam,
    homeLineup = [],
    awayLineup = [],
    homeSubs = [],
    awaySubs = [],
    homePlayers,
    awayPlayers,
    homeFormation,
    awayFormation,
    events = [],
    onPlayerClick
}: MatchLineupProps) {
    const [view, setView] = React.useState<'pitch' | 'list'>('pitch');

    // Resolve formations
    const finalHomeFormation = homeFormation || homeTeam.formation || '4-4-2';
    const finalAwayFormation = awayFormation || awayTeam.formation || '4-4-2';

    // Helper to prepare players with stats
    const preparePlayers = (lineup: LineupEntry[], playersMap: Record<string, Player>) => {
        return lineup
            .filter(entry => entry.isStarter !== false)
            .map(entry => {
                const basePlayer = playersMap[entry.playerId];
                if (!basePlayer) return null;

                // Simple stats derivation
                const playerEvents = events.filter(e => e.playerId === entry.playerId);
                const goals = playerEvents.filter(e => e.type === 'Goal').length;
                const subOutEvent = events.find(e => e.type === 'Substitution' && e.detail === 'Out' && e.playerId === entry.playerId);
                // Note: Better sub detection logic might be needed depending on your event structure

                return {
                    ...basePlayer,
                    position: entry.position || basePlayer.position,
                    _rating: entry.rating,
                    _isCaptain: entry.isCaptain,
                    _isMotM: entry.isMotM,
                    _goals: goals,
                    _subTime: subOutEvent ? `${subOutEvent.minute}'` : undefined
                };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);
    };

    const homeStarterPlayers = preparePlayers(homeLineup, homePlayers);
    const awayStarterPlayers = preparePlayers(awayLineup, awayPlayers);

    const homeLayout = processLineup(homeStarterPlayers, finalHomeFormation, true);
    const awayLayout = processLineup(awayStarterPlayers, finalAwayFormation, false);

    return (
        <div className="flex flex-col bg-[#0f1419] -mx-4 w-[calc(100%+2rem)] sm:mx-0 sm:w-full">
            {/* Header / Toggle - Sticky */}
            <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#0f1419]/95 backdrop-blur-sm border-b border-white/5 shadow-sm">
                <h2 className="text-xl font-bold text-white">Lineups</h2>
                <div className="flex bg-[#1e2329] rounded-full p-1 border border-white/5">
                    <button
                        onClick={() => setView('pitch')}
                        className={cn(
                            "px-6 py-1.5 rounded-full text-sm font-medium transition-all relative",
                            view === 'pitch' ? "bg-[#3b82f6] text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"
                        )}
                    >
                        Pitch
                    </button>
                    <button
                        onClick={() => setView('list')}
                        className={cn(
                            "px-6 py-1.5 rounded-full text-sm font-medium transition-all relative",
                            view === 'list' ? "bg-[#3b82f6] text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"
                        )}
                    >
                        List
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {view === 'pitch' ? (
                <div className="w-full bg-[#1a4d2e]">

                    {/* Pitch Container - Increased Height for Zoom effect */}
                    <div className="relative w-full shadow-2xl" style={{ height: '1350px' }}>

                        {/* Background - Horizontal Stripes */}
                        <div className="absolute inset-0 flex flex-col pointer-events-none">
                            {Array.from({ length: 24 }).map((_, i) => (
                                <div key={i} className={cn(
                                    "flex-1 w-full",
                                    i % 2 === 0 ? "bg-[#1a4d2e]" : "bg-[#1f5635]"
                                )} />
                            ))}
                        </div>

                        {/* Markings */}
                        <PitchMarkings className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-40 mix-blend-overlay" />

                        {/* Formation Labels */}
                        <div className="absolute top-4 left-4 z-0 text-white/30 text-2xl font-black uppercase tracking-wider select-none pointer-events-none drop-shadow-md">
                            {finalAwayFormation}
                        </div>
                        <div className="absolute bottom-4 right-4 z-0 text-white/30 text-2xl font-black uppercase tracking-wider select-none pointer-events-none drop-shadow-md">
                            {finalHomeFormation}
                        </div>

                        {/* PLAYERS LAYER */}
                        <div className="absolute inset-0 z-10 p-4">
                            {/* Away Team (Top) */}
                            {awayLayout.map((item) => (
                                <PitchPlayer
                                    key={item.player.id}
                                    player={item.player}
                                    x={item.x}
                                    y={item.y}
                                    color={awayTeam.color}
                                    rating={(item.player as any)._rating}
                                    isCaptain={(item.player as any)._isCaptain}
                                    isMotM={(item.player as any)._isMotM}
                                    goals={(item.player as any)._goals}
                                    substitutionTime={(item.player as any)._subTime}
                                    onClick={() => onPlayerClick?.(item.player)}
                                />
                            ))}

                            {/* Home Team (Bottom) */}
                            {homeLayout.map((item) => (
                                <PitchPlayer
                                    key={item.player.id}
                                    player={item.player}
                                    x={item.x}
                                    y={item.y}
                                    color={homeTeam.color}
                                    rating={(item.player as any)._rating}
                                    isCaptain={(item.player as any)._isCaptain}
                                    isMotM={(item.player as any)._isMotM}
                                    goals={(item.player as any)._goals}
                                    substitutionTime={(item.player as any)._subTime}
                                    onClick={() => onPlayerClick?.(item.player)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Substitutes Header & List (Bottom of Pitch) */}
                    <div className="bg-[#0f1419] border-t border-white/10 px-4 py-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-5 h-5 bg-indigo-900 rounded-sm flex items-center justify-center text-[10px] text-white shadow-sm">🏆</div>
                            <span className="font-bold text-white text-sm uppercase tracking-wide">Valid Substitutes</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <SubsList
                                team={homeTeam}
                                players={homePlayers}
                                subs={homeSubs}
                                events={events}
                                onPlayerClick={onPlayerClick}
                            />
                            <SubsList
                                team={awayTeam}
                                players={awayPlayers}
                                subs={awaySubs}
                                events={events}
                                onPlayerClick={onPlayerClick}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="w-full flex-1 p-4 overflow-y-auto bg-[#0f1419]">
                    {/* List View Implementation - Tabbed */}
                    <div className="space-y-6">
                        <SubsList
                            team={homeTeam}
                            players={homePlayers}
                            subs={homeLineup} // Reusing SubsList for Starters temporarily or create plain list? List style is similar
                            events={events}
                            onPlayerClick={onPlayerClick}
                        />
                        <SubsList
                            team={awayTeam}
                            players={awayPlayers}
                            subs={awayLineup}
                            events={events}
                            onPlayerClick={onPlayerClick}
                        />
                        {/* Note: In a real List View, we'd probably want a switcher Home/Away like ResponsiveLineup had. 
                            For now, displaying all as a simple vertical list is a safe MVP if the user prefers Pitch mainly.
                        */}
                    </div>
                </div>
            )}
        </div>
    );
}
