'use client';

import { motion } from 'framer-motion';
import { Activity, Heart, Trophy, Users, Star, Calendar, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export interface ActivityItem {
    id: string;
    type: 'match_watched' | 'team_followed' | 'player_followed' | 'favorite_added' | 'prediction_made' | 'competition_followed';
    title: string;
    subtitle?: string;
    time: string;
    icon?: string;
    color?: 'blue' | 'orange' | 'yellow' | 'green' | 'red' | 'purple';
    entityType?: 'match' | 'team' | 'player' | 'competition';
    entityId?: string;
    metadata?: any;
}

interface ActivityFeedProps {
    activities: ActivityItem[];
    title?: string;
    showHeader?: boolean;
    maxItems?: number;
    onItemClick?: (activity: ActivityItem) => void;
}

export function ActivityFeed({
    activities,
    title = 'Recent Activity',
    showHeader = true,
    maxItems,
    onItemClick,
}: ActivityFeedProps) {
    const displayActivities = maxItems ? activities.slice(0, maxItems) : activities;

    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
            {showHeader && (
                <h2 className="text-sm font-black uppercase tracking-widest text-white/60 mb-4 flex items-center gap-2">
                    <Activity size={16} className="text-primary" />
                    {title}
                </h2>
            )}
            <div className="space-y-3">
                {displayActivities.length === 0 ? (
                    <EmptyState />
                ) : (
                    displayActivities.map((activity, idx) => (
                        <ActivityCard
                            key={activity.id}
                            activity={activity}
                            delay={idx * 0.05}
                            onClick={onItemClick}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function ActivityCard({
    activity,
    delay,
    onClick,
}: {
    activity: ActivityItem;
    delay: number;
    onClick?: (activity: ActivityItem) => void;
}) {
    const colorClasses = {
        blue: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
        orange: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
        yellow: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
        green: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
        red: 'bg-red-500/20 text-red-500 border-red-500/30',
        purple: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    };

    const getIcon = () => {
        if (activity.icon) return activity.icon;

        switch (activity.type) {
            case 'match_watched':
                return '⚽';
            case 'team_followed':
                return '👥';
            case 'player_followed':
                return '⭐';
            case 'favorite_added':
                return '❤️';
            case 'prediction_made':
                return '🎯';
            case 'competition_followed':
                return '🏆';
            default:
                return '📌';
        }
    };

    const handleClick = () => {
        if (onClick) {
            onClick(activity);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay }}
            onClick={handleClick}
            className={`flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all ${onClick ? 'cursor-pointer' : ''
                }`}
        >
            <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border ${activity.color ? colorClasses[activity.color] : 'bg-white/10 text-white border-white/20'
                    }`}
            >
                {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{activity.title}</p>
                {activity.subtitle && (
                    <p className="text-xs text-white/60 mt-0.5 truncate">{activity.subtitle}</p>
                )}
                <div className="flex items-center gap-1 mt-1 text-xs text-white/40">
                    <Clock size={10} />
                    {activity.time}
                </div>
            </div>
            {onClick && (
                <ArrowRight size={16} className="text-white/40 flex-shrink-0" />
            )}
        </motion.div>
    );
}

function EmptyState() {
    return (
        <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Activity size={32} className="text-white/20" />
            </div>
            <p className="text-sm font-bold text-white/60 mb-1">No activity yet</p>
            <p className="text-xs text-white/40">
                Your recent activity will appear here
            </p>
        </div>
    );
}

// Utility function to format relative time
export function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
}

// Activity type helper
export function getActivityColor(type: ActivityItem['type']): ActivityItem['color'] {
    const colorMap: Record<ActivityItem['type'], ActivityItem['color']> = {
        match_watched: 'blue',
        team_followed: 'orange',
        player_followed: 'yellow',
        favorite_added: 'red',
        prediction_made: 'blue',
        competition_followed: 'purple',
    };
    return colorMap[type] || 'blue';
}

