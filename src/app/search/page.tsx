'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, TrendingUp, Trophy, Calendar, ArrowLeft, Filter } from 'lucide-react';
import { PlayerProfileOverlay } from '@/components/PlayerProfileOverlay';
import Link from 'next/link';

interface SearchResults {
    teams: any[];
    players: any[];
    matches: any[];
    competitions: any[];
}

export default function SearchPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-white pb-20">
            <React.Suspense fallback={
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
            }>
                <SearchContent />
            </React.Suspense>
        </div>
    );
}

function SearchContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const query = searchParams.get('q') || '';

    const [results, setResults] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'teams' | 'players' | 'matches' | 'competitions'>('all');
    const [selectedSport, setSelectedSport] = useState<string | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

    useEffect(() => {
        if (query) {
            performSearch();
        }
    }, [query, activeTab, selectedSport]);

    const performSearch = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('q', query);
            if (activeTab !== 'all') {
                params.append('category', activeTab);
            }
            if (selectedSport) {
                params.append('sport', selectedSport);
            }

            const response = await fetch(`/api/search?${params}`);
            const data = await response.json();
            setResults(data.results);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTotalResults = () => {
        if (!results) return 0;
        return (
            results.teams.length +
            results.players.length +
            results.matches.length +
            results.competitions.length
        );
    };

    const getCategoryCount = (category: keyof SearchResults) => {
        return results?.[category]?.length || 0;
    };

    return (
        <>
            {/* Header */}
            <div className="sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-4 mb-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold">Search Results</h1>
                            <p className="text-white/60">
                                {loading ? 'Searching...' : `${getTotalResults()} results for "${query}"`}
                            </p>
                        </div>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === 'all'
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            All ({getTotalResults()})
                        </button>
                        <button
                            onClick={() => setActiveTab('teams')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === 'teams'
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            <Users className="w-4 h-4 inline mr-2" />
                            Teams ({getCategoryCount('teams')})
                        </button>
                        <button
                            onClick={() => setActiveTab('players')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === 'players'
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            <TrendingUp className="w-4 h-4 inline mr-2" />
                            Players ({getCategoryCount('players')})
                        </button>
                        <button
                            onClick={() => setActiveTab('matches')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === 'matches'
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            <Calendar className="w-4 h-4 inline mr-2" />
                            Matches ({getCategoryCount('matches')})
                        </button>
                        <button
                            onClick={() => setActiveTab('competitions')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === 'competitions'
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            <Trophy className="w-4 h-4 inline mr-2" />
                            Competitions ({getCategoryCount('competitions')})
                        </button>
                    </div>

                    {/* Sport Filter */}
                    <div className="flex gap-2 mt-3">
                        {['Football', 'Basketball', 'Track'].map(sport => (
                            <button
                                key={sport}
                                onClick={() => setSelectedSport(selectedSport === sport ? null : sport)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedSport === sport
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                                    }`}
                            >
                                {sport === 'Football' ? '⚽' : sport === 'Basketball' ? '🏀' : '🏃'} {sport}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : !results || getTotalResults() === 0 ? (
                    <div className="text-center py-20">
                        <Search className="w-16 h-16 text-white/20 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white/60 mb-2">No results found</h3>
                        <p className="text-white/40">Try a different search term or adjust your filters</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Teams */}
                        {results.teams.length > 0 && (activeTab === 'all' || activeTab === 'teams') && (
                            <div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Users className="w-5 h-5" />
                                    Teams ({results.teams.length})
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {results.teams.map((team: any, index: number) => (
                                        <motion.div
                                            key={team.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                        >
                                            <Link href={`/teams/${team.id}`}>
                                                <div className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all cursor-pointer">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                                                            style={{ backgroundColor: team.color + '20' }}
                                                        >
                                                            {team.logo ? (
                                                                <img src={team.logo} alt={team.name} className="w-12 h-12 object-contain" />
                                                            ) : (
                                                                <span className="text-xl font-bold">{team.shortName.substring(0, 2)}</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-lg">{team.name}</div>
                                                            <div className="text-sm text-white/60">{team.sport}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Players */}
                        {results.players.length > 0 && (activeTab === 'all' || activeTab === 'players') && (
                            <div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" />
                                    Players ({results.players.length})
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {results.players.map((player: any, index: number) => (
                                        <motion.div
                                            key={player.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                        >
                                            <div onClick={() => setSelectedPlayer(player)}>
                                                <div className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all cursor-pointer">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-xl font-bold">#{player.number}</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="font-bold text-lg">{player.name}</div>
                                                            <div className="text-sm text-white/60">
                                                                {player.position} • {player.team?.name}
                                                            </div>
                                                        </div>
                                                        {player.rating && (
                                                            <div className="text-right">
                                                                <div className="text-2xl font-bold text-primary">
                                                                    {player.rating.toFixed(1)}
                                                                </div>
                                                                <div className="text-xs text-white/60">Rating</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Competitions */}
                        {results.competitions.length > 0 && (activeTab === 'all' || activeTab === 'competitions') && (
                            <div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Trophy className="w-5 h-5" />
                                    Competitions ({results.competitions.length})
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {results.competitions.map((comp: any, index: number) => (
                                        <motion.div
                                            key={comp.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                        >
                                            <Link href={`/competitions/${comp.id}`}>
                                                <div className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all cursor-pointer">
                                                    <div className="flex items-center gap-3">
                                                        {comp.logo && (
                                                            <img src={comp.logo} alt={comp.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-lg">{comp.name}</div>
                                                            <div className="text-sm text-white/60">
                                                                {comp.sport} • {comp.season}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Matches */}
                        {results.matches.length > 0 && (activeTab === 'all' || activeTab === 'matches') && (
                            <div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Calendar className="w-5 h-5" />
                                    Matches ({results.matches.length})
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {results.matches.map((match: any, index: number) => (
                                        <motion.div
                                            key={match.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                        >
                                            <Link href={`/matches/${match.id}`}>
                                                <div className="p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all cursor-pointer">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm text-white/60">{match.competition?.name}</span>
                                                        <span className="text-xs text-white/40">
                                                            {new Date(match.startTime).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold">{match.homeTeam?.shortName}</span>
                                                            <span className="text-white/40">vs</span>
                                                            <span className="font-bold">{match.awayTeam?.shortName}</span>
                                                        </div>
                                                        {match.status !== 'UPCOMING' && (
                                                            <div className="text-xl font-bold text-primary">
                                                                {match.homeScore} - {match.awayScore}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {/* @ts-ignore */}
                {selectedPlayer && (
                    <PlayerProfileOverlay
                        player={selectedPlayer}
                        sport={selectedPlayer.team?.sport}
                        onClose={() => setSelectedPlayer(null)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
