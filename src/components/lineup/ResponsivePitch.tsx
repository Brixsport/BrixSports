'use client';

import React from 'react';
import { Shirt, ArrowRightLeft } from 'lucide-react';
import { FaFutbol } from 'react-icons/fa';
import { SoccerBootIcon } from '../icons/SoccerBootIcon';
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
    goals?: number;
    assists?: number;
    card?: 'yellow' | 'red';
    penalty?: boolean;
}

export interface ResponsivePitchProps {
    players: PitchPlayer[];
    homeTeamColor: string;
    awayTeamColor?: string; // Optional if using one color for heatmap style
    onPlayerClick?: (player: Player) => void;
    orientation?: 'vertical' | 'horizontal'; // Support both layouts
    className?: string;
    showMarkings?: boolean;
    variant?: '11-a-side' | '5-a-side' | 'basketball' | '3x3';
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
    variant = '11-a-side',
}: ResponsivePitchProps) {
    const isBasketball = variant === 'basketball' || variant === '3x3';

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
                    "relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-white/10",
                    isBasketball ? "bg-[#1a1c2c]" : "bg-[#0d1f12]"
                )}
            >
                {/* Pitch Background - dark pitch-green (matches Figma), premium dark theme for basketball */}
                <div className={cn("absolute inset-0", isBasketball ? "bg-gradient-to-br from-[#121421] to-[#1a1c2c]" : "bg-gradient-to-b from-[#1c3a22] to-[#0d1f12]")}>
                    {/* Subtle gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20" />

                    {/* Background Pattern */}
                    {isBasketball ? (
                        <div className="absolute inset-0 opacity-[0.05]"
                            style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                    ) : (
                        <div
                            className="absolute inset-0 opacity-[0.05]"
                            style={{
                                backgroundImage: orientation === 'horizontal'
                                    ? 'repeating-linear-gradient(90deg, transparent, transparent 5%, #fff 5%, #fff 10%)'
                                    : 'repeating-linear-gradient(0deg, transparent, transparent 5%, #fff 5%, #fff 10%)'
                            }}
                        />
                    )}
                </div>

                {/* Markings */}
                {showMarkings && (
                    variant === '5-a-side' ? (
                        <PitchMarkings5Aside orientation={orientation} strokeColor="rgba(255,255,255,0.2)" />
                    ) : variant === 'basketball' ? (
                        <CourtMarkings orientation={orientation} strokeColor="rgba(255,255,255,0.2)" />
                    ) : variant === '3x3' ? (
                        <CourtMarkings3x3 orientation={orientation} strokeColor="rgba(255,255,255,0.2)" />
                    ) : (
                        <PitchMarkings orientation={orientation} strokeColor="rgba(255,255,255,0.2)" />
                    )
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
                            variant={variant}
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
    orientation,
    variant = '11-a-side'
}: {
    data: PitchPlayer;
    color: string;
    onClick?: () => void;
    orientation: 'vertical' | 'horizontal';
    variant?: '11-a-side' | '5-a-side' | 'basketball' | '3x3';
}) {
    const { player, position, rating, isCaptain, isMotM, goals, assists, card, penalty, isSubstituted, subMinute } = data;

    // Invert Y axis if needed, or handle varying coordinate systems
    // Assuming inputs are: x (0-100 left-right), y (0-100 top-bottom)

    // Y-Coordinate Calibration (FotMob Logic)
    // For 5-a-side/Basketball, we might want less compression or different logic
    const VISUAL_Y_SCALE = (variant === '5-a-side' || variant === 'basketball' || variant === '3x3') ? 0.85 : 0.92;
    const visualY = 50 + (position.y - 50) * VISUAL_Y_SCALE;
    const jerseySize = (variant === '5-a-side' || variant === 'basketball' || variant === '3x3') ? '9.5%' : '6.5%';

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
            {/* Rating Pill (tight to the jersey, small footprint) */}
            {rating > 0 && (
                <div
                    className={cn(
                        "px-1 py-0.5 rounded text-[8px] font-bold shadow-sm border border-black/20 -mb-0.5 z-10",
                        getRatingColor(rating)
                    )}
                >
                    {rating.toFixed(1)}
                </div>
            )}

            {/* Jersey Icon - scaled up for clear visibility of shape + number */}
            <div
                className="relative flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                style={{
                    width: jerseySize,
                    aspectRatio: '1/1',
                    minWidth: '34px',
                    minHeight: '34px',
                    filter: isMotM ? 'drop-shadow(0 0 6px rgba(255, 215, 0, 0.7))' : 'drop-shadow(0 4px 4px rgba(0,0,0,0.3))'
                }}
            >
                <Shirt
                    className="absolute inset-0 w-full h-full"
                    fill={color}
                    stroke={isMotM ? '#FFD700' : 'rgba(255,255,255,0.7)'}
                    strokeWidth={1.5}
                />
                <span
                    className="relative z-10 font-bold text-white"
                    style={{ fontSize: 'clamp(12px, 1.5cqw, 17px)' }}
                >
                    {player.number}
                </span>
            </div>

            {/* Name + inline status row plain text on the pitch, no chip background) */}
            <div className="mt-1 flex items-center gap-0.5 max-w-[100px]" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                {isCaptain && (
                    <span className="text-yellow-400 text-[8px] font-black shrink-0">(C)</span>
                )}
                <span className="min-w-0 text-white text-[10px] sm:text-xs font-medium truncate">
                    {player.jerseyName || player.name}
                </span>
                {card === 'yellow' && (
                    <span className="w-2.5 h-3 bg-yellow-400 rounded-[1px] shrink-0" title="Yellow card" />
                )}
                {card === 'red' && (
                    <span className="w-2.5 h-3 bg-red-500 rounded-[1px] shrink-0" title="Red card" />
                )}
                {!!goals && goals > 0 && (
                    <span
                        className="flex items-center -space-x-1 text-white shrink-0"
                        title={`${goals} goal${goals > 1 ? 's' : ''}${penalty ? ' (incl. penalty)' : ''}`}
                    >
                        {Array.from({ length: goals }).map((_, i) => (
                            <FaFutbol key={i} className="w-2.5 h-2.5" />
                        ))}
                        {penalty && <span className="ml-0.5 text-[7px] font-bold text-white/70">(P)</span>}
                    </span>
                )}
                {!!assists && assists > 0 && (
                    <span
                        className="flex items-center -space-x-1 text-white shrink-0"
                        title={`${assists} assist${assists > 1 ? 's' : ''}`}
                    >
                        {Array.from({ length: assists }).map((_, i) => (
                            <SoccerBootIcon key={i} className="w-2.5 h-2.5 -rotate-[30deg]" />
                        ))}
                    </span>
                )}
                {isSubstituted && (
                    <span className="flex items-center gap-px text-red-400 text-[9px] font-bold shrink-0" title="Substituted off">
                        <ArrowRightLeft className="w-2.5 h-2.5" />
                        {subMinute ? `${subMinute}'` : ''}
                    </span>
                )}
            </div>
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

