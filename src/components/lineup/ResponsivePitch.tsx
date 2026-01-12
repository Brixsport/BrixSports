'use client';

import React from 'react';
import { Player } from '@/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// ========== TYPES ==========

export interface PitchPlayer {
    player: Player;
    position: { x: number; y: number }; // Percentage 0-100
    rating: number;
    isCaptain?: boolean;
    isMotM?: boolean;
    isSubstituted?: boolean;
    subMinute?: number;
}

export interface ResponsivePitchProps {
    players: PitchPlayer[];
    homeTeamColor: string;
    awayTeamColor?: string; // Optional if using one color for heatmap style
    onPlayerClick?: (player: Player) => void;
    orientation?: 'vertical' | 'horizontal'; // Support both layouts
    className?: string;
    showMarkings?: boolean;
}

// ========== COMPONENTS ==========

export function ResponsivePitch({
    players,
    homeTeamColor,
    awayTeamColor,
    onPlayerClick,
    orientation = 'horizontal',
    className,
    showMarkings = true,
}: ResponsivePitchProps) {

    // Decide aspect ratio based on orientation
    // Horizontal: 105m x 68m ≈ 1.54 ratio (using 16:9 or similar for screens)
    // Vertical: Inverse

    return (
        <div className={cn("w-full relative select-none", className)}>
            {/* Aspect Ratio Container */}
            {/* Horizontal: pb-[64%] (approx 105/68) or pb-[56.25%] (16:9) */}
            {/* Vertical: pb-[150%] */}
            <div
                className={cn(
                    "relative w-full rounded-xl overflow-hidden shadow-2xl bg-[#2a2a2a] border border-white/10",
                    orientation === 'horizontal' ? 'pb-[60%]' : 'pb-[140%]'
                )}
            >
                {/* Pitch Background - Grass Texture */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-800 via-emerald-800 to-green-900">
                    {/* Mowed lawn stripes pattern */}
                    <div
                        className="absolute inset-0 opacity-10"
                        style={{
                            backgroundImage: orientation === 'horizontal'
                                ? 'repeating-linear-gradient(90deg, transparent, transparent 5%, #000 5%, #000 10%)'
                                : 'repeating-linear-gradient(0deg, transparent, transparent 5%, #000 5%, #000 10%)'
                        }}
                    />
                </div>

                {/* Markings */}
                {showMarkings && (
                    <PitchMarkings orientation={orientation} strokeColor="rgba(255,255,255,0.4)" />
                )}

                {/* Players Layer */}
                <div className="absolute inset-0 z-10">
                    {players.map((p) => (
                        <PlayerDot
                            key={p.player.id}
                            data={p}
                            color={homeTeamColor} // Logic for away color can be added if needed
                            onClick={() => onPlayerClick?.(p.player)}
                            orientation={orientation}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function PlayerDot({
    data,
    color,
    onClick,
    orientation
}: {
    data: PitchPlayer;
    color: string;
    onClick?: () => void;
    orientation: 'vertical' | 'horizontal';
}) {
    const { player, position, rating, isCaptain, isMotM } = data;

    // Invert Y axis if needed, or handle varying coordinate systems
    // Assuming inputs are: x (0-100 left-right), y (0-100 top-bottom)

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group flex flex-col items-center"
            style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
            }}
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
        >
            {/* Player Circle */}
            <div className="relative">
                <div
                    className={cn(
                        "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center",
                        "border-2 shadow-lg transition-transform duration-200 group-hover:scale-110",
                        "bg-zinc-900 text-white font-bold text-xs sm:text-sm"
                    )}
                    style={{
                        borderColor: isMotM ? '#FFD700' : isCaptain ? '#FFFFFF' : 'rgba(255,255,255,0.8)',
                        backgroundColor: color,
                        boxShadow: isMotM ? '0 0 15px rgba(255, 215, 0, 0.5)' : '0 4px 6px rgba(0,0,0,0.3)'
                    }}
                >
                    {player.number}
                </div>

                {/* Captain Badge */}
                {isCaptain && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-[8px] font-black text-black border border-white shadow-sm">
                        C
                    </div>
                )}
            </div>

            {/* Name Label */}
            <div className="mt-1">
                <div className="bg-black/80 backdrop-blur-sm text-white text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium truncate max-w-[80px] text-center shadow-md border border-white/5">
                    {player.name}
                </div>
            </div>

            {/* Rating Pill */}
            {rating > 0 && (
                <div
                    className={cn(
                        "absolute -bottom-2 -right-2 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm border border-black/20",
                        getRatingColor(rating)
                    )}
                >
                    {rating.toFixed(1)}
                </div>
            )}
        </motion.div>
    );
}

// ========== HELPERS ==========

function getRatingColor(rating: number): string {
    if (rating >= 8.5) return 'bg-emerald-500 text-white'; // World class
    if (rating >= 7.5) return 'bg-blue-500 text-white';    // Excellent
    if (rating >= 7.0) return 'bg-green-500 text-white';   // Good
    if (rating >= 6.0) return 'bg-orange-400 text-white';  // Average
    return 'bg-red-500 text-white';                        // Poor
}

function PitchMarkings({ orientation, strokeColor }: { orientation: 'vertical' | 'horizontal'; strokeColor: string }) {
    if (orientation === 'horizontal') {
        return (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 64" preserveAspectRatio="none">
                {/* Border */}
                <rect x="0" y="0" width="100" height="64" fill="none" stroke="none" />

                {/* Outer Boundary */}
                <rect x="2" y="2" width="96" height="60" fill="none" stroke={strokeColor} strokeWidth="0.3" />

                {/* Center Line */}
                <line x1="50" y1="2" x2="50" y2="62" stroke={strokeColor} strokeWidth="0.3" />

                {/* Center Circle */}
                <circle cx="50" cy="32" r="8" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <circle cx="50" cy="32" r="0.4" fill={strokeColor} />

                {/* Left Goal Area (Home) */}
                <rect x="2" y="22" width="5" height="20" fill="none" stroke={strokeColor} strokeWidth="0.3" /> {/* Small box */}
                <rect x="2" y="14" width="15" height="36" fill="none" stroke={strokeColor} strokeWidth="0.3" /> {/* Big box */}
                <circle cx="10" cy="32" r="0.4" fill={strokeColor} /> {/* Penalty spot */}
                {/* Penalty Arc */}
                <path d="M 17 27 A 8 8 0 0 1 17 37" fill="none" stroke={strokeColor} strokeWidth="0.3" />

                {/* Right Goal Area (Away) */}
                <rect x="93" y="22" width="5" height="20" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <rect x="83" y="14" width="15" height="36" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <circle cx="90" cy="32" r="0.4" fill={strokeColor} />
                <path d="M 83 27 A 8 8 0 0 0 83 37" fill="none" stroke={strokeColor} strokeWidth="0.3" />

                {/* Corner Arcs */}
                <path d="M 2 3 A 1 1 0 0 0 3 2" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <path d="M 98 3 A 1 1 0 0 1 97 2" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <path d="M 2 61 A 1 1 0 0 1 3 62" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <path d="M 98 61 A 1 1 0 0 0 97 62" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            </svg>
        );
    }

    // Vertical (Mobile) Orientation
    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 64 100" preserveAspectRatio="none">
            <rect x="2" y="2" width="60" height="96" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* Center Line */}
            <line x1="2" y1="50" x2="62" y2="50" stroke={strokeColor} strokeWidth="0.3" />
            <circle cx="32" cy="50" r="8" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* Top Goal Area */}
            <rect x="22" y="2" width="20" height="5" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <rect x="14" y="2" width="36" height="15" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* Bottom Goal Area */}
            <rect x="22" y="93" width="20" height="5" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <rect x="14" y="83" width="36" height="15" fill="none" stroke={strokeColor} strokeWidth="0.3" />
        </svg>
    );
}
