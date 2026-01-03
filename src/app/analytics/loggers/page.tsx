/**
 * Logger Analytics Page
 * View performance metrics and insights for loggers
 */

'use client';

import { useState } from 'react';
import { LoggerAnalyticsDashboard } from '@/components/LoggerAnalyticsDashboard';
import { BarChart3, Users, TrendingUp } from 'lucide-react';

export default function LoggerAnalyticsPage() {
    const [selectedLogger, setSelectedLogger] = useState<string | undefined>(undefined);
    const [timeframe, setTimeframe] = useState(30);

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <BarChart3 size={32} className="text-primary" />
                        <h1 className="text-4xl font-display italic uppercase">Logger Analytics</h1>
                    </div>
                    <p className="text-white/60">
                        Track performance, activity patterns, and quality metrics
                    </p>
                </div>

                {/* Controls */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Timeframe Selector */}
                        <div>
                            <label className="text-xs font-black uppercase tracking-widest text-white/40 mb-2 block">
                                Timeframe
                            </label>
                            <div className="flex gap-2">
                                {[7, 30, 90, 365].map((days) => (
                                    <button
                                        key={days}
                                        onClick={() => setTimeframe(days)}
                                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${timeframe === days
                                                ? 'bg-primary text-black'
                                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                            }`}
                                    >
                                        {days}d
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* View Selector */}
                        <div className="ml-auto">
                            <label className="text-xs font-black uppercase tracking-widest text-white/40 mb-2 block">
                                View
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedLogger(undefined)}
                                    className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${!selectedLogger
                                            ? 'bg-primary text-black'
                                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    <Users size={16} />
                                    All Loggers
                                </button>
                                <button
                                    onClick={() => setSelectedLogger('current')}
                                    className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${selectedLogger
                                            ? 'bg-primary text-black'
                                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    <TrendingUp size={16} />
                                    My Stats
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dashboard */}
                <LoggerAnalyticsDashboard
                    loggerId={selectedLogger}
                    timeframe={timeframe}
                />
            </div>
        </div>
    );
}
