'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Target, Shield, Activity, Zap } from 'lucide-react';
import { TeamLogo } from '@/lib/utils/team-logo';

interface LiveStatsProps {
    stats: any;
    sport: string;
    homeTeam: any;
    awayTeam: any;
}

export default function LiveStats({ stats, sport, homeTeam, awayTeam }: LiveStatsProps) {
    if (!stats) {
        return (
            <div className="text-center py-20">
                <Activity className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white/60 mb-2">No statistics available</h3>
                <p className="text-white/40">Match statistics will appear here during the game</p>
            </div>
        );
    }

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

    const renderFootballStats = () => (
        <div className="space-y-6">
            <StatBar
                label="Possession"
                homeValue={stats.possession || 50}
                awayValue={100 - (stats.possession || 50)}
                max={100}
                unit="%"
                icon={<Activity className="w-4 h-4" />}
            />
            <StatBar
                label="Shots"
                homeValue={stats.homeShots || 0}
                awayValue={stats.awayShots || 0}
                max={Math.max(stats.homeShots || 0, stats.awayShots || 0, 20)}
                icon={<Target className="w-4 h-4" />}
            />
            <StatBar
                label="Shots on Target"
                homeValue={stats.homeShotsOnTarget || 0}
                awayValue={stats.awayShotsOnTarget || 0}
                max={Math.max(stats.homeShotsOnTarget || 0, stats.awayShotsOnTarget || 0, 10)}
                icon={<Target className="w-4 h-4" />}
            />
            <StatBar
                label="Corners"
                homeValue={stats.homeCorners || 0}
                awayValue={stats.awayCorners || 0}
                max={Math.max(stats.homeCorners || 0, stats.awayCorners || 0, 10)}
                icon={<Zap className="w-4 h-4" />}
            />
            <StatBar
                label="Fouls"
                homeValue={stats.homeFouls || 0}
                awayValue={stats.awayFouls || 0}
                max={Math.max(stats.homeFouls || 0, stats.awayFouls || 0, 20)}
                icon={<Shield className="w-4 h-4" />}
            />
            <StatBar
                label="Yellow Cards"
                homeValue={stats.homeYellowCards || 0}
                awayValue={stats.awayYellowCards || 0}
                max={Math.max(stats.homeYellowCards || 0, stats.awayYellowCards || 0, 5)}
                icon={<div className="w-3 h-4 bg-yellow-500 rounded-sm" />}
            />
            {(stats.homeRedCards > 0 || stats.awayRedCards > 0) && (
                <StatBar
                    label="Red Cards"
                    homeValue={stats.homeRedCards || 0}
                    awayValue={stats.awayRedCards || 0}
                    max={Math.max(stats.homeRedCards || 0, stats.awayRedCards || 0, 2)}
                    icon={<div className="w-3 h-4 bg-red-500 rounded-sm" />}
                />
            )}
            <StatBar
                label="Saves"
                homeValue={stats.homeSaves || 0}
                awayValue={stats.awaySaves || 0}
                max={Math.max(stats.homeSaves || 0, stats.awaySaves || 0, 10)}
                icon={<Shield className="w-4 h-4" />}
            />
        </div>
    );

    const renderBasketballStats = () => (
        <div className="space-y-6">
            <StatBar
                label="Field Goals Made"
                homeValue={stats.homeFieldGoals || 0}
                awayValue={stats.awayFieldGoals || 0}
                max={Math.max(stats.homeFieldGoals || 0, stats.awayFieldGoals || 0, 40)}
                icon={<Target className="w-4 h-4" />}
            />
            <StatBar
                label="3-Pointers Made"
                homeValue={stats.homeThreePointers || 0}
                awayValue={stats.awayThreePointers || 0}
                max={Math.max(stats.homeThreePointers || 0, stats.awayThreePointers || 0, 15)}
                icon={<Target className="w-4 h-4" />}
            />
            <StatBar
                label="Free Throws Made"
                homeValue={stats.homeFreeThrows || 0}
                awayValue={stats.awayFreeThrows || 0}
                max={Math.max(stats.homeFreeThrows || 0, stats.awayFreeThrows || 0, 20)}
                icon={<Target className="w-4 h-4" />}
            />
            <StatBar
                label="Rebounds"
                homeValue={stats.homeRebounds || 0}
                awayValue={stats.awayRebounds || 0}
                max={Math.max(stats.homeRebounds || 0, stats.awayRebounds || 0, 50)}
                icon={<TrendingUp className="w-4 h-4" />}
            />
            <StatBar
                label="Assists"
                homeValue={stats.homeAssists || 0}
                awayValue={stats.awayAssists || 0}
                max={Math.max(stats.homeAssists || 0, stats.awayAssists || 0, 30)}
                icon={<Zap className="w-4 h-4" />}
            />
            <StatBar
                label="Steals"
                homeValue={stats.homeSteals || 0}
                awayValue={stats.awaySteals || 0}
                max={Math.max(stats.homeSteals || 0, stats.awaySteals || 0, 15)}
                icon={<Shield className="w-4 h-4" />}
            />
            <StatBar
                label="Blocks"
                homeValue={stats.homeBlocks || 0}
                awayValue={stats.awayBlocks || 0}
                max={Math.max(stats.homeBlocks || 0, stats.awayBlocks || 0, 10)}
                icon={<Shield className="w-4 h-4" />}
            />
            <StatBar
                label="Turnovers"
                homeValue={stats.homeTurnovers || 0}
                awayValue={stats.awayTurnovers || 0}
                max={Math.max(stats.homeTurnovers || 0, stats.awayTurnovers || 0, 20)}
                icon={<Activity className="w-4 h-4" />}
            />
        </div>
    );

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
                    <div>
                        <div className="font-bold">{homeTeam.name}</div>
                        <div className="text-sm text-white/60">{homeTeam.shortName}</div>
                    </div>
                </div>

                <div className="text-white/60 font-semibold">VS</div>

                <div className="flex items-center gap-3 flex-row-reverse">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: awayTeam.color + '20' }}
                    >
                        <TeamLogo logo={awayTeam.logo} name={awayTeam.name} size="sm" />
                    </div>
                    <div className="text-right">
                        <div className="font-bold">{awayTeam.name}</div>
                        <div className="text-sm text-white/60">{awayTeam.shortName}</div>
                    </div>
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
