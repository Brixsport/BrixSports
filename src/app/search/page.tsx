'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, TrendingUp, Trophy, Calendar, ArrowLeft, Filter } from 'lucide-react';
import { PlayerProfileOverlay } from '@/components/PlayerProfileOverlay';
import Link from 'next/link';
import { TeamLogo } from '@/lib/utils/team-logo';
import { UnderlineTabs, UnderlineTab } from '@/components/ui/UnderlineTabs';

interface SearchResults {
    teams: any[];
    players: any[];
    matches: any[];
    competitions: any[];
}

export default function SearchPage() {
    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
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

    // BACKLOG-390 #3: was a row of pill buttons visually identical to the
    // sport-filter row below it, reading as one confusing duplicate. Now the
    // same UnderlineTabs bar used on match/team/player detail pages -- a
    // distinct style from the sport pills, and scrolls on overflow for free.
    const categoryTabs: UnderlineTab[] = [
        { id: 'all', label: 'All', count: getTotalResults() },
        { id: 'teams', label: 'Teams', icon: <Users className="w-3.5 h-3.5" />, count: getCategoryCount('teams') },
        { id: 'players', label: 'Players', icon: <TrendingUp className="w-3.5 h-3.5" />, count: getCategoryCount('players') },
        { id: 'matches', label: 'Matches', icon: <Calendar className="w-3.5 h-3.5" />, count: getCategoryCount('matches') },
        { id: 'competitions', label: 'Competitions', icon: <Trophy className="w-3.5 h-3.5" />, count: getCategoryCount('competitions') },
    ];

    return (
        <>
            {/* Header */}
            <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-4 mb-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold">Search Results</h1>
                            <p className="text-foreground/60">
                                {loading ? 'Searching...' : `${getTotalResults()} results for "${query}"`}
                            </p>
                        </div>
                    </div>

                    {/* Category Tabs */}
                    <UnderlineTabs
                        tabs={categoryTabs}
                        activeId={activeTab}
                        onChange={(id) => setActiveTab(id as typeof activeTab)}
                        layoutId="searchCategoryTabs"
                    />

                    {/* Sport Filter */}
                    <div className="flex gap-2 mt-3">
                        {['Football', 'Basketball', 'Track'].map(sport => (
                            <button
                                key={sport}
                                onClick={() => setSelectedSport(selectedSport === sport ? null : sport)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedSport === sport
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-foreground/60 hover:bg-muted/80'
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
                        <Search className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-foreground/60 mb-2">No results found</h3>
                        <p className="text-foreground/40">Try a different search term or adjust your filters</p>
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
                                                <div className="p-4 bg-muted hover:bg-muted/80 rounded-xl border border-border hover:border-border transition-all cursor-pointer">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                                                            style={{ backgroundColor: team.color + '20' }}
                                                        >
                                                            <TeamLogo logo={team.logo} name={team.name} size="sm" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-lg">{team.name}</div>
                                                            <div className="text-sm text-foreground/60">{team.sport}</div>
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
                                                <div className="p-4 bg-muted hover:bg-muted/80 rounded-xl border border-border hover:border-border transition-all cursor-pointer">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-xl font-bold">#{player.number}</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="font-bold text-lg">{player.name}</div>
                                                            <div className="text-sm text-foreground/60">
                                                                {player.position} • {player.team?.name}
                                                            </div>
                                                        </div>
                                                        {player.rating && (
                                                            <div className="text-right">
                                                                <div className="text-2xl font-bold text-primary">
                                                                    {player.rating.toFixed(1)}
                                                                </div>
                                                                <div className="text-xs text-foreground/60">Rating</div>
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
                                                <div className="p-4 bg-muted hover:bg-muted/80 rounded-xl border border-border hover:border-border transition-all cursor-pointer">
                                                    <div className="flex items-center gap-3">
                                                        {comp.logo && (
                                                            <img src={comp.logo} alt={comp.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-lg">{comp.name}</div>
                                                            <div className="text-sm text-foreground/60">
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
                                                <div className="p-4 bg-muted hover:bg-muted/80 rounded-xl border border-border hover:border-border transition-all cursor-pointer">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm text-foreground/60">{match.competition?.name}</span>
                                                        <span className="text-xs text-foreground/40">
                                                            {new Date(match.startTime).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold">{match.homeTeam?.shortName}</span>
                                                            <span className="text-foreground/40">vs</span>
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
