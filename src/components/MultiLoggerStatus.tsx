/**
 * Multi-Logger Status Component
 * Shows active loggers and conflict notifications
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Users, AlertTriangle, CheckCircle, Wifi, WifiOff, Activity } from 'lucide-react';
import { EventConflict } from '@/lib/multiLogger';

interface LoggerInfo {
    loggerId: string;
    loggerName: string;
    joinedAt: Date;
    lastActivity: Date;
}

interface MultiLoggerStatusProps {
    activeLoggers: LoggerInfo[];
    conflicts: EventConflict[];
    isConnected: boolean;
    syncStatus: 'synced' | 'syncing' | 'error';
    currentLoggerName: string;
    onResolveConflict?: (conflictId: string, resolution: 'keep-first' | 'keep-second' | 'keep-both') => void;
}

export function MultiLoggerStatus({
    activeLoggers,
    conflicts,
    isConnected,
    syncStatus,
    currentLoggerName,
    onResolveConflict,
}: MultiLoggerStatusProps) {
    const unresolvedConflicts = conflicts.filter(c => !c.resolved);
    const isMultiLogger = activeLoggers.length > 0;

    if (!isMultiLogger && unresolvedConflicts.length === 0) {
        return null; // Don't show if solo logging with no conflicts
    }

    return (
        <div className="fixed top-20 right-4 z-30 space-y-2 max-w-sm">
            {/* Active Loggers Panel */}
            <AnimatePresence>
                {isMultiLogger && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Users size={16} className="text-primary" />
                                <span className="text-xs font-black uppercase tracking-widest">
                                    Multi-Logger Mode
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                {isConnected ? (
                                    <Wifi size={14} className="text-green-500" />
                                ) : (
                                    <WifiOff size={14} className="text-red-500" />
                                )}
                                {syncStatus === 'syncing' && (
                                    <Activity size={14} className="text-orange-500 animate-pulse" />
                                )}
                                {syncStatus === 'synced' && (
                                    <CheckCircle size={14} className="text-green-500" />
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {/* Current Logger */}
                            <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded-lg">
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                                <span className="text-xs font-bold text-primary">{currentLoggerName} (You)</span>
                            </div>

                            {/* Other Loggers */}
                            {activeLoggers.map((logger) => (
                                <div
                                    key={logger.loggerId}
                                    className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-lg"
                                >
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="text-xs font-medium text-white/80">{logger.loggerName}</span>
                                </div>
                            ))}
                        </div>

                        <p className="text-[10px] text-white/40 mt-3 text-center">
                            {activeLoggers.length + 1} logger{activeLoggers.length > 0 ? 's' : ''} active
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Conflicts Panel */}
            <AnimatePresence>
                {unresolvedConflicts.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="bg-orange-500/10 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-4"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle size={16} className="text-orange-500" />
                            <span className="text-xs font-black uppercase tracking-widest text-orange-500">
                                {unresolvedConflicts.length} Conflict{unresolvedConflicts.length > 1 ? 's' : ''}
                            </span>
                        </div>

                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {unresolvedConflicts.slice(0, 3).map((conflict) => (
                                <div
                                    key={conflict.id}
                                    className="bg-black/40 border border-orange-500/20 rounded-lg p-3"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                                            {conflict.conflictType}
                                        </span>
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded ${conflict.severity === 'high' ? 'bg-red-500/20 text-red-500' :
                                                conflict.severity === 'medium' ? 'bg-orange-500/20 text-orange-500' :
                                                    'bg-yellow-500/20 text-yellow-500'
                                            }`}>
                                            {conflict.severity}
                                        </span>
                                    </div>

                                    <div className="space-y-1 text-xs text-white/60 mb-3">
                                        <p>• {conflict.event1.loggerName}: {conflict.event1.type} @ {conflict.event1.minute}'</p>
                                        <p>• {conflict.event2.loggerName}: {conflict.event2.type} @ {conflict.event2.minute}'</p>
                                    </div>

                                    {onResolveConflict && (
                                        <div className="grid grid-cols-3 gap-1">
                                            <button
                                                onClick={() => onResolveConflict(conflict.id, 'keep-first')}
                                                className="text-[9px] font-black uppercase px-2 py-1 bg-white/5 hover:bg-white/10 rounded transition-all"
                                            >
                                                Keep 1st
                                            </button>
                                            <button
                                                onClick={() => onResolveConflict(conflict.id, 'keep-second')}
                                                className="text-[9px] font-black uppercase px-2 py-1 bg-white/5 hover:bg-white/10 rounded transition-all"
                                            >
                                                Keep 2nd
                                            </button>
                                            <button
                                                onClick={() => onResolveConflict(conflict.id, 'keep-both')}
                                                className="text-[9px] font-black uppercase px-2 py-1 bg-primary/20 hover:bg-primary/30 text-primary rounded transition-all"
                                            >
                                                Both
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {unresolvedConflicts.length > 3 && (
                            <p className="text-[10px] text-white/40 mt-2 text-center">
                                +{unresolvedConflicts.length - 3} more conflict{unresolvedConflicts.length - 3 > 1 ? 's' : ''}
                            </p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
