'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, TrendingUp, Users, Activity, Star, Award, Zap, GitCompare, ChevronDown } from 'lucide-react';
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
    competition?: string;
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

interface Competition {
    id: string;
    name: string;
    sport: string;
    season?: string;
    status?: string;
}

function BasketballContent() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState('STANDINGS');
    const [matches, setMatches] = useState<Match[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    // Competitions State
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);

    const [statsLeaders, setStatsLeaders] = useState<any>({
        points: [],
        rebounds: [],
        assists: [],
        steals: [],
        blocks: []
    });
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

    // Initial Load: Competitions & Global Data
    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);

                // 1. Fetch Basketball Competitions
                const compRes = await fetch('/api/competitions?sport=Basketball');
                const compData = await compRes.json();

                let validComps: Competition[] = [];
                if (compData.competitions) {
                    validComps = compData.competitions;
                    setCompetitions(validComps);

                    // Default to URL param, then BUSA, then first available
                    const paramCompName = searchParams.get('competition');
                    let defaultComp = null;

                    if (paramCompName) {
                        defaultComp = validComps.find(c => c.name === paramCompName);
                    }

                    if (!defaultComp) {
                        defaultComp = validComps.find(c => c.name.toUpperCase().includes('BUSA')) || validComps[0];
                    }

                    if (defaultComp) setSelectedCompetition(defaultComp);
                }

                // 2. Fetch Global Data (Teams, Players, Stats)
                const [teamsRes, playersRes, pointsRes, reboundsRes, assistsRes, stealsRes, blocksRes] = await Promise.all([
                    fetch('/api/basketball/teams'),
                    fetch('/api/basketball/players?sortBy=rating'),
                    fetch('/api/players/stats/leaders?sport=Basketball&type=points&limit=10'),
                    fetch('/api/players/stats/leaders?sport=Basketball&type=rebounds&limit=10'),
                    fetch('/api/players/stats/leaders?sport=Basketball&type=assists&limit=10'),
                    fetch('/api/players/stats/leaders?sport=Basketball&type=steals&limit=10'),
                    fetch('/api/players/stats/leaders?sport=Basketball&type=blocks&limit=10')
                ]);

                const [teamsData, playersData, pointsData, reboundsData, assistsData, stealsData, blocksData] = await Promise.all([
                    teamsRes.json(),
                    playersRes.json(),
                    pointsRes.json(),
                    reboundsRes.json(),
                    assistsRes.json(),
                    stealsRes.json(),
                    blocksRes.json()
                ]);

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

        init();
    }, []);

    // Effect: Fetch Competition Specific Data
    useEffect(() => {
        if (!selectedCompetition) return;

        const fetchCompData = async () => {
            setDataLoading(true);
            try {
                const [matchesRes, standingsRes] = await Promise.all([
                    fetch('/api/basketball/matches'),
                    fetch(`/api/basketball/standings?competition=${encodeURIComponent(selectedCompetition.name)}`)
                ]);

                const [matchesData, standingsData] = await Promise.all([
                    matchesRes.json(),
                    standingsRes.json()
                ]);

                // Process Matches
                if (matchesData.success) {
                    const allMatches = matchesData.matches || [];
                    // Filter by selected competition
                    const compMatches = allMatches.filter((m: Match) => m.competition === selectedCompetition.name);

                    // Sort matches
                    const sorted = compMatches.sort((a: Match, b: Match) => {
                        const statusOrder = { 'LIVE': 0, 'UPCOMING': 1, 'FINISHED': 2 };
                        const statusA = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
                        const statusB = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
                        if (statusA !== statusB) return statusA - statusB;
                        if (a.status === 'UPCOMING') return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
                        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
                    });
                    setMatches(sorted);
                }

                // Process Standings
                if (standingsData.success) setStandings(standingsData.standings);
                else setStandings([]);

            } catch (err) {
                console.error('Error fetching competition data:', err);
            } finally {
                setDataLoading(false);
            }
        };

        fetchCompData();
    }, [selectedCompetition]);


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

                            {/* Competition Selector */}
                            {competitions.length > 0 ? (
                                <div className="relative group">
                                    <button className="text-3xl font-display font-bold flex items-center gap-3 cursor-pointer hover:text-white/80 transition-colors">
                                        🏀 {selectedCompetition?.name || 'Basketball Hub'}
                                        <ChevronDown size={24} className="text-white/40" />
                                    </button>
                                    <p className="text-sm text-white/60">{selectedCompetition?.season || '2025/2026'} Season • {selectedCompetition?.status || 'Active'} League</p>

                                    {/* Dropdown Menu */}
                                    <div className="absolute top-full left-0 mt-2 w-72 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden hidden group-hover:block z-50">
                                        <div className="p-2">
                                            <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/40">Select League</p>
                                            {competitions.map(comp => (
                                                <button
                                                    key={comp.id}
                                                    onClick={() => {
                                                        setSelectedCompetition(comp);
                                                    }}
                                                    className={`w-full text-left px-3 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-between ${selectedCompetition?.id === comp.id ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                                                >
                                                    <span>{comp.name}</span>
                                                    {selectedCompetition?.id === comp.id && <div className="w-2 h-2 bg-primary rounded-full"></div>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                                        🏀 Basketball Hub
                                    </h1>
                                    <p className="text-sm text-white/60">Loading competitions...</p>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg border border-primary/20">
                            <Trophy size={18} />
                            <span className="text-xs font-bold uppercase tracking-widest">
                                {selectedCompetition ? 'Active Season' : 'Loading...'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Tabs */}
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mb-8 overflow-x-auto scrollbar-hide">
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
                    <div className={`transition-opacity duration-300 ${dataLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        <AnimatePresence mode="wait">
                            {/* STANDINGS TAB */}
                            {activeTab === 'STANDINGS' && (
                                <motion.div
                                    key="standings"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                >
                                    {standings.length > 0 ? (
                                        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-white/5">
                                                        <tr className="text-xs font-bold uppercase tracking-widest text-white/60">
                                                            <th className="px-2 md:px-6 py-4 text-left">Pos</th>
                                                            <th className="px-2 md:px-6 py-4 text-left">Team</th>
                                                            <th className="px-1 md:px-6 py-4 text-center">P</th>
                                                            <th className="px-1 md:px-6 py-4 text-center">W</th>
                                                            <th className="px-1 md:px-6 py-4 text-center">L</th>
                                                            <th className="px-1 md:px-6 py-4 text-center hidden sm:table-cell">PF</th>
                                                            <th className="px-1 md:px-6 py-4 text-center hidden sm:table-cell">PA</th>
                                                            <th className="px-1 md:px-6 py-4 text-center">PD</th>
                                                            <th className="px-2 md:px-6 py-4 text-center">Pts</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {standings.map((standing, index) => (
                                                            <tr
                                                                key={standing.id}
                                                                onClick={() => standing.team && setSelectedTeam(standing.team)}
                                                                className="border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                                                            >
                                                                <td className="px-2 md:px-6 py-4">
                                                                    <span className={`text-lg font-bold ${index === 0 ? 'text-primary' : ''}`}>
                                                                        {index + 1}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 md:px-6 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 md:w-10 md:h-10 relative rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                                                                            <Image
                                                                                src={standing.team?.logo || '/assests/Logos/BRIX-SPORT-LOGO.png'}
                                                                                alt={standing.team?.name || 'Team'}
                                                                                fill
                                                                                className="object-cover"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-bold text-sm md:text-base">{standing.team?.name}</p>
                                                                            <p className="text-[10px] md:text-xs text-white/40">{standing.team?.shortName}</p>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-1 md:px-6 py-4 text-center font-semibold text-sm md:text-base">{standing.played}</td>
                                                                <td className="px-1 md:px-6 py-4 text-center font-semibold text-blue-500 text-sm md:text-base">{standing.won}</td>
                                                                <td className="px-1 md:px-6 py-4 text-center font-semibold text-red-500 text-sm md:text-base">{standing.lost}</td>
                                                                <td className="px-1 md:px-6 py-4 text-center font-semibold text-sm md:text-base hidden sm:table-cell">{standing.goalsFor}</td>
                                                                <td className="px-1 md:px-6 py-4 text-center font-semibold text-sm md:text-base hidden sm:table-cell">{standing.goalsAgainst}</td>
                                                                <td className={`px-1 md:px-6 py-4 text-center font-semibold text-sm md:text-base ${standing.goalDifference > 0 ? 'text-blue-500' : standing.goalDifference < 0 ? 'text-red-500' : ''}`}>
                                                                    {standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}
                                                                </td>
                                                                <td className="px-2 md:px-6 py-4 text-center">
                                                                    <span className="px-2 md:px-3 py-1 bg-primary/20 text-primary rounded-full text-xs md:text-sm font-bold">
                                                                        {standing.points}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-24 text-center bg-white/5 border border-white/10 rounded-[40px]">
                                            <Trophy className="w-16 h-16 text-white/5 mx-auto mb-6" />
                                            <h3 className="text-xl font-display italic uppercase font-bold text-white/40 mb-2">No Standings</h3>
                                            <p className="text-white/20 font-black uppercase tracking-widest text-[10px] max-w-sm mx-auto">
                                                Standings for {selectedCompetition?.name} are not available.
                                            </p>
                                        </div>
                                    )}
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
                                    {matches.length > 0 ? matches.map((match) => (
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
                                    )) : (
                                        <div className="py-24 text-center bg-white/5 border border-white/10 rounded-[40px]">
                                            <Trophy className="w-16 h-16 text-white/5 mx-auto mb-6" />
                                            <h3 className="text-xl font-display italic uppercase font-bold text-white/40 mb-2">No Matches</h3>
                                            <p className="text-white/20 font-black uppercase tracking-widest text-[10px] max-w-sm mx-auto">
                                                No matches for {selectedCompetition?.name} yet.
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* STATS TAB */}
                            {activeTab === 'STATS' && (
                                <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {renderLeaderboardCard('Points Leaders', statsLeaders.points, <Zap size={20} />, 'points')}
                                    {renderLeaderboardCard('Rebounds Leaders', statsLeaders.rebounds, <Activity size={20} />, 'rebounds')}
                                    {renderLeaderboardCard('Assists Leaders', statsLeaders.assists, <Users size={20} />, 'assists')}
                                    {renderLeaderboardCard('Steals Leaders', statsLeaders.steals, <Award size={20} />, 'steals')}
                                    {renderLeaderboardCard('Blocks Leaders', statsLeaders.blocks, <TrendingUp size={20} />, 'blocks')}
                                </motion.div>
                            )}

                            {/* TEAMS/PLAYERS TABs (Global) */}
                            {activeTab === 'TEAMS' && (
                                <motion.div key="teams" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {teams.map((team) => (
                                        <div key={team.id} className="bg-white/5 rounded-2xl border border-white/10 p-6 flex items-center gap-4">
                                            <div className="w-16 h-16 relative rounded-xl overflow-hidden bg-white/5"><Image src={team.logo || '/assests/Logos/BRIX-SPORT-LOGO.png'} alt={team.name} fill className="object-cover" /></div>
                                            <div><h3 className="font-bold text-xl">{team.name}</h3><p className="text-sm text-white/40">{team.shortName}</p></div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                            {activeTab === 'PLAYERS' && (
                                <motion.div key="players" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="col-span-full flex justify-end mb-2">
                                        <Link href="/players/compare?sport=Basketball" className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl transition-all font-bold text-sm uppercase tracking-wider">
                                            <GitCompare size={18} /> Compare
                                        </Link>
                                    </div>
                                    {players.slice(0, 30).map((player) => (
                                        <div key={player.id} onClick={() => setSelectedPlayer(player)} className="bg-white/5 rounded-2xl border border-white/10 p-4 flex items-center gap-3 cursor-pointer hover:bg-white/10">
                                            <div className="w-10 h-10 relative rounded bg-white/5"><Image src={player.team?.logo || '/assests/Logos/BRIX-SPORT-LOGO.png'} alt="Team" fill className="object-cover" /></div>
                                            <div><h3 className="font-bold text-sm">{player.name}</h3><p className="text-xs text-white/40">{player.team?.shortName}</p></div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}

                        </AnimatePresence>
                    </div>
                )}
            </div>

            {selectedPlayer && <PlayerProfileOverlay player={selectedPlayer} onClose={() => setSelectedPlayer(null)} sport="Basketball" />}
            {selectedTeam && <TeamProfileOverlay team={selectedTeam} sport="Basketball" onClose={() => setSelectedTeam(null)} onSelectPlayer={(p) => { setSelectedPlayer(p); setSelectedTeam(null); }} />}
            {selectedMatch && <BasketballMatchOverlay match={selectedMatch} onClose={() => setSelectedMatch(null)} onSelectTeam={(t) => { setSelectedTeam(t); setSelectedMatch(null); }} onSelectPlayer={(p) => { setSelectedPlayer(p); setSelectedMatch(null); }} />}
        </div>
    );
}

export default function BasketballPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-[#E5FF00] border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-white/40 font-display font-medium">Loading Basketball Hub...</p>
            </div>
        }>
            <BasketballContent />
        </Suspense>
    );
}
