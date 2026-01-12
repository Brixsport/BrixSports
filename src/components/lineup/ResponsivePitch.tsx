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
        <div className={cn("w-full h-full relative select-none", className)}>
            {/* Aspect Ratio Container */}
            {/* Horizontal: pb-[64%] (approx 105/68) or pb-[56.25%] (16:9) */}
            {/* Vertical: pb-[150%] */}
            <div
                className={cn(
                    "relative w-full h-full rounded-xl overflow-hidden shadow-2xl bg-[#2a2a2a] border border-white/10",
                )}
            >
                {/* Pitch Background - Dark Premium Theme */}
                <div className="absolute inset-0 bg-[#1a1a1a]">
                    {/* Subtle gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />

                    {/* Mowed lawn stripes pattern - very subtle */}
                    <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: orientation === 'horizontal'
                                ? 'repeating-linear-gradient(90deg, transparent, transparent 5%, #fff 5%, #fff 10%)'
                                : 'repeating-linear-gradient(0deg, transparent, transparent 5%, #fff 5%, #fff 10%)'
                        }}
                    />
                </div>

                {/* Markings */}
                {showMarkings && (
                    <PitchMarkings orientation={orientation} strokeColor="rgba(255,255,255,0.2)" />
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

    // Y-Coordinate Calibration (FotMob Logic)
    const VISUAL_Y_SCALE = 0.92;
    const visualY = 50 + (position.y - 50) * VISUAL_Y_SCALE;

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group flex flex-col items-center"
            style={{
                left: `${position.x}%`,
                top: `${visualY}%`,
                zIndex: 20
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
                        "rounded-full flex items-center justify-center",
                        "border-2 shadow-lg transition-transform duration-200 group-hover:scale-110",
                        "bg-zinc-900 text-white font-bold"
                    )}
                    style={{
                        width: '3.5%', // 3.5% of pitch width
                        aspectRatio: '1/1', // Keep it circular
                        minWidth: '22px', // Minimum visibility
                        minHeight: '22px',
                        fontSize: 'clamp(10px, 1.25cqw, 14px)', // clear text scaling
                        borderColor: isMotM ? '#FFD700' : isCaptain ? '#FFFFFF' : 'rgba(255,255,255,0.8)',
                        backgroundColor: color,
                        boxShadow: isMotM ? '0 0 15px rgba(255, 215, 0, 0.5)' : '0 4px 6px rgba(0,0,0,0.3)'
                    }}
                >
                    <span style={{ fontSize: '100%' }}>{player.number}</span>
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
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 105 68" preserveAspectRatio="none">
                {/* Border / Touchline / Goal Line */}
                <rect x="0" y="0" width="105" height="68" fill="none" stroke={strokeColor} strokeWidth="0.3" />

                {/* Center Line */}
                <line x1="52.5" y1="0" x2="52.5" y2="68" stroke={strokeColor} strokeWidth="0.3" />

                {/* Center Circle (Radius 9.15m) */}
                <circle cx="52.5" cy="34" r="9.15" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <circle cx="52.5" cy="34" r="0.4" fill={strokeColor} />

                {/* --- LEFT (HOME) --- */}

                {/* Goal Area (5.5m deep, 18.32m wide) */}
                {/* Y-start = 34 - 9.16 = 24.84 */}
                <rect x="0" y="24.84" width="5.5" height="18.32" fill="none" stroke={strokeColor} strokeWidth="0.3" />

                {/* Penalty Area (16.5m deep, 40.32m wide) */}
                {/* Y-start = 34 - 20.16 = 13.84 */}
                <rect x="0" y="13.84" width="16.5" height="40.32" fill="none" stroke={strokeColor} strokeWidth="0.3" />

                {/* Penalty Spot (11m) */}
                <circle cx="11" cy="34" r="0.4" fill={strokeColor} />

                {/* Penalty Arc (Radius 9.15m from spot, bounded) */}
                {/* Starting from y=26.5 to y=41.5 (approx intersection with box line) */}
                {/* Math: sqrt(9.15^2 - (16.5-11)^2) = sqrt(83.72 - 30.25) = sqrt(53.47) = 7.31 */}
                {/* Intersection Y = 34 +/- 7.31 = 26.69 and 41.31 */}
                <path d="M 16.5 26.69 A 9.15 9.15 0 0 1 16.5 41.31" fill="none" stroke={strokeColor} strokeWidth="0.3" />


                {/* --- RIGHT (AWAY) --- */}

                {/* Goal Area */}
                <rect x="99.5" y="24.84" width="5.5" height="18.32" fill="none" stroke={strokeColor} strokeWidth="0.3" />

                {/* Penalty Area */}
                <rect x="88.5" y="13.84" width="16.5" height="40.32" fill="none" stroke={strokeColor} strokeWidth="0.3" />

                {/* Penalty Spot (105 - 11 = 94) */}
                <circle cx="94" cy="34" r="0.4" fill={strokeColor} />

                {/* Penalty Arc */}
                <path d="M 88.5 26.69 A 9.15 9.15 0 0 0 88.5 41.31" fill="none" stroke={strokeColor} strokeWidth="0.3" />


                {/* --- CORNERS (1m radius) --- */}
                <path d="M 0 1 A 1 1 0 0 0 1 0" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <path d="M 104 0 A 1 1 0 0 0 105 1" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <path d="M 0 67 A 1 1 0 0 1 1 68" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <path d="M 105 67 A 1 1 0 0 0 104 68" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            </svg>
        );
    }

    // Vertical (Mobile) Orientation (68 x 105)
    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 68 105" preserveAspectRatio="none">
            {/* Border */}
            <rect x="0" y="0" width="68" height="105" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* Center Line */}
            <line x1="0" y1="52.5" x2="68" y2="52.5" stroke={strokeColor} strokeWidth="0.3" />

            {/* Center Circle */}
            <circle cx="34" cy="52.5" r="9.15" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <circle cx="34" cy="52.5" r="0.4" fill={strokeColor} />


            {/* --- TOP (AWAY) --- */}

            {/* Goal Area (width 18.32, depth 5.5) */}
            {/* X-start = 34 - 9.16 = 24.84 */}
            <rect x="24.84" y="0" width="18.32" height="5.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* Penalty Area (width 40.32, depth 16.5) */}
            {/* X-start = 34 - 20.16 = 13.84 */}
            <rect x="13.84" y="0" width="40.32" height="16.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* Penalty Spot (11m) */}
            <circle cx="34" cy="11" r="0.4" fill={strokeColor} />

            {/* Penalty Arc */}
            {/* Intersection X = 34 +/- 7.31 = 26.69 and 41.31 */}
            <path d="M 26.69 16.5 A 9.15 9.15 0 0 0 41.31 16.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />


            {/* --- BOTTOM (HOME) --- */}

            {/* Goal Area */}
            <rect x="24.84" y="99.5" width="18.32" height="5.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* Penalty Area */}
            <rect x="13.84" y="88.5" width="40.32" height="16.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* Penalty Spot (105 - 11 = 94) */}
            <circle cx="34" cy="94" r="0.4" fill={strokeColor} />

            {/* Penalty Arc */}
            <path d="M 26.69 88.5 A 9.15 9.15 0 0 1 41.31 88.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />


            {/* --- CORNERS --- */}
            <path d="M 1 0 A 1 1 0 0 0 0 1" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <path d="M 68 1 A 1 1 0 0 0 67 0" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <path d="M 0 104 A 1 1 0 0 0 1 105" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <path d="M 67 105 A 1 1 0 0 0 68 104" fill="none" stroke={strokeColor} strokeWidth="0.3" />
        </svg>
    );
}
