'use client';

import { motion } from 'framer-motion';

interface SkeletonLoaderProps {
    count?: number;
    type?: 'card' | 'table' | 'stat';
}

export default function SkeletonLoader({ count = 3, type = 'card' }: SkeletonLoaderProps) {
    if (type === 'stat') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white/5 rounded-2xl p-6 border border-white/10"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-6 h-6 bg-white/10 rounded animate-pulse" />
                            <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
                        </div>
                        <div className="h-8 w-16 bg-white/10 rounded animate-pulse" />
                    </motion.div>
                ))}
            </div>
        );
    }

    if (type === 'table') {
        return (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-6 space-y-4">
                    {Array.from({ length: count }).map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-center gap-4"
                        >
                            <div className="w-12 h-12 bg-white/10 rounded-full animate-pulse" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
                                <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
                            </div>
                            <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
                        </motion.div>
                    ))}
                </div>
            </div>
        );
    }

    // Default: card type
    return (
        <div className="space-y-4">
            {Array.from({ length: count }).map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white/5 rounded-2xl p-6 border border-white/10"
                >
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="h-6 w-48 bg-white/10 rounded animate-pulse" />
                                <div className="h-5 w-20 bg-white/10 rounded-full animate-pulse" />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Array.from({ length: 4 }).map((_, j) => (
                                    <div key={j} className="space-y-2">
                                        <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
                                        <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="w-8 h-8 bg-white/10 rounded-lg animate-pulse" />
                            <div className="w-8 h-8 bg-white/10 rounded-lg animate-pulse" />
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
