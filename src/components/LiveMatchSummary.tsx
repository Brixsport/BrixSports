'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    Target,
    AlertCircle,
    TrendingUp,
    Users,
    Award,
    ArrowRightLeft,
    Flag,
    Circle,
    Trophy,
    Zap,
    Activity,
    Eye,
} from 'lucide-react';
import { MatchEvent } from '@/db/schema';
import { useMatchEvents } from '@/hooks/useWebSocket';

interface LiveMatchSummaryProps {
    matchId: string;
    sport: string;
    homeTeamName: string;
    awayTeamName: string;
    homeTeamColor?: string;
    awayTeamColor?: string;
}

interface EventDisplay {
    id: string;
    minute: number;
    second?: number;
    icon: React.ReactNode;
    title: string;
    description: string;
    teamColor: string;
    isImportant: boolean;
    type: string;
}

export default function LiveMatchSummary({
    matchId,
    sport,
    homeTeamName,
    awayTeamName,
    homeTeamColor = '#FF6B35',
    awayTeamColor = '#4ECDC4',
}: LiveMatchSummaryProps) {
    const { events, latestEvent, isConnected } = useMatchEvents(matchId);
    const [displayEvents, setDisplayEvents] = useState<EventDisplay[]>([]);
    const [filter, setFilter] = useState<'all' | 'important'>('all');

    useEffect(() => {
        const formattedEvents = events.map(event => formatEvent(event));
        setDisplayEvents(formattedEvents.reverse()); // Most recent first
    }, [events]);

    const formatEvent = (event: MatchEvent): EventDisplay => {
        const timeDisplay = `${event.minute}'${event.second ? `:${event.second}` : ''}`;
        const isHomeTeam = event.teamId === homeTeamName; // This should use teamId comparison
        const teamColor = isHomeTeam ? homeTeamColor : awayTeamColor;
        const teamName = isHomeTeam ? homeTeamName : awayTeamName;

        let icon: React.ReactNode;
        let title: string;
        let description: string;
        let isImportant = false;

        switch (event.type) {
            // Football Events
            case 'GOAL':
                icon = <Target className="w-5 h-5" />;
                title = '⚽ GOAL!';
                description = `Goal scored by ${event.playerId || 'Unknown Player'}`;
                if (event.relatedPlayerId) {
                    description += ` (Assist: ${event.relatedPlayerId})`;
                }
                isImportant = true;
                break;

            case 'ASSIST':
                icon = <TrendingUp className="w-5 h-5" />;
                title = 'Assist';
                description = `Assist by ${event.playerId || 'Unknown Player'}`;
                break;

            case 'YELLOW_CARD':
                icon = <AlertCircle className="w-5 h-5 text-yellow-400" />;
                title = '🟨 Yellow Card';
                description = `${event.playerId || 'Unknown Player'} receives a yellow card`;
                if (event.detail) description += ` - ${event.detail}`;
                isImportant = true;
                break;

            case 'RED_CARD':
                icon = <AlertCircle className="w-5 h-5 text-red-500" />;
                title = '🟥 Red Card';
                description = `${event.playerId || 'Unknown Player'} sent off!`;
                if (event.detail) description += ` - ${event.detail}`;
                isImportant = true;
                break;

            case 'SUBSTITUTION':
                icon = <ArrowRightLeft className="w-5 h-5" />;
                title = 'Substitution';
                description = `${event.relatedPlayerId || 'Player'} ON ↔ ${event.playerId || 'Player'} OFF`;
                break;

            case 'CORNER':
                icon = <Flag className="w-5 h-5" />;
                title = 'Corner';
                description = `Corner kick for ${teamName}`;
                if (event.playerId) description += ` - Taken by ${event.playerId}`;
                break;

            case 'SHOT_ON_TARGET':
                icon = <Target className="w-5 h-5" />;
                title = 'Shot on Target';
                description = `Shot by ${event.playerId || 'Unknown Player'}`;
                if (event.detail) description += ` - ${event.detail}`;
                break;

            case 'SHOT_OFF_TARGET':
                icon = <Circle className="w-5 h-5" />;
                title = 'Shot Off Target';
                description = `Shot missed by ${event.playerId || 'Unknown Player'}`;
                break;

            case 'SAVE':
                icon = <Award className="w-5 h-5" />;
                title = 'Save';
                description = `Great save by ${event.playerId || 'Goalkeeper'}`;
                break;

            case 'FOUL':
                icon = <AlertCircle className="w-5 h-5" />;
                title = 'Foul';
                description = `Foul committed by ${event.playerId || 'Unknown Player'}`;
                if (event.detail) description += ` on ${event.detail}`;
                break;

            case 'OFFSIDE':
                icon = <Flag className="w-5 h-5" />;
                title = 'Offside';
                description = `${event.playerId || 'Player'} caught offside`;
                break;

            // Basketball Events
            case 'FIELD_GOAL':
                icon = <Target className="w-5 h-5" />;
                title = '🏀 2-Point Field Goal';
                description = `2 points scored by ${event.playerId || 'Unknown Player'}`;
                isImportant = true;
                break;

            case 'THREE_POINTER':
                icon = <Zap className="w-5 h-5" />;
                title = '🏀 3-Pointer!';
                description = `3 points scored by ${event.playerId || 'Unknown Player'}`;
                isImportant = true;
                break;

            case 'FREE_THROW':
                icon = <Target className="w-5 h-5" />;
                title = 'Free Throw';
                description = `Free throw made by ${event.playerId || 'Unknown Player'}`;
                break;

            case 'REBOUND':
                icon = <Activity className="w-5 h-5" />;
                title = 'Rebound';
                description = `${event.detail === 'offensive' ? 'Offensive' : 'Defensive'} rebound by ${event.playerId || 'Unknown Player'}`;
                break;

            case 'STEAL':
                icon = <Zap className="w-5 h-5" />;
                title = 'Steal';
                description = `Steal by ${event.playerId || 'Unknown Player'}`;
                break;

            case 'BLOCK':
                icon = <Award className="w-5 h-5" />;
                title = 'Block';
                description = `Shot blocked by ${event.playerId || 'Unknown Player'}`;
                break;

            case 'TURNOVER':
                icon = <AlertCircle className="w-5 h-5" />;
                title = 'Turnover';
                description = `Turnover by ${event.playerId || 'Unknown Player'}`;
                break;

            // Track & Field Events
            case 'RACE_START':
                icon = <Flag className="w-5 h-5" />;
                title = '🏁 Race Started';
                description = 'Race has begun!';
                isImportant = true;
                break;

            case 'FINISH':
                icon = <Trophy className="w-5 h-5" />;
                title = 'Finish';
                const value = event.value ? JSON.parse(event.value) : {};
                description = `${event.playerId || 'Athlete'} finished in position ${value.position || 'N/A'}`;
                if (value.time) description += ` - Time: ${value.time}`;
                isImportant = value.position <= 3;
                break;

            case 'RECORD_BROKEN':
                icon = <Trophy className="w-5 h-5 text-yellow-400" />;
                title = '🏆 RECORD BROKEN!';
                description = `New record set by ${event.playerId || 'Athlete'}!`;
                isImportant = true;
                break;

            // Special Events
            case 'EYE_POINT':
                icon = <Eye className="w-5 h-5 text-purple-400" />;
                title = '👁️ Eye Point Awarded';
                description = `Eye Point awarded to ${event.playerId || 'Unknown Player'}`;
                if (event.detail) description += ` - ${event.detail}`;
                isImportant = true;
                break;

            case 'HALF_TIME':
                icon = <Clock className="w-5 h-5" />;
                title = 'Half Time';
                description = 'First half ended';
                isImportant = true;
                break;

            case 'FULL_TIME':
                icon = <Clock className="w-5 h-5" />;
                title = 'Full Time';
                description = 'Match ended';
                isImportant = true;
                break;

            default:
                icon = <Activity className="w-5 h-5" />;
                title = event.type.replace(/_/g, ' ');
                description = event.detail || `Event by ${event.playerId || 'Unknown'}`;
        }

        // Add Eye Point indicator if applicable
        if (event.isEyePoint) {
            title = `👁️ ${title}`;
            isImportant = true;
        }

        return {
            id: event.id,
            minute: event.minute,
            second: event.second || 0,
            icon,
            title,
            description,
            teamColor,
            isImportant,
            type: event.type,
        };
    };

    const filteredEvents = filter === 'important'
        ? displayEvents.filter(e => e.isImportant)
        : displayEvents;

    return (
        <div className="w-full h-full bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505] rounded-2xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/10 p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/5 rounded-lg">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                                Live Commentary
                            </h2>
                            <p className="text-sm text-white/50">
                                {isConnected ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                        Live Updates
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-red-500 rounded-full" />
                                        Disconnected
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'all'
                                    ? 'bg-white/10 text-white'
                                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                                }`}
                        >
                            All Events
                        </button>
                        <button
                            onClick={() => setFilter('important')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'important'
                                    ? 'bg-white/10 text-white'
                                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                                }`}
                        >
                            Key Events
                        </button>
                    </div>
                </div>

                {/* Event Count */}
                <div className="text-sm text-white/50">
                    {filteredEvents.length} {filter === 'important' ? 'key' : ''} event{filteredEvents.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Events Timeline */}
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="popLayout">
                    {filteredEvents.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-12"
                        >
                            <Activity className="w-12 h-12 text-white/20 mx-auto mb-4" />
                            <p className="text-white/50">No events yet. Waiting for match to start...</p>
                        </motion.div>
                    ) : (
                        filteredEvents.map((event, index) => (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: index * 0.05 }}
                                className={`relative group ${event.isImportant ? 'mb-4' : ''
                                    }`}
                            >
                                {/* Timeline Connector */}
                                {index < filteredEvents.length - 1 && (
                                    <div className="absolute left-[22px] top-12 w-0.5 h-full bg-gradient-to-b from-white/20 to-transparent" />
                                )}

                                <div
                                    className={`relative flex gap-4 p-4 rounded-xl transition-all ${event.isImportant
                                            ? 'bg-gradient-to-r from-white/10 to-transparent border border-white/20'
                                            : 'bg-white/5 hover:bg-white/10'
                                        }`}
                                    style={{
                                        borderLeftColor: event.isImportant ? event.teamColor : 'transparent',
                                        borderLeftWidth: event.isImportant ? '4px' : '0',
                                    }}
                                >
                                    {/* Time Badge */}
                                    <div className="flex-shrink-0">
                                        <div
                                            className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm"
                                            style={{
                                                background: `linear-gradient(135deg, ${event.teamColor}40, ${event.teamColor}20)`,
                                                color: event.teamColor,
                                                border: `2px solid ${event.teamColor}60`,
                                            }}
                                        >
                                            {event.minute}'
                                        </div>
                                    </div>

                                    {/* Event Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start gap-3 mb-1">
                                            <div
                                                className="p-2 rounded-lg"
                                                style={{
                                                    backgroundColor: `${event.teamColor}20`,
                                                    color: event.teamColor,
                                                }}
                                            >
                                                {event.icon}
                                            </div>
                                            <div className="flex-1">
                                                <h3
                                                    className={`font-bold mb-1 ${event.isImportant ? 'text-lg' : 'text-base'
                                                        }`}
                                                    style={{ color: event.isImportant ? event.teamColor : 'white' }}
                                                >
                                                    {event.title}
                                                </h3>
                                                <p className="text-white/70 text-sm leading-relaxed">
                                                    {event.description}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Important Event Highlight */}
                                        {event.isImportant && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                                                <span className="text-xs text-white/40 uppercase tracking-wider">
                                                    Key Event
                                                </span>
                                                <div className="h-px flex-1 bg-gradient-to-l from-white/20 to-transparent" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Latest Event Indicator */}
                                    {latestEvent?.id === event.id && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute -top-2 -right-2"
                                        >
                                            <div className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                                                NEW
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Custom Scrollbar Styles */}
            <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
        </div>
    );
}

