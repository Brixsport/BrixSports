'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, TrendingUp, Users, Activity, Star, Award, Zap } from 'lucide-react';
import { PlayerProfileOverlay } from '@/components/PlayerProfileOverlay';
import { TeamProfileOverlay } from '@/components/TeamProfileOverlay';
import { BasketballMatchOverlay } from '@/components/BasketballMatchOverlay';

interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    color: string;
}

interface Match {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    status: string;
    startTime: string;
    venue: string;
    homeTeam?: Team;
    awayTeam?: Team;
}

interface Standing {
    id: string;
    played: number;
    won: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    team?: Team;
}

interface Player {
    id: string;
    name: string;
    number: number;
    teamId: string;
    position: string;
    rating: number;
    eyePoints: number;
    team?: Team;
}

export default function BasketballPage() {
    const [activeTab, setActiveTab] = useState('STANDINGS');
    const [matches, setMatches] = useState<Match[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [statsLeaders, setStatsLeaders] = useState<any>({
        points: [],
        rebounds: [],
        assists: [],
        steals: [],
        blocks: []
    });
    const [loading, setLoading] = useState(true);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

    useEffect(() => {
        fetchBasketballData();
    }, []);

    const fetchBasketballData = async () => {
        try {
            setLoading(true);
            const [matchesRes, standingsRes, teamsRes, playersRes, pointsRes, reboundsRes, assistsRes, stealsRes, blocksRes] = await Promise.all([
                fetch('/api/basketball/matches'),
                fetch('/api/basketball/standings'),
                fetch('/api/basketball/teams'),
                fetch('/api/basketball/players?sortBy=rating'),
                fetch('/api/players/stats/leaders?sport=Basketball&type=points&limit=10'),
                fetch('/api/players/stats/leaders?sport=Basketball&type=rebounds&limit=10'),
                fetch('/api/players/stats/leaders?sport=Basketball&type=assists&limit=10'),
                fetch('/api/players/stats/leaders?sport=Basketball&type=steals&limit=10'),
                fetch('/api/players/stats/leaders?sport=Basketball&type=blocks&limit=10')
            ]);

            const [matchesData, standingsData, teamsData, playersData, pointsData, reboundsData, assistsData, stealsData, blocksData] = await Promise.all([
                matchesRes.json(),
                standingsRes.json(),
                teamsRes.json(),
                playersRes.json(),
                pointsRes.json(),
                reboundsRes.json(),
                assistsRes.json(),
                stealsRes.json(),
                blocksRes.json()
            ]);

            if (matchesData.success) {
                // Sort matches: UPCOMING first (asc date), then others (desc date) to show recent results
                const sorted = matchesData.matches.sort((a: Match, b: Match) => {
                    const statusOrder = { 'LIVE': 0, 'UPCOMING': 1, 'FINISHED': 2 };
                    const statusA = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
                    const statusB = statusOrder[b.status as keyof typeof statusOrder] ?? 3;

                    if (statusA !== statusB) return statusA - statusB;

                    // If both upcoming, sort earliest first
                    if (a.status === 'UPCOMING') {
                        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
                    }

                    // If finished, sort latest first (reverse chronological)
                    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
                });
                setMatches(sorted);
            }
            if (standingsData.success) setStandings(standingsData.standings);
            if (teamsData.success) setTeams(teamsData.teams);
            if (playersData.success) setPlayers(playersData.players);

            setStatsLeaders({
                points: pointsData.leaders || [],
                rebounds: reboundsData.leaders || [],
                assists: assistsData.leaders || [],
                steals: stealsData.leaders || [],
                blocks: blocksData.leaders || []
            });

        } catch (error) {
            console.error('Error fetching basketball data:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderLeaderboardCard = (title: string, data: any[], icon: any, statKey: string) => (
        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    {icon}
                </div>
                <h3 className="font-display text-lg px-2 font-bold tracking-tight uppercase">{title}</h3>
            </div>
            <div className="space-y-4">
                {data.map((item, index) => (
                    <div
                        key={item.player.id}
                        onClick={() => setSelectedPlayer(item.player)}
                        className="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <span className={`text-lg font-bold w-6 text-center ${index === 0 ? 'text-primary' : 'text-white/40'}`}>
                                {index + 1}
                            </span>
                            <div className="relative">
                                <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                                    <Image
                                        src={item.team?.logo || '/assests/Logos/BRIX-SPORT-LOGO.png'}
                                        alt={item.team?.name || 'Team'}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold truncate max-w-[120px]">{item.player.name}</span>
                                <span className="text-[10px] text-white/40 uppercase tracking-wider">{item.team?.name}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-secondary font-display text-xl leading-none italic font-bold">
                                {item.highlightedStat}
                            </span>
                            <span className="text-[10px] text-white/40 uppercase">Total</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Header */}
            <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                                <ArrowLeft size={20} />
                            </Link>
                            <div>
                                <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                                    🏀 BUSA LEAGUE BASKETBALL
                                </h1>
                                <p className="text-sm text-white/60">2025/2026 Season</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg border border-primary/20">
                            <Trophy size={18} />
                            <span className="text-xs font-bold uppercase tracking-widest">6 Teams • 6 Rounds</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Tabs */}
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mb-8 overflow-x-auto">
                    {['STANDINGS', 'MATCHES', 'STATS', 'TEAMS', 'PLAYERS'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab
                                ? 'bg-primary text-black shadow-lg shadow-primary/20'
                                : 'text-white/40 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="py-20 text-center">
                        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-white/40">Loading basketball data...</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {/* STANDINGS TAB */}
                        {activeTab === 'STANDINGS' && (
                            <motion.div
                                key="standings"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-white/5">
                                                <tr className="text-xs font-bold uppercase tracking-widest text-white/60">
                                                    <th className="px-6 py-4 text-left">Pos</th>
                                                    <th className="px-6 py-4 text-left">Team</th>
                                                    <th className="px-6 py-4 text-center">P</th>
                                                    <th className="px-6 py-4 text-center">W</th>
                                                    <th className="px-6 py-4 text-center">L</th>
                                                    <th className="px-6 py-4 text-center">PF</th>
                                                    <th className="px-6 py-4 text-center">PA</th>
                                                    <th className="px-6 py-4 text-center">PD</th>
                                                    <th className="px-6 py-4 text-center">Pts</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {standings.map((standing, index) => (
                                                    <tr
                                                        key={standing.id}
                                                        onClick={() => standing.team && setSelectedTeam(standing.team)}
                                                        className="border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                                                    >
                                                        <td className="px-6 py-4">
                                                            <span className={`text-lg font-bold ${index === 0 ? 'text-primary' : ''}`}>
                                                                {index + 1}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 relative rounded-lg overflow-hidden bg-white/5">
                                                                    <Image
                                                                        src={standing.team?.logo || '/assests/Logos/BRIX-SPORT-LOGO.png'}
                                                                        alt={standing.team?.name || 'Team'}
                                                                        fill
                                                                        className="object-cover"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold">{standing.team?.name}</p>
                                                                    <p className="text-xs text-white/40">{standing.team?.shortName}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-semibold">{standing.played}</td>
                                                        <td className="px-6 py-4 text-center font-semibold text-blue-500">{standing.won}</td>
                                                        <td className="px-6 py-4 text-center font-semibold text-red-500">{standing.lost}</td>
                                                        <td className="px-6 py-4 text-center font-semibold">{standing.goalsFor}</td>
                                                        <td className="px-6 py-4 text-center font-semibold">{standing.goalsAgainst}</td>
                                                        <td className={`px-6 py-4 text-center font-semibold ${standing.goalDifference > 0 ? 'text-blue-500' : standing.goalDifference < 0 ? 'text-red-500' : ''}`}>
                                                            {standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-bold">
                                                                {standing.points}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <p className="text-xs text-white/40 mt-4 text-center">
                                    Scoring: 2 points for a win, 1 point for a loss
                                </p>
                            </motion.div>
                        )}

                        {/* MATCHES TAB */}
                        {activeTab === 'MATCHES' && (
                            <motion.div
                                key="matches"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-4"
                            >
                                {matches.map((match) => (
                                    <div
                                        key={match.id}
                                        onClick={() => setSelectedMatch(match)}
                                        className="bg-white/5 rounded-2xl border border-white/10 p-6 hover:border-primary/50 transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 flex items-center justify-end gap-4">
                                                <div className="text-right">
                                                    <p className="font-bold text-lg">{match.homeTeam?.name}</p>
                                                    <p className="text-xs text-white/40">{match.homeTeam?.shortName}</p>
                                                </div>
                                                <div className="w-12 h-12 relative rounded-lg overflow-hidden bg-white/5">
                                                    <Image
                                                        src={match.homeTeam?.logo || '/assests/Logos/BRIX-SPORT-LOGO.png'}
                                                        alt={match.homeTeam?.name || 'Team'}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                            </div>
                                            <div className="px-8 text-center">
                                                <div className="flex items-center gap-4">
                                                    <span className={`text-4xl font-bold ${match.homeScore > match.awayScore ? 'text-primary' : 'text-white/40'}`}>
                                                        {match.homeScore}
                                                    </span>
                                                    <span className="text-white/20">-</span>
                                                    <span className={`text-4xl font-bold ${match.awayScore > match.homeScore ? 'text-primary' : 'text-white/40'}`}>
                                                        {match.awayScore}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-white/40 mt-2 uppercase tracking-widest">{match.status}</p>
                                            </div>
                                            <div className="flex-1 flex items-center gap-4">
                                                <div className="w-12 h-12 relative rounded-lg overflow-hidden bg-white/5">
                                                    <Image
                                                        src={match.awayTeam?.logo || '/assests/Logos/BRIX-SPORT-LOGO.png'}
                                                        alt={match.awayTeam?.name || 'Team'}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-lg">{match.awayTeam?.name}</p>
                                                    <p className="text-xs text-white/40">{match.awayTeam?.shortName}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
                                            <span>{match.venue}</span>
                                            <span>{new Date(match.startTime).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {/* STATS TAB */}
                        {activeTab === 'STATS' && (
                            <motion.div
                                key="stats"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                            >
                                {renderLeaderboardCard('Points Leaders', statsLeaders.points, <Zap size={20} />, 'points')}
                                {renderLeaderboardCard('Rebounds Leaders', statsLeaders.rebounds, <Activity size={20} />, 'rebounds')}
                                {renderLeaderboardCard('Assists Leaders', statsLeaders.assists, <Users size={20} />, 'assists')}
                                {renderLeaderboardCard('Steals Leaders', statsLeaders.steals, <Award size={20} />, 'steals')}
                                {renderLeaderboardCard('Blocks Leaders', statsLeaders.blocks, <TrendingUp size={20} />, 'blocks')}
                            </motion.div>
                        )}

                        {/* TEAMS TAB */}
                        {activeTab === 'TEAMS' && (
                            <motion.div
                                key="teams"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                            >
                                {teams.map((team) => (
                                    <div
                                        key={team.id}
                                        onClick={() => setSelectedTeam(team)}
                                        className="bg-white/5 rounded-2xl border border-white/10 p-6 hover:border-primary/50 transition-all group cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-16 h-16 relative rounded-xl overflow-hidden bg-white/5 group-hover:scale-110 transition-transform">
                                                <Image
                                                    src={team.logo || '/assests/Logos/BRIX-SPORT-LOGO.png'}
                                                    alt={team.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-xl">{team.name}</h3>
                                                <p className="text-sm text-white/40">{team.shortName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Users size={16} className="text-white/40" />
                                            <span className="text-sm text-white/60">{team.playerCount} Players</span>
                                        </div>
                                        <div className="space-y-2">
                                            {team.players?.slice(0, 3).map((player: any) => (
                                                <div key={player.id} className="flex items-center justify-between text-sm">
                                                    <span className="text-white/60">#{player.number} {player.name}</span>
                                                    <span className="text-primary font-bold">{player.rating.toFixed(1)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {/* PLAYERS TAB */}
                        {activeTab === 'PLAYERS' && (
                            <motion.div
                                key="players"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {players.map((player, index) => (
                                        <div
                                            key={player.id}
                                            onClick={() => setSelectedPlayer(player)}
                                            className="bg-white/5 rounded-2xl border border-white/10 p-6 hover:border-primary/50 transition-all cursor-pointer"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <h3 className="font-bold text-lg flex items-center gap-2">
                                                        {player.name}
                                                        {index < 3 && <Star size={16} className="text-primary fill-primary" />}
                                                    </h3>
                                                    <p className="text-sm text-white/40">#{player.number} • {player.position}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-bold">
                                                        {player.rating.toFixed(1)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-8 h-8 relative rounded-lg overflow-hidden bg-white/5">
                                                    <Image
                                                        src={player.team?.logo || '/assests/Logos/BRIX-SPORT-LOGO.png'}
                                                        alt={player.team?.name || 'Team'}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <span className="text-sm text-white/60">{player.team?.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-white/40">
                                                <Zap size={14} className="text-primary" />
                                                <span>{player.eyePoints} Eye Points</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>

            {/* Overlay components... */}
            {selectedPlayer && (
                <PlayerProfileOverlay
                    player={selectedPlayer}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}

            {/* Team Profile Overlay */}
            {selectedTeam && (
                <TeamProfileOverlay
                    team={selectedTeam}
                    onClose={() => setSelectedTeam(null)}
                    onSelectPlayer={(player) => {
                        setSelectedPlayer(player);
                        setSelectedTeam(null);
                    }}
                />
            )}

            {/* Basketball Match Overlay */}
            {selectedMatch && (
                <BasketballMatchOverlay
                    match={selectedMatch}
                    onClose={() => setSelectedMatch(null)}
                    onSelectTeam={(team) => {
                        setSelectedTeam(team);
                        setSelectedMatch(null);
                    }}
                    onSelectPlayer={(player) => {
                        setSelectedPlayer(player);
                        setSelectedMatch(null);
                    }}
                />
            )}
        </div>
    );
}

