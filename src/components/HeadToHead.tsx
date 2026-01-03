'use client';

import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Calendar } from 'lucide-react';

export interface HeadToHeadData {
    team1: {
        id: string;
        name: string;
        logo: string;
        shortName?: string;
    };
    team2: {
        id: string;
        name: string;
        logo: string;
        shortName?: string;
    };
    headToHead: {
        totalMatches: number;
        team1Wins: number;
        team2Wins: number;
        draws: number;
        team1GoalsFor: number;
        team2GoalsFor: number;
    };
    recentMatches?: any[];
}

interface HeadToHeadProps {
    data: HeadToHeadData;
    showRecentMatches?: boolean;
}

export function HeadToHeadComparison({ data, showRecentMatches = true }: HeadToHeadProps) {
    const { team1, team2, headToHead, recentMatches } = data;

    const team1WinPercentage = (headToHead.team1Wins / headToHead.totalMatches) * 100;
    const team2WinPercentage = (headToHead.team2Wins / headToHead.totalMatches) * 100;
    const drawPercentage = (headToHead.draws / headToHead.totalMatches) * 100;

    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest text-white/60 flex items-center gap-2">
                    <Trophy size={16} className="text-primary" />
                    Head-to-Head
                </h2>
                <span className="text-xs text-white/40">
                    {headToHead.totalMatches} {headToHead.totalMatches === 1 ? 'Match' : 'Matches'}
                </span>
            </div>

            {/* Teams Comparison */}
            <div className="grid grid-cols-3 gap-4 items-center">
                {/* Team 1 */}
                <div className="text-center">
                    <div className="text-5xl mb-2">{team1.logo}</div>
                    <p className="text-sm font-black uppercase tracking-tight">{team1.shortName || team1.name}</p>
                </div>

                {/* VS */}
                <div className="text-center">
                    <div className="text-4xl font-display italic text-white/20 mb-2">VS</div>
                    <div className="flex items-center justify-center gap-2 text-xs text-white/40">
                        <Calendar size={12} />
                        <span>All Time</span>
                    </div>
                </div>

                {/* Team 2 */}
                <div className="text-center">
                    <div className="text-5xl mb-2">{team2.logo}</div>
                    <p className="text-sm font-black uppercase tracking-tight">{team2.shortName || team2.name}</p>
                </div>
            </div>

            {/* Win Statistics */}
            <div className="grid grid-cols-3 gap-4">
                <StatBox
                    label="Wins"
                    value={headToHead.team1Wins}
                    percentage={team1WinPercentage}
                    color="blue"
                />
                <StatBox
                    label="Draws"
                    value={headToHead.draws}
                    percentage={drawPercentage}
                    color="yellow"
                />
                <StatBox
                    label="Wins"
                    value={headToHead.team2Wins}
                    percentage={team2WinPercentage}
                    color="blue"
                />
            </div>

            {/* Goals Statistics */}
            <div className="bg-white/5 rounded-2xl p-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                        <p className="text-xs text-white/40 font-bold mb-1">GOALS SCORED</p>
                        <p className="text-3xl font-display italic text-primary">{headToHead.team1GoalsFor}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-white/40 font-bold mb-1">GOALS SCORED</p>
                        <p className="text-3xl font-display italic text-primary">{headToHead.team2GoalsFor}</p>
                    </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs text-white/60">
                        <span>Avg: {(headToHead.team1GoalsFor / headToHead.totalMatches).toFixed(1)}</span>
                        <span className="text-white/40">Goals Per Match</span>
                        <span>Avg: {(headToHead.team2GoalsFor / headToHead.totalMatches).toFixed(1)}</span>
                    </div>
                </div>
            </div>

            {/* Win Percentage Bar */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-blue-500">{team1WinPercentage.toFixed(0)}%</span>
                    <span className="text-white/40">Win Rate</span>
                    <span className="text-blue-500">{team2WinPercentage.toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden flex">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${team1WinPercentage}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="bg-blue-500"
                    />
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${drawPercentage}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                        className="bg-yellow-500"
                    />
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${team2WinPercentage}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
                        className="bg-blue-500"
                    />
                </div>
            </div>

            {/* Recent Matches */}
            {showRecentMatches && recentMatches && recentMatches.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white/40">Recent Matches</h3>
                    <div className="space-y-2">
                        {recentMatches.map((match, idx) => (
                            <RecentMatchCard key={match.id} match={match} team1Id={team1.id} team2Id={team2.id} delay={idx * 0.1} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatBox({
    label,
    value,
    percentage,
    color,
}: {
    label: string;
    value: number;
    percentage: number;
    color: 'blue' | 'yellow' | 'red';
}) {
    const colorClasses = {
        blue: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
        yellow: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
        red: 'bg-red-500/20 text-red-500 border-red-500/30',
    };

    return (
        <div className="bg-white/5 rounded-2xl p-4 text-center">
            <p className="text-xs text-white/40 font-bold mb-2">{label}</p>
            <p className="text-3xl font-display italic text-white mb-1">{value}</p>
            <div className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${colorClasses[color]}`}>
                {percentage.toFixed(0)}%
            </div>
        </div>
    );
}

function RecentMatchCard({
    match,
    team1Id,
    team2Id,
    delay,
}: {
    match: any;
    team1Id: string;
    team2Id: string;
    delay: number;
}) {
    const isTeam1Home = match.homeTeamId === team1Id;
    const team1Score = isTeam1Home ? match.homeScore : match.awayScore;
    const team2Score = isTeam1Home ? match.awayScore : match.homeScore;

    const getResultColor = () => {
        if (team1Score > team2Score) return 'border-blue-500/30 bg-blue-500/10';
        if (team2Score > team1Score) return 'border-red-500/30 bg-red-500/10';
        return 'border-yellow-500/30 bg-yellow-500/10';
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay }}
            className={`flex items-center justify-between p-3 rounded-xl border ${getResultColor()}`}
        >
            <div className="flex items-center gap-3">
                <div className="text-xs text-white/40">
                    {new Date(match.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-xs text-white/60">{match.competition}</div>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-lg font-display italic text-white">{team1Score}</span>
                <span className="text-xs text-white/40">-</span>
                <span className="text-lg font-display italic text-white">{team2Score}</span>
            </div>
        </motion.div>
    );
}

// Empty state component
export function HeadToHeadEmpty() {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-12 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trophy size={32} className="text-white/20" />
            </div>
            <p className="text-sm font-bold text-white/60 mb-1">No Head-to-Head Data</p>
            <p className="text-xs text-white/40">
                These teams haven't faced each other yet
            </p>
        </div>
    );
}

