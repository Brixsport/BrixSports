'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, TrendingUp, Clock, Users, Trophy, Calendar, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchResult {
    teams: any[];
    players: any[];
    matches: any[];
    competitions: any[];
}

interface GlobalSearchProps {
    placeholder?: string;
    autoFocus?: boolean;
    onClose?: () => void;
}

export default function GlobalSearch({ placeholder = 'Search teams, players, matches...', autoFocus = false, onClose }: GlobalSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<'all' | 'teams' | 'players' | 'matches' | 'competitions'>('all');

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const debouncedQuery = useDebounce(query, 300);

    // Load recent searches from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('recentSearches');
        if (saved) {
            setRecentSearches(JSON.parse(saved));
        }
    }, []);

    // Auto focus
    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    // Search when debounced query changes
    useEffect(() => {
        if (debouncedQuery.length >= 2) {
            performSearch(debouncedQuery);
        } else {
            setResults(null);
        }
    }, [debouncedQuery, selectedCategory]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const performSearch = async (searchQuery: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('q', searchQuery);
            if (selectedCategory !== 'all') {
                params.append('category', selectedCategory);
            }

            const response = await fetch(`/api/search?${params}`);
            const data = await response.json();
            setResults(data.results);
            setShowResults(true);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        if (e.target.value.length >= 2) {
            setShowResults(true);
        }
    };

    const handleClear = () => {
        setQuery('');
        setResults(null);
        setShowResults(false);
        inputRef.current?.focus();
    };

    const handleSelectResult = (type: string, id: string, name: string) => {
        // Save to recent searches
        const updated = [name, ...recentSearches.filter(s => s !== name)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));

        // Navigate based on type
        switch (type) {
            case 'team':
                router.push(`/teams/${id}`);
                break;
            case 'player':
                router.push(`/players/${id}`);
                break;
            case 'match':
                router.push(`/matches/${id}`);
                break;
            case 'competition':
                router.push(`/competitions/${id}`);
                break;
        }

        setShowResults(false);
        setQuery('');
        onClose?.();
    };

    const handleRecentSearch = (search: string) => {
        setQuery(search);
        performSearch(search);
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem('recentSearches');
    };

    const getTotalResults = () => {
        if (!results) return 0;
        return (
            (results.teams?.length || 0) +
            (results.players?.length || 0) +
            (results.matches?.length || 0) +
            (results.competitions?.length || 0)
        );
    };

    return (
        <div ref={containerRef} className="relative w-full max-w-2xl">
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => setShowResults(true)}
                    placeholder={placeholder}
                    className="w-full pl-12 pr-12 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-primary transition-colors"
                />
                {loading ? (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 animate-spin" />
                ) : query && (
                    <button
                        onClick={handleClear}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-white/60" />
                    </button>
                )}
            </div>

            {/* Category Filters */}
            {query.length >= 2 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-2 scrollbar-hide">
                    {['all', 'teams', 'players', 'matches', 'competitions'].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat as any)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat
                                ? 'bg-primary text-white'
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                    ))}
                </div>
            )}

            {/* Search Results Dropdown */}
            <AnimatePresence>
                {showResults && (query.length >= 2 || recentSearches.length > 0) && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a] backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl max-h-[500px] overflow-y-auto z-50"
                    >
                        {query.length < 2 && recentSearches.length > 0 ? (
                            /* Recent Searches */
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
                                        <Clock className="w-4 h-4" />
                                        Recent Searches
                                    </div>
                                    <button
                                        onClick={clearRecentSearches}
                                        className="text-xs text-white/40 hover:text-white/60 transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {recentSearches.map((search, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleRecentSearch(search)}
                                            className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg transition-colors text-white/80"
                                        >
                                            {search}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : results && getTotalResults() > 0 ? (
                            /* Search Results */
                            <div className="p-4 space-y-4">
                                {/* Teams */}
                                {(results.teams?.length || 0) > 0 && (selectedCategory === 'all' || selectedCategory === 'teams') && (
                                    <div>
                                        <div className="flex items-center gap-2 text-sm font-semibold text-white/60 mb-2">
                                            <Users className="w-4 h-4" />
                                            Teams ({results.teams?.length || 0})
                                        </div>
                                        <div className="space-y-1">
                                            {results.teams?.map((team: any) => (
                                                <button
                                                    key={team.id}
                                                    onClick={() => handleSelectResult('team', team.id, team.name)}
                                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors"
                                                >
                                                    <div
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                                        style={{ backgroundColor: team.color + '20' }}
                                                    >
                                                        {team.logo ? (
                                                            <img src={team.logo} alt={team.name} className="w-8 h-8 object-contain" />
                                                        ) : (
                                                            <span className="text-sm font-bold">{team.shortName.substring(0, 2)}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-semibold text-white">{team.name}</div>
                                                        <div className="text-xs text-white/60">{team.sport}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Players */}
                                {(results.players?.length || 0) > 0 && (selectedCategory === 'all' || selectedCategory === 'players') && (
                                    <div>
                                        <div className="flex items-center gap-2 text-sm font-semibold text-white/60 mb-2">
                                            <TrendingUp className="w-4 h-4" />
                                            Players ({results.players?.length || 0})
                                        </div>
                                        <div className="space-y-1">
                                            {results.players?.map((player: any) => (
                                                <button
                                                    key={player.id}
                                                    onClick={() => handleSelectResult('player', player.id, player.name)}
                                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors"
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-sm font-bold">#{player.number}</span>
                                                    </div>
                                                    <div className="text-left flex-1">
                                                        <div className="font-semibold text-white">{player.name}</div>
                                                        <div className="text-xs text-white/60">
                                                            {player.position} • {player.team?.name}
                                                        </div>
                                                    </div>
                                                    {player.rating && (
                                                        <div className="text-sm font-bold text-primary">
                                                            {player.rating.toFixed(1)}
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Competitions */}
                                {(results.competitions?.length || 0) > 0 && (selectedCategory === 'all' || selectedCategory === 'competitions') && (
                                    <div>
                                        <div className="flex items-center gap-2 text-sm font-semibold text-white/60 mb-2">
                                            <Trophy className="w-4 h-4" />
                                            Competitions ({results.competitions?.length || 0})
                                        </div>
                                        <div className="space-y-1">
                                            {results.competitions?.map((comp: any) => (
                                                <button
                                                    key={comp.id}
                                                    onClick={() => handleSelectResult('competition', comp.id, comp.name)}
                                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors"
                                                >
                                                    {comp.logo && (
                                                        <img src={comp.logo} alt={comp.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                                    )}
                                                    <div className="text-left">
                                                        <div className="font-semibold text-white">{comp.name}</div>
                                                        <div className="text-xs text-white/60">{comp.sport} • {comp.season}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Matches */}
                                {(results.matches?.length || 0) > 0 && (selectedCategory === 'all' || selectedCategory === 'matches') && (
                                    <div>
                                        <div className="flex items-center gap-2 text-sm font-semibold text-white/60 mb-2">
                                            <Calendar className="w-4 h-4" />
                                            Matches ({results.matches?.length || 0})
                                        </div>
                                        <div className="space-y-1">
                                            {results.matches?.map((match: any) => (
                                                <button
                                                    key={match.id}
                                                    onClick={() => handleSelectResult('match', match.id, `${match.homeTeam?.name} vs ${match.awayTeam?.name}`)}
                                                    className="w-full px-3 py-2 hover:bg-white/5 rounded-lg transition-colors"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white font-semibold">{match.homeTeam?.shortName}</span>
                                                            <span className="text-white/40">vs</span>
                                                            <span className="text-white font-semibold">{match.awayTeam?.shortName}</span>
                                                        </div>
                                                        {match.status !== 'UPCOMING' && (
                                                            <div className="text-sm font-bold text-primary">
                                                                {match.homeScore} - {match.awayScore}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-white/60 mt-1">
                                                        {match.competition?.name} • {new Date(match.startTime).toLocaleDateString()}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : query.length >= 2 && !loading ? (
                            /* No Results */
                            <div className="p-8 text-center">
                                <Search className="w-12 h-12 text-white/20 mx-auto mb-3" />
                                <p className="text-white/60">No results found for "{query}"</p>
                                <p className="text-sm text-white/40 mt-1">Try a different search term</p>
                            </div>
                        ) : null}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
