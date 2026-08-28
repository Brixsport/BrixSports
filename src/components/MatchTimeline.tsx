'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
    Circle, Target, AlertCircle, ArrowRightLeft, Eye,
    TrendingUp, Award, Clock, Zap, Shield, Activity,
    ChevronDown, ChevronUp, Play, Pause
} from 'lucide-react';
import { useState } from 'react';
import { MatchEvent } from '@/db/schema';
import { safeParseEventValue } from '@/lib/eventValue';

interface MatchTimelineProps {
    events: (MatchEvent & {
        player?: { id: string; name: string; number: number };
        relatedPlayer?: { id: string; name: string; number: number };
        team?: { id: string; name: string; color: string; shortName?: string };
    })[];
    homeTeam: any;
    awayTeam: any;
    sport: 'Football' | 'Basketball' | 'Track';
    showFilters?: boolean;
}

type EventFilter = 'all' | 'goals' | 'cards' | 'substitutions' | 'eyePoints';

export function MatchTimeline({ events, homeTeam, awayTeam, sport, showFilters = true }: MatchTimelineProps) {
    const [filter, setFilter] = useState<EventFilter>('all');
    const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

    const getEventIcon = (type: string) => {
        switch (type.toUpperCase().replace(/\s+/g, '_')) {
            case 'GOAL':
                return <Target className="w-5 h-5" />;
            case 'ASSIST':
                return <TrendingUp className="w-5 h-5" />;
            case 'YELLOW_CARD':
                return <AlertCircle className="w-5 h-5 text-yellow-500" />;
            case 'RED_CARD':
            case 'RED_CARD_(SECOND_YELLOW)':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            case 'SUBSTITUTION':
                return <ArrowRightLeft className="w-5 h-5" />;
            case 'SAVE':
                return <Shield className="w-5 h-5" />;
            case 'PENALTY_SAVED':
                return <Shield className="w-5 h-5 text-amber-400" />;
            case 'PENALTY_MISSED':
                return <Activity className="w-5 h-5 text-red-400" />;
            case 'EYE_POINT':
                return <Eye className="w-5 h-5 text-purple-500" />;
            case 'FIELD_GOAL':
            case 'THREE_POINTER':
                return <Target className="w-5 h-5" />;
            case 'FREE_THROW':
                return <Circle className="w-5 h-5" />;
            case 'KICK_OFF':
            case 'HALF_TIME':
            case 'FULL_TIME':
                return <Clock className="w-5 h-5" />;
            default:
                return <Activity className="w-5 h-5" />;
        }
    };

    const getEventColor = (type: string) => {
        switch (type.toUpperCase().replace(/\s+/g, '_')) {
            case 'GOAL':
            case 'FIELD_GOAL':
            case 'THREE_POINTER':
                return 'bg-blue-500/20 border-blue-500/50 text-blue-500';
            case 'YELLOW_CARD':
                return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500';
            case 'RED_CARD':
            case 'RED_CARD_(SECOND_YELLOW)':
                return 'bg-red-500/20 border-red-500/50 text-red-500';
            case 'SUBSTITUTION':
                return 'bg-blue-500/20 border-blue-500/50 text-blue-500';
            case 'EYE_POINT':
                return 'bg-purple-500/20 border-purple-500/50 text-purple-500';
            case 'SAVE':
                return 'bg-cyan-500/20 border-cyan-500/50 text-cyan-500';
            case 'PENALTY_SAVED':
                return 'bg-amber-500/20 border-amber-500/50 text-amber-400';
            case 'PENALTY_MISSED':
                return 'bg-red-500/20 border-red-500/50 text-red-400';
            case 'ASSIST':
                return 'bg-orange-500/20 border-orange-500/50 text-orange-500';
            default:
                return 'bg-white/10 border-white/20 text-white/80';
        }
    };

    const getEventDescription = (event: any) => {
        const playerName = event.player?.name || 'Unknown';
        const playerNumber = event.player?.number;

        switch (event.type.toUpperCase().replace(/\s+/g, '_')) {
            case 'GOAL':
                return (
                    <div>
                        <span className="font-bold text-lg">⚽ GOAL!</span>
                        <div className="mt-1">
                            <span className="font-semibold">{playerName}</span>
                            {playerNumber && <span className="text-white/60 ml-1">#{playerNumber}</span>}
                        </div>
                        {event.relatedPlayer && (
                            <div className="text-sm text-white/60 mt-1">
                                Assist: {event.relatedPlayer.name} #{event.relatedPlayer.number}
                            </div>
                        )}
                        {event.detail && (
                            <div className="text-xs text-white/50 mt-1 italic">{event.detail}</div>
                        )}
                    </div>
                );
            case 'YELLOW_CARD':
                return (
                    <div>
                        <span className="font-bold">🟨 Yellow Card</span>
                        <div className="mt-1">
                            <span className="font-semibold">{playerName}</span>
                            {playerNumber && <span className="text-white/60 ml-1">#{playerNumber}</span>}
                        </div>
                        {event.detail && (
                            <div className="text-sm text-white/60 mt-1">{event.detail}</div>
                        )}
                    </div>
                );
            case 'RED_CARD':
                return (
                    <div>
                        <span className="font-bold">🟥 Red Card</span>
                        <div className="mt-1">
                            <span className="font-semibold">{playerName}</span>
                            {playerNumber && <span className="text-white/60 ml-1">#{playerNumber}</span>}
                        </div>
                        {event.detail && (
                            <div className="text-sm text-white/60 mt-1">{event.detail}</div>
                        )}
                    </div>
                );
            case 'SUBSTITUTION':
                return (
                    <div>
                        <span className="font-bold">🔄 Substitution</span>
                        <div className="text-sm mt-2 space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-blue-500">↑ IN:</span>
                                <span className="font-semibold">{event.player?.name}</span>
                            </div>
                            {event.relatedPlayer && (
                                <div className="flex items-center gap-2">
                                    <span className="text-red-500">↓ OUT:</span>
                                    <span className="font-semibold">{event.relatedPlayer.name}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'SAVE':
                return (
                    <div>
                        <span className="font-bold">🧤 Great Save!</span>
                        <div className="mt-1">
                            <span className="font-semibold">{playerName}</span>
                            {playerNumber && <span className="text-white/60 ml-1">#{playerNumber}</span>}
                        </div>
                    </div>
                );
            case 'THREE_POINTER':
                return (
                    <div>
                        <span className="font-bold text-lg">🎯 3-POINTER!</span>
                        <div className="mt-1">
                            <span className="font-semibold">{playerName}</span>
                            {playerNumber && <span className="text-white/60 ml-1">#{playerNumber}</span>}
                        </div>
                    </div>
                );
            case 'FIELD_GOAL':
                return (
                    <div>
                        <span className="font-bold">🏀 2-Point Score</span>
                        <div className="mt-1">
                            <span className="font-semibold">{playerName}</span>
                            {playerNumber && <span className="text-white/60 ml-1">#{playerNumber}</span>}
                        </div>
                    </div>
                );
            case 'KICK_OFF':
                return <span className="font-bold">⚽ Kick-off</span>;
            case 'HALF_TIME':
                return <span className="font-bold">⏸️ Half Time</span>;
            case 'FULL_TIME':
                return <span className="font-bold">🏁 Full Time</span>;
            default:
                return (
                    <div>
                        <span className="font-bold">{event.type}</span>
                        {playerName !== 'Unknown' && (
                            <div className="mt-1">
                                <span className="font-semibold">{playerName}</span>
                                {playerNumber && <span className="text-white/60 ml-1">#{playerNumber}</span>}
                            </div>
                        )}
                    </div>
                );
        }
    };

    // Filter events
    const filteredEvents = events.filter(event => {
        if (filter === 'all') return true;
        if (filter === 'goals') return ['GOAL', 'FIELD_GOAL', 'THREE_POINTER'].includes(event.type.toUpperCase().replace(/\s+/g, '_'));
        if (filter === 'cards') return ['YELLOW_CARD', 'RED_CARD', 'RED_CARD_(SECOND_YELLOW)'].includes(event.type.toUpperCase().replace(/\s+/g, '_'));
        if (filter === 'substitutions') return event.type.toUpperCase().replace(/\s+/g, '_') === 'SUBSTITUTION';
        if (filter === 'eyePoints') return event.isEyePoint;
        return true;
    });

    // Group events by period
    const groupedEvents = filteredEvents.reduce((acc, event) => {
        let period = 'First Half';

        // Check if event has a period field (from MatchStateManager)
        if ((event as any).period) {
            const eventPeriod = (event as any).period;
            switch (eventPeriod) {
                case 'FIRST_HALF':
                case 'NOT_STARTED':
                    period = 'First Half';
                    break;
                case 'SECOND_HALF':
                    period = 'Second Half';
                    break;
                case 'HALF_TIME':
                    period = 'Half Time';
                    break;
                case 'EXTRA_TIME_1':
                    period = 'Extra Time (1st Half)';
                    break;
                case 'EXTRA_TIME_2':
                    period = 'Extra Time (2nd Half)';
                    break;
                case 'PENALTY_SHOOTOUT':
                    period = 'Penalty Shootout';
                    break;
                case 'FINISHED':
                    period = 'Full Time';
                    break;
                default:
                    period = 'First Half';
            }
        } else {
            // Fallback to minute-based grouping (for older events without period field)
            if (sport === 'Football') {
                if (event.minute > 45 && event.minute <= 90) period = 'Second Half';
                else if (event.minute > 90) period = 'Extra Time';
            } else if (sport === 'Basketball') {
                if (event.minute <= 10) period = '1st Quarter';
                else if (event.minute <= 20) period = '2nd Quarter';
                else if (event.minute <= 30) period = '3rd Quarter';
                else period = '4th Quarter';
            }
        }

        if (!acc[period]) acc[period] = [];
        acc[period].push(event);
        return acc;
    }, {} as Record<string, typeof events>);

    if (events.length === 0) {
        return (
            <div className="text-center py-20">
                <Activity className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white/60 mb-2">No events yet</h3>
                <p className="text-white/40">Match events will appear here as they happen</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filters */}
            {showFilters && (
                <div className="flex flex-wrap gap-2">
                    {[
                        { key: 'all', label: 'All Events', icon: Activity },
                        { key: 'goals', label: 'Goals', icon: Target },
                        { key: 'cards', label: 'Cards', icon: AlertCircle },
                        { key: 'substitutions', label: 'Subs', icon: ArrowRightLeft },
                        { key: 'eyePoints', label: 'Eye Points', icon: Eye },
                    ].map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key as EventFilter)}
                            className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${filter === key
                                ? 'bg-primary text-black'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            <Icon size={14} />
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {/* Timeline */}
            <div className="space-y-8">
                {Object.entries(groupedEvents).map(([period, periodEvents]) => (
                    <div key={period}>
                        {/* Period Header */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                            <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10">
                                <span className="font-semibold text-sm">{period}</span>
                            </div>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                        </div>

                        {/* Events */}
                        <div className="space-y-4">
                            {periodEvents.map((event, index) => {
                                const isHomeTeam = event.team?.id === homeTeam.id;
                                const isExpanded = expandedEvent === event.id;

                                return (
                                    <motion.div
                                        key={event.id}
                                        initial={{ opacity: 0, x: isHomeTeam ? -20 : 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={`flex items-start gap-4 ${isHomeTeam ? 'flex-row' : 'flex-row-reverse'
                                            }`}
                                    >
                                        {/* Time */}
                                        <div className="flex-shrink-0 w-16 text-center">
                                            <div className="text-sm font-bold text-primary">
                                                {event.minute}'
                                                {event.second ? <span className="text-xs">:{event.second}</span> : ''}
                                            </div>
                                        </div>

                                        {/* Event Card */}
                                        <div
                                            className={`flex-1 max-w-2xl p-4 rounded-xl border ${getEventColor(
                                                event.type
                                            )} backdrop-blur-sm cursor-pointer hover:bg-white/5 transition-all`}
                                            onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Icon */}
                                                <div className="flex-shrink-0 mt-0.5">
                                                    {getEventIcon(event.type)}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1">
                                                    {getEventDescription(event)}

                                                    {/* Team Badge */}
                                                    {event.team && (
                                                        <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5">
                                                            <div
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: event.team.color }}
                                                            />
                                                            <span className="text-xs font-medium">
                                                                {event.team.shortName || event.team.name}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Eye Point Badge */}
                                                    {event.isEyePoint && (
                                                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/20 border border-purple-500/50">
                                                            <Eye className="w-3 h-3 text-purple-500" />
                                                            <span className="text-xs font-medium text-purple-500">
                                                                Eye Point +0.5
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Expanded Details */}
                                                    <AnimatePresence>
                                                        {isExpanded && event.value && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="mt-3 pt-3 border-t border-white/10 text-xs text-white/60"
                                                            >
                                                                <pre className="whitespace-pre-wrap">
                                                                    {JSON.stringify(safeParseEventValue(event.value), null, 2)}
                                                                </pre>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>

                                                {/* Expand Icon */}
                                                {event.value && (
                                                    <div className="flex-shrink-0">
                                                        {isExpanded ? (
                                                            <ChevronUp size={16} className="text-white/40" />
                                                        ) : (
                                                            <ChevronDown size={16} className="text-white/40" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Spacer for alignment */}
                                        <div className="flex-shrink-0 w-16" />
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

