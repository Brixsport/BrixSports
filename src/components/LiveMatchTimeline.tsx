'use client';

import { motion } from 'framer-motion';
import {
    Circle, Target, AlertCircle, ArrowRightLeft, Eye,
    TrendingUp, Award, Clock, Zap, Shield, Activity
} from 'lucide-react';
import { format } from 'date-fns';

interface Event {
    id: string;
    type: string;
    minute: number;
    second?: number;
    period?: string;
    displayMinute?: number;
    player?: {
        id: string;
        name: string;
        number: number;
    };
    // WS events from match-state-manager carry playerSnapshot instead of player
    playerSnapshot?: {
        id?: string;
        name?: string;
        jerseyName?: string;
        teamId?: string;
    };
    relatedPlayer?: {
        id: string;
        name: string;
        number: number;
    };
    team?: {
        id: string;
        name: string;
        color: string;
    };
    detail?: string;
    isEyePoint?: boolean;
    value?: any;
    playerId?: string;
    teamId?: string;
}

interface LiveMatchTimelineProps {
    events: Event[];
    homeTeam: any;
    awayTeam: any;
    eyePoints: any[];
    sport?: string;
}

export default function LiveMatchTimeline({ events, homeTeam, awayTeam, eyePoints, sport = 'football' }: LiveMatchTimelineProps) {
    const getEventIcon = (type: string) => {
        switch (type.toUpperCase().replace(/\s+/g, '_')) {
            case 'GOAL':
                return <Target className="w-5 h-5" />;
            case 'ASSIST':
                return <TrendingUp className="w-5 h-5" />;
            case 'YELLOW_CARD':
                return <AlertCircle className="w-5 h-5 text-yellow-500" />;
            case 'RED_CARD':
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
            case 'BLOCK':
                return <Shield className="w-5 h-5" />;
            case 'STEAL':
                return <Zap className="w-5 h-5" />;
            default:
                return <Activity className="w-5 h-5" />;
        }
    };

    const getEventColor = (type: string) => {
        const baseStyle = "bg-white/5 border border-white/10 backdrop-blur-sm transition-all hover:bg-white/10";
        switch (type.toUpperCase().replace(/\s+/g, '_')) {
            case 'GOAL':
            case 'FIELD_GOAL':
            case 'THREE_POINTER':
                return `${baseStyle} border-primary/20 hover:border-primary/40`;
            case 'YELLOW_CARD':
                return `${baseStyle} border-yellow-500/20 hover:border-yellow-500/40`;
            case 'RED_CARD':
                return `${baseStyle} border-red-500/20 hover:border-red-500/40`;
            case 'SUBSTITUTION':
                return `${baseStyle} border-green-500/20 hover:border-green-500/40`;
            case 'EYE_POINT':
                return `${baseStyle} border-purple-500/20 hover:border-purple-500/40`;
            case 'PENALTY_SAVED':
                return `${baseStyle} border-amber-500/20 hover:border-amber-500/40`;
            case 'PENALTY_MISSED':
                return `${baseStyle} border-red-500/20 hover:border-red-500/40`;
            default:
                return baseStyle;
        }
    };

    // Helper to pick a template deterministically based on event properties
    const getCommentaryTemplate = (templates: string[], seed: number) => {
        return templates[seed % templates.length];
    };

    // Advanced Commentary Generators
    const generateGoalCommentary = (event: Event, seed: number) => {
        const playerName = event.player?.name ?? event.playerSnapshot?.name ?? event.playerSnapshot?.jerseyName;
        const isLateGame = event.minute > 85;
        const isEarlyGame = event.minute < 10;
        const detail = event.detail?.toLowerCase() || '';
        const isPenalty = detail.includes('penalty');
        const isOwnGoal = detail.includes('own goal');

        let templates: string[] = [];

        if (isPenalty) {
            templates = [
                "Cool as you like! {player} converts from the spot.",
                "PENALTY SCORED! {player} makes no mistake.",
                "Ice in the veins! {player} slots the penalty home."
            ];
        } else if (isOwnGoal) {
            templates = [
                "Oh no! It's an own goal by {player}!",
                "Heartbreak for {player} as they turn it into their own net.",
                "Disaster! An own goal gives the opposition a gift."
            ];
        } else if (isLateGame) {
            templates = [
                "SURELY THAT'S THE WINNER?! {player} strikes late!",
                "LATE DRAMA! {player} might have just won it!",
                "IN THE DYING MOMENTS! {player} finds a crucial goal!",
                "CLUTCH! {player} delivers when it matters most!"
            ];
        } else if (isEarlyGame) {
            templates = [
                "What a start! {player} opens the scoring early on.",
                "Lightning fast start! {player} puts them ahead.",
                "They haven't wasted any time! {player} strikes!"
            ];
        } else {
            templates = [
                "GOAL! A fantastic finish by {player}!",
                "IT'S A GOAL! {player} finds the back of the net!",
                "What a strike! {player} scores for the team!",
                "Clinical finish from {player}!",
                "The net bulges! {player} gets on the scoresheet.",
                "Beautifully worked, and finished by {player}."
            ];
        }

        return getCommentaryTemplate(templates, seed).replace('{player}', playerName || 'Unknown');
    };

    const generateBasketballScoreCommentary = (event: Event, seed: number, type: '2pt' | '3pt' | 'ft') => {
        const playerName = event.player?.name ?? event.playerSnapshot?.name ?? event.playerSnapshot?.jerseyName ?? 'Player';
        const isClutch = event.minute > 36; // Late 4th quarter

        let templates: string[] = [];

        if (type === '3pt') {
            if (isClutch) {
                templates = [
                    "DAGGER! {player} hits the huge three!",
                    "FROM DOWNTOWN IN THE CLUTCH! {player} connects!",
                    "ICE COLD! {player} for three!"
                ];
            } else {
                templates = [
                    "FROM DOWNTOWN! {player} hits the 3-pointer!",
                    "SPLASH! {player} connects from deep.",
                    "Rain dance! {player} for three!",
                    "{player} steps back... and drills the three!"
                ];
            }
        } else if (type === 'ft') {
            templates = [
                "Free throw is good by {player}.",
                "{player} adds a point from the line.",
                "Sinks the free throw."
            ];
        } else {
            // 2pt
            templates = [
                "{player} gets the bucket.",
                "Easy two for {player}.",
                "{player} drives and scores.",
                "Mid-range jumper falls for {player}."
            ];
        }
        return getCommentaryTemplate(templates, seed).replace('{player}', playerName);
    };

    const getEventDescription = (event: Event) => {
        const playerName = event.player?.name ?? event.playerSnapshot?.name ?? event.playerSnapshot?.jerseyName ?? 'Unknown';
        const playerNumber = event.player?.number;
        const seed = event.minute + (event.type?.length || 0) + (playerName?.length || 0) + (event.detail?.length || 0);

        switch (event.type.toUpperCase().replace(/\s+/g, '_')) {
            case 'GOAL':
                const goalText = generateGoalCommentary(event, seed);
                return (
                    <div>
                        <span className="font-bold text-lg block mb-1">⚽ {goalText}</span>
                        <div className="text-sm opacity-90">
                            {playerNumber && <span className="font-mono bg-white/10 px-1 rounded mr-2">#{playerNumber}</span>}
                            {event.relatedPlayer && (
                                <span className="text-white/70">Assist by {event.relatedPlayer.name}</span>
                            )}
                        </div>
                    </div>
                );
            case 'ASSIST':
                return (
                    <div>
                        <span className="font-bold">🎯 Great vision!</span> Assist by {playerName}
                        {playerNumber && <span className="text-white/60 ml-1">#{playerNumber}</span>}
                    </div>
                );
            case 'YELLOW_CARD':
                const yellowTemplates = [
                    "Yellow card shown to {player}.",
                    "The referee books {player} for that challenge.",
                    "{player} goes into the book.",
                    "Caution for {player}."
                ];
                const yellowText = getCommentaryTemplate(yellowTemplates, seed).replace('{player}', playerName);
                return (
                    <div>
                        <span className="font-bold text-yellow-500 text-base block mb-0.5">🟨 Caution</span>
                        <span>{yellowText}</span>
                        {event.detail && <div className="text-sm text-white/60 mt-1 italic">Reason: {event.detail}</div>}
                    </div>
                );
            case 'RED_CARD':
                const redTemplates = [
                    "{player} receives their marching orders!",
                    "It's an early shower for {player}!",
                    "RED CARD! {player} is sent off!"
                ];
                const redText = getCommentaryTemplate(redTemplates, seed).replace('{player}', playerName);
                return (
                    <div>
                        <span className="font-bold text-red-500 text-lg block mb-1">🟥 SENT OFF!</span>
                        {redText}
                        {event.detail && <div className="text-sm text-white/60 mt-1">Reason: {event.detail}</div>}
                    </div>
                );
            case 'SUBSTITUTION':
                return (
                    <div>
                        <span className="font-bold block mb-1">🔄 Substitution</span>
                        <div className="text-sm grid gap-1">
                            <div className="text-green-400 flex items-center gap-2">
                                <span className="text-[10px] font-bold bg-green-500/20 px-1 rounded">IN</span> {event.player?.name ?? event.playerSnapshot?.name ?? event.playerSnapshot?.jerseyName}
                            </div>
                            {event.relatedPlayer && (
                                <div className="text-red-400 flex items-center gap-2">
                                    <span className="text-[10px] font-bold bg-red-500/20 px-1 rounded">OUT</span> {event.relatedPlayer.name}
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'SAVE':
            case 'BLOCK':
                const saveTemplates = sport === 'basketball'
                    ? ["Get that out of here! {player} with the block!", "REJECTED by {player}!", "Huge block from {player}!"]
                    : ["What a save by {player}!", "Great stop from {player}!", "{player} denies the goal!"];
                const saveText = getCommentaryTemplate(saveTemplates, seed).replace('{player}', playerName);
                return (
                    <div>
                        <span className="font-bold">{sport === 'basketball' ? '🚫' : '🧤'} {saveText}</span>
                    </div>
                );
            case 'FIELD_GOAL':
                const fgText = generateBasketballScoreCommentary(event, seed, '2pt');
                return (
                    <div>
                        <span className="font-bold text-lg block text-green-400">🏀 {fgText}</span>
                    </div>
                );
            case 'THREE_POINTER':
                const threeText = generateBasketballScoreCommentary(event, seed, '3pt');
                return (
                    <div>
                        <span className="font-bold text-lg block text-yellow-400">🎯 {threeText}</span>
                    </div>
                );
            case 'FREE_THROW':
                const ftText = generateBasketballScoreCommentary(event, seed, 'ft');
                return (
                    <div>
                        <span className="font-bold">✨ {ftText}</span>
                    </div>
                );
            case 'STEAL':
                return (
                    <div>
                        <span className="font-bold">🛡️ STOLEN!</span> {playerName} takes the ball away.
                    </div>
                );
            default:
                // Generic formatting
                const niceType = event.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
                return (
                    <div>
                        <span className="font-bold">{niceType}</span>
                        {playerName !== 'Unknown' && ` by ${playerName}`}
                    </div>
                );
        }
    };

    // Group events by period (first half, second half, etc.)
    const groupedEvents = events.reduce((acc, event) => {
        let period = 'First Half';
        if (event.period) {
            switch (event.period) {
                case 'FIRST_HALF': period = 'First Half'; break;
                case 'SECOND_HALF': period = 'Second Half'; break;
                case 'EXTRA_TIME_1': period = 'Extra Time 1'; break;
                case 'EXTRA_TIME_2': period = 'Extra Time 2'; break;
                case 'PENALTY_SHOOTOUT': period = 'Penalties'; break;
                default: period = event.period.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
            }
        } else {
            if (event.minute > 45 && event.minute <= 90) period = 'Second Half';
            else if (event.minute > 90) period = 'Extra Time';
        }

        if (!acc[period]) acc[period] = [];
        acc[period].push(event);
        return acc;
    }, {} as Record<string, Event[]>);

    if (events.length === 0) {
        return (
            <div className="text-center py-20">
                <Activity className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white/60 mb-2">No events yet</h3>
                <p className="text-white/40">Match events will appear here as they happen</p>
            </div>
        );
    }

    // -1 is the established "minute unknown" sentinel written by goals-only
    // backfill scripts (no full logsheet available for the match). If any
    // event carries it, the match's timing data isn't trustworthy enough to
    // present as a real minute-by-minute timeline — hide it entirely rather
    // than show a partial/misleading order.
    const hasUnknownMinuteEvents = events.some(e => e.minute == null || e.minute < 0);
    if (hasUnknownMinuteEvents) {
        return (
            <div className="text-center py-20">
                <Clock className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white/60 mb-2">Timeline not available</h3>
                <p className="text-white/40">Match timeline will be displayed here once available</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {Object.entries(groupedEvents).map(([period, periodEvents]) => (
                <div key={period}>
                    {/* Period Header */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-px flex-1 bg-white/10" />
                        <div className="px-4 py-1.5 bg-white/5 rounded-full border border-white/10 backdrop-blur-sm">
                            <span className="font-semibold text-xs text-white/60 uppercase tracking-wider">{period}</span>
                        </div>
                        <div className="h-px flex-1 bg-white/10" />
                    </div>

                    {/* Events */}
                    <div className="space-y-4">
                        {periodEvents.map((event, index) => {
                            const isHomeTeam = event.team?.id === homeTeam.id;

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
                                            {(() => {
                                                const min = event.minute;
                                                // -1 is the established "minute unknown" sentinel written by
                                                // goals-only backfill scripts (no full logsheet available).
                                                if (min == null || min < 0) return '—';

                                                const p = event.period;
                                                const isFootball = sport?.toLowerCase() === 'football' || sport?.toLowerCase() === '5-a-side' || sport?.toLowerCase() === 'five-a-side';

                                                let label = String(min);
                                                if (isFootball && p) {
                                                    if (p === 'FIRST_HALF' && min > 45) label = `45+${min - 45}`;
                                                    else if (p === 'SECOND_HALF' && min > 90) label = `90+${min - 90}`;
                                                    else if (p === 'EXTRA_TIME_1' && min > 105) label = `105+${min - 105}`;
                                                    else if (p === 'EXTRA_TIME_2' && min > 120) label = `120+${min - 120}`;
                                                }
                                                return (
                                                    <>
                                                        {label}'
                                                        {event.second ? <span className="text-xs">:{event.second}</span> : ''}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Event Card */}
                                    <div
                                        className={`flex-1 max-w-2xl p-4 rounded-xl border ${getEventColor(event.type)} backdrop-blur-sm`}
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
                                                        <span className="text-xs font-medium">{event.team.name}</span>
                                                    </div>
                                                )}

                                                {/* Eye Point Badge */}
                                                {event.isEyePoint && (
                                                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/20 border border-purple-500/50">
                                                        <Eye className="w-3 h-3 text-purple-500" />
                                                        <span className="text-xs font-medium text-purple-500">Eye Point +0.5</span>
                                                    </div>
                                                )}
                                            </div>
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

            {/* Eye Points Summary */}
            {(eyePoints ?? []).length > 0 && (
                <div className="mt-8 p-6 bg-purple-500/10 border border-purple-500/30 rounded-2xl">
                    <div className="flex items-center gap-2 mb-4">
                        <Eye className="w-5 h-5 text-purple-500" />
                        <h3 className="font-bold text-lg">Eye Point Awards</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(eyePoints ?? []).map((award) => (
                            <div key={award.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                                <Award className="w-5 h-5 text-purple-500" />
                                <div>
                                    <div className="font-semibold">{award.player?.name}</div>
                                    {award.reason && (
                                        <div className="text-sm text-white/60">{award.reason}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

