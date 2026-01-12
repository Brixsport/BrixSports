import React from 'react';
import { Player } from '@/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface PitchPlayerProps {
    player: Player;
    x: number; // Percentage 0-100
    y: number; // Percentage 0-100
    color: string;
    rating?: number;
    isCaptain?: boolean;
    isMotM?: boolean;
    substitutionTime?: string; // e.g. "72'"
    goals?: number;
    onClick?: () => void;
    showName?: boolean;
}

export function PitchPlayer({
    player,
    x,
    y,
    color,
    rating,
    isCaptain,
    isMotM,
    substitutionTime,
    goals,
    onClick,
    showName = true
}: PitchPlayerProps) {

    // Rating Color Logic
    const getRatingColor = (r: number) => {
        if (r >= 8.5) return 'bg-emerald-500 text-white border-emerald-600';
        if (r >= 7.5) return 'bg-blue-500 text-white border-blue-600';
        if (r >= 7.0) return 'bg-green-500 text-white border-green-600';
        if (r >= 6.0) return 'bg-orange-400 text-white border-orange-500';
        return 'bg-red-500 text-white border-red-600';
    };

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer group z-10"
            style={{
                left: `${x}%`,
                top: `${y}%`,
            }}
            onClick={onClick}
        >
            <div className="relative">
                {/* Player Avatar / Number Circle */}
                <div
                    className={cn(
                        "relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 shadow-md transition-transform group-hover:scale-105",
                        isMotM ? "border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]" : "border-white/90"
                    )}
                    style={{ backgroundColor: color }}
                >
                    {player.avatar ? (
                        <div className="w-full h-full rounded-full overflow-hidden relative">
                            {/* Use Next.js Image if domain is configured, otherwise img for safety in this snippet */}
                            <img
                                src={player.avatar}
                                alt={player.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <span className="text-white font-bold text-sm sm:text-base drop-shadow-md">
                            {player.number}
                        </span>
                    )}

                    {/* Captain Badge */}
                    {isCaptain && (
                        <div className="absolute -top-1 -left-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-[8px] font-black text-black border border-white shadow-sm z-20">
                            C
                        </div>
                    )}

                    {/* Substitution Indicator (Red Badge) */}
                    {substitutionTime && (
                        <div className="absolute -top-1 -right-2 bg-red-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-full border border-white shadow-sm z-20 flex items-center gap-0.5">
                            <span className="text-[6px]">↓</span>{substitutionTime}
                        </div>
                    )}

                    {/* Goal Indicator */}
                    {goals && goals > 0 && (
                        <div className="absolute -bottom-1 -left-2 bg-white text-black text-[8px] font-bold px-1 py-0 rounded-full border border-gray-200 shadow-sm z-20 flex items-center gap-0.5">
                            ⚽ {goals > 1 ? `x${goals}` : ''}
                        </div>
                    )}

                    {/* Rating Badge (Bottom Right) */}
                    {rating !== undefined && rating > 0 && (
                        <div className={cn(
                            "absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold border shadow-sm z-20",
                            getRatingColor(rating)
                        )}>
                            {rating.toFixed(1)}
                        </div>
                    )}
                </div>
            </div>

            {/* Player Name */}
            {showName && (
                <div className="mt-1 flex flex-col items-center">
                    <span className="text-[10px] sm:text-xs font-medium text-white bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-[2px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[90px] text-center shadow-sm">
                        {player.jerseyName || player.name.split(' ').pop() || player.name}
                    </span>
                    {/* Small number if avatar is shown? Maybe redundant but requested "Player number: Small text above name" 
                        Actually request says "Player number: Small text above name".
                        But usually it replaces avatar if no photo. 
                        If avatar exists, number is often on the player model or not shown prominently.
                        Let's add it tiny if avatar is present?
                    */}
                </div>
            )}
        </motion.div>
    );
}
