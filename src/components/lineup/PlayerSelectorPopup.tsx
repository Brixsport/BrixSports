'use client';

// BACKLOG-323 step 5: the scoped player-selector popup. Takes a candidate
// list as a prop and doesn't know or care where it came from -- the admin
// builder passes that match's two real rosters, a future public builder
// would pass a sport-filtered global list. No fetch, no route knowledge.

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Star, X, UserMinus } from 'lucide-react';

export interface PlayerSelectorCandidate {
    id: string;
    name: string;
    jerseyName?: string;
    number: number;
    position: string;
    rating?: number;
    teamLabel?: 'home' | 'away';
}

export interface PlayerSelectorPopupProps {
    isOpen: boolean;
    onClose: () => void;
    candidates: PlayerSelectorCandidate[];
    /** Ids already placed elsewhere -- shown disabled rather than filtered out, so the list composition doesn't shift under the viewer. */
    excludePlayerIds?: string[];
    onSelect: (playerId: string) => void;
    title?: string;
    /** If the slot being edited already has a player, offer a Remove action alongside selection. */
    currentPlayerId?: string;
    onRemove?: () => void;
}

export function PlayerSelectorPopup({
    isOpen,
    onClose,
    candidates,
    excludePlayerIds = [],
    onSelect,
    title = 'Select Player',
    currentPlayerId,
    onRemove,
}: PlayerSelectorPopupProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [positionFilter, setPositionFilter] = useState<string>('all');

    const positions = useMemo(() => {
        const unique = new Set(candidates.map((p) => p.position));
        return ['all', ...Array.from(unique)];
    }, [candidates]);

    const filtered = useMemo(() => {
        return candidates
            .filter((p) => {
                const q = searchQuery.toLowerCase();
                const matchesSearch = !q ||
                    p.name.toLowerCase().includes(q) ||
                    (p.jerseyName && p.jerseyName.toLowerCase().includes(q)) ||
                    p.number.toString().includes(q);
                const matchesPosition = positionFilter === 'all' || p.position === positionFilter;
                return matchesSearch && matchesPosition;
            })
            .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }, [candidates, searchQuery, positionFilter]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 40, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl bg-neutral-950 border border-white/10 shadow-2xl max-h-[85vh] flex flex-col"
                >
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">{title}</h3>
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white/60">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-4 space-y-3 border-b border-white/10">
                        {currentPlayerId && onRemove && (
                            <button
                                onClick={() => {
                                    onRemove();
                                    onClose();
                                }}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-black uppercase tracking-wider hover:bg-red-500/20 transition-colors"
                            >
                                <UserMinus size={14} />
                                Remove from Slot
                            </button>
                        )}

                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" />
                            <input
                                type="text"
                                placeholder="Search players..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>

                        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                            {positions.map((pos) => (
                                <button
                                    key={pos}
                                    onClick={() => setPositionFilter(pos)}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${positionFilter === pos
                                        ? 'bg-primary text-black'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                >
                                    {pos}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {filtered.length === 0 ? (
                            <div className="text-center py-8 text-white/40 text-sm">No players found</div>
                        ) : (
                            filtered.map((candidate) => {
                                const isExcluded = excludePlayerIds.includes(candidate.id) && candidate.id !== currentPlayerId;
                                return (
                                    <CandidateRow
                                        key={candidate.id}
                                        candidate={candidate}
                                        disabled={isExcluded}
                                        isCurrent={candidate.id === currentPlayerId}
                                        onClick={() => {
                                            if (isExcluded) return;
                                            onSelect(candidate.id);
                                            onClose();
                                        }}
                                    />
                                );
                            })
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

function CandidateRow({
    candidate,
    disabled,
    isCurrent,
    onClick,
}: {
    candidate: PlayerSelectorCandidate;
    disabled: boolean;
    isCurrent: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${disabled
                ? 'bg-white/5 border-white/5 opacity-40 cursor-not-allowed'
                : isCurrent
                    ? 'bg-primary/10 border-primary'
                    : 'bg-white/5 border-white/10 hover:border-primary/50 hover:bg-white/10'
                }`}
        >
            <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center font-display text-sm font-bold border ${candidate.teamLabel === 'away'
                    ? 'bg-red-500/20 border-red-500/30 text-red-400'
                    : 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                    }`}
            >
                {candidate.number}
            </div>

            <div className="flex-1 text-left">
                <p className="text-sm font-black uppercase tracking-tight text-white">
                    {candidate.jerseyName || candidate.name}
                </p>
                <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">
                    {candidate.position}
                    {disabled && ' · already placed'}
                </p>
            </div>

            {typeof candidate.rating === 'number' && (
                <div className="flex items-center gap-1">
                    <Star size={12} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-bold text-yellow-500">{candidate.rating.toFixed(1)}</span>
                </div>
            )}
        </button>
    );
}
