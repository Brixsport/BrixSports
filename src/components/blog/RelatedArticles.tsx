'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Clock, Eye, Heart, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface RelatedArticle {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    imageUrl: string | null;
    category: string;
    views: number;
    likes: number;
    publishedAt: string | null;
    readingTime?: number;
}

interface RelatedArticlesProps {
    articles: RelatedArticle[];
    title?: string;
    className?: string;
}

export default function RelatedArticles({
    articles,
    title = 'Related Articles',
    className = ''
}: RelatedArticlesProps) {
    if (!articles || articles.length === 0) {
        return null;
    }

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            breaking: 'from-red-500 to-orange-500',
            transfer: 'from-blue-500 to-cyan-500',
            match: 'from-green-500 to-emerald-500',
            injury: 'from-yellow-500 to-amber-500',
            general: 'from-purple-500 to-pink-500',
        };
        return colors[category] || colors.general;
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className={`${className}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <TrendingUp className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                    {title}
                </h2>
            </div>

            {/* Articles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.map((article, index) => (
                    <motion.div
                        key={article.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <Link href={`/news/${article.slug}`}>
                            <div className="group relative bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20 h-full">
                                {/* Image */}
                                <div className="relative h-48 overflow-hidden bg-slate-800">
                                    {article.imageUrl ? (
                                        <img
                                            src={article.imageUrl}
                                            alt={article.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <TrendingUp className="w-16 h-16 text-slate-600" />
                                        </div>
                                    )}

                                    {/* Category Badge */}
                                    <div className="absolute top-3 left-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${getCategoryColor(article.category)} shadow-lg`}>
                                            {article.category}
                                        </span>
                                    </div>

                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-60" />
                                </div>

                                {/* Content */}
                                <div className="p-5">
                                    {/* Title */}
                                    <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-cyan-400 transition-colors">
                                        {article.title}
                                    </h3>

                                    {/* Excerpt */}
                                    <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                                        {article.excerpt}
                                    </p>

                                    {/* Meta */}
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <div className="flex items-center gap-3">
                                            {article.readingTime && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {article.readingTime} min
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Eye className="w-3 h-3" />
                                                {article.views}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Heart className="w-3 h-3" />
                                                {article.likes}
                                            </span>
                                        </div>
                                        <span>{formatDate(article.publishedAt)}</span>
                                    </div>
                                </div>

                                {/* Hover Arrow */}
                                <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                                        <ArrowRight className="w-4 h-4 text-white" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
