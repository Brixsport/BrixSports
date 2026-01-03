'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trophy, TrendingUp, Award, Shield, Target, AlertCircle,
    ChevronDown, ChevronUp, Info, Calendar, Users, Zap, Wifi, WifiOff
} from 'lucide-react';
import Link from 'next/link';
import { useLiveStandings } from '@/hooks/useLiveStandings';
import { StandingsFilters, FilterOptions, SortOption } from '@/components/StandingsFilters';

// Mock data - will be replaced with real API calls
const mockCompetitionData = {
    competition: {
        id: 'nuga-2024',
        name: 'NUGA Football Championship 2024',
        sport: 'Football',
        format: 'league',
        season: '2024',
        status: 'ongoing',
        numberOfTeams: 8,
        description: 'Nigerian University Games Association Football Championship',
    },
    standings: [
        {
            position: 1,
            teamId: 'unilag',
            teamName: 'UNILAG Marines',
            teamLogo: '🌊',
            university: 'University of Lagos',
            played: 7,
            won: 5,
            drawn: 2,
            lost: 0,
            goalsFor: 15,
            goalsAgainst: 5,
            goalDifference: 10,
            points: 17,
            form: ['W', 'W', 'D', 'W', 'W'], // Last 5 matches
        },
        {
            position: 2,
            teamId: 'uniben',
            teamName: 'UNIBEN Royals',
            teamLogo: '🦁',
            university: 'University of Benin',
            played: 7,
            won: 5,
            drawn: 1,
            lost: 1,
            goalsFor: 14,
            goalsAgainst: 6,
            goalDifference: 8,
            points: 16,
            form: ['W', 'L', 'W', 'W', 'D'],
        },
        {
            position: 3,
            teamId: 'ui',
            teamName: 'UI Lions',
            teamLogo: '🦁',
            university: 'University of Ibadan',
            played: 7,
            won: 4,
            drawn: 2,
            lost: 1,
            goalsFor: 12,
            goalsAgainst: 7,
            goalDifference: 5,
            points: 14,
            form: ['W', 'D', 'W', 'W', 'D'],
        },
        // Add more teams...
    ],
    topScorers: [
        {
            id: 'p1',
            name: 'Tunde Adeyemi',
            team: 'UNILAG Marines',
            teamLogo: '🌊',
            goals: 8,
            assists: 3,
            appearances: 7,
        },
        {
            id: 'p2',
            name: 'Emeka Obi',
            team: 'UNIBEN Royals',
            teamLogo: '🦁',
            goals: 7,
            assists: 2,
            appearances: 7,
        },
        {
            id: 'p3',
            name: 'Chidi Nwosu',
            team: 'UI Lions',
            teamLogo: '🦁',
            goals: 6,
            assists: 4,
            appearances: 7,
        },
    ],
    topAssists: [
        {
            id: 'p4',
            name: 'Segun Bello',
            team: 'UNILAG Marines',
            teamLogo: '🌊',
            assists: 5,
            goals: 3,
            appearances: 7,
        },
        {
            id: 'p3',
            name: 'Chidi Nwosu',
            team: 'UI Lions',
            teamLogo: '🦁',
            assists: 4,
            goals: 6,
            appearances: 7,
        },
    ],
    disciplinary: [
        {
            id: 'p5',
            name: 'Yusuf Mohammed',
            team: 'OAU Giants',
            teamLogo: '⚡',
            yellowCards: 4,
            redCards: 1,
            appearances: 6,
        },
        {
            id: 'p6',
            name: 'David Okon',
            team: 'UNIBEN Royals',
            teamLogo: '🦁',
            yellowCards: 3,
            redCards: 0,
            appearances: 7,
        },
    ],
};

type TabType = 'standings' | 'scorers' | 'assists' | 'discipline' | 'rules';

