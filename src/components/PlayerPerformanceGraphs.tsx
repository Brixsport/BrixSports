/**
 * Player Performance Graphs
 * Visual analytics for player performance over time
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, Target, Award } from 'lucide-react';

interface PerformanceData {
    match: string;
    date: string;
    points?: number;
    goals?: number;
    assists?: number;
    fouls?: number;
    // BACKLOG-315: real per-match rating from playerRatings, null when the
    // match genuinely hasn't been rated yet -- never a fabricated number.
    rating: number | null;
    minutesPlayed: number;
}

interface PlayerPerformanceGraphsProps {
    playerId: string;
    sport: 'Football' | 'Basketball';
    timeframe?: number; // days
}

export function PlayerPerformanceGraphs({
    playerId,
    sport,
    timeframe = 30
}: PlayerPerformanceGraphsProps) {
    const [data, setData] = useState<PerformanceData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMetric, setSelectedMetric] = useState<'points' | 'goals' | 'assists' | 'rating'>('rating');

    useEffect(() => {
        fetchPerformanceData();
    }, [playerId, timeframe]);

    const fetchPerformanceData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(
                `/api/players/${playerId}/performance?timeframe=${timeframe}`
            );
            const performanceData = await response.json();
            setData(performanceData);
        } catch (error) {
            console.error('Error fetching performance data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="text-center p-12 text-white/40">
                No performance data available
            </div>
        );
    }

    // Calculate statistics. BACKLOG-315: rating can be null (not yet rated) --
    // average and trend only consider matches that actually have a real rating.
    const ratedMatches = data.filter((d): d is PerformanceData & { rating: number } => d.rating != null);
    const avgRating = ratedMatches.length > 0
        ? ratedMatches.reduce((sum, d) => sum + d.rating, 0) / ratedMatches.length
        : null;
    const totalPoints = data.reduce((sum, d) => sum + (d.points || d.goals || 0), 0);
    const totalAssists = data.reduce((sum, d) => sum + (d.assists || 0), 0);
    const trend = ratedMatches.length >= 2
        ? ratedMatches[ratedMatches.length - 1].rating - ratedMatches[0].rating
        : 0;

    const maxValue = Math.max(...data.map(d => {
        switch (selectedMetric) {
            case 'points': return d.points || 0;
            case 'goals': return d.goals || 0;
            case 'assists': return d.assists || 0;
            case 'rating': return d.rating ?? 0;
            default: return 0;
        }
    }));

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={<Award />}
                    label="Avg Rating"
                    value={avgRating != null ? avgRating.toFixed(1) : 'N/A'}
                    color="text-primary"
                />
                <StatCard
                    icon={<Target />}
                    label={sport === 'Basketball' ? 'Total Points' : 'Total Goals'}
                    value={totalPoints.toString()}
                    color="text-green-500"
                />
                <StatCard
                    icon={<Activity />}
                    label="Total Assists"
                    value={totalAssists.toString()}
                    color="text-blue-500"
                />
                <StatCard
                    icon={trend >= 0 ? <TrendingUp /> : <TrendingDown />}
                    label="Trend"
                    value={trend >= 0 ? `+${trend.toFixed(1)}` : trend.toFixed(1)}
                    color={trend >= 0 ? 'text-green-500' : 'text-red-500'}
                />
            </div>

            {/* Metric Selector */}
            <div className="flex gap-2 flex-wrap">
                {['rating', sport === 'Basketball' ? 'points' : 'goals', 'assists'].map((metric) => (
                    <button
                        key={metric}
                        onClick={() => setSelectedMetric(metric as any)}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedMetric === metric
                                ? 'bg-primary text-black'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        {metric.charAt(0).toUpperCase() + metric.slice(1)}
                    </button>
                ))}
            </div>

            {/* Line Graph */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h3 className="text-lg font-display italic uppercase mb-6">
                    Performance Over Time
                </h3>

                <div className="relative h-64">
                    {/* Y-axis labels */}
                    <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-white/40 pr-2">
                        <span>{maxValue.toFixed(0)}</span>
                        <span>{(maxValue * 0.75).toFixed(0)}</span>
                        <span>{(maxValue * 0.5).toFixed(0)}</span>
                        <span>{(maxValue * 0.25).toFixed(0)}</span>
                        <span>0</span>
                    </div>

                    {/* Graph area */}
                    <div className="ml-8 h-full relative">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between">
                            {[0, 1, 2, 3, 4].map(i => (
                                <div key={i} className="border-t border-white/5"></div>
                            ))}
                        </div>

                        {/* Data points and line */}
                        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                            {/* Line */}
                            <polyline
                                points={data.map((d, i) => {
                                    const x = (i / (data.length - 1)) * 100;
                                    const value = (() => {
                                        switch (selectedMetric) {
                                            case 'points': return d.points || 0;
                                            case 'goals': return d.goals || 0;
                                            case 'assists': return d.assists || 0;
                                            case 'rating': return d.rating ?? 0;
                                            default: return 0;
                                        }
                                    })();
                                    const y = 100 - (value / maxValue) * 100;
                                    return `${x},${y}`;
                                }).join(' ')}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-primary"
                                vectorEffect="non-scaling-stroke"
                            />

                            {/* Points */}
                            {data.map((d, i) => {
                                const x = (i / (data.length - 1)) * 100;
                                const value = (() => {
                                    switch (selectedMetric) {
                                        case 'points': return d.points || 0;
                                        case 'goals': return d.goals || 0;
                                        case 'assists': return d.assists || 0;
                                        case 'rating': return d.rating ?? 0;
                                        default: return 0;
                                    }
                                })();
                                const y = 100 - (value / maxValue) * 100;
                                const isUnratedPoint = selectedMetric === 'rating' && d.rating == null;

                                return (
                                    <motion.circle
                                        key={i}
                                        cx={`${x}%`}
                                        cy={`${y}%`}
                                        r="4"
                                        fill="currentColor"
                                        className={isUnratedPoint ? 'text-white/20 cursor-pointer' : 'text-primary cursor-pointer'}
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        whileHover={{ scale: 1.5 }}
                                    >
                                        <title>{`${d.match}: ${isUnratedPoint ? 'N/A' : value.toFixed(1)}`}</title>
                                    </motion.circle>
                                );
                            })}
                        </svg>

                        {/* X-axis labels */}
                        <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-white/40">
                            {data.map((d, i) => {
                                if (i % Math.ceil(data.length / 5) === 0 || i === data.length - 1) {
                                    return (
                                        <span key={i} className="truncate max-w-[60px]">
                                            {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bar Chart - Recent Matches */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h3 className="text-lg font-display italic uppercase mb-6">
                    Recent Matches
                </h3>

                <div className="space-y-3">
                    {data.slice(-5).reverse().map((d, i) => {
                        const value = (() => {
                            switch (selectedMetric) {
                                case 'points': return d.points || 0;
                                case 'goals': return d.goals || 0;
                                case 'assists': return d.assists || 0;
                                case 'rating': return d.rating ?? 0;
                                default: return 0;
                            }
                        })();
                        const isUnrated = selectedMetric === 'rating' && d.rating == null;
                        const percentage = (value / maxValue) * 100;

                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="space-y-1"
                            >
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-white/80 truncate max-w-[200px]">{d.match}</span>
                                    <span className="text-primary font-bold">{isUnrated ? 'N/A' : value.toFixed(1)}</span>
                                </div>
                                <div className="h-6 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ duration: 0.5, delay: i * 0.1 }}
                                    />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color }: any) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className={`${color} mb-2`}>{icon}</div>
            <div className="text-2xl font-display">{value}</div>
            <div className="text-xs text-white/60">{label}</div>
        </div>
    );
}
