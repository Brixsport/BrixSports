'use client';

import { motion } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Player {
    id: string;
    name: string;
    position: string;
    team: string;
    rating: number;
    stats?: {
        pace?: number;
        shooting?: number;
        passing?: number;
        dribbling?: number;
        defending?: number;
        physical?: number;
    };
}

interface PlayerComparisonProps {
    player1: Player;
    player2: Player;
    onClose: () => void;
}

export default function PlayerComparisonModal({ player1, player2, onClose }: PlayerComparisonProps) {
    const stats = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'];

    const getStatValue = (player: Player, stat: string): number => {
        return player.stats?.[stat as keyof typeof player.stats] || player.rating;
    };

    const compareStats = (stat: string) => {
        const value1 = getStatValue(player1, stat);
        const value2 = getStatValue(player2, stat);

        if (value1 > value2) return 'player1';
        if (value2 > value1) return 'player2';
        return 'equal';
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">Player Comparison</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Players */}
                <div className="p-6">
                    <div className="grid grid-cols-3 gap-6 mb-8">
                        {/* Player 1 */}
                        <div className="text-center">
                            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-3xl font-bold mb-4">
                                {player1.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <h3 className="font-bold text-white text-lg mb-1">{player1.name}</h3>
                            <p className="text-sm text-slate-400 mb-2">{player1.team}</p>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/20">
                                <span className="text-xs font-bold">{player1.position}</span>
                                <span className="text-lg font-bold">{player1.rating}</span>
                            </div>
                        </div>

                        {/* VS */}
                        <div className="flex items-center justify-center">
                            <div className="text-4xl font-black text-slate-600">VS</div>
                        </div>

                        {/* Player 2 */}
                        <div className="text-center">
                            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold mb-4">
                                {player2.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <h3 className="font-bold text-white text-lg mb-1">{player2.name}</h3>
                            <p className="text-sm text-slate-400 mb-2">{player2.team}</p>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/20">
                                <span className="text-xs font-bold">{player2.position}</span>
                                <span className="text-lg font-bold">{player2.rating}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats Comparison */}
                    <div className="space-y-4">
                        {stats.map((stat) => {
                            const value1 = getStatValue(player1, stat);
                            const value2 = getStatValue(player2, stat);
                            const winner = compareStats(stat);

                            return (
                                <div key={stat} className="bg-slate-800/50 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold text-slate-300 capitalize">
                                            {stat}
                                        </span>
                                        {winner !== 'equal' && (
                                            <div className="flex items-center gap-1 text-xs">
                                                {winner === 'player1' ? (
                                                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                                                ) : (
                                                    <TrendingUp className="w-4 h-4 text-purple-400" />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 items-center">
                                        {/* Player 1 Bar */}
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-2 mb-1">
                                                <span className={`text-lg font-bold ${winner === 'player1' ? 'text-cyan-400' : 'text-slate-400'}`}>
                                                    {value1}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${winner === 'player1' ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-slate-600'}`}
                                                    style={{ width: `${value1}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Difference */}
                                        <div className="text-center">
                                            {winner === 'equal' ? (
                                                <Minus className="w-5 h-5 text-slate-500 mx-auto" />
                                            ) : (
                                                <span className={`text-sm font-bold ${winner === 'player1' ? 'text-cyan-400' : 'text-purple-400'}`}>
                                                    {Math.abs(value1 - value2)}
                                                </span>
                                            )}
                                        </div>

                                        {/* Player 2 Bar */}
                                        <div className="text-left">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-lg font-bold ${winner === 'player2' ? 'text-purple-400' : 'text-slate-400'}`}>
                                                    {value2}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${winner === 'player2' ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-slate-600'}`}
                                                    style={{ width: `${value2}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Overall Winner */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl text-center">
                        <p className="text-sm text-slate-400 mb-2">Overall Better Player</p>
                        <p className="text-2xl font-bold text-white">
                            {player1.rating > player2.rating
                                ? player1.name
                                : player2.rating > player1.rating
                                    ? player2.name
                                    : 'Equal Match'}
                        </p>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
