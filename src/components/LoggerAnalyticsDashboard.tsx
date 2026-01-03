/**
 * Logger Analytics Dashboard
 * Displays performance metrics, activity patterns, and insights
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Activity, TrendingUp, Award, Clock, Calendar,
    BarChart3, PieChart, Target, Zap, Users
} from 'lucide-react';

interface LoggerAnalytics {
    logger: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
    metrics: {
        totalEvents: number;
        recentEvents: number;
        matchesLogged: number;
        recentMatches: number;
        eventsPerMatch: number;
        eventsPerDay: number;
        last7DaysEvents: number;
        qualityScore: number;
    };
    breakdown: {
        eventTypes: Record<string, number>;
        dayActivity: Record<string, number>;
        hourActivity: Record<string, number>;
    };
    insights: {
        mostActiveMatch: { matchId: string; events: number } | null;
        mostCommonEvent: string | null;
        peakDay: string | null;
        peakHour: string | null;
    };
    timeline: {
        firstEvent: string | null;
        lastEvent: string | null;
        daysSinceFirst: number;
    };
}

interface LoggerAnalyticsDashboardProps {
    loggerId?: string;
    timeframe?: number;
}

export function LoggerAnalyticsDashboard({
    loggerId,
    timeframe = 30
}: LoggerAnalyticsDashboardProps) {
    const [analytics, setAnalytics] = useState<LoggerAnalytics | null>(null);
    const [allLoggers, setAllLoggers] = useState<LoggerAnalytics[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'single' | 'all'>('single');

    useEffect(() => {
        fetchAnalytics();
    }, [loggerId, timeframe]);

    const fetchAnalytics = async () => {
        setIsLoading(true);
        try {
            const url = loggerId
                ? `/api/analytics/loggers?loggerId=${loggerId}&timeframe=${timeframe}`
                : `/api/analytics/loggers?timeframe=${timeframe}`;

            const response = await fetch(url);
            const data = await response.json();

            if (loggerId) {
                setAnalytics(data);
                setViewMode('single');
            } else {
                setAllLoggers(data.loggers);
                setViewMode('all');
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
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

    if (viewMode === 'single' && analytics) {
        return <SingleLoggerView analytics={analytics} />;
    }

    if (viewMode === 'all' && allLoggers.length > 0) {
        return <AllLoggersView loggers={allLoggers} />;
    }

    return (
        <div className="text-center p-12 text-white/40">
            No analytics data available
        </div>
    );
}

function SingleLoggerView({ analytics }: { analytics: LoggerAnalytics }) {
    const { logger, metrics, breakdown, insights, timeline } = analytics;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-display italic uppercase">{logger.name}</h2>
                        <p className="text-sm text-white/60">{logger.email}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-display text-primary">{metrics.qualityScore}</div>
                        <p className="text-xs font-black uppercase tracking-widest text-white/40">Quality Score</p>
                    </div>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                    icon={<Activity />}
                    label="Total Events"
                    value={metrics.totalEvents.toLocaleString()}
                    color="text-blue-500"
                />
                <MetricCard
                    icon={<Target />}
                    label="Matches Logged"
                    value={metrics.matchesLogged.toLocaleString()}
                    color="text-green-500"
                />
                <MetricCard
                    icon={<TrendingUp />}
                    label="Events/Match"
                    value={metrics.eventsPerMatch.toString()}
                    color="text-orange-500"
                />
                <MetricCard
                    icon={<Zap />}
                    label="Last 7 Days"
                    value={metrics.last7DaysEvents.toLocaleString()}
                    color="text-purple-500"
                />
            </div>

            {/* Event Types Distribution */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h3 className="text-lg font-display italic uppercase mb-4 flex items-center gap-2">
                    <PieChart size={20} className="text-primary" />
                    Event Distribution
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(breakdown.eventTypes)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 6)
                        .map(([type, count]) => (
                            <div key={type} className="bg-white/5 rounded-xl p-3">
                                <div className="text-2xl font-display text-primary">{count}</div>
                                <div className="text-xs text-white/60">{type}</div>
                            </div>
                        ))}
                </div>
            </div>

            {/* Activity Patterns */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* Day Activity */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                    <h3 className="text-lg font-display italic uppercase mb-4 flex items-center gap-2">
                        <Calendar size={20} className="text-primary" />
                        Activity by Day
                    </h3>
                    <div className="space-y-2">
                        {Object.entries(breakdown.dayActivity)
                            .sort(([, a], [, b]) => b - a)
                            .map(([day, count]) => (
                                <div key={day} className="flex items-center gap-2">
                                    <div className="text-xs w-20 text-white/60">{day}</div>
                                    <div className="flex-1 bg-white/5 rounded-full h-6 overflow-hidden">
                                        <div
                                            className="bg-primary h-full rounded-full"
                                            style={{
                                                width: `${(count / Math.max(...Object.values(breakdown.dayActivity))) * 100}%`
                                            }}
                                        />
                                    </div>
                                    <div className="text-xs w-12 text-right text-white/80">{count}</div>
                                </div>
                            ))}
                    </div>
                </div>

                {/* Insights */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                    <h3 className="text-lg font-display italic uppercase mb-4 flex items-center gap-2">
                        <Award size={20} className="text-primary" />
                        Insights
                    </h3>
                    <div className="space-y-4">
                        <InsightItem
                            label="Most Common Event"
                            value={insights.mostCommonEvent || 'N/A'}
                        />
                        <InsightItem
                            label="Peak Day"
                            value={insights.peakDay || 'N/A'}
                        />
                        <InsightItem
                            label="Peak Hour"
                            value={insights.peakHour ? `${insights.peakHour}:00` : 'N/A'}
                        />
                        <InsightItem
                            label="Avg Events/Day"
                            value={metrics.eventsPerDay.toFixed(1)}
                        />
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h3 className="text-lg font-display italic uppercase mb-4 flex items-center gap-2">
                    <Clock size={20} className="text-primary" />
                    Timeline
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                    <div>
                        <div className="text-xs text-white/40 mb-1">First Event</div>
                        <div className="text-sm text-white/80">
                            {timeline.firstEvent
                                ? new Date(timeline.firstEvent).toLocaleDateString()
                                : 'N/A'}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-white/40 mb-1">Last Event</div>
                        <div className="text-sm text-white/80">
                            {timeline.lastEvent
                                ? new Date(timeline.lastEvent).toLocaleDateString()
                                : 'N/A'}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-white/40 mb-1">Days Active</div>
                        <div className="text-sm text-white/80">{timeline.daysSinceFirst}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AllLoggersView({ loggers }: { loggers: LoggerAnalytics[] }) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-display italic uppercase">Logger Leaderboard</h2>

            <div className="grid gap-4">
                {loggers.map((analytics, index) => (
                    <motion.div
                        key={analytics.logger.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="text-3xl font-display text-primary w-12 text-center">
                                #{index + 1}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold">{analytics.logger.name}</h3>
                                <p className="text-xs text-white/60">{analytics.logger.email}</p>
                            </div>
                            <div className="grid grid-cols-4 gap-4 text-center">
                                <div>
                                    <div className="text-lg font-display text-primary">
                                        {analytics.metrics.totalEvents}
                                    </div>
                                    <div className="text-[8px] text-white/40 uppercase">Events</div>
                                </div>
                                <div>
                                    <div className="text-lg font-display text-green-500">
                                        {analytics.metrics.matchesLogged}
                                    </div>
                                    <div className="text-[8px] text-white/40 uppercase">Matches</div>
                                </div>
                                <div>
                                    <div className="text-lg font-display text-orange-500">
                                        {analytics.metrics.eventsPerMatch.toFixed(1)}
                                    </div>
                                    <div className="text-[8px] text-white/40 uppercase">Avg/Match</div>
                                </div>
                                <div>
                                    <div className="text-lg font-display text-purple-500">
                                        {analytics.metrics.qualityScore}
                                    </div>
                                    <div className="text-[8px] text-white/40 uppercase">Quality</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function MetricCard({ icon, label, value, color }: any) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className={`${color} mb-2`}>{icon}</div>
            <div className="text-2xl font-display">{value}</div>
            <div className="text-xs text-white/60">{label}</div>
        </div>
    );
}

function InsightItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-xs text-white/60">{label}</span>
            <span className="text-sm font-bold text-primary">{value}</span>
        </div>
    );
}
