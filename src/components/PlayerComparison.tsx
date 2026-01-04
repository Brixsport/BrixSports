'use client';

import { motion } from 'framer-motion';
import { Trophy, Target, TrendingUp, Shield, Star, Award, Activity, Zap } from 'lucide-react';

interface PlayerWithDetails {
    id: string;
    name: string;
    number: number;
    position: string;
    rating?: number;
    image?: string;
    team?: {
        id: string;
        name: string;
        sport: string;
        logo?: string;
    };
    stats?: any;
}

interface PlayerComparisonProps {
    player1: PlayerWithDetails;
    player2: PlayerWithDetails;
    sport: 'Football' | 'Basketball' | 'Track';
}

export function PlayerComparison({ player1, player2, sport }: PlayerComparisonProps) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-center gap-2">
                <Trophy size={20} className="text-primary" />
                <h2 className="text-sm font-black uppercase tracking-widest text-white/60">
                    Player Comparison
                </h2>
            </div>

            {/* Players Header */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                {/* Player 1 */}
                <PlayerHeader player={player1} align="left" />

                {/* VS */}
                <div className="text-center">
                    <div className="text-2xl md:text-4xl font-display italic text-white/20">VS</div>
                </div>

                {/* Player 2 */}
                <PlayerHeader player={player2} align="right" />
            </div>

            {/* Stats Comparison */}
            {sport === 'Football' && (
                <FootballComparison player1={player1} player2={player2} />
            )}
            {sport === 'Basketball' && (
                <BasketballComparison player1={player1} player2={player2} />
            )}
            {sport === 'Track' && (
                <TrackComparison player1={player1} player2={player2} />
            )}

            {/* Overall Rating */}
            <div className="bg-white/5 rounded-2xl p-4">
                <p className="text-xs text-white/40 font-bold mb-3 text-center">OVERALL RATING</p>
                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            <span className="text-3xl font-display italic text-primary">
                                {player1.rating?.toFixed(1) || '7.0'}
                            </span>
                        </div>
                        <p className="text-xs text-white/60">{player1.name}</p>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            <span className="text-3xl font-display italic text-primary">
                                {player2.rating?.toFixed(1) || '7.0'}
                            </span>
                        </div>
                        <p className="text-xs text-white/60">{player2.name}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PlayerHeader({ player, align }: { player: PlayerWithDetails; align: 'left' | 'right' }) {
    return (
        <div className={`text-${align}`}>
            {player.image ? (
                <img
                    src={player.image}
                    alt={player.name}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover mx-auto mb-2 border-2 border-primary"
                />
            ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2 border-2 border-primary">
                    <span className="text-2xl md:text-3xl font-display italic">{player.number}</span>
                </div>
            )}
            <p className="text-xs md:text-sm font-black uppercase tracking-tight truncate max-w-[100px] md:max-w-none mx-auto">{player.name}</p>
            <p className="text-[10px] md:text-xs text-white/60 font-bold">{player.position}</p>
        </div>
    );
}

function FootballComparison({ player1, player2 }: { player1: any; player2: any }) {
    const stats1 = player1.stats || {};
    const stats2 = player2.stats || {};

    const compareStats = [
        { label: 'Goals', key: 'goals', icon: Target, color: 'blue' },
        { label: 'Assists', key: 'assists', icon: TrendingUp, color: 'blue' },
        { label: 'Appearances', key: 'appearances', icon: Activity, color: 'purple' },
        { label: 'Minutes', key: 'minutesPlayed', icon: Activity, color: 'yellow' },
        { label: 'Yellow Cards', key: 'yellowCards', icon: Shield, color: 'yellow' },
        { label: 'Red Cards', key: 'redCards', icon: Shield, color: 'red' },
    ];

    return (
        <div className="space-y-3">
            {compareStats.map((stat, idx) => {
                const value1 = stats1[stat.key] || 0;
                const value2 = stats2[stat.key] || 0;
                const total = value1 + value2;
                const percentage1 = total > 0 ? (value1 / total) * 100 : 50;
                const percentage2 = total > 0 ? (value2 / total) * 100 : 50;

                return (
                    <ComparisonBar
                        key={stat.key}
                        label={stat.label}
                        value1={value1}
                        value2={value2}
                        percentage1={percentage1}
                        percentage2={percentage2}
                        icon={stat.icon}
                        color={stat.color}
                        delay={idx * 0.1}
                    />
                );
            })}
        </div>
    );
}

function BasketballComparison({ player1, player2 }: { player1: any; player2: any }) {
    const stats1 = player1.stats || {};
    const stats2 = player2.stats || {};

    const compareStats = [
        { label: 'Points', key: 'totalPoints', icon: Target, color: 'blue' },
        { label: 'Assists', key: 'totalAssists', icon: TrendingUp, color: 'blue' },
        { label: 'Rebounds', key: 'rebounds', icon: Shield, color: 'purple' },
        { label: 'Steals', key: 'steals', icon: Zap, color: 'yellow' },
        { label: 'Blocks', key: 'blocks', icon: Shield, color: 'red' },
        { label: 'Appearances', key: 'appearances', icon: Activity, color: 'orange' },
    ];

    return (
        <div className="space-y-3">
            {compareStats.map((stat, idx) => {
                const value1 = stats1[stat.key] || 0;
                const value2 = stats2[stat.key] || 0;
                const total = value1 + value2;
                const percentage1 = total > 0 ? (value1 / total) * 100 : 50;
                const percentage2 = total > 0 ? (value2 / total) * 100 : 50;

                return (
                    <ComparisonBar
                        key={stat.key}
                        label={stat.label}
                        value1={value1}
                        value2={value2}
                        percentage1={percentage1}
                        percentage2={percentage2}
                        icon={stat.icon}
                        color={stat.color}
                        delay={idx * 0.1}
                    />
                );
            })}
        </div>
    );
}

function TrackComparison({ player1, player2 }: { player1: any; player2: any }) {
    const stats1 = player1.stats || {};
    const stats2 = player2.stats || {};

    const compareStats = [
        { label: 'Gold Medals', key: 'goldMedals', icon: Award, color: 'yellow' },
        { label: 'Silver Medals', key: 'silverMedals', icon: Award, color: 'gray' },
        { label: 'Bronze Medals', key: 'bronzeMedals', icon: Award, color: 'orange' },
        { label: 'Events', key: 'appearances', icon: Activity, color: 'blue' },
        { label: 'Personal Bests', key: 'personalBests', icon: Zap, color: 'blue' },
    ];

    return (
        <div className="space-y-3">
            {compareStats.map((stat, idx) => {
                const value1 = stats1[stat.key] || 0;
                const value2 = stats2[stat.key] || 0;
                const total = value1 + value2;
                const percentage1 = total > 0 ? (value1 / total) * 100 : 50;
                const percentage2 = total > 0 ? (value2 / total) * 100 : 50;

                return (
                    <ComparisonBar
                        key={stat.key}
                        label={stat.label}
                        value1={value1}
                        value2={value2}
                        percentage1={percentage1}
                        percentage2={percentage2}
                        icon={stat.icon}
                        color={stat.color}
                        delay={idx * 0.1}
                    />
                );
            })}
        </div>
    );
}

function ComparisonBar({
    label,
    value1,
    value2,
    percentage1,
    percentage2,
    icon: Icon,
    color,
    delay,
}: {
    label: string;
    value1: number;
    value2: number;
    percentage1: number;
    percentage2: number;
    icon: any;
    color: string;
    delay: number;
}) {
    const colorClasses: Record<string, string> = {
        green: 'bg-blue-500',
        blue: 'bg-blue-500',
        purple: 'bg-purple-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500',
        orange: 'bg-orange-500',
        gray: 'bg-gray-500',
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
                <span className="font-bold">{value1}</span>
                <div className="flex items-center gap-2 text-white/60">
                    <Icon size={14} />
                    <span className="font-bold uppercase tracking-wider">{label}</span>
                </div>
                <span className="font-bold">{value2}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage1}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay }}
                    className={`${colorClasses[color]} opacity-80`}
                />
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage2}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: delay + 0.1 }}
                    className={`${colorClasses[color]}`}
                />
            </div>
        </div>
    );
}

// Empty state
export function PlayerComparisonEmpty() {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-12 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trophy size={32} className="text-white/20" />
            </div>
            <p className="text-sm font-bold text-white/60 mb-1">Select Players to Compare</p>
            <p className="text-xs text-white/40">
                Choose two players to see their head-to-head statistics
            </p>
        </div>
    );
}

