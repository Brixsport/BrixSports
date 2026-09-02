'use client';

import { useState } from 'react';
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
        jerseyName?: string;
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
        jerseyName?: string;
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

const KEY_EVENT_TYPES = new Set(['GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION']);

// BACKLOG-294: show the jersey/known-as name everywhere a player
// appears on this page, not the full real name.
function displayName(person?: { name?: string; jerseyName?: string } | null): string | undefined {
    return person?.jerseyName || person?.name || undefined;
}

export default function LiveMatchTimeline({ events, homeTeam, awayTeam, eyePoints, sport = 'football' }: LiveMatchTimelineProps) {
    // BACKLOG-294: opens on "Key events" by default, with "All" a click away 
    //(Key events is the pre-selected pill).
    const [filter, setFilter] = useState<'all' | 'key'>('key');

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
        const playerName = displayName(event.player) ?? displayName(event.playerSnapshot);
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
        const playerName = displayName(event.player) ?? displayName(event.playerSnapshot) ?? 'Player';
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
        const playerName = displayName(event.player) ?? displayName(event.playerSnapshot) ?? 'Unknown';
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
                                <span className="text-white/70">Assist by {displayName(event.relatedPlayer)}</span>
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
                                <span className="text-[10px] font-bold bg-green-500/20 px-1 rounded">IN</span> {displayName(event.player) ?? displayName(event.playerSnapshot)}
                            </div>
                            {event.relatedPlayer && (
                                <div className="text-red-400 flex items-center gap-2">
                                    <span className="text-[10px] font-bold bg-red-500/20 px-1 rounded">OUT</span> {displayName(event.relatedPlayer)}
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

    // BACKLOG-294:  Timeline tab has an All/Key events segmented filter --
    // 'key' narrows to goals/cards/subs, matching the two-column team-side layout
    // in the reference screenshots. Applied before grouping so period headers only
    // show up for periods that still have a visible event under the current filter.
    const filteredEvents = filter === 'key'
        ? events.filter(e => KEY_EVENT_TYPES.has(e.type.toUpperCase().replace(/\s+/g, '_')))
        : events;

    // Group events by period (first half, second half, etc.)
    const groupedEvents = filteredEvents.reduce((acc, event) => {
        let period = 'First Half';
        if (event.period) {
            switch (event.period) {
                case 'FIRST_HALF': period = 'First Half'; break;
                case 'SECOND_HALF': period = 'Second Half'; break;
                case 'EXTRA_TIME_1': period = 'Extra Time 1'; break;
                case 'EXTRA_TIME_2': period = 'Extra Time 2'; break;
                case 'PENALTY_SHOOTOUT': period = 'Penalties'; break;
                // Basketball -- BasketballLogger now sends period on every event (it never
                // did before), so real basketball events reach this branch instead of the
                // minute-based football-only fallback below, which always mislabeled every
                // basketball event as "First Half"/"Second Half" since quarter numbers (1-5)
                // never exceed the football thresholds.
                case 'Q1': period = '1st Quarter'; break;
                case 'Q2': period = '2nd Quarter'; break;
                case 'Q3': period = '3rd Quarter'; break;
                case 'Q4': period = '4th Quarter'; break;
                case 'OT': period = 'Overtime'; break;
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
            {/* All / Key events segmented filter (Figma) */}
            <div className="inline-flex bg-white/5 border border-white/10 rounded-full p-1">
                {(['all', 'key'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-colors ${filter === f ? 'bg-primary text-black' : 'text-white/60 hover:text-white'
                            }`}
                    >
                        {f === 'all' ? 'All' : 'Key events'}
                    </button>
                ))}
            </div>

            {filter === 'key' && (
                <KeyEventsList events={filteredEvents} homeTeam={homeTeam} awayTeam={awayTeam} sport={sport} />
            )}

            {filter === 'all' && Object.entries(groupedEvents).map(([period, periodEvents]) => (
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
                            // BACKLOG-259: the API no longer sends a full team object per
                            // event (was 39 duplicate copies in a 40-event match) -- resolve
                            // via teamId against the homeTeam/awayTeam props instead, which
                            // this component already receives independently.
                            const isHomeTeam = event.teamId === homeTeam.id;
                            const eventTeam = event.teamId ? (isHomeTeam ? homeTeam : awayTeam) : null;

                            return (
                                <motion.div
                                    key={event.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    // BACKLOG-332: Figma's "All" view is a uniform single-column
                                    // layout, not side-mirrored by team like Key events correctly
                                    // is -- dropped the isHomeTeam flex-row-reverse for this path.
                                    className="flex items-start gap-4"
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

                                                // Basketball -- `min` is now a real elapsed-match-minute
                                                // (BasketballLogger used to send the quarter number here,
                                                // which every branch below assumed was elapsed time).
                                                // Showing a bare elapsed-minute with a football-style `'`
                                                // isn't what a basketball viewer expects; show the quarter
                                                // label plus the in-quarter clock (event.second holds
                                                // seconds-remaining-in-quarter from the logger's countdown).
                                                if (sport?.toLowerCase() === 'basketball') {
                                                    const secs = event.second ?? 0;
                                                    const mm = Math.floor(secs / 60);
                                                    const ss = String(secs % 60).padStart(2, '0');
                                                    return (
                                                        <>
                                                            <span>{p ?? 'Q?'}</span>
                                                            <span className="text-xs block opacity-70">{mm}:{ss}</span>
                                                        </>
                                                    );
                                                }

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
                                                {eventTeam && (
                                                    <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5">
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: eventTeam.color }}
                                                        />
                                                        <span className="text-xs font-medium">{eventTeam.name}</span>
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
                                    <div className="font-semibold">{displayName(award.player)}</div>
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

// BACKLOG-294:  "Key events" view is a distinct, compact two-column layout
// (home events left-aligned, away right-aligned, running score badge on goals) --
// visually different enough from the "All" view's descriptive cards above that it's
// its own renderer rather than a filtered pass through getEventDescription/getEventIcon.
// Kept fully separate so nothing here can regress the existing "All" rendering.
interface KeyEventsListProps {
    events: Event[];
    homeTeam: any;
    awayTeam: any;
    sport?: string;
}

function KeyEventsList({ events, homeTeam, awayTeam, sport }: KeyEventsListProps) {
    if (events.length === 0) {
        return (
            <div className="text-center py-12">
                <Activity className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/40">No key events in this match yet</p>
            </div>
        );
    }

    // The events prop arrives newest-first (API order) -- wrong direction for a
    // running score, which must accumulate oldest-to-newest. Sorted copy only;
    // never mutates the prop.
    const chronological = [...events].sort(
        (a, b) => (a.minute - b.minute) || ((a.second ?? 0) - (b.second ?? 0))
    );

    let homeScore = 0;
    let awayScore = 0;
    const rows = chronological.map(event => {
        const isHomeTeam = event.teamId === homeTeam.id;
        const normType = event.type.toUpperCase().replace(/\s+/g, '_');

        if (normType === 'GOAL') {
            // An own goal credits the OTHER team's score -- same detection this
            // file's generateGoalCommentary already uses for the "All" view.
            const isOwnGoal = event.detail?.toLowerCase().includes('own goal') ?? false;
            if (isHomeTeam !== isOwnGoal) homeScore += 1; else awayScore += 1;
        }

        return { event, isHomeTeam, normType, scoreAtEvent: { home: homeScore, away: awayScore } };
    });

    const minuteLabel = (event: Event) =>
        sport?.toLowerCase() === 'basketball' ? `${event.period ?? ''} ${event.minute}`.trim() : `${event.minute}'`;

    return (
        <div className="space-y-3">
            {rows.map(({ event, isHomeTeam, normType, scoreAtEvent }) => {
                const playerName = displayName(event.player) ?? displayName(event.playerSnapshot) ?? 'Unknown';

                return (
                    <div key={event.id} className={`flex items-center gap-3 ${isHomeTeam ? 'flex-row' : 'flex-row-reverse'}`}>
                        <span className="text-xs font-bold text-primary w-12 flex-shrink-0 text-center">
                            {minuteLabel(event)}
                        </span>
                        <div className={`flex-1 flex items-center gap-2 min-w-0 ${isHomeTeam ? '' : 'flex-row-reverse'}`}>
                            {normType === 'GOAL' && (
                                <>
                                    {/* Assist name is secondary info -- capped at a small fixed
                                        width so it can't eat into the scorer's own name space
                                        (both truncating equally made the scorer's name
                                        illegible on anything but a short one). */}
                                    {event.relatedPlayer && (
                                        <span className="text-white/50 text-sm truncate max-w-[72px] flex-shrink-0">({displayName(event.relatedPlayer)})</span>
                                    )}
                                    <span className="font-bold truncate flex-1 min-w-0">{playerName}</span>
                                    <span className="flex-shrink-0">⚽</span>
                                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full border border-white/20 text-xs font-bold">
                                        {scoreAtEvent.home}-{scoreAtEvent.away}
                                    </span>
                                </>
                            )}
                            {(normType === 'YELLOW_CARD' || normType === 'RED_CARD') && (
                                <>
                                    <div className={`flex-shrink-0 w-3 h-4 rounded-sm ${normType === 'YELLOW_CARD' ? 'bg-yellow-500' : 'bg-red-600'}`} />
                                    <span className="font-bold truncate flex-1 min-w-0">{playerName}</span>
                                </>
                            )}
                            {normType === 'SUBSTITUTION' && (
                                <>
                                    <span className="text-red-400 truncate flex-1 min-w-0">{displayName(event.relatedPlayer) ?? 'Unknown'}</span>
                                    <ArrowRightLeft className="w-4 h-4 text-white/50 flex-shrink-0" />
                                    <span className="text-green-400 truncate flex-1 min-w-0">{playerName}</span>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

