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
    playerDetails: Record<string, { name: string; jerseyName?: string; rating: number }>;
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

    const getPlayerAtPosition = (positionId: string) => {
        return starters.find(p => p.position === positionId);
    };

    return (
        <div className="relative w-full aspect-[2/3] md:aspect-[3/4] bg-gradient-to-b from-green-900/30 to-green-800/30 rounded-3xl overflow-hidden border border-white/10">
            {/* Pitch Markings */}
            <PitchMarkings sport={sport} />

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
                    />
                );
            })}

            {/* Team Side Label */}
            <div className="absolute top-4 left-4">
                <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${teamSide === 'combined'
                    ? 'bg-gradient-to-r from-purple-500/20 to-primary/20 text-primary border border-primary/30'
                    : teamSide === 'home'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                    {teamSide === 'combined' ? 'Combined XI' : `${teamSide} Team`}
                </div>
            </div>

            {/* Formation Name */}
            <div className="absolute top-4 right-4">
                <div className="px-3 py-1 bg-black/40 rounded-lg backdrop-blur-sm border border-white/10">
                    <span className="text-xs font-display italic font-bold text-white uppercase tracking-wider">
                        {formationData.name}
                    </span>
                </div>
            </div>

            {/* Branding Tag */}
            <div className="absolute bottom-4 right-4 pointer-events-none">
                <h1 className="font-display text-3xl md:text-4xl italic font-black uppercase tracking-tighter text-white/20 select-none">
                    BrixSport
                </h1>
            </div>
        </div>
    );
}

function PitchMarkings({ sport }: { sport: 'Football' | 'Basketball' }) {
    if (sport === 'Football') {
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
    isTarget
}: {
    position: any;
    player?: LineupPlayer;
    playerDetails?: { name: string; jerseyName?: string; rating: number };
    onRemove: () => void;
    onAssign: () => void;
    onSetCaptain: () => void;
    onSetViceCaptain: () => void;
    teamSide: 'home' | 'away' | 'combined';
    isTarget?: boolean;
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
                        className={`relative w-16 h-20 rounded-xl border-2 transition-all ${teamSide === 'home'
                            ? 'bg-blue-500/90 border-blue-400'
                            : 'bg-red-500/90 border-red-400'
                            } hover:scale-110 shadow-lg`}
                    >
                        {/* Captain/Vice-Captain Badge */}
                        {player!.isCaptain && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-black">
                                <span className="text-black text-[10px] font-black">C</span>
                            </div>
                        )}
                        {player!.isViceCaptain && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center border-2 border-black">
                                <span className="text-black text-[10px] font-black">VC</span>
                            </div>
                        )}

                        {/* Jersey Number */}
                        <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
                            <span className="text-white text-xl font-display font-bold">
                                {player!.jerseyNumber}
                            </span>
                        </div>

                        {/* Player Name */}
                        <div className="absolute bottom-1 left-0 right-0 px-1">
                            <p className="text-white text-[8px] font-black uppercase truncate text-center">
                                {displayName}
                            </p>
                        </div>

                        {/* Rating */}
                        <div className="absolute top-1 right-1">
                            <div className="flex items-center gap-0.5 bg-black/30 rounded px-1">
                                <Star size={8} className="text-yellow-400 fill-yellow-400" />
                                <span className="text-[8px] font-bold text-white">
                                    {playerDetails!.rating.toFixed(1)}
                                </span>
                            </div>
                        </div>
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
                    className={`w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center transition-all cursor-pointer ${isTarget
                        ? 'border-green-500 bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.5)]'
                        : 'border-white/30 bg-white/5 hover:border-primary hover:bg-primary/10'
                        }`}
                >
                    <span className={`text-[10px] font-black uppercase ${isTarget ? 'text-green-400' : 'text-white/60'}`}>
                        {position.position}
                    </span>
                </motion.div>
            )}
        </div>
    );
}
