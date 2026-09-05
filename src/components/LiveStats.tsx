'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Target, Shield, Activity } from 'lucide-react';
import { TeamLogo } from '@/lib/utils/team-logo';
import { computeBasketballQuarterStats, type BasketballQuarter } from '@/lib/basketball/matchStats';

interface LiveStatsProps {
    stats: any;
    sport: string;
    homeTeam: any;
    awayTeam: any;
    // BACKLOG-331: only needed for basketball's quarter-scoped percentage rework --
    // the football path is untouched and keeps reading `stats` alone.
    events?: any[];
}

const QUARTER_LABELS: Record<BasketballQuarter, string> = { ALL: 'All', Q1: '1st', Q2: '2nd', Q3: '3rd', Q4: '4th' };

export default function LiveStats({ stats, sport, homeTeam, awayTeam, events }: LiveStatsProps) {
    const [quarter, setQuarter] = useState<BasketballQuarter>('ALL');

    if (!stats) {
        return (
            <div className="text-center py-20">
                <Activity className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white/60 mb-2">No statistics available</h3>
                <p className="text-white/40">Match statistics will appear here during the game</p>
            </div>
        );
    }

    // BACKLOG-330: Figma only uses the dual-color bar for Possession (disabled,
    // BACKLOG-192). Every other football category is a plain value each side with
    // the leading side circled -- no bar, no icon.
    const StatRow = ({ label, homeValue, awayValue, unit = '' }: any) => {
        const homeLeads = homeValue > awayValue;
        const awayLeads = awayValue > homeValue;

        return (
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                {homeLeads ? (
                    <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white font-bold">
                        {homeValue}{unit}
                    </span>
                ) : (
                    <span className="font-semibold">{homeValue}{unit}</span>
                )}
                <span className="text-sm text-white/60">{label}</span>
                {awayLeads ? (
                    <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white font-bold">
                        {awayValue}{unit}
                    </span>
                ) : (
                    <span className="font-semibold">{awayValue}{unit}</span>
                )}
            </div>
        );
    };

    const StatBar = ({ label, homeValue, awayValue, max, unit = '', icon }: any) => {
        const homePercentage = (homeValue / max) * 100;
        const awayPercentage = (awayValue / max) * 100;

        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{homeValue}{unit}</span>
                    <div className="flex items-center gap-2 text-white/60">
                        {icon}
                        <span>{label}</span>
                    </div>
                    <span className="font-semibold">{awayValue}{unit}</span>
                </div>
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    {/* Home Team Bar (from left) */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${homePercentage}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="absolute left-0 h-full rounded-l-full"
                        style={{ backgroundColor: homeTeam.color }}
                    />
                    {/* Away Team Bar (from right) */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${awayPercentage}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="absolute right-0 h-full rounded-r-full"
                        style={{ backgroundColor: awayTeam.color }}
                    />
                </div>
            </div>
        );
    };

    const renderFootballStats = () => {
        // API returns array format: stats.shots = [homeVal, awayVal]
        const homePossession = Array.isArray(stats.possession) ? stats.possession[0] : (stats.possession ?? 50);
        const awayPossession = Array.isArray(stats.possession) ? stats.possession[1] : (100 - homePossession);
        const shots        = Array.isArray(stats.shots)        ? stats.shots        : [stats.homeShots ?? 0,        stats.awayShots ?? 0];
        const shotsOnTarget= Array.isArray(stats.shotsOnTarget)? stats.shotsOnTarget: [stats.homeShotsOnTarget ?? 0, stats.awayShotsOnTarget ?? 0];
        const corners      = Array.isArray(stats.corners)      ? stats.corners      : [stats.homeCorners ?? 0,      stats.awayCorners ?? 0];
        const fouls        = Array.isArray(stats.fouls)        ? stats.fouls        : [stats.homeFouls ?? 0,        stats.awayFouls ?? 0];
        const yellowCards  = Array.isArray(stats.yellowCards)  ? stats.yellowCards  : [stats.homeYellowCards ?? 0,  stats.awayYellowCards ?? 0];
        const redCards     = Array.isArray(stats.redCards)     ? stats.redCards     : [stats.homeRedCards ?? 0,     stats.awayRedCards ?? 0];
        const saves        = Array.isArray(stats.saves)        ? stats.saves        : [stats.homeSaves ?? 0,        stats.awaySaves ?? 0];

        // BACKLOG-122: goals-only backfilled matches (no team logsheet) never captured
        // possession/shots/corners/fouls/saves -- those categories are not real 0-0s, they
        // were simply never tracked. Suppress them instead of rendering a false stat line.
        // Yellow/Red Cards are always real captured data in both modes, so they stay.
        const isGoalsOnly = stats.statsCaptureMode === 'goals-only';

        return (
        <div className="space-y-6">
            {/* BACKLOG-192: possession is computed as an attacking-event-count proxy
                (shots + corners + free kicks), not real time-based possession -- even on
                fully-tracked matches this reads as authoritative but isn't. Richard's call:
                hide it rather than ship a misleading number; real tracking or honest
                relabeling is a later, separate decision. Commented out, not deleted --
                homePossession/awayPossession above still compute correctly if reinstated. */}
            {false && !isGoalsOnly && (
                <StatBar
                    label="Possession"
                    homeValue={homePossession}
                    awayValue={awayPossession}
                    max={100}
                    unit="%"
                    icon={<Activity className="w-4 h-4" />}
                />
            )}
            {!isGoalsOnly && (
                <StatRow
                    label="Shots"
                    homeValue={shots[0]}
                    awayValue={shots[1]}
                />
            )}
            {!isGoalsOnly && (
                <StatRow
                    label="Shots on Target"
                    homeValue={shotsOnTarget[0]}
                    awayValue={shotsOnTarget[1]}
                />
            )}
            {!isGoalsOnly && (
                <StatRow
                    label="Corners"
                    homeValue={corners[0]}
                    awayValue={corners[1]}
                />
            )}
            {!isGoalsOnly && (
                <StatRow
                    label="Fouls"
                    homeValue={fouls[0]}
                    awayValue={fouls[1]}
                />
            )}
            <StatRow
                label="Yellow Cards"
                homeValue={yellowCards[0]}
                awayValue={yellowCards[1]}
            />
            {(redCards[0] > 0 || redCards[1] > 0) && (
                <StatBar
                    label="Red Cards"
                    homeValue={redCards[0]}
                    awayValue={redCards[1]}
                    max={Math.max(redCards[0], redCards[1], 2)}
                    icon={<div className="w-3 h-4 bg-red-500 rounded-sm" />}
                />
            )}
            {!isGoalsOnly && (
                <StatBar
                    label="Saves"
                    homeValue={saves[0]}
                    awayValue={saves[1]}
                    max={Math.max(saves[0], saves[1], 10)}
                    icon={<Shield className="w-4 h-4" />}
                />
            )}
        </div>
        );
    };

    // BACKLOG-331: Figma's basketball Stats screen is a different data shape
    // entirely from the raw counts above -- make/attempt percentage splits for
    // Free Throws/3 Pointers/2 Pointers, share-of-combined-total splits for
    // Fouls/Rebounds, all quarter-scoped. Derived straight from `events` (same
    // `event.period` values BasketballLogger.tsx already writes), not from the
    // `stats` blob, since `stats` has no per-quarter breakdown.
    //
    // Assumption made (flagged in BACKLOG-331's audit, unresolved as of this
    // implementation): Figma's mock also shows a "1 Pointers" row with a split
    // identical to "Free Throws" -- a free throw already IS a 1-pointer, and the
    // duplicate split reads as reused placeholder data, not a distinct stat.
    // Dropped rather than shipped as a literal duplicate; revisit if Richard
    // confirms it should mean something else.
    const renderBasketballStats = () => {
        const bball = computeBasketballQuarterStats(events || [], homeTeam.id, quarter);

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                    {(Object.keys(QUARTER_LABELS) as BasketballQuarter[]).map(q => (
                        <button
                            key={q}
                            onClick={() => setQuarter(q)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${quarter === q ? 'bg-primary text-white' : 'bg-white/5 text-white/60 hover:text-white'
                                }`}
                        >
                            {QUARTER_LABELS[q]}
                        </button>
                    ))}
                </div>
                <StatBar
                    label="Free Throws"
                    homeValue={bball.freeThrows[0]}
                    awayValue={bball.freeThrows[1]}
                    max={100}
                    unit="%"
                    icon={<Target className="w-4 h-4" />}
                />
                <StatBar
                    label="3 Pointers"
                    homeValue={bball.threePointers[0]}
                    awayValue={bball.threePointers[1]}
                    max={100}
                    unit="%"
                    icon={<Target className="w-4 h-4" />}
                />
                <StatBar
                    label="2 Pointers"
                    homeValue={bball.twoPointers[0]}
                    awayValue={bball.twoPointers[1]}
                    max={100}
                    unit="%"
                    icon={<Target className="w-4 h-4" />}
                />
                <StatBar
                    label="Fouls"
                    homeValue={bball.fouls[0]}
                    awayValue={bball.fouls[1]}
                    max={100}
                    unit="%"
                    icon={<Shield className="w-4 h-4" />}
                />
                <StatBar
                    label="Rebounds"
                    homeValue={bball.rebounds[0]}
                    awayValue={bball.rebounds[1]}
                    max={100}
                    unit="%"
                    icon={<TrendingUp className="w-4 h-4" />}
                />
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Team Headers */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: homeTeam.color + '20' }}
                    >
                        <TeamLogo logo={homeTeam.logo} name={homeTeam.name} size="sm" />
                    </div>
                    {/* BACKLOG-330: Figma's football Stats-tab header shows logos only --
                        name/shortName already appear in the page header above. Basketball's
                        own Stats reference keeps the text, so scope this to football only. */}
                    {sport !== 'Football' && (
                        <div>
                            <div className="font-bold">{homeTeam.name}</div>
                            <div className="text-sm text-white/60">{homeTeam.shortName}</div>
                        </div>
                    )}
                </div>

                <div className="text-white/60 font-semibold">VS</div>

                <div className="flex items-center gap-3 flex-row-reverse">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: awayTeam.color + '20' }}
                    >
                        <TeamLogo logo={awayTeam.logo} name={awayTeam.name} size="sm" />
                    </div>
                    {sport !== 'Football' && (
                        <div className="text-right">
                            <div className="font-bold">{awayTeam.name}</div>
                            <div className="text-sm text-white/60">{awayTeam.shortName}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats */}
            {sport === 'Football' && renderFootballStats()}
            {sport === 'Basketball' && renderBasketballStats()}
            {sport !== 'Football' && sport !== 'Basketball' && (
                <div className="text-center py-10 text-white/60">
                    Statistics for {sport} coming soon
                </div>
            )}
        </div>
    );
}
