'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Newspaper,
    TrendingUp,
    Clock,
    Eye,
    Heart,
    Share2,
    Filter,
    Search,
    Zap,
    Star
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface NewsArticle {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    imageUrl: string | null;
    category: string;
    tags: string | null;
    isBreaking: boolean;
    isFeatured: boolean;
    authorName: string;
    views: number;
    likes: number;
    publishedAt: string;
    createdAt: string;
}

const CATEGORIES = [
    { id: 'all', label: 'All News', icon: Newspaper },
    { id: 'breaking', label: 'Breaking', icon: Zap },
    { id: 'transfer', label: 'Transfers', icon: TrendingUp },
    { id: 'match', label: 'Matches', icon: Star },
    { id: 'injury', label: 'Injuries', icon: Heart },
    { id: 'general', label: 'General', icon: Newspaper },
];

export default function NewsPage() {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [featuredNews, setFeaturedNews] = useState<NewsArticle[]>([]);

    useEffect(() => {
        fetchNews();
    }, [selectedCategory, searchQuery]);

    const fetchNews = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedCategory === 'breaking') {
                params.append('breaking', 'true');
            } else if (selectedCategory !== 'all') {
                params.append('category', selectedCategory);
            }
            if (searchQuery) {
                params.append('search', searchQuery);
            }
            params.append('limit', '20');

            const response = await fetch(`/api/news?${params.toString()}`);
            const data = await response.json();
            setNews(data.news || []);

            // Fetch featured news separately
            if (selectedCategory === 'all' && !searchQuery) {
                const featuredResponse = await fetch('/api/news?featured=true&limit=3');
                const featuredData = await featuredResponse.json();
                setFeaturedNews(featuredData.news || []);
            }
        } catch (error) {
            console.error('Error fetching news:', error);
        } finally {
            setLoading(false);
        }
    };

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            breaking: 'from-red-500 to-orange-500',
            transfer: 'from-blue-500 to-cyan-500',
            match: 'from-blue-500 to-blue-500',
            injury: 'from-yellow-500 to-amber-500',
            general: 'from-purple-500 to-pink-500',
        };
        return colors[category] || 'from-gray-500 to-slate-500';
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white pt-20 pb-12">
            <div className="max-w-7xl mx-auto px-4">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-4xl font-display font-bold text-white mb-2">
                        LATEST NEWS
                    </h1>
                    <p className="text-white/60 text-lg">
                        Stay updated with the latest sports news and transfers
                    </p>
                </motion.div>

                {/* Search and Filter */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-8 space-y-6"
                >
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <input
                            type="text"
                            placeholder="Search news..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-primary/50 transition-all font-medium"
                        />
                    </div>

                    {/* Category Filters */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {CATEGORIES.map((category) => {
                            const Icon = category.icon;
                            const isActive = selectedCategory === category.id;
                            return (
                                <button
                                    key={category.id}
                                    onClick={() => setSelectedCategory(category.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-all ${isActive
                                        ? 'bg-primary text-black'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {category.label}
                                </button>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Featured News */}
                {featuredNews.length > 0 && selectedCategory === 'all' && !searchQuery && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mb-12"
                    >
                        <h2 className="text-xl font-bold uppercase tracking-wider text-white/80 mb-6 flex items-center gap-2">
                            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            Featured Stories
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {featuredNews.map((article, index) => (
                                <FeaturedNewsCard key={article.id} article={article} index={index} />
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* News Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="animate-pulse">
                                <div className="bg-white/5 rounded-xl h-80" />
                            </div>
                        ))}
                    </div>
                ) : news.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-20"
                    >
                        <Newspaper className="w-16 h-16 text-white/10 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-white/40 mb-2">No news found</h3>
                        <p className="text-white/20">Try adjusting your filters or search query</p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence mode="popLayout">
                            {news.map((article, index) => (
                                <NewsCard key={article.id} article={article} index={index} getCategoryColor={getCategoryColor} formatDate={formatDate} />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}

function FeaturedNewsCard({ article, index }: { article: NewsArticle; index: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
        >
            <Link href={`/news/${article.slug}`}>
                <div className="group relative h-80 rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-primary/50 transition-colors">
                    {/* Image */}
                    {article.imageUrl ? (
                        <Image
                            src={article.imageUrl}
                            alt={article.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-[#0a0a0a]" />
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />

                    {/* Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                        {article.isBreaking && (
                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider mb-3">
                                <Zap className="w-3 h-3" />
                                BREAKING
                            </div>
                        )}
                        <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-primary transition-colors font-display tracking-wide">
                            {article.title}
                        </h3>
                        <p className="text-white/60 text-sm line-clamp-2 mb-3">
                            {article.excerpt}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-white/40 font-bold uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(article.publishedAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {article.views}
                            </span>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

function NewsCard({ article, index, getCategoryColor, formatDate }: {
    article: NewsArticle;
    index: number;
    getCategoryColor: (category: string) => string;
    formatDate: (date: string) => string;
}) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: index * 0.05 }}
        >
            <Link href={`/news/${article.slug}`}>
                <div className="group relative bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden hover:border-primary/50 transition-all duration-300">
                    {/* Image */}
                    <div className="relative h-48 overflow-hidden bg-white/5">
                        {article.imageUrl ? (
                            <Image
                                src={article.imageUrl}
                                alt={article.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-white/10">
                                <Newspaper size={40} />
                            </div>
                        )}

                        {/* Category Badge */}
                        <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/80 backdrop-blur-md text-white/80 text-[10px] font-bold uppercase tracking-wider border border-white/10">
                            {article.category}
                        </div>

                        {article.isBreaking && (
                            <div className="absolute top-3 right-3 px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                <Zap className="w-3 h-3" />
                                BREAKING
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                        <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-primary transition-colors font-display tracking-wide">
                            {article.title}
                        </h3>
                        <p className="text-white/50 text-sm line-clamp-3 mb-4">
                            {article.excerpt}
                        </p>

                        {/* Meta */}
                        <div className="flex items-center justify-between text-xs text-white/40 font-bold uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(article.publishedAt)}
                            </span>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    {article.views}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Heart className="w-3 h-3" />
                                    {article.likes}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}

