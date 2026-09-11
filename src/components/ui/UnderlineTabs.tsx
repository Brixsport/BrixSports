'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface UnderlineTab {
    id: string;
    label: string;
    icon?: ReactNode;
    count?: number;
}

interface UnderlineTabsProps {
    tabs: UnderlineTab[];
    activeId: string;
    onChange: (id: string) => void;
    /** Shared across every UnderlineTabs instance that should animate one
     * continuous indicator between them (e.g. grouped rows on the same page).
     * Use a distinct id when two tab bars on the same page must not share
     * the sliding highlight. */
    layoutId: string;
    className?: string;
}

/**
 * Shared underline-tab bar -- the style already used on team/match/player
 * detail pages (px-3 py-2, text-[10px] uppercase, animated h-0.5 underline).
 * Consolidates what was previously 4 copy-pasted implementations.
 */
export function UnderlineTabs({ tabs, activeId, onChange, layoutId, className }: UnderlineTabsProps) {
    return (
        <div className={cn('flex gap-1 border-b border-white/10 overflow-x-auto scrollbar-hide', className)}>
            {tabs.map((tab) => {
                const active = activeId === tab.id;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                            'px-3 md:px-4 py-2 md:py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all relative whitespace-nowrap flex items-center gap-1.5 md:gap-2 shrink-0',
                            active ? 'text-primary' : 'text-white/60 hover:text-white'
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                        {typeof tab.count === 'number' && (
                            <span
                                className={cn(
                                    'px-1.5 py-0.5 rounded-full text-[9px] leading-none',
                                    active ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/40'
                                )}
                            >
                                {tab.count}
                            </span>
                        )}
                        {active && (
                            <motion.div
                                layoutId={layoutId}
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