function PitchMarkings5Aside({ orientation, strokeColor }: { orientation: 'vertical' | 'horizontal'; strokeColor: string }) {
    // 5-a-side dimensions (approx 40x20m relative)
    // We'll normalize to a 40x20 aspect ratio visualization, but render into the component
    // Let's use simpler geometries: Semicircle penalty areas (radius 6m)

    if (orientation === 'horizontal') {
        const aspectW = 100;
        const aspectH = 50; // 2:1 ratio
        // We will assume the viewBox is roughly matching this ratio or we render slightly differently
        // Standard Futsal Pitch

        return (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 50" preserveAspectRatio="none">
                {/* Border */}
                <rect x="0" y="0" width="100" height="50" fill="none" stroke={strokeColor} strokeWidth="0.3" />

                {/* Center Line */}
                <line x1="50" y1="0" x2="50" y2="50" stroke={strokeColor} strokeWidth="0.3" />

                {/* Center Circle (Radius 3m -> 7.5% width) */}
                <circle cx="50" cy="25" r="7.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <circle cx="50" cy="25" r="0.5" fill={strokeColor} />

                {/* --- LEFT (HOME) --- */}
                {/* Penalty Area (Semicircle radius 6m -> 15% width) */}
                <path d="M 0 10 A 15 15 0 0 1 0 40" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                {/* Goal Post Line (approx) */}
                <line x1="0" y1="10" x2="1" y2="10" stroke={strokeColor} strokeWidth="0.3" />
                <line x1="0" y1="40" x2="1" y2="40" stroke={strokeColor} strokeWidth="0.3" />

                {/* Penalty Spot (6m -> 15% width) */}
                <circle cx="15" cy="25" r="0.5" fill={strokeColor} />
                {/* Second Penalty Spot (10m -> 25% width) */}
                <circle cx="25" cy="25" r="0.3" fill={strokeColor} opacity="0.7" />

                {/* --- RIGHT (AWAY) --- */}
                {/* Penalty Area (Semicircle) */}
                <path d="M 100 10 A 15 15 0 0 0 100 40" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <line x1="100" y1="10" x2="99" y2="10" stroke={strokeColor} strokeWidth="0.3" />
                <line x1="100" y1="40" x2="99" y2="40" stroke={strokeColor} strokeWidth="0.3" />

                {/* Penalty Spot */}
                <circle cx="85" cy="25" r="0.5" fill={strokeColor} />
                {/* Second Penalty Spot */}
                <circle cx="75" cy="25" r="0.3" fill={strokeColor} opacity="0.7" />

                {/* CORNERS */}
                <path d="M 0 1 A 1 1 0 0 0 1 0" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <path d="M 99 0 A 1 1 0 0 0 100 1" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <path d="M 0 49 A 1 1 0 0 1 1 50" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <path d="M 100 49 A 1 1 0 0 0 99 50" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            </svg>
        );
    }

    // Vertical (Mobile) Orientation (20x40m -> 50x100)
    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 50 100" preserveAspectRatio="none">
            {/* Border */}
            <rect x="0" y="0" width="50" height="100" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* Center Line */}
            <line x1="0" y1="50" x2="50" y2="50" stroke={strokeColor} strokeWidth="0.3" />

            {/* Center Circle */}
            <circle cx="25" cy="50" r="7.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <circle cx="25" cy="50" r="0.5" fill={strokeColor} />

            {/* --- TOP (AWAY) --- */}
            {/* Penalty Area (Semicircle radius 15) */}
            <path d="M 10 0 A 15 15 0 0 0 40 0" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* Penalty Spot (15% from top = 15) */}
            <circle cx="25" cy="15" r="0.5" fill={strokeColor} />
            {/* Second Spot (25) */}
            <circle cx="25" cy="25" r="0.3" fill={strokeColor} opacity="0.7" />

            {/* --- BOTTOM (HOME) --- */}
            {/* Penalty Area */}
            <path d="M 10 100 A 15 15 0 0 1 40 100" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* Penalty Spot */}
            <circle cx="25" cy="85" r="0.5" fill={strokeColor} />
            {/* Second Spot */}
            <circle cx="25" cy="75" r="0.3" fill={strokeColor} opacity="0.7" />

            {/* CORNERS */}
            <path d="M 1 0 A 1 1 0 0 0 0 1" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <path d="M 50 1 A 1 1 0 0 0 49 0" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <path d="M 0 99 A 1 1 0 0 0 1 100" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <path d="M 49 100 A 1 1 0 0 0 50 99" fill="none" stroke={strokeColor} strokeWidth="0.3" />
        </svg>
    );
}

