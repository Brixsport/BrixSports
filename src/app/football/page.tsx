'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, Users, Activity, Star, Award, Zap, Shield, Goal, GitCompare } from 'lucide-react';
import { PlayerProfileOverlay } from '@/components/PlayerProfileOverlay';
import { TeamProfileOverlay } from '@/components/TeamProfileOverlay';
import { MatchOverlay } from '@/components/MatchOverlay';
import { Match, Player, Team } from '@/types';

// Extend the shared interfaces if necessary for local state, or rely on transformations matching frontend needs.
// Given strict TS, we will cast or ensure data matches.
// We also need a local Standing interface as it might not be in shared types or slightly different.
// Checking shared types, 'Standing' is not exported. Let's define it here matching the API response.

interface Standing {
    id: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    teamId: string;
    team?: Team;
}

interface BracketNode {
    id: string;
    title: string;
    status: string;
    matchId: string | null;
    homeTeam: any;
    awayTeam: any;
    homeScore: number | null;
    awayScore: number | null;
    match: any;
}

interface BracketRound {
    round: string;
    matches: BracketNode[];
}

export default function FootballPage() {
    const [activeTab, setActiveTab] = useState('STANDINGS');
    const [matches, setMatches] = useState<Match[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [statsLeaders, setStatsLeaders] = useState<any>({
        goals: [],
        assists: [],
        cleanSheets: [],
        yellowCards: [],
        rating: []
    });
    const [brackets, setBrackets] = useState<BracketRound[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

    useEffect(() => {
        fetchFootballData();
    }, []);

    const fetchFootballData = async () => {
        try {
            setLoading(true);
            const [matchesRes, standingsRes, teamsRes, playersRes, goalsRes, assistsRes, cleanSheetsRes, yellowCardsRes, ratingRes, bracketRes] = await Promise.all([
                fetch('/api/football/matches'),
                fetch('/api/football/standings'),
                fetch('/api/football/teams'),
                fetch('/api/football/players?sortBy=rating'),
                fetch('/api/players/stats/leaders?sport=Football&type=goals&limit=10'),
                fetch('/api/players/stats/leaders?sport=Football&type=assists&limit=10'),
                fetch('/api/players/stats/leaders?sport=Football&type=cleanSheets&limit=10'),
                fetch('/api/players/stats/leaders?sport=Football&type=yellowCards&limit=10'),
                fetch('/api/players/stats/leaders?sport=Football&type=rating&limit=10'),
                fetch('/api/brackets?sport=Football&competition=BUSA LEAGUE FOOTBALL')
            ]);

            const [matchesData, standingsData, teamsData, playersData, goalsData, assistsData, cleanSheetsData, yellowCardsData, ratingData, bracketData] = await Promise.all([
                matchesRes.json(),
                standingsRes.json(),
                teamsRes.json(),
                playersRes.json(),
                goalsRes.json(),
                assistsRes.json(),
                cleanSheetsRes.json(),
                yellowCardsRes.json(),
                ratingRes.json(),
                bracketRes.json()
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
                // Ensure stats object exists and parse if string
                const processedMatches = sorted.map((match: any) => {
                    let dbStats = {};
                    try {
                        dbStats = typeof match.stats === 'string' ? JSON.parse(match.stats) : (match.stats || {});
                    } catch (e) {
                        console.error('Error parsing match stats:', e);
                    }
                    return { ...match, stats: dbStats };
                });
                setMatches(processedMatches);
            }
            // Standings might be returned as { success: true, standings: [] } or just []
            if (standingsData.success) {
                setStandings(standingsData.standings);
            } else if (Array.isArray(standingsData)) {
                setStandings(standingsData);
            }

            if (teamsData.success) setTeams(teamsData.teams);
            if (playersData.success) setPlayers(playersData.players);

            setStatsLeaders({
                goals: goalsData.leaders || [],
                assists: assistsData.leaders || [],
                cleanSheets: cleanSheetsData.leaders || [],
                yellowCards: yellowCardsData.leaders || [],
                rating: ratingData.leaders || []
            });

            if (bracketData.rounds) {
                setBrackets(bracketData.rounds);
            }

        } catch (error) {
            console.error('Error fetching football data:', error);
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
                                {typeof item.highlightedStat === 'number' && statKey === 'rating'
                                    ? item.highlightedStat.toFixed(1)
                                    : item.highlightedStat}
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
                <div className="max-w-7xl mx-auto px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link href="/" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                                <ArrowLeft size={18} />
                            </Link>
                            <div>
                                <h1 className="text-xl md:text-2xl font-display font-bold flex items-center gap-2">
                                    ⚽ BUSA LEAGUE FOOTBALL
                                </h1>
                                <p className="text-xs text-white/60">2025/2026 Season</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20">
                            <Trophy size={16} />
                            <span className="text-xs font-bold uppercase tracking-widest">{teams.length} Teams</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Tabs */}
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mb-8 overflow-x-auto">
                    {['STANDINGS', 'MATCHES', 'BRACKET', 'STATS', 'TEAMS', 'PLAYERS'].map((tab) => (
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
                        <p className="text-white/40">Loading football data...</p>
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
                                                    <th className="px-6 py-4 text-center">D</th>
                                                    <th className="px-6 py-4 text-center">L</th>
                                                    <th className="px-6 py-4 text-center">GF</th>
                                                    <th className="px-6 py-4 text-center">GA</th>
                                                    <th className="px-6 py-4 text-center">GD</th>
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
                                                        <td className="px-6 py-4 text-center font-semibold text-green-500">{standing.won}</td>
                                                        <td className="px-6 py-4 text-center font-semibold text-yellow-500">{standing.drawn}</td>
                                                        <td className="px-6 py-4 text-center font-semibold text-red-500">{standing.lost}</td>
                                                        <td className="px-6 py-4 text-center font-semibold">{standing.goalsFor}</td>
                                                        <td className="px-6 py-4 text-center font-semibold">{standing.goalsAgainst}</td>
                                                        <td className={`px-6 py-4 text-center font-semibold ${standing.goalDifference > 0 ? 'text-green-500' : standing.goalDifference < 0 ? 'text-red-500' : ''}`}>
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
                                    Scoring: 3 points for a win, 1 point for a draw
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
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0">
                                            {/* Home Team */}
                                            <div className="flex-1 flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                                                <div className="text-left md:text-right order-2 md:order-1">
                                                    <p className="font-bold text-base md:text-lg leading-tight">{match.homeTeam?.name}</p>
                                                    <p className="text-[10px] md:text-xs text-white/40">{match.homeTeam?.shortName}</p>
                                                </div>
                                                <div className="w-10 h-10 md:w-12 md:h-12 relative rounded-lg overflow-hidden bg-white/5 flex-shrink-0 order-1 md:order-2">
                                                    <Image
                                                        src={match.homeTeam?.logo || '/assests/Logos/BRIX-SPORT-LOGO.png'}
                                                        alt={match.homeTeam?.name || 'Team'}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                            </div>

                                            {/* Score / Status */}
                                            <div className="px-4 md:px-8 text-center w-full md:w-auto flex md:flex-col items-center justify-between md:justify-center border-y md:border-0 border-white/5 py-3 md:py-0">
                                                <span className="md:hidden text-[10px] font-black uppercase text-white/20">Final Score</span>
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center gap-4">
                                                        <span className={`text-3xl md:text-4xl font-black font-display italic ${match.status === 'UPCOMING' ? 'text-white' : match.homeScore > match.awayScore ? 'text-primary' : 'text-white/40'}`}>
                                                            {match.status === 'UPCOMING' ? '-' : match.homeScore}
                                                        </span>
                                                        <span className="text-white/20 font-black">-</span>
                                                        <span className={`text-3xl md:text-4xl font-black font-display italic ${match.status === 'UPCOMING' ? 'text-white' : match.awayScore > match.homeScore ? 'text-primary' : 'text-white/40'}`}>
                                                            {match.status === 'UPCOMING' ? '-' : match.awayScore}
                                                        </span>
                                                    </div>
                                                    <p className="hidden md:block text-[10px] text-white/40 mt-2 uppercase tracking-widest font-black">
                                                        {match.status === 'LIVE' ? <span className="text-red-500 font-bold animate-pulse">LIVE</span> : match.status}
                                                    </p>
                                                </div>
                                                <span className="md:hidden px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black uppercase text-white/40 tracking-widest">
                                                    {match.status === 'LIVE' ? <span className="text-red-500 font-bold">LIVE</span> : match.status}
                                                </span>
                                            </div>

                                            {/* Away Team */}
                                            <div className="flex-1 flex items-center justify-between md:justify-start gap-4 w-full md:w-auto">
                                                <div className="w-10 h-10 md:w-12 md:h-12 relative rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                                                    <Image
                                                        src={match.awayTeam?.logo || '/assests/Logos/BRIX-SPORT-LOGO.png'}
                                                        alt={match.awayTeam?.name || 'Team'}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <div className="text-right md:text-left">
                                                    <p className="font-bold text-base md:text-lg leading-tight">{match.awayTeam?.name}</p>
                                                    <p className="text-[10px] md:text-xs text-white/40">{match.awayTeam?.shortName}</p>
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

                        {/* BRACKET TAB */}
                        {activeTab === 'BRACKET' && (
                            <motion.div
                                key="bracket"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                {brackets.length > 0 ? (
                                    <div className="relative overflow-x-auto pb-8 scrollbar-hide">
                                        <div className="min-w-[1000px] relative p-8">
                                            {/* Bracket Connectors Overlay (Simplified SVG) */}
                                            <div className="absolute inset-0 pointer-events-none">
                                                {/* Add SVG paths if needed for visual connectors */}
                                            </div>

                                            <div className="flex justify-around items-stretch gap-12">
                                                {brackets.map((round, roundIdx) => (
                                                    <div key={round.round} className="flex-1 flex flex-col">
                                                        <div className="text-center mb-12">
                                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 mb-1">
                                                                {round.round.replace('_', ' ')}
                                                            </h3>
                                                            <div className="h-1 w-8 bg-primary/20 mx-auto rounded-full" />
                                                        </div>

                                                        <div className="flex-1 flex flex-col justify-around gap-8">
                                                            {round.matches.map((bracketMatch) => {
                                                                // Find the full match object from the matches array
                                                                const fullMatch = bracketMatch.matchId
                                                                    ? matches.find(m => m.id === bracketMatch.matchId)
                                                                    : null;

                                                                return (
                                                                    <div
                                                                        key={bracketMatch.id}
                                                                        onClick={() => fullMatch && setSelectedMatch(fullMatch)}
                                                                        className="relative group"
                                                                    >
                                                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-primary/40 hover:bg-white/[0.07] transition-all cursor-pointer relative z-10 backdrop-blur-sm">
                                                                            <div className="flex justify-between items-center mb-3">
                                                                                <span className="text-[8px] font-black uppercase tracking-widest text-white/30">{bracketMatch.title}</span>
                                                                                <span className={`text-[8px] px-2 py-0.5 rounded font-black ${bracketMatch.status === 'LIVE' ? 'bg-red-500 animate-pulse text-white' : 'bg-white/10 text-white/40'}`}>
                                                                                    {bracketMatch.status}
                                                                                </span>
                                                                            </div>
                                                                            <div className="space-y-3">
                                                                                <div className="flex justify-between items-center">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className="w-6 h-6 rounded bg-white/5 p-1 flex items-center justify-center">
                                                                                            {bracketMatch.homeTeam?.logo ? (
                                                                                                <img src={bracketMatch.homeTeam.logo} className="w-full h-full object-contain" />
                                                                                            ) : (
                                                                                                <div className="w-full h-full border border-white/10 rounded-sm flex items-center justify-center text-[8px] text-white/20">?</div>
                                                                                            )}
                                                                                        </div>
                                                                                        <span className={`text-[10px] font-bold uppercase ${bracketMatch.homeScore !== null && bracketMatch.awayScore !== null && bracketMatch.homeScore > bracketMatch.awayScore ? 'text-white' : 'text-white/60'}`}>
                                                                                            {bracketMatch.homeTeam?.name || 'TBD'}
                                                                                        </span>
                                                                                    </div>
                                                                                    <span className={`font-display italic text-lg ${bracketMatch.homeScore !== null && bracketMatch.awayScore !== null && bracketMatch.homeScore > bracketMatch.awayScore ? 'text-primary' : 'text-white/40'}`}>
                                                                                        {bracketMatch.homeScore ?? '-'}
                                                                                    </span>
                                                                                </div>

                                                                                <div className="h-px bg-white/5 mx-2" />

                                                                                <div className="flex justify-between items-center">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className="w-6 h-6 rounded bg-white/5 p-1 flex items-center justify-center">
                                                                                            {bracketMatch.awayTeam?.logo ? (
                                                                                                <img src={bracketMatch.awayTeam.logo} className="w-full h-full object-contain" />
                                                                                            ) : (
                                                                                                <div className="w-full h-full border border-white/10 rounded-sm flex items-center justify-center text-[8px] text-white/20">?</div>
                                                                                            )}
                                                                                        </div>
                                                                                        <span className={`text-[10px] font-bold uppercase ${bracketMatch.awayScore !== null && bracketMatch.homeScore !== null && bracketMatch.awayScore > bracketMatch.homeScore ? 'text-white' : 'text-white/60'}`}>
                                                                                            {bracketMatch.awayTeam?.name || 'TBD'}
                                                                                        </span>
                                                                                    </div>
                                                                                    <span className={`font-display italic text-lg ${bracketMatch.awayScore !== null && bracketMatch.homeScore !== null && bracketMatch.awayScore > bracketMatch.homeScore ? 'text-primary' : 'text-white/40'}`}>
                                                                                        {bracketMatch.awayScore ?? '-'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>

                                                                            {/* Visual Highlight on Hover */}
                                                                            <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-24 text-center bg-white/5 border border-white/10 rounded-[40px]">
                                        <Trophy className="w-16 h-16 text-white/5 mx-auto mb-6" />
                                        <h3 className="text-xl font-display italic uppercase font-bold text-white/40 mb-2">Bracket Not Established</h3>
                                        <p className="text-white/20 font-black uppercase tracking-widest text-[10px] max-w-sm mx-auto leading-relaxed">
                                            Tournament brackets will appear here once the knockout phases are confirmed.
                                        </p>
                                    </div>
                                )}
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
                                {renderLeaderboardCard('Top Scorers', statsLeaders.goals, <Goal size={20} />, 'goals')}
                                {renderLeaderboardCard('Top Assists', statsLeaders.assists, <Activity size={20} />, 'assists')}
                                {renderLeaderboardCard('Clean Sheets', statsLeaders.cleanSheets, <Shield size={20} />, 'cleanSheets')}
                                {renderLeaderboardCard('Top Rated', statsLeaders.rating, <Star size={20} />, 'rating')}
                                {renderLeaderboardCard('Yellow Cards', statsLeaders.yellowCards, <Award size={20} />, 'yellowCards')}
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
                                {teams.map((team: any) => (
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
                                                    <span className="text-primary font-bold">{player.rating?.toFixed(1) || '0.0'}</span>
                                                </div>
                                            ))}
                                            {team.players && team.players.length > 3 && (
                                                <div className="text-xs text-white/40 pt-2 text-center">
                                                    +{team.players.length - 3} more players
                                                </div>
                                            )}
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
                                <div className="flex justify-end mb-6">
                                    <Link
                                        href="/players/compare?sport=Football"
                                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/50 rounded-xl transition-all font-bold text-sm uppercase tracking-wider"
                                    >
                                        <GitCompare size={18} />
                                        Compare Players
                                    </Link>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {players.map((player: any, index: number) => (
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
                                                        {player.rating?.toFixed(1) || '0.0'}
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
                                                <span>{player.eyePoints || 0} Eye Points</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>

            {/* Overlay components */}
            {selectedPlayer && (
                <PlayerProfileOverlay
                    player={selectedPlayer}
                    onClose={() => setSelectedPlayer(null)}
                    sport="Football"
                />
            )}

            {selectedTeam && (
                <TeamProfileOverlay
                    team={selectedTeam}
                    sport="Football"
                    onClose={() => setSelectedTeam(null)}
                    onSelectPlayer={(player) => {
                        setSelectedPlayer(player);
                        setSelectedTeam(null);
                    }}
                />
            )}

            {selectedMatch && (
                <MatchOverlay
                    match={selectedMatch}
                    onClose={() => setSelectedMatch(null)}
                    onSelectPlayer={(player) => {
                        setSelectedPlayer(player);
                        setSelectedMatch(null);
                    }}
                />
            )}
        </div>
    );
}
