'use client';

import { motion } from 'framer-motion';
import { Player } from '@/types';
import { useState } from 'react';

interface ResponsivePlayerCardProps {
    player: Player;
    position: { top: number; left: number };
    rating?: number;
    isCaptain?: boolean;
    isMotM?: boolean;
    teamColor: string;
    screenSize: {
        isMobile: boolean;
        isTablet: boolean;
        isDesktop: boolean;
    };
    subInfo?: {
        type: 'in' | 'out';
        minute: number;
    };
    onClick?: (player: Player) => void;
}

function getRatingColor(rating: number): string {
    if (rating >= 8) return 'bg-blue-500 text-white';
    if (rating >= 7) return 'bg-green-500 text-white';
    if (rating >= 6) return 'bg-yellow-500 text-black';
    return 'bg-red-500 text-white';
}

export function ResponsivePlayerCard({
    player,
    position,
    rating,
    isCaptain,
    isMotM,
    teamColor,
    screenSize,
    subInfo,
    onClick,
}: ResponsivePlayerCardProps) {
    const [touchStart, setTouchStart] = useState(0);

    // Adaptive sizing based on screen size
    const cardSize = {
        mobile: {
            jersey: 'w-10 h-10',
            text: 'text-[10px]',
            rating: 'w-5 h-5 text-[9px]',
            badge: 'text-[8px]'
        },
        tablet: {
            jersey: 'w-11 h-11',
            text: 'text-xs',
            rating: 'w-6 h-6 text-[10px]',
            badge: 'text-[9px]'
        },
        desktop: {
            jersey: 'w-12 h-12',
            text: 'text-xs',
            rating: 'w-7 h-7 text-xs',
            badge: 'text-[10px]'
        },
    };

    const size = screenSize.isMobile
        ? cardSize.mobile
        : screenSize.isTablet
            ? cardSize.tablet
            : cardSize.desktop;

    const handleTouchStart = () => {
        setTouchStart(Date.now());
    };

    const handleTouchEnd = () => {
        // Only trigger if touch was < 200ms (tap, not scroll)
        if (Date.now() - touchStart < 200) {
            onClick?.(player);
        }
    };

    const handleClick = () => {
        onClick?.(player);
    };

    return (
        <motion.div
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group touch-manipulation"
            style={{ top: `${position.top}%`, left: `${position.left}%` }}
            whileTap={{ scale: 0.95 }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={handleClick}
        >
            {/* Jersey Circle - Responsive Size */}
            <div
                className={`${size.jersey} rounded-full flex items-center justify-center text-white font-bold border-2 border-white/30 shadow-lg relative transition-transform active:scale-95`}
                style={{ backgroundColor: teamColor }}
            >
                <span className={size.text}>{player.number}</span>

                {/* Captain Badge - Scales with card */}
                {isCaptain && (
                    <div className={`absolute -top-0.5 -right-0.5 ${size.rating} bg-yellow-400 rounded-full flex items-center justify-center border border-white`}>
                        <span className={`text-black ${size.badge} font-black`}>C</span>
                    </div>
                )}

                {/* Man of the Match Badge */}
                {isMotM && (
                    <div className={`absolute -top-0.5 -left-0.5 ${size.rating} bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center border border-white`}>
                        <span className={`text-white ${size.badge} font-black`}>⭐</span>
                    </div>
                )}
            </div>

            {/* Player Name - Adaptive Text */}
            <div className={`mt-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-white ${size.text} font-semibold whitespace-nowrap text-center border border-white/20 max-w-[60px] truncate`}>
                {player.jerseyName || player.name.split(' ').pop()}
            </div>

            {/* Rating Badge - Conditional on Mobile (hidden to reduce clutter) */}
            {rating && !screenSize.isMobile && (
                <div className={`absolute -top-1 -left-1 ${size.rating} rounded-full flex items-center justify-center font-bold border-2 border-white shadow-lg ${getRatingColor(rating)}`}>
                    {rating.toFixed(1)}
                </div>
            )}

            {/* Substitution Indicator (for pitch players - OUT) */}
            {subInfo && subInfo.type === 'out' && (
                <div className="absolute -bottom-2 -right-2 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-lg z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3 h-3 text-white font-bold" strokeWidth="4">
                        <path d="M12 5v14M19 12l-7 7-7-7" />
                    </svg>
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-[8px] px-1 rounded font-bold border border-white">
                        {subInfo.minute}'
                    </div>
                </div>
            )}
        </motion.div>
    );
}