function CourtMarkings({ orientation, strokeColor }: { orientation: 'vertical' | 'horizontal'; strokeColor: string }) {
    // 28x15m (Normalizing to 100x53.5 for SVG)
    if (orientation === 'horizontal') {
        return (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 53.5" preserveAspectRatio="none">
                {/* Border */}
                <rect x="0" y="0" width="100" height="53.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />

                {/* Center Line */}
                <line x1="50" y1="0" x2="50" y2="53.5" stroke={strokeColor} strokeWidth="0.3" />

                {/* Center Circle (Radius 1.8m -> 6.4 unit) */}
                <circle cx="50" cy="26.75" r="6.4" fill="none" stroke={strokeColor} strokeWidth="0.3" />

                {/* --- LEFT SIDE --- */}
                {/* 3 Point Line (Radius 6.75m -> 24 unit) */}
                <path d="M 0 12 A 24 24 0 0 1 0 41.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                {/* Key / Restricted Area (4.9m x 5.8m -> 17.5 x 20.7 unit) */}
                <rect x="0" y="16.375" width="20.7" height="17.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                {/* Free Throw Circle */}
                <circle cx="20.7" cy="26.75" r="6.4" fill="none" stroke={strokeColor} strokeWidth="0.3" />

                {/* --- RIGHT SIDE --- */}
                <path d="M 100 12 A 24 24 0 0 0 100 41.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <rect x="79.3" y="16.375" width="20.7" height="17.5" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                <circle cx="79.3" cy="26.75" r="6.4" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            </svg>
        );
    }

    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 53.5 100" preserveAspectRatio="none">
            {/* Border */}
            <rect x="0" y="0" width="53.5" height="100" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* Center Line */}
            <line x1="0" y1="50" x2="53.5" y2="50" stroke={strokeColor} strokeWidth="0.3" />

            {/* Center Circle */}
            <circle cx="26.75" cy="50" r="6.4" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* --- TOP SIDE --- */}
            <path d="M 12 0 A 24 24 0 0 0 41.5 0" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <rect x="16.375" y="0" width="17.5" height="20.7" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <circle cx="26.75" cy="20.7" r="6.4" fill="none" stroke={strokeColor} strokeWidth="0.3" />

            {/* --- BOTTOM SIDE --- */}
            <path d="M 12 100 A 24 24 0 0 1 41.5 100" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <rect x="16.375" y="79.3" width="17.5" height="20.7" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            <circle cx="26.75" cy="79.3" r="6.4" fill="none" stroke={strokeColor} strokeWidth="0.3" />
        </svg>
    );
}

function CourtMarkings3x3({ orientation, strokeColor }: { orientation: 'vertical' | 'horizontal'; strokeColor: string }) {
    // Half court (15m x 11m -> 100x73.3)
    if (orientation === 'horizontal') {
        return (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 73.3" preserveAspectRatio="none">
                <rect x="0" y="0" width="100" height="73.3" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                {/* 3 Point Line */}
                <path d="M 0 10 A 45 45 0 0 1 0 63.3" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                {/* Key */}
                <rect x="0" y="22.15" width="25" height="29" fill="none" stroke={strokeColor} strokeWidth="0.3" />
                {/* Hoop / Circle */}
                <circle cx="8" cy="36.65" r="1" fill={strokeColor} />
            </svg>
        );
    }

    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 73.3 100" preserveAspectRatio="none">
            <rect x="0" y="0" width="73.3" height="100" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            {/* 3 Point Line */}
            <path d="M 10 0 A 45 45 0 0 0 63.3 0" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            {/* Key */}
            <rect x="22.15" y="0" width="29" height="25" fill="none" stroke={strokeColor} strokeWidth="0.3" />
            {/* Hoop */}
            <circle cx="36.65" cy="8" r="1" fill={strokeColor} />
        </svg>
    );
}




