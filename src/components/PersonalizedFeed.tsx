'use client';

import { motion } from 'framer-motion';
import { TrendingUp, ArrowRight, Calendar, Users, Trophy, Star } from 'lucide-react';
import Link from 'next/link';

export interface FeedItem {
    id: string;
    type: 'team_news' | 'match_highlight' | 'player_milestone' | 'competition_update' | 'match_reminder';
    title: string;
    description: string;
    image?: string;
    time: string;
    category: string;
    entityType?: 'team' | 'player' | 'match' | 'competition';
    entityId?: string;
    actionUrl?: string;
}

interface PersonalizedFeedProps {
    items: FeedItem[];
    title?: string;
    showHeader?: boolean;
    maxItems?: number;
    onItemClick?: (item: FeedItem) => void;
}

export function PersonalizedFeed({
    items,
    title = 'For You',
    showHeader = true,
    maxItems,
    onItemClick,
}: PersonalizedFeedProps) {
    const displayItems = maxItems ? items.slice(0, maxItems) : items;

    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
            {showHeader && (
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-black uppercase tracking-widest text-white/60 flex items-center gap-2">
                        <TrendingUp size={16} className="text-primary" />
                        {title}
                    </h2>
                    <button className="text-xs font-bold text-primary hover:underline">
                        View All
                    </button>
                </div>
            )}
            <div className="space-y-4">
                {displayItems.length === 0 ? (
                    <EmptyState />
                ) : (
                    displayItems.map((item, idx) => (
                        <FeedCard
                            key={item.id}
                            item={item}
                            delay={idx * 0.05}
                            onClick={onItemClick}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function FeedCard({
    item,
    delay,
    onClick,
}: {
    item: FeedItem;
    delay: number;
    onClick?: (item: FeedItem) => void;
}) {
    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            'Team News': 'bg-blue-500/20 border-blue-500/30 text-blue-500',
            'Highlights': 'bg-orange-500/20 border-orange-500/30 text-orange-500',
            'Milestone': 'bg-yellow-500/20 border-yellow-500/30 text-yellow-500',
            'Competition': 'bg-purple-500/20 border-purple-500/30 text-purple-500',
            'Reminder': 'bg-blue-500/20 border-blue-500/30 text-blue-500',
        };
        return colors[category] || 'bg-white/10 border-white/20 text-white/60';
    };

    const handleClick = () => {
        if (onClick) {
            onClick(item);
        } else if (item.actionUrl) {
            window.location.href = item.actionUrl;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay }}
            onClick={handleClick}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all cursor-pointer group"
        >
            <div className="flex items-start gap-4">
                {item.image && (
                    <div className="text-4xl flex-shrink-0">{item.image}</div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                            className={`px-2 py-0.5 border rounded text-[10px] font-black uppercase ${getCategoryColor(
                                item.category
                            )}`}
                        >
                            {item.category}
                        </span>
                        <span className="text-xs text-white/40">{item.time}</span>
                    </div>
                    <h3 className="text-sm font-black text-white mb-1 group-hover:text-primary transition-colors">
                        {item.title}
                    </h3>
                    <p className="text-xs text-white/60 line-clamp-2">{item.description}</p>
                </div>
                <ArrowRight
                    size={16}
                    className="text-white/40 group-hover:text-primary transition-colors flex-shrink-0"
                />
            </div>
        </motion.div>
    );
}

function EmptyState() {
    return (
        <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp size={32} className="text-white/20" />
            </div>
            <p className="text-sm font-bold text-white/60 mb-1">No updates yet</p>
            <p className="text-xs text-white/40 mb-4">
                Follow teams, players, and competitions to see personalized updates
            </p>
            <Link
                href="/search"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-xl hover:scale-105 transition-all text-sm font-black uppercase tracking-widest"
            >
                Explore
                <ArrowRight size={14} />
            </Link>
        </div>
    );
}

// Feed item type helpers
export function createTeamNewsFeedItem(
    id: string,
    teamName: string,
    newsTitle: string,
    description: string,
    teamLogo: string,
    time: string
): FeedItem {
    return {
        id,
        type: 'team_news',
        title: newsTitle,
        description,
        image: teamLogo,
        time,
        category: 'Team News',
        entityType: 'team',
        entityId: id,
    };
}

export function createMatchHighlightFeedItem(
    id: string,
    matchTitle: string,
    description: string,
    time: string
): FeedItem {
    return {
        id,
        type: 'match_highlight',
        title: matchTitle,
        description,
        image: '⚽',
        time,
        category: 'Highlights',
        entityType: 'match',
        entityId: id,
    };
}

export function createPlayerMilestoneFeedItem(
    id: string,
    playerName: string,
    milestone: string,
    description: string,
    time: string
): FeedItem {
    return {
        id,
        type: 'player_milestone',
        title: `${playerName} ${milestone}`,
        description,
        image: '🏆',
        time,
        category: 'Milestone',
        entityType: 'player',
        entityId: id,
    };
}

export function createMatchReminderFeedItem(
    id: string,
    homeTeam: string,
    awayTeam: string,
    matchTime: string,
    venue: string
): FeedItem {
    return {
        id,
        type: 'match_reminder',
        title: `${homeTeam} vs ${awayTeam}`,
        description: `${matchTime} • ${venue}`,
        image: '📅',
        time: 'Upcoming',
        category: 'Reminder',
        entityType: 'match',
        entityId: id,
    };
}

