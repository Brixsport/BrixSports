'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { X, Trophy, Users, TrendingUp, Calendar, MapPin, Award, Star } from 'lucide-react';

interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    color: string;
    university?: string;
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

interface Match {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    status: string;
    startTime: string;
    venue: string;
    competition: string;
    homeTeam?: Team;
    awayTeam?: Team;
}

interface Standing {
    played: number;
    won: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
}

interface TeamProfileOverlayProps {
    team: Team;
    onClose: () => void;
    onSelectPlayer?: (player: Player) => void;
}

// Helper function to validate image paths
const isValidImagePath = (path: string | undefined): boolean => {
    if (!path || path.trim() === '') return false;
    return path.startsWith('/') || path.startsWith('http');
};

export function TeamProfileOverlay({ team, onClose, onSelectPlayer, sport = 'Basketball' }: TeamProfileOverlayProps & { sport?: string }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [players, setPlayers] = useState<Player[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [standing, setStanding] = useState<Standing & { drawn?: number } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTeamData();
    }, [team.id]);

    const fetchTeamData = async () => {
        try {
            setLoading(true);
            const apiSport = sport.toLowerCase();
            const [playersRes, matchesRes, standingsRes] = await Promise.all([
                fetch(`/api/${apiSport}/players?teamId=${team.id}`),
                fetch(`/api/${apiSport}/matches?teamId=${team.id}`),
                fetch(`/api/${apiSport}/standings`)
            ]);

            const [playersData, matchesData, standingsData] = await Promise.all([
                playersRes.json(),
                matchesRes.json(),
                standingsRes.json()
            ]);

            if (playersData.success) {
                setPlayers(playersData.players || []);
            }

            if (matchesData.success) {
                // Filter matches for this team
                const teamMatches = (matchesData.matches || []).filter(
                    (m: Match) => m.homeTeamId === team.id || m.awayTeamId === team.id
                );
                setMatches(teamMatches);
            }

            if (standingsData.success) {
                // Handle both array format and object format
                const allStandings = Array.isArray(standingsData.standings) ? standingsData.standings : (Array.isArray(standingsData) ? standingsData : []);

                const teamStanding = allStandings.find(
                    (s: any) => s.team?.id === team.id || s.teamId === team.id
                );

                if (teamStanding) {
                    setStanding({
                        played: teamStanding.played,
                        won: teamStanding.won,
                        drawn: teamStanding.drawn || 0,
                        lost: teamStanding.lost,
                        goalsFor: teamStanding.goalsFor,
                        goalsAgainst: teamStanding.goalsAgainst,
                        goalDifference: teamStanding.goalDifference,
                        points: teamStanding.points
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching team data:', error);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Trophy },
        { id: 'roster', label: 'Roster', icon: Users },
        { id: 'matches', label: 'Matches', icon: Calendar },
        { id: 'stats', label: 'Stats', icon: TrendingUp },
    ];

    const recentMatches = matches.slice(0, 5);
    const winPercentage = standing ? ((standing.won / (standing.played || 1)) * 100).toFixed(1) : '0.0';
    const isFootball = sport.toLowerCase() === 'football';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md overflow-y-auto"
            onClick={onClose}
        >
            <div className="min-h-screen flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-white/10">
                    <div className="max-w-5xl mx-auto px-4 pt-4 pb-2">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 relative rounded-xl overflow-hidden bg-white/5">
                                    {isValidImagePath(team.logo) ? (
                                        <Image
                                            src={team.logo}
                                            alt={team.name}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold">
                                            {team.shortName}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold">{team.name}</h1>
                                    <p className="text-sm text-white/60">{team.shortName}</p>
                                    {team.university && (
                                        <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{team.university}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                                {standing && (
                                    <div className="flex gap-4">
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-primary leading-none">{standing.won}</p>
                                            <p className="text-[10px] text-white/40 uppercase">W</p>
                                        </div>
                                        {isFootball && (
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-yellow-500 leading-none">{standing.drawn}</p>
                                                <p className="text-[10px] text-white/40 uppercase">D</p>
                                            </div>
                                        )}
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-red-500 leading-none">{standing.lost}</p>
                                            <p className="text-[10px] text-white/40 uppercase">L</p>
                                        </div>
                                        {!isFootball && (
                                            <div className="text-right">
                                                <p className="text-lg font-bold leading-none">{winPercentage}%</p>
                                                <p className="text-[10px] text-white/40 uppercase">Win%</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-1 overflow-x-auto scrollbar-hide border-t border-white/5 pt-2">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activeTab === tab.id
                                        ? 'bg-primary text-black'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <tab.icon size={12} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-5xl mx-auto w-full px-4 py-8">
                    {loading ? (
                        <div className="py-20 text-center">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-white/40">Loading team data...</p>
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            {/* Overview Tab */}
                            {activeTab === 'overview' && (
                                <motion.div
                                    key="overview"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="space-y-6"
                                >
                                    {standing && (
                                        <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                                            <h3 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-4">
                                                Team Statistics
                                            </h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-2xl font-bold">{standing.played}</p>
                                                    <p className="text-xs text-white/40">Games Played</p>
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-bold text-primary">{standing.points}</p>
                                                    <p className="text-xs text-white/40">Points</p>
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-bold">{standing.goalsFor}</p>
                                                    <p className="text-xs text-white/40">{isFootball ? 'Goals For' : 'Points For'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-bold">{standing.goalsAgainst}</p>
                                                    <p className="text-xs text-white/40">{isFootball ? 'Goals Against' : 'Points Against'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                                        <h3 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-4">
                                            Recent Form
                                        </h3>
                                        <div className="space-y-2">
                                            {recentMatches.length > 0 ? (
                                                recentMatches.map((match) => {
                                                    const isHome = match.homeTeamId === team.id;
                                                    const opponent = isHome ? match.awayTeam : match.homeTeam;
                                                    const teamScore = isHome ? match.homeScore : match.awayScore;
                                                    const oppScore = isHome ? match.awayScore : match.homeScore;
                                                    const result = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D';

                                                    return (
                                                        <div
                                                            key={match.id}
                                                            className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${result === 'W'
                                                                        ? 'bg-blue-500/20 text-blue-500'
                                                                        : result === 'L'
                                                                            ? 'bg-red-500/20 text-red-500'
                                                                            : 'bg-yellow-500/20 text-yellow-500'
                                                                        }`}
                                                                >
                                                                    {result}
                                                                </div>
                                                                <span className="text-sm">vs {opponent?.name}</span>
                                                            </div>
                                                            <span className="font-bold">
                                                                {teamScore} - {oppScore}
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p className="text-white/40 text-center py-4">No recent matches</p>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Roster Tab */}
                            {activeTab === 'roster' && (
                                <motion.div
                                    key="roster"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {players.length > 0 ? (
                                            players.map((player) => (
                                                <div
                                                    key={player.id}
                                                    onClick={() => onSelectPlayer?.(player)}
                                                    className="bg-white/5 rounded-2xl border border-white/10 p-6 hover:border-primary/50 transition-all cursor-pointer"
                                                >
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div>
                                                            <h3 className="font-bold text-lg flex items-center gap-2">
                                                                {player.name}
                                                                {player.rating >= 8 && <Star size={16} className="text-primary fill-primary" />}
                                                            </h3>
                                                            <p className="text-sm text-white/40">
                                                                #{player.number} • {player.position}
                                                            </p>
                                                        </div>
                                                        <div className="px-3 py-1 bg-primary/20 text-primary rounded-lg font-bold text-sm">
                                                            {player.rating.toFixed(1)}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-white/60">
                                                        <div>
                                                            <Award size={14} className="inline mr-1" />
                                                            {player.eyePoints} Eye Points
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-full text-center py-12 text-white/40">
                                                No players found
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* Matches Tab */}
                            {activeTab === 'matches' && (
                                <motion.div
                                    key="matches"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="space-y-3"
                                >
                                    {matches.length > 0 ? (
                                        matches.map((match) => {
                                            const isHome = match.homeTeamId === team.id;
                                            // Handle potential missing awayTeam/homeTeam by checking match data or passed team
                                            const opponent = isHome ? match.awayTeam : match.homeTeam;
                                            // Fallback if opponent team data is missing in match object
                                            const opponentName = opponent?.name || 'Opponent';

                                            return (
                                                <div
                                                    key={match.id}
                                                    className="bg-white/5 rounded-2xl border border-white/10 p-4 hover:border-primary/50 transition-all"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <p className="text-xs text-white/40 mb-2">{match.competition}</p>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-semibold">
                                                                    {isHome ? 'vs' : '@'} {opponentName}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-white/40 mt-2">
                                                                <MapPin size={12} className="inline mr-1" />
                                                                {match.venue}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            {match.status === 'FINISHED' ? (
                                                                <div className="text-2xl font-bold">
                                                                    {isHome ? match.homeScore : match.awayScore} -{' '}
                                                                    {isHome ? match.awayScore : match.homeScore}
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-white/60">
                                                                    {new Date(match.startTime).toLocaleDateString()}
                                                                </div>
                                                            )}
                                                            <div className="text-xs text-white/40 mt-1">{match.status}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center py-12 text-white/40">No matches found</div>
                                    )}
                                </motion.div>
                            )}

                            {/* Stats Tab */}
                            {activeTab === 'stats' && standing && (
                                <motion.div
                                    key="stats"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="bg-white/5 rounded-2xl border border-white/10 p-6"
                                >
                                    <h3 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-6">
                                        Detailed Statistics
                                    </h3>
                                    <div className="space-y-6">
                                        <div>
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className="text-white/60">Win Percentage</span>
                                                <span className="font-bold">{winPercentage}%</span>
                                            </div>
                                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary"
                                                    style={{ width: `${winPercentage}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white/5 rounded-xl p-4">
                                                <p className="text-xs text-white/40 mb-1">{isFootball ? 'Avg Goals For' : 'Avg Points For'}</p>
                                                <p className="text-2xl font-bold">
                                                    {(standing.goalsFor / (standing.played || 1)).toFixed(1)}
                                                </p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-4">
                                                <p className="text-xs text-white/40 mb-1">{isFootball ? 'Avg Goals Against' : 'Avg Points Against'}</p>
                                                <p className="text-2xl font-bold">
                                                    {(standing.goalsAgainst / (standing.played || 1)).toFixed(1)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-white/5 rounded-xl p-4">
                                            <p className="text-xs text-white/40 mb-1">{isFootball ? 'Goal Difference' : 'Point Differential'}</p>
                                            <p className={`text-3xl font-bold ${standing.goalDifference > 0 ? 'text-blue-500' : standing.goalDifference < 0 ? 'text-red-500' : ''}`}>
                                                {standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

