'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, TrendingUp, Target, Activity, Shield, Zap, Award, Users } from 'lucide-react';
import { Player } from '@/types';

interface PlayerStatsModalProps {
    player: Player | null;
    isOpen: boolean;
    onClose: () => void;
    teamColor: string;
    rating?: number; // Current match rating
    averageRating?: number; // Player's average rating across all matches
    position?: string;
    stats?: any;
    isCaptain?: boolean;
    isMotM?: boolean;
}

export function PlayerStatsModal({
    player,
    isOpen,
    onClose,
    teamColor,
    rating = 0,
    averageRating,
    position = 'MID',
    stats,
    isCaptain = false,
    isMotM = false,
}: PlayerStatsModalProps) {
    if (!player) return null;

    // Use average rating as the primary display, fallback to current match rating
    const displayRating = averageRating || rating;
    const hasAverageRating = averageRating !== undefined && averageRating > 0;

    // Get rating color
    const getRatingColor = (rating: number) => {
        if (rating >= 8.0) return 'from-green-500 to-emerald-600';
        if (rating >= 7.0) return 'from-green-600 to-green-700';
        if (rating >= 6.5) return 'from-yellow-500 to-yellow-600';
        if (rating >= 6.0) return 'from-orange-500 to-orange-600';
        return 'from-red-500 to-red-600';
    };

    // Mock stats if not provided (you'll replace this with real data)
    const playerStats = stats || {
        goals: 0,
        assists: 0,
        shots: 0,
        shotsOnTarget: 0,
        passes: 0,
        passAccuracy: 0,
        tackles: 0,
        interceptions: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
        minutesPlayed: 0,
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl"
                    >
                        {/* Header with gradient */}
                        <div
                            className="relative p-6 pb-20"
                            style={{
                                background: `linear-gradient(135deg, ${teamColor}40 0%, ${teamColor}20 100%)`,
                            }}
                        >
                            {/* Close button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Player Info */}
                            <div className="flex items-start gap-4">
                                {/* Jersey Number */}
                                <div
                                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black border-2 border-white/20"
                                    style={{ backgroundColor: teamColor }}
                                >
                                    {player.number}
                                </div>

                                {/* Name and Position */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h2 className="text-2xl font-bold">{player.name}</h2>
                                        {isCaptain && (
                                            <div className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-bold flex items-center gap-1">
                                                <Award className="w-3 h-3" />
                                                CAPTAIN
                                            </div>
                                        )}
                                        {isMotM && (
                                            <div className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-bold flex items-center gap-1">
                                                <Star className="w-3 h-3 fill-current" />
                                                MOTM
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-white/60 text-sm mb-3">{position}</div>

                                    {/* Rating Badges */}
                                    <div className="flex items-center gap-3">
                                        {/* Average Rating - Primary */}
                                        {displayRating > 0 && (
                                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-white/10 to-white/5 border border-white/10">
                                                <Star className="w-5 h-5 text-yellow-500 fill-current" />
                                                <div>
                                                    <div className="text-xs text-white/60">
                                                        {hasAverageRating ? 'Average Rating' : 'Match Rating'}
                                                    </div>
                                                    <div className={`text-2xl font-bold bg-gradient-to-r ${getRatingColor(displayRating)} bg-clip-text text-transparent`}>
                                                        {displayRating.toFixed(1)}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Current Match Rating - Secondary (only if different from average) */}
                                        {hasAverageRating && rating > 0 && rating !== averageRating && (
                                            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                                                <div>
                                                    <div className="text-xs text-white/60">This Match</div>
                                                    <div className={`text-lg font-bold bg-gradient-to-r ${getRatingColor(rating)} bg-clip-text text-transparent`}>
                                                        {rating.toFixed(1)}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>                                </div>
                            </div>
                        </div>

                        {/* Stats Content */}
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {/* Key Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <StatCard
                                    icon={<Target className="w-5 h-5" />}
                                    label="Goals"
                                    value={playerStats.goals}
                                    color="text-green-500"
                                />
                                <StatCard
                                    icon={<TrendingUp className="w-5 h-5" />}
                                    label="Assists"
                                    value={playerStats.assists}
                                    color="text-blue-500"
                                />
                                <StatCard
                                    icon={<Activity className="w-5 h-5" />}
                                    label="Shots"
                                    value={playerStats.shots}
                                    color="text-purple-500"
                                />
                                <StatCard
                                    icon={<Shield className="w-5 h-5" />}
                                    label="Tackles"
                                    value={playerStats.tackles}
                                    color="text-orange-500"
                                />
                            </div>

                            {/* Detailed Stats */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Performance Details</h3>

                                <StatBar
                                    label="Pass Accuracy"
                                    value={playerStats.passAccuracy}
                                    max={100}
                                    suffix="%"
                                    color={teamColor}
                                />

                                <StatRow label="Passes Completed" value={playerStats.passes} />
                                <StatRow label="Shots on Target" value={playerStats.shotsOnTarget} />
                                <StatRow label="Interceptions" value={playerStats.interceptions} />
                                <StatRow label="Fouls Committed" value={playerStats.fouls} />
                                <StatRow label="Minutes Played" value={playerStats.minutesPlayed} suffix="'" />

                                {/* Cards */}
                                {(playerStats.yellowCards > 0 || playerStats.redCards > 0) && (
                                    <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                                        {playerStats.yellowCards > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-6 bg-yellow-500 rounded-sm"></div>
                                                <span className="text-sm">×{playerStats.yellowCards}</span>
                                            </div>
                                        )}
                                        {playerStats.redCards > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-6 bg-red-500 rounded-sm"></div>
                                                <span className="text-sm">×{playerStats.redCards}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-white/10 bg-white/5">
                            <button
                                onClick={onClose}
                                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 font-semibold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Stat Card Component
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className={`${color} mb-2`}>{icon}</div>
            <div className="text-2xl font-bold mb-1">{value}</div>
            <div className="text-xs text-white/60">{label}</div>
        </div>
    );
}

// Stat Row Component
function StatRow({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
    return (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm text-white/80">{label}</span>
            <span className="font-semibold">{value}{suffix}</span>
        </div>
    );
}

// Stat Bar Component
function StatBar({ label, value, max, suffix = '', color }: { label: string; value: number; max: number; suffix?: string; color: string }) {
    const percentage = (value / max) * 100;

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/80">{label}</span>
                <span className="font-semibold">{value}{suffix}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                />
            </div>
        </div>
    );
}
