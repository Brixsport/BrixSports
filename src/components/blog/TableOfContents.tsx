'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, ChevronRight, ChevronDown } from 'lucide-react';
import { ToCItem, scrollToHeading } from '@/lib/utils/table-of-contents';

interface TableOfContentsProps {
    items: ToCItem[];
    activeId?: string;
    className?: string;
}

export default function TableOfContents({ items, activeId, className = '' }: TableOfContentsProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Auto-expand parent items of active heading
        if (activeId) {
            const newExpanded = new Set<string>();
            const findParents = (items: ToCItem[], targetId: string, parents: string[] = []): boolean => {
                for (const item of items) {
                    if (item.id === targetId) {
                        parents.forEach(p => newExpanded.add(p));
                        return true;
                    }
                    if (item.children) {
                        if (findParents(item.children, targetId, [...parents, item.id])) {
                            return true;
                        }
                    }
                }
                return false;
            };
            findParents(items, activeId);
            setExpandedItems(newExpanded);
        }
    }, [activeId, items]);

    const toggleExpand = (id: string) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleClick = (id: string) => {
        scrollToHeading(id);
    };

    const renderItem = (item: ToCItem, depth: number = 0) => {
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedItems.has(item.id);
        const isActive = activeId === item.id;

        return (
            <div key={item.id} className="relative">
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`
                        flex items-start gap-2 py-2 px-3 rounded-lg cursor-pointer
                        transition-all duration-200
                        ${isActive
                            ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }
                        ${depth > 0 ? 'ml-' + (depth * 4) : ''}
                    `}
                    onClick={() => handleClick(item.id)}
                    style={{ paddingLeft: `${depth * 16 + 12}px` }}
                >
                    {hasChildren && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(item.id);
                            }}
                            className="flex-shrink-0 mt-1"
                        >
                            {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                            ) : (
                                <ChevronRight className="w-4 h-4" />
                            )}
                        </button>
                    )}
                    <span className={`text-sm leading-relaxed ${!hasChildren ? 'ml-6' : ''}`}>
                        {item.text}
                    </span>
                </motion.div>

                <AnimatePresence>
                    {hasChildren && isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            {item.children!.map(child => renderItem(child, depth + 1))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    if (!items || items.length === 0) {
        return null;
    }

    return (
        <div className={`bg-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden ${className}`}>
            {/* Header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <List className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-bold text-white">Table of Contents</h3>
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                </motion.div>
            </button>

            {/* Content */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-slate-700/50"
                    >
                        <div className="p-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                            {items.map(item => renderItem(item))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
