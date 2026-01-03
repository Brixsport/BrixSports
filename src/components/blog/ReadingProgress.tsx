'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ReadingProgressProps {
    target?: string; // CSS selector for the content element
    className?: string;
}

export default function ReadingProgress({ target = 'article', className = '' }: ReadingProgressProps) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const calculateProgress = () => {
            const element = document.querySelector(target);
            if (!element) return;

            const rect = element.getBoundingClientRect();
            const elementHeight = element.scrollHeight;
            const viewportHeight = window.innerHeight;

            // Calculate how much of the element has been scrolled past
            const scrolled = Math.max(0, -rect.top);
            const totalScrollable = elementHeight - viewportHeight;

            if (totalScrollable <= 0) {
                setProgress(100);
                return;
            }

            const percentage = Math.min(100, Math.max(0, (scrolled / totalScrollable) * 100));
            setProgress(percentage);
        };

        // Calculate on mount
        calculateProgress();

        // Recalculate on scroll
        window.addEventListener('scroll', calculateProgress);
        window.addEventListener('resize', calculateProgress);

        return () => {
            window.removeEventListener('scroll', calculateProgress);
            window.removeEventListener('resize', calculateProgress);
        };
    }, [target]);

    return (
        <>
            {/* Fixed top progress bar */}
            <div className={`fixed top-0 left-0 right-0 h-1 bg-slate-800/50 z-50 ${className}`}>
                <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    style={{ width: `${progress}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                />
            </div>

            {/* Circular progress indicator (optional, can be toggled) */}
            {progress > 0 && progress < 100 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="fixed bottom-8 right-8 z-40"
                >
                    <div className="relative w-16 h-16">
                        {/* Background circle */}
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="32"
                                cy="32"
                                r="28"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                                className="text-slate-700"
                            />
                            {/* Progress circle */}
                            <circle
                                cx="32"
                                cy="32"
                                r="28"
                                stroke="url(#gradient)"
                                strokeWidth="4"
                                fill="none"
                                strokeDasharray={`${2 * Math.PI * 28}`}
                                strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                                className="transition-all duration-300"
                                strokeLinecap="round"
                            />
                            <defs>
                                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#06b6d4" />
                                    <stop offset="100%" stopColor="#3b82f6" />
                                </linearGradient>
                            </defs>
                        </svg>
                        {/* Percentage text */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">
                                {Math.round(progress)}%
                            </span>
                        </div>
                    </div>
                </motion.div>
            )}
        </>
    );
}