export default function CompetitionStandingsPage() {
    const [activeTab, setActiveTab] = useState<TabType>('standings');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [data] = useState(mockCompetitionData);

    const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
        { key: 'standings', label: 'Standings', icon: <Trophy size={14} /> },
        { key: 'scorers', label: 'Top Scorers', icon: <Target size={14} /> },
        { key: 'assists', label: 'Top Assists', icon: <Award size={14} /> },
        { key: 'discipline', label: 'Discipline', icon: <AlertCircle size={14} /> },
        { key: 'rules', label: 'Rules', icon: <Info size={14} /> },
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Trophy size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                            {data.competition.season}
                        </span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none mb-2">
                                {data.competition.name}
                            </h1>
                            <p className="text-sm text-white/60">{data.competition.description}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                                <Users size={16} className="text-primary" />
                                <span className="text-sm font-bold">{data.competition.numberOfTeams} Teams</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-xl">
                                <Zap size={16} className="text-green-500" />
                                <span className="text-sm font-bold text-green-500 uppercase">{data.competition.status}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all text-sm font-black uppercase tracking-widest ${activeTab === tab.key
                                ? 'bg-primary text-black'
                                : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'standings' && (
                            <StandingsTable
                                standings={data.standings}
                                expandedRow={expandedRow}
                                onRowExpand={setExpandedRow}
                            />
                        )}
                        {activeTab === 'scorers' && <TopScorersTable players={data.topScorers} />}
                        {activeTab === 'assists' && <TopAssistsTable players={data.topAssists} />}
                        {activeTab === 'discipline' && <DisciplinaryTable players={data.disciplinary} />}
                        {activeTab === 'rules' && <CompetitionRules competition={data.competition} />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function StandingsTable({
    standings,
    expandedRow,
    onRowExpand,
}: {
    standings: any[];
    expandedRow: string | null;
    onRowExpand: (id: string | null) => void;
}) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Pos</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Team</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">P</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">W</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">D</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">L</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">GF</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">GA</th>
                            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">GD</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-primary text-center">Pts</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">Form</th>
                            <th className="px-4 py-4"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {standings.map((team, idx) => (
                            <StandingsRow
                                key={team.teamId}
                                team={team}
                                isExpanded={expandedRow === team.teamId}
                                onExpand={() => onRowExpand(expandedRow === team.teamId ? null : team.teamId)}
                                delay={idx * 0.05}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3 p-4">
                {standings.map((team, idx) => (
                    <StandingsMobileCard key={team.teamId} team={team} delay={idx * 0.05} />
                ))}
            </div>
        </div>
    );
}

function StandingsRow({
    team,
    isExpanded,
    onExpand,
    delay,
}: {
    team: any;
    isExpanded: boolean;
    onExpand: () => void;
    delay: number;
}) {
    const getPositionColor = (pos: number) => {
        if (pos <= 2) return 'text-primary';
        if (pos <= 4) return 'text-blue-500';
        return 'text-white/40';
    };

    return (
        <>
            <motion.tr
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay }}
                className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                onClick={onExpand}
            >
                <td className="px-6 py-4">
                    <span className={`text-lg font-display italic ${getPositionColor(team.position)}`}>
                        {team.position}
                    </span>
                </td>
                <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{team.teamLogo}</span>
                        <div>
                            <p className="text-sm font-black uppercase tracking-tight">{team.teamName}</p>
                            <p className="text-[10px] text-white/40 font-bold uppercase">{team.university}</p>
                        </div>
                    </div>
                </td>
                <td className="px-4 py-4 text-center font-bold text-sm">{team.played}</td>
                <td className="px-4 py-4 text-center font-bold text-sm">{team.won}</td>
                <td className="px-4 py-4 text-center font-bold text-sm">{team.drawn}</td>
                <td className="px-4 py-4 text-center font-bold text-sm">{team.lost}</td>
                <td className="px-4 py-4 text-center font-bold text-sm">{team.goalsFor}</td>
                <td className="px-4 py-4 text-center font-bold text-sm">{team.goalsAgainst}</td>
                <td className="px-4 py-4 text-center font-bold text-sm text-white/60">
                    {team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}
                </td>
                <td className="px-6 py-4 text-center">
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-xl font-display italic text-lg border border-primary/20">
                        {team.points}
                    </span>
                </td>
                <td className="px-6 py-4">
                    <FormGuide form={team.form} />
                </td>
                <td className="px-4 py-4 text-center">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </td>
            </motion.tr>
            {isExpanded && (
                <tr>
                    <td colSpan={12} className="px-6 py-4 bg-white/5">
                        <ExpandedTeamInfo team={team} />
                    </td>
                </tr>
            )}
        </>
    );
}

function StandingsMobileCard({ team, delay }: { team: any; delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4"
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-display italic text-primary">{team.position}</span>
                    <span className="text-2xl">{team.teamLogo}</span>
                    <div>
                        <p className="text-sm font-black uppercase">{team.teamName}</p>
                        <p className="text-xs text-white/40">{team.university}</p>
                    </div>
                </div>
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-xl font-display italic text-xl border border-primary/20">
                    {team.points}
                </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3">
                <div>
                    <p className="text-white/40 font-bold mb-1">P</p>
                    <p className="font-black">{team.played}</p>
                </div>
                <div>
                    <p className="text-white/40 font-bold mb-1">W</p>
                    <p className="font-black">{team.won}</p>
                </div>
                <div>
                    <p className="text-white/40 font-bold mb-1">D</p>
                    <p className="font-black">{team.drawn}</p>
                </div>
                <div>
                    <p className="text-white/40 font-bold mb-1">L</p>
                    <p className="font-black">{team.lost}</p>
                </div>
            </div>
            <FormGuide form={team.form} />
        </motion.div>
    );
}

function FormGuide({ form }: { form: string[] }) {
    const getFormColor = (result: string) => {
        if (result === 'W') return 'bg-green-500 text-white';
        if (result === 'D') return 'bg-yellow-500 text-black';
        return 'bg-red-500 text-white';
    };

    return (
        <div className="flex items-center gap-1">
            {form.map((result, idx) => (
                <div
                    key={idx}
                    className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black ${getFormColor(
                        result
                    )}`}
                >
                    {result}
                </div>
            ))}
        </div>
    );
}

function ExpandedTeamInfo({ team }: { team: any }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-white/40 mb-2">Attack</h4>
                <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="text-white/60">Goals Scored</span>
                        <span className="font-bold">{team.goalsFor}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-white/60">Goals/Match</span>
                        <span className="font-bold">{(team.goalsFor / team.played).toFixed(1)}</span>
                    </div>
                </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-white/40 mb-2">Defense</h4>
                <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="text-white/60">Goals Conceded</span>
                        <span className="font-bold">{team.goalsAgainst}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-white/60">Conceded/Match</span>
                        <span className="font-bold">{(team.goalsAgainst / team.played).toFixed(1)}</span>
                    </div>
                </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-white/40 mb-2">Performance</h4>
                <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="text-white/60">Win Rate</span>
                        <span className="font-bold">{((team.won / team.played) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-white/60">Points/Match</span>
                        <span className="font-bold">{(team.points / team.played).toFixed(1)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TopScorersTable({ players }: { players: any[] }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
            <div className="space-y-3">
                {players.map((player, idx) => (
                    <motion.div
                        key={player.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <span className={`text-2xl font-display italic ${idx < 3 ? 'text-primary' : 'text-white/40'}`}>
                                {idx + 1}
                            </span>
                            <span className="text-2xl">{player.teamLogo}</span>
                            <div>
                                <p className="text-sm font-black uppercase">{player.name}</p>
                                <p className="text-xs text-white/60">{player.team}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <p className="text-xs text-white/40 font-bold mb-1">GOALS</p>
                                <p className="text-2xl font-display italic text-primary">{player.goals}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-white/40 font-bold mb-1">ASSISTS</p>
                                <p className="text-lg font-bold">{player.assists}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-white/40 font-bold mb-1">APPS</p>
                                <p className="text-lg font-bold">{player.appearances}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function TopAssistsTable({ players }: { players: any[] }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
            <div className="space-y-3">
                {players.map((player, idx) => (
                    <motion.div
                        key={player.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <span className={`text-2xl font-display italic ${idx < 3 ? 'text-primary' : 'text-white/40'}`}>
                                {idx + 1}
                            </span>
                            <span className="text-2xl">{player.teamLogo}</span>
                            <div>
                                <p className="text-sm font-black uppercase">{player.name}</p>
                                <p className="text-xs text-white/60">{player.team}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <p className="text-xs text-white/40 font-bold mb-1">ASSISTS</p>
                                <p className="text-2xl font-display italic text-primary">{player.assists}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-white/40 font-bold mb-1">GOALS</p>
                                <p className="text-lg font-bold">{player.goals}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-white/40 font-bold mb-1">APPS</p>
                                <p className="text-lg font-bold">{player.appearances}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function DisciplinaryTable({ players }: { players: any[] }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
            <div className="space-y-3">
                {players.map((player, idx) => (
                    <motion.div
                        key={player.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl"
                    >
                        <div className="flex items-center gap-4">
                            <span className="text-2xl">{player.teamLogo}</span>
                            <div>
                                <p className="text-sm font-black uppercase">{player.name}</p>
                                <p className="text-xs text-white/60">{player.team}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-6 bg-yellow-500 rounded"></div>
                                <span className="text-lg font-bold">{player.yellowCards}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-6 bg-red-500 rounded"></div>
                                <span className="text-lg font-bold">{player.redCards}</span>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-white/40 font-bold mb-1">APPS</p>
                                <p className="text-lg font-bold">{player.appearances}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function CompetitionRules({ competition }: { competition: any }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
            <div className="space-y-6">
                <div>
                    <h3 className="text-xl font-display italic uppercase mb-3">Competition Format</h3>
                    <p className="text-white/80 leading-relaxed">
                        The {competition.name} is a {competition.format} format competition featuring {competition.numberOfTeams} teams
                        competing for the championship title.
                    </p>
                </div>

                <div>
                    <h3 className="text-xl font-display italic uppercase mb-3">Points System</h3>
                    <ul className="space-y-2 text-white/80">
                        <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-primary rounded-full"></span>
                            Win: 3 points
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-primary rounded-full"></span>
                            Draw: 1 point
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-primary rounded-full"></span>
                            Loss: 0 points
                        </li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-xl font-display italic uppercase mb-3">Tiebreaker Rules</h3>
                    <ol className="space-y-2 text-white/80 list-decimal list-inside">
                        <li>Total points</li>
                        <li>Goal difference</li>
                        <li>Goals scored</li>
                        <li>Head-to-head record</li>
                        <li>Fair play points</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-xl font-display italic uppercase mb-3">Qualification</h3>
                    <p className="text-white/80 leading-relaxed">
                        The top 2 teams qualify for the knockout stage. Teams finishing 3rd and 4th enter a playoff for the final
                        knockout spot.
                    </p>
                </div>
            </div>
        </div>
    );
}
