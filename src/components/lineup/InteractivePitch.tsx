'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { getFormationById } from '@/lib/formations';
import { LineupPlayer } from '@/types/lineup';
import { Star } from 'lucide-react';

interface InteractivePitchProps {
    sport: 'Football' | 'Basketball';
    formation: string;
    starters: LineupPlayer[];
    onAssignPlayer: (positionId: string, player: LineupPlayer | null | undefined) => void;
    onSetCaptain: (playerId: string) => void;
    onSetViceCaptain: (playerId: string) => void;
    teamSide: 'home' | 'away' | 'combined';
    playerDetails: Record<string, { name: string; jerseyName?: string; rating: number; originalTeam?: 'home' | 'away' }>;
    selectedPlayer?: any;
}

export function InteractivePitch({
    sport,
    formation,
    starters,
    onAssignPlayer,
    onSetCaptain,
    onSetViceCaptain,
    teamSide,
    playerDetails,
    selectedPlayer
}: InteractivePitchProps) {
    const formationData = getFormationById(formation, sport);

    if (!formationData) {
        return (
            <div className="text-center py-12 text-white/40">
                Please select a formation
            </div>
        );
    }

    const is5Aside = formationData.positions.length === 5 && sport === 'Football';

    const getPlayerAtPosition = (positionId: string) => {
        return starters.find(p => p.position === positionId);
    };

    return (
        <div className={`relative w-full ${is5Aside ? 'aspect-[4/5] sm:aspect-[1/1]' : 'aspect-[2/3] md:aspect-[3/4]'} bg-gradient-to-b from-green-900/40 to-green-800/20 rounded-3xl overflow-hidden border border-white/10 shadow-2xl transition-all duration-300`}>
            {/* Pitch Markings */}
            <PitchMarkings sport={sport} is5Aside={is5Aside} />

            {/* Position Slots */}
            {formationData.positions.map((position) => {
                const assignedPlayer = getPlayerAtPosition(position.id);

                return (
                    <PositionSlot
                        key={position.id}
                        position={position}
                        player={assignedPlayer}
                        playerDetails={assignedPlayer ? playerDetails[assignedPlayer.playerId] : undefined}
                        onRemove={() => onAssignPlayer(position.id, null)}
                        onAssign={() => onAssignPlayer(position.id, undefined)}
                        onSetCaptain={() => assignedPlayer && onSetCaptain(assignedPlayer.playerId)}
                        onSetViceCaptain={() => assignedPlayer && onSetViceCaptain(assignedPlayer.playerId)}
                        teamSide={teamSide}
                        isTarget={!assignedPlayer && !!selectedPlayer}
                        is5Aside={is5Aside}
                    />
                );
            })}

            {/* Team Side Label */}
            <div className="absolute top-4 left-4 z-10">
                <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${teamSide === 'combined'
                    ? 'bg-gradient-to-r from-purple-500/30 to-primary/30 text-primary border border-primary/30 backdrop-blur-md'
                    : teamSide === 'home'
                        ? 'bg-blue-500/30 text-blue-400 border border-blue-500/30 backdrop-blur-md'
                        : 'bg-red-500/30 text-red-400 border border-red-500/30 backdrop-blur-md'
                    }`}>
                    {teamSide === 'combined' ? 'Combined XI' : `${teamSide} Team`}
                </div>
            </div>

            {/* Formation Name */}
            <div className="absolute top-4 right-4 z-10">
                <div className="px-3 py-1 bg-black/50 rounded-lg backdrop-blur-md border border-white/10">
                    <span className="text-xs font-display italic font-bold text-white uppercase tracking-wider">
                        {formationData.name}
                    </span>
                </div>
            </div>

            {/* Branding Tag */}
            <div className="absolute bottom-6 right-6 pointer-events-none opacity-20">
                <h1 className="font-display text-4xl md:text-5xl italic font-black uppercase tracking-tighter text-white select-none">
                    BrixSport
                </h1>
            </div>
        </div>
    );
}

function PitchMarkings({ sport, is5Aside }: { sport: 'Football' | 'Basketball'; is5Aside?: boolean }) {
    if (sport === 'Football') {
        if (is5Aside) {
            return (
                <div className="absolute inset-0 p-4 opacity-50">
                    <div className="w-full h-full border-2 border-white/15 rounded-xl relative">
                        {/* Halfway Line */}
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/15" />

                        {/* Center Circle */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/15 rounded-full" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/20 rounded-full" />

                        {/* Futsal Penalty D (Semicircles) */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 border-2 border-white/15 border-t-0 rounded-b-full bg-white/5" />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-16 border-2 border-white/15 border-b-0 rounded-t-full bg-white/5" />

                        {/* Goals */}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-16 h-1 bg-white/40" />
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-1 bg-white/40" />
                    </div>
                </div>
            );
        }

        return (
            <>
                {/* Center Circle */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/10 rounded-full" />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/20 rounded-full" />

                {/* Halfway Line */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />

                {/* Penalty Boxes */}
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3/4 h-24 border-2 border-white/10 border-b-0" />
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-3/4 h-24 border-2 border-white/10 border-t-0" />

                {/* Goal Boxes */}
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-12 border-2 border-white/10 border-b-0" />
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/2 h-12 border-2 border-white/10 border-t-0" />
            </>
        );
    }

    // Basketball court markings
    return (
        <>
            {/* Center Circle */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/10 rounded-full" />

            {/* Halfway Line */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />

            {/* Three-point arcs */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3/4 h-32 border-2 border-white/10 border-b-0 rounded-t-full" />
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-3/4 h-32 border-2 border-white/10 border-t-0 rounded-b-full" />
        </>
    );
}

function PositionSlot({
    position,
    player,
    playerDetails,
    onRemove,
    onAssign,
    onSetCaptain,
    onSetViceCaptain,
    teamSide,
    isTarget,
    is5Aside
}: {
    position: any;
    player?: LineupPlayer;
    playerDetails?: { name: string; jerseyName?: string; rating: number; originalTeam?: 'home' | 'away' };
    onRemove: () => void;
    onAssign: () => void;
    onSetCaptain: () => void;
    onSetViceCaptain: () => void;
    teamSide: 'home' | 'away' | 'combined';
    isTarget?: boolean;
    is5Aside?: boolean;
}) {
    const [showMenu, setShowMenu] = useState(false);
    const hasPlayer = !!(player && playerDetails);

    const displayName = playerDetails && (playerDetails.jerseyName || playerDetails.name.split(' ').pop());

    return (
        <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
            }}
        >
            {hasPlayer ? (
                <div className="relative">
                    {/* Player Card */}
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className={`relative ${is5Aside ? 'w-20 h-24' : 'w-16 h-20'} rounded-xl border-2 transition-all ${teamSide === 'combined'
                            ? playerDetails?.originalTeam === 'home'
                                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-cyan-400 shadow-cyan-500/50'
                                : 'bg-gradient-to-br from-pink-500 to-rose-600 border-pink-400 shadow-pink-500/50'
                            : teamSide === 'home'
                                ? 'bg-blue-500/90 border-blue-400'
                                : 'bg-red-500/90 border-red-400'
                            } hover:scale-110 shadow-lg`}
                    >
                        {/* Captain/Vice-Captain Badge */}
                        {player!.isCaptain && (
                            <div className={`absolute -top-2 -right-2 ${is5Aside ? 'w-8 h-8' : 'w-6 h-6'} bg-yellow-500 rounded-full flex items-center justify-center border-2 border-black`}>
                                <span className={`${is5Aside ? 'text-xs' : 'text-[10px]'} font-black`}>C</span>
                            </div>
                        )}
                        {player!.isViceCaptain && (
                            <div className={`absolute -top-2 -right-2 ${is5Aside ? 'w-8 h-8' : 'w-6 h-6'} bg-gray-400 rounded-full flex items-center justify-center border-2 border-black`}>
                                <span className={`${is5Aside ? 'text-xs' : 'text-[10px]'} font-black`}>VC</span>
                            </div>
                        )}

                        {/* Jersey Number */}
                        <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
                            <span className={`text-white ${is5Aside ? 'text-2xl' : 'text-xl'} font-display font-bold`}>
                                {player!.jerseyNumber}
                            </span>
                        </div>

                        {/* Player Name */}
                        <div className="absolute bottom-1 left-0 right-0 px-1">
                            <p className={`text-white ${is5Aside ? 'text-[10px]' : 'text-[8px]'} font-black uppercase truncate text-center`}>
                                {displayName}
                            </p>
                        </div>

                        {/* Rating */}
                        <div className="absolute top-1 right-1">
                            <div className="flex items-center gap-0.5 bg-black/30 rounded px-1">
                                <Star size={is5Aside ? 10 : 8} className="text-yellow-400 fill-yellow-400" />
                                <span className={`${is5Aside ? 'text-[10px]' : 'text-[8px]'} font-bold text-white`}>
                                    {playerDetails!.rating.toFixed(1)}
                                </span>
                            </div>
                        </div>

                        {/* Team Indicator for Combined XI */}
                        {teamSide === 'combined' && (
                            <div className="absolute bottom-1 left-1">
                                <div className={`${is5Aside ? 'w-5 h-5' : 'w-4 h-4'} rounded-full flex items-center justify-center border ${playerDetails?.originalTeam === 'home'
                                    ? 'bg-cyan-500 border-cyan-300'
                                    : 'bg-pink-500 border-pink-300'
                                    }`}>
                                    <span className="text-white text-[6px] font-black">
                                        {playerDetails?.originalTeam === 'home' ? 'H' : 'A'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </button>

                    {/* ... rest of context menu ... */}


                    {/* Context Menu */}
                    {showMenu && (
                        <div
                            className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-black border border-white/20 rounded-xl p-2 shadow-xl z-10 whitespace-nowrap"
                        >
                            <button
                                onClick={(e) => { e.stopPropagation(); onSetCaptain(); setShowMenu(false); }}
                                className="block w-full text-left px-3 py-2 text-xs font-bold text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                Set as Captain
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onSetViceCaptain(); setShowMenu(false); }}
                                className="block w-full text-left px-3 py-2 text-xs font-bold text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                Set as Vice-Captain
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(); setShowMenu(false); }}
                                className="block w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                Remove
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <motion.div
                    animate={isTarget ? { scale: [1, 1.1, 1], borderColor: '#22c55e' } : { scale: 1 }}
                    transition={isTarget ? { repeat: Infinity, duration: 2 } : {}}
                    onClick={onAssign}
                    className={`${is5Aside ? 'w-16 h-16' : 'w-12 h-12'} rounded-full border-2 border-dashed flex items-center justify-center transition-all cursor-pointer ${isTarget
                        ? 'border-green-500 bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.5)]'
                        : 'border-white/30 bg-white/5 hover:border-primary hover:bg-primary/10'
                        }`}
                >
                    <span className={`${is5Aside ? 'text-xs' : 'text-[10px]'} font-black uppercase ${isTarget ? 'text-green-400' : 'text-white/60'}`}>
                        {position.position}
                    </span>
                </motion.div>
            )}
        </div>
    );
}
