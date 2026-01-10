'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Player } from '@/types';
import { X } from 'lucide-react';

interface MobilePlayerSheetProps {
    player: Player | null;
    isOpen: boolean;
    onClose: () => void;
    rating?: number;
    teamColor?: string;
}

interface StatCardProps {
    label: string;
    value: string | number;
}

function StatCard({ label, value }: StatCardProps) {
    return (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-white/60 text-xs mb-1">{label}</p>
            <p className="text-white text-xl font-bold">{value}</p>
        </div>
    );
}

export function MobilePlayerSheet({ player, isOpen, onClose, rating, teamColor = '#3b82f6' }: MobilePlayerSheetProps) {
    if (!player) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-40"
                        onClick={onClose}
                    />

                    {/* Bottom Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-3xl z-50 max-h-[80vh] overflow-y-auto"
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(e, { offset, velocity }) => {
                            if (offset.y > 100 || velocity.y > 500) {
                                onClose();
                            }
                        }}
                    >
                        {/* Drag Handle */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-10 h-1 bg-white/20 rounded-full" />
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5 text-white/60" />
                        </button>

                        {/* Player Details */}
                        <div className="p-6">
                            <div className="flex items-center gap-4 mb-6">
                                <div
                                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-2 border-white/30 shadow-lg"
                                    style={{ backgroundColor: teamColor }}
                                >
                                    <span className="text-white">{player.number}</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">{player.name}</h3>
                                    <p className="text-white/60">{player.position}</p>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <StatCard label="Rating" value={rating?.toFixed(1) || 'N/A'} />
                                <StatCard label="Goals" value="0" />
                                <StatCard label="Assists" value="0" />
                            </div>

                            {/* Additional Info */}
                            <div className="space-y-3">
                                {player.jerseyName && (
                                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                                        <span className="text-white/60">Jersey Name</span>
                                        <span className="text-white font-semibold">{player.jerseyName}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center py-2 border-b border-white/10">
                                    <span className="text-white/60">Number</span>
                                    <span className="text-white font-semibold">#{player.number}</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-white/60">Position</span>
                                    <span className="text-white font-semibold">{player.position}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
