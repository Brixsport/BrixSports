'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Search,
    X,
    Share2,
    Star,
    Trophy,
    Users,
    Shuffle,
} from 'lucide-react';
import Link from 'next/link';
import { PlayerComparison, PlayerComparisonEmpty } from '@/components/PlayerComparison';

export default function PlayerComparePage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const player1Id = searchParams.get('player1');
    const player2Id = searchParams.get('player2');

    const [player1, setPlayer1] = useState<any>(null);
    const [player2, setPlayer2] = useState<any>(null);
    const [comparisonData, setComparisonData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const [searchQuery1, setSearchQuery1] = useState('');
    const [searchQuery2, setSearchQuery2] = useState('');
    const [searchResults1, setSearchResults1] = useState<any[]>([]);
    const [searchResults2, setSearchResults2] = useState<any[]>([]);
    const [searching1, setSearching1] = useState(false);
    const [searching2, setSearching2] = useState(false);

    useEffect(() => {
        if (player1Id && player2Id) {
            fetchComparison();
        }
    }, [player1Id, player2Id]);

    const fetchComparison = async () => {
        if (!player1Id || !player2Id) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/players/compare?player1=${player1Id}&player2=${player2Id}`);
            const data = await res.json();
            setComparisonData(data);
            setPlayer1(data.player1);
            setPlayer2(data.player2);
        } catch (error) {
            console.error('Error fetching comparison:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchPlayers = async (query: string, playerSlot: 1 | 2) => {
        if (!query.trim()) {
            if (playerSlot === 1) setSearchResults1([]);
            else setSearchResults2([]);
            return;
        }

        if (playerSlot === 1) setSearching1(true);
        else setSearching2(true);

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&category=players&limit=10`);
            const data = await res.json();

            if (playerSlot === 1) {
                setSearchResults1(data.results?.players || []);
            } else {
                setSearchResults2(data.results?.players || []);
            }
        } catch (error) {
            console.error('Error searching players:', error);
        } finally {
            if (playerSlot === 1) setSearching1(false);
            else setSearching2(false);
        }
    };

    const selectPlayer = (playerId: string, playerSlot: 1 | 2) => {
        const params = new URLSearchParams(searchParams.toString());

        if (playerSlot === 1) {
            params.set('player1', playerId);
            setSearchQuery1('');
            setSearchResults1([]);
        } else {
            params.set('player2', playerId);
            setSearchQuery2('');
            setSearchResults2([]);
        }

        router.push(`/players/compare?${params.toString()}`);
    };

    const clearPlayer = (playerSlot: 1 | 2) => {
        const params = new URLSearchParams(searchParams.toString());

        if (playerSlot === 1) {
            params.delete('player1');
            setPlayer1(null);
        } else {
            params.delete('player2');
            setPlayer2(null);
        }

        setComparisonData(null);
        router.push(`/players/compare?${params.toString()}`);
    };

    const swapPlayers = () => {
        if (!player1Id || !player2Id) return;
        router.push(`/players/compare?player1=${player2Id}&player2=${player1Id}`);
    };

    const shareComparison = async () => {
        const url = window.location.href;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${player1?.name} vs ${player2?.name} - Player Comparison`,
                    text: `Compare ${player1?.name} and ${player2?.name} on Brixsport!`,
                    url: url,
                });
            } catch (error) {
                console.log('Error sharing:', error);
            }
        } else {
            // Fallback: Copy to clipboard
            await navigator.clipboard.writeText(url);
            alert('Comparison link copied to clipboard!');
        }
    };

    const hasComparison = player1 && player2 && comparisonData;

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Link
                            href="/players"
                            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                        >
                            <ArrowLeft size={20} />
                            <span className="text-sm font-bold">Back to Players</span>
                        </Link>

                        <div className="flex items-center gap-2">
                            {hasComparison && (
                                <>
                                    <button
                                        onClick={swapPlayers}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
                                        title="Swap players"
                                    >
                                        <Shuffle size={18} />
                                        <span className="hidden sm:inline text-sm font-bold">Swap</span>
                                    </button>
                                    <button
                                        onClick={shareComparison}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black hover:bg-primary/90 transition-all"
                                    >
                                        <Share2 size={18} />
                                        <span className="hidden sm:inline text-sm font-bold">Share</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Page Title */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <Trophy className="w-8 h-8 text-primary" />
                        <h1 className="text-4xl font-black uppercase tracking-tight">
                            Player Comparison
                        </h1>
                    </div>
                    <p className="text-white/60">
                        Compare statistics between any two players
                    </p>
                </div>

                {/* Player Selection */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Player 1 Selector */}
                    <PlayerSelector
                        playerSlot={1}
                        selectedPlayer={player1}
                        searchQuery={searchQuery1}
                        setSearchQuery={setSearchQuery1}
                        searchResults={searchResults1}
                        searching={searching1}
                        onSearch={(query) => searchPlayers(query, 1)}
                        onSelect={(id) => selectPlayer(id, 1)}
                        onClear={() => clearPlayer(1)}
                    />

                    {/* Player 2 Selector */}
                    <PlayerSelector
                        playerSlot={2}
                        selectedPlayer={player2}
                        searchQuery={searchQuery2}
                        setSearchQuery={setSearchQuery2}
                        searchResults={searchResults2}
                        searching={searching2}
                        onSearch={(query) => searchPlayers(query, 2)}
                        onSelect={(id) => selectPlayer(id, 2)}
                        onClear={() => clearPlayer(2)}
                    />
                </div>

                {/* Comparison Result */}
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center py-20"
                        >
                            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-white/60">Loading comparison...</p>
                        </motion.div>
                    ) : hasComparison ? (
                        <motion.div
                            key="comparison"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <PlayerComparison
                                player1={comparisonData.player1}
                                player2={comparisonData.player2}
                                sport={comparisonData.player1.team?.sport || 'Football'}
                            />

                            {/* Summary */}
                            {comparisonData.summary && (
                                <div className="mt-8 bg-white/5 border border-white/10 rounded-[32px] p-6">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-white/60 mb-4">
                                        Comparison Summary
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                            <span className="text-white/60">Better Goal Scorer</span>
                                            <span className="font-bold text-primary">
                                                {comparisonData.summary.betterGoalScorer}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                            <span className="text-white/60">Better Playmaker</span>
                                            <span className="font-bold text-primary">
                                                {comparisonData.summary.betterPlaymaker}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                            <span className="text-white/60">More Experienced</span>
                                            <span className="font-bold text-primary">
                                                {comparisonData.summary.moreExperienced}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                            <span className="text-white/60">Higher Rated</span>
                                            <span className="font-bold text-primary">
                                                {comparisonData.summary.higherRated}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <PlayerComparisonEmpty />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function PlayerSelector({
    playerSlot,
    selectedPlayer,
    searchQuery,
    setSearchQuery,
    searchResults,
    searching,
    onSearch,
    onSelect,
    onClear,
}: {
    playerSlot: 1 | 2;
    selectedPlayer: any;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchResults: any[];
    searching: boolean;
    onSearch: (query: string) => void;
    onSelect: (id: string) => void;
    onClear: () => void;
}) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/60">
                    Player {playerSlot}
                </h3>
                {selectedPlayer && (
                    <button
                        onClick={onClear}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                        title="Clear selection"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {selectedPlayer ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    {/* Selected Player Card */}
                    <Link href={`/players/${selectedPlayer.id}`}>
                        <div className="p-6 bg-white/5 rounded-2xl hover:bg-white/10 transition-all cursor-pointer border border-white/10">
                            {selectedPlayer.image ? (
                                <img
                                    src={selectedPlayer.image}
                                    alt={selectedPlayer.name}
                                    className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-primary"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 border-4 border-primary">
                                    <span className="text-4xl font-display italic">
                                        {selectedPlayer.number}
                                    </span>
                                </div>
                            )}
                            <h4 className="text-xl font-black uppercase tracking-tight mb-1">
                                {selectedPlayer.name}
                            </h4>
                            <p className="text-sm text-white/60 mb-2">
                                {selectedPlayer.position} • {selectedPlayer.team?.name}
                            </p>
                            {selectedPlayer.rating && (
                                <div className="flex items-center justify-center gap-1">
                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    <span className="font-bold text-primary">
                                        {selectedPlayer.rating.toFixed(1)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </Link>
                </motion.div>
            ) : (
                <div>
                    {/* Search Box */}
                    <div className="relative mb-4">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <input
                            type="text"
                            placeholder="Search for a player..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                onSearch(e.target.value);
                            }}
                            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-primary transition-all"
                        />
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {searchResults.map((result) => (
                                <button
                                    key={result.id}
                                    onClick={() => onSelect(result.id)}
                                    className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all flex items-center gap-3 text-left"
                                >
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                        <span className="font-bold text-sm">#{result.number}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold truncate">{result.name}</div>
                                        <div className="text-xs text-white/60 truncate">
                                            {result.position} • {result.team?.name}
                                        </div>
                                    </div>
                                    {result.rating && (
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                            <span className="text-sm font-bold">
                                                {result.rating.toFixed(1)}
                                            </span>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {searching && (
                        <div className="text-center py-8 text-white/60 text-sm">
                            Searching...
                        </div>
                    )}

                    {!searching && searchQuery && searchResults.length === 0 && (
                        <div className="text-center py-8 text-white/60 text-sm">
                            No players found
                        </div>
                    )}

                    {!searchQuery && (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
                            <p className="text-sm text-white/60">
                                Search for a player to select
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
