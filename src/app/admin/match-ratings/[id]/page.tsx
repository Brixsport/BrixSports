'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RatingCalculator } from '@/lib/ratingCalculator';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Save, AlertCircle, RefreshCw, Star, Info, Filter, X } from 'lucide-react';
import Image from 'next/image';
import { getClientErrorMessage } from '@/lib/client-error';

interface Team {
    id: string;
    name: string;
    logo: string;
    shortName: string;
    color: string;
}

interface PlayerRating {
    id: string;
    playerId: string;
    matchId: string;
    autoRating: number;
    finalRating: number | null;
    adjustmentNotes: string | null;
    isMotM: boolean;
    player: {
        id: string;
        name: string;
        position: string;
        number: number;
        teamId: string;
        team?: Team | null;
        image?: string;
    };
    suggestion: {
        min: number;
        max: number;
        suggestion: string;
    };
    description: string;
    needsReview: boolean;
}

interface Match {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number;
    awayScore: number;
    status: string;
    startTime: string;
    competition: string;
    homeTeam: Team;
    awayTeam: Team;
}

export default function MatchRatingsAdjustPage() {
    const params = useParams();
    const router = useRouter();
    const matchId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [match, setMatch] = useState<Match | null>(null);
    const [ratings, setRatings] = useState<PlayerRating[]>([]);
    const [adjustedRatings, setAdjustedRatings] = useState<Map<string, { rating: number; notes: string; isMotM: boolean }>>(new Map());
    const [activeTab, setActiveTab] = useState<'home' | 'away'>('home');
    const [filter, setFilter] = useState<'all' | 'needsReview' | 'adjusted'>('all');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRatings();
    }, [matchId]);

    const fetchRatings = async () => {
        try {
            setError(null);
            const response = await fetch(`/api/matches/${matchId}/ratings/adjust`);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Ratings fetch error:', errorData);

                switch (errorData.code) {
                    case 'AUTH_REQUIRED':
                        throw new Error('Please log in to access match ratings');
                    case 'INSUFFICIENT_PERMISSIONS':
                        throw new Error(`Access denied. You need admin or logger role. Your current role: ${errorData.userRole || 'unknown'}`);
                    case 'MATCH_NOT_FOUND':
                        throw new Error(`Match not found (ID: ${matchId})`);
                    case 'INVALID_MATCH_STATUS':
                        throw new Error(`This match is ${errorData.currentStatus}. Ratings can only be adjusted for FINISHED matches.`);
                    case 'NO_RATINGS':
                        throw new Error('No ratings have been calculated yet. Please calculate ratings first using the logger interface.');
                    default:
                        throw new Error(errorData.message || 'Failed to fetch ratings');
                }
            }

            const data = await response.json();
            setMatch(data.match);

            // Sort ratings by position (GK, DEF, MID, FWD) or number
            const sortedRatings = (data.ratings as PlayerRating[]).sort((a, b) => {
                const posOrder: Record<string, number> = { 'GK': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
                const posA = Object.keys(posOrder).find(k => a.player.position.includes(k)) || 'MID';
                const posB = Object.keys(posOrder).find(k => b.player.position.includes(k)) || 'MID';
                if (posOrder[posA] !== posOrder[posB]) return posOrder[posA] - posOrder[posB];
                return a.player.number - b.player.number;
            });

            setRatings(sortedRatings);

            // Initialize adjusted ratings with current values
            const initial = new Map();
            data.ratings.forEach((r: PlayerRating) => {
                initial.set(r.playerId, {
                    rating: r.finalRating || r.autoRating,
                    notes: r.adjustmentNotes || '',
                    isMotM: r.isMotM
                });
            });
            setAdjustedRatings(initial);

        } catch (err) {
            setError(getClientErrorMessage(err, 'Failed to load ratings'));
            console.error('Error in fetchRatings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCalculateRatings = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/matches/${matchId}/ratings`, {
                method: 'POST'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to calculate ratings');
            }

            fetchRatings();
        } catch (err) {
            setError(getClientErrorMessage(err, 'Failed to calculate ratings'));
            setLoading(false);
        }
    };

    const handleRatingChange = (playerId: string, rating: number) => {
        const current = adjustedRatings.get(playerId) || { rating: 6.0, notes: '', isMotM: false };
        setAdjustedRatings(new Map(adjustedRatings.set(playerId, { ...current, rating })));
    };

    const handleNotesChange = (playerId: string, notes: string) => {
        const current = adjustedRatings.get(playerId) || { rating: 6.0, notes: '', isMotM: false };
        setAdjustedRatings(new Map(adjustedRatings.set(playerId, { ...current, notes })));
    };

    const handleMotMChange = (playerId: string) => {
        const newMap = new Map(adjustedRatings);
        // Clear all MOTM flags first (only one MOTM allowed per match usually, but sometimes detailed per team. Assuming 1 per match for now)
        // Or if per team, filter by team. Let's assume global MOTM for now.
        newMap.forEach((value, key) => {
            value.isMotM = key === playerId ? !value.isMotM : false;
        });
        setAdjustedRatings(newMap);
    };

    const handlePreset = (playerId: string, preset: 'poor' | 'average' | 'good' | 'excellent') => {
        const presetValues = {
            poor: 5.5,
            average: 6.5,
            good: 7.5,
            excellent: 8.5
        };
        handleRatingChange(playerId, presetValues[preset]);
    };

    const handlePublish = async () => {
        setSaving(true);
        setError(null);

        try {
            const ratingsToSubmit = Array.from(adjustedRatings.entries()).map(([playerId, data]) => ({
                playerId,
                finalRating: data.rating,
                notes: data.notes,
                isMotM: data.isMotM
            }));

            console.log('[Publish Ratings] Submitting', ratingsToSubmit.length, 'ratings for match', matchId);
            console.log('[Publish Ratings] Payload:', ratingsToSubmit);

            const response = await fetch(`/api/matches/${matchId}/ratings/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ratings: ratingsToSubmit })
            });

            const data = await response.json();
            console.log('[Publish Ratings] Response:', data);

            if (!response.ok) {
                const errorMessage = data.error || data.message || 'Failed to save ratings';
                console.error('[Publish Ratings] Error:', errorMessage, data);
                throw new Error(errorMessage);
            }

            // Validate response
            if (data.updated === 0) {
                console.warn('[Publish Ratings] Warning: No ratings were updated');
                throw new Error('No ratings were updated. Please try again.');
            }

            if (data.errors && data.errors.length > 0) {
                console.warn('[Publish Ratings] Partial success:', data.errors);
                const errorMsg = `Published ${data.updated} ratings, but ${data.errors.length} failed. Check console for details.`;
                setError(errorMsg);
                // Still redirect after 2 seconds to show the published ratings
                setTimeout(() => {
                    router.push(`/admin/match-ratings`);
                }, 2000);
                return;
            }

            console.log('[Publish Ratings] Success! Updated', data.updated, 'ratings');

            // Emit custom event for real-time updates
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('RATINGS_PUBLISHED', {
                    detail: {
                        matchId,
                        updated: data.updated,
                        timestamp: new Date().toISOString()
                    }
                }));
            }

            // Show success message briefly before redirecting
            alert(`Successfully published ${data.updated} player ratings!`);
            router.push(`/admin/match-ratings`);

        } catch (err) {
            const errorMessage = getClientErrorMessage(err, 'Failed to save ratings');
            console.error('[Publish Ratings] Error:', err);
            setError(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    // Derived state
    const currentTeamId = match ? (activeTab === 'home' ? match.homeTeamId : match.awayTeamId) : '';

    const teamRatings = ratings.filter((rating) => (rating.player.team?.id ?? rating.player.teamId) === currentTeamId);

    const filteredRatings = teamRatings.filter(r => {
        if (filter === 'needsReview') return r.needsReview;
        if (filter === 'adjusted') {
            const adjusted = adjustedRatings.get(r.playerId);
            return adjusted && adjusted.rating !== r.autoRating;
        }
        return true;
    });

    const adjustedCount = Array.from(adjustedRatings.values()).filter((v, i) => {
        const original = ratings.find(r => adjustedRatings.has(r.playerId)); // Approximate check
        // Ideally we compare with original rating
        return true;
    }).length; // This logic was a bit flawed in original, let's just count how many have been touched or differ? 
    // Let's simplify: Any rating existing in map is technically "ready" if we pre-filled it.
    // We want to know how many differ from AUTO.
    const actuallyAdjustedCount = Array.from(adjustedRatings.entries()).filter(([pid, val]) => {
        const original = ratings.find(r => r.playerId === pid);
        return original && val.rating !== original.autoRating;
    }).length;


    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-primary mb-4"></div>
                <p className="text-white/60 font-medium">Loading Match Data...</p>
            </div>
        );
    }

    if (error || !match) {
        const isAuthError = error?.includes('log in') || error?.includes('Access denied');
        const isNoRatings = error?.includes('No ratings') || error?.includes('not been calculated');

        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 text-center shadow-2xl">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Unable to Load Ratings</h2>
                    <p className="text-white/60 mb-8">{error || 'Unknown error occurred'}</p>

                    <div className="flex flex-col gap-3">
                        {isNoRatings && (
                            <button
                                onClick={handleCalculateRatings}
                                className="w-full py-3 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-5 h-5" /> Generate Ratings
                            </button>
                        )}
                        <button
                            onClick={() => router.back()}
                            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-white pb-32">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/2"></div>
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-4 pt-6">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                    <button
                        onClick={() => router.back()}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors absolute md:relative top-4 md:top-0 left-4 md:left-0"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>

                    <div className="flex items-center gap-12 bg-white/5 backdrop-blur-md px-12 py-6 rounded-3xl border border-white/10 shadow-lg">
                        {/* Home Team */}
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-20 h-20 relative">
                                <Image
                                    src={match.homeTeam.logo}
                                    alt={match.homeTeam.name}
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <h2 className="font-bold text-lg text-center hidden md:block">{match.homeTeam.name}</h2>
                        </div>

                        {/* Valid Score */}
                        <div className="text-center">
                            <div className="text-xs text-white/40 font-bold tracking-widest uppercase mb-2">{match.competition}</div>
                            <div className="text-5xl font-black font-mono tracking-tighter flex items-center gap-4">
                                <span>{match.homeScore}</span>
                                <span className="text-white/20">-</span>
                                <span>{match.awayScore}</span>
                            </div>
                            <div className="mt-2 px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full inline-block">
                                FINAL
                            </div>
                        </div>

                        {/* Away Team */}
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-20 h-20 relative">
                                <Image
                                    src={match.awayTeam.logo}
                                    alt={match.awayTeam.name}
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <h2 className="font-bold text-lg text-center hidden md:block">{match.awayTeam.name}</h2>
                        </div>
                    </div>

                    <div className="w-10 hidden md:block"></div> {/* Spacer for alignment */}
                </div>

                {/* Team Selection Tabs */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white/5 p-1 rounded-2xl flex gap-1">
                        <button
                            onClick={() => setActiveTab('home')}
                            className={`px-8 py-3 rounded-xl font-bold transition-all ${activeTab === 'home'
                                ? 'bg-white text-black shadow-lg scale-105'
                                : 'text-white/60 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            {match.homeTeam.shortName || 'Home'}
                        </button>
                        <button
                            onClick={() => setActiveTab('away')}
                            className={`px-8 py-3 rounded-xl font-bold transition-all ${activeTab === 'away'
                                ? 'bg-white text-black shadow-lg scale-105'
                                : 'text-white/60 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            {match.awayTeam.shortName || 'Away'}
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === 'all' ? 'bg-primary text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        All Players ({teamRatings.length})
                    </button>
                    <button
                        onClick={() => setFilter('needsReview')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === 'needsReview' ? 'bg-yellow-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        ⚠️ Needs Review ({teamRatings.filter(r => r.needsReview).length})
                    </button>
                    <button
                        onClick={() => setFilter('adjusted')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filter === 'adjusted' ? 'bg-green-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        Adjusted ({teamRatings.filter(r => adjustedRatings.get(r.playerId)?.rating !== r.autoRating).length})
                    </button>
                </div>

                {/* Players Grid */}
                <motion.div
                    layout
                    className="grid grid-cols-1 gap-4"
                >
                    <AnimatePresence mode='popLayout'>
                        {filteredRatings.map((rating) => {
                            const adjusted = adjustedRatings.get(rating.playerId) || { rating: rating.autoRating, notes: '', isMotM: false };
                            const hasChanged = adjusted.rating !== rating.autoRating;
                            const isHigh = adjusted.rating >= 8.0;
                            const isLow = adjusted.rating <= 5.0;

                            return (
                                <motion.div
                                    key={rating.playerId}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    layout
                                    className={`bg-white/5 backdrop-blur-sm rounded-2xl p-5 border transition-all duration-300 ${rating.needsReview ? 'border-yellow-500/50 shadow-[0_0_20px_-10px_rgba(234,179,8,0.3)]' :
                                        hasChanged ? 'border-primary/50 shadow-[0_0_20px_-10px_rgba(34,197,94,0.3)]' :
                                            'border-white/5 hover:border-white/10'
                                        }`}
                                >
                                    <div className="flex flex-col md:flex-row gap-6">
                                        {/* Player Info */}
                                        <div className="flex items-center gap-4 min-w-[200px]">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center relative overflow-hidden group">
                                                {/* Fallback pattern or Initials */}
                                                <span className="text-2xl font-black text-white/20 group-hover:scale-110 transition-transform duration-500">
                                                    {rating.player.number}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-lg text-white">{rating.player.name}</h3>
                                                    {rating.player.position && (
                                                        <span className="text-xs font-bold px-2 py-0.5 bg-white/10 rounded text-white/60">
                                                            {rating.player.position}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-white/40">Auto: {rating.autoRating.toFixed(1)}</span>
                                                    {rating.needsReview && (
                                                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" /> Review
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Rating Controls */}
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex gap-2">
                                                    <button onClick={() => handlePreset(rating.playerId, 'poor')} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">Poor</button>
                                                    <button onClick={() => handlePreset(rating.playerId, 'average')} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors">Avg</button>
                                                    <button onClick={() => handlePreset(rating.playerId, 'good')} className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">Good</button>
                                                </div>

                                                <div className={`text-3xl font-black tabular-nums tracking-tight ${adjusted.rating >= 8 ? 'text-purple-400' :
                                                    adjusted.rating >= 7 ? 'text-green-400' :
                                                        adjusted.rating >= 6 ? 'text-white' :
                                                            'text-red-400'
                                                    }`}>
                                                    {adjusted.rating.toFixed(1)}
                                                </div>
                                            </div>

                                            <input
                                                type="range"
                                                min="1"
                                                max="10"
                                                step="0.1"
                                                value={adjusted.rating}
                                                onChange={(e) => handleRatingChange(rating.playerId, parseFloat(e.target.value))}
                                                className={`w-full h-2 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg bg-white/10`}
                                                style={{
                                                    background: `linear-gradient(to right, 
                                                        ${adjusted.rating < 6 ? '#ef4444' : '#22c55e'} 0%, 
                                                        ${adjusted.rating < 6 ? '#ef4444' : '#22c55e'} ${(adjusted.rating / 10) * 100}%, 
                                                        rgba(255,255,255,0.1) ${(adjusted.rating / 10) * 100}%, 
                                                        rgba(255,255,255,0.1) 100%)`
                                                }}
                                            />
                                        </div>

                                        {/* Extras */}
                                        <div className="flex flex-col gap-3 min-w-[200px]">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={adjusted.notes}
                                                    onChange={(e) => handleNotesChange(rating.playerId, e.target.value)}
                                                    placeholder="Stats/Notes..."
                                                    className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors"
                                                />
                                            </div>

                                            <div className="flex items-center justify-between">
                                                {rating.suggestion && (
                                                    <div className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                                                        <Info className="w-3 h-3" />
                                                        <span>Range: {rating.suggestion.min}-{rating.suggestion.max}</span>
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => handleMotMChange(rating.playerId)}
                                                    className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${adjusted.isMotM
                                                        ? 'bg-yellow-500 text-black shadow-[0_0_15px_-5px_rgba(234,179,8,0.5)]'
                                                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                                                        }`}
                                                >
                                                    <Star className={`w-3.5 h-3.5 ${adjusted.isMotM ? 'fill-black' : ''}`} />
                                                    MOTM
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </motion.div>
            </div>


            {/* Error Banner */}
            {error && (
                <div className="fixed bottom-24 left-0 right-0 z-50 px-4">
                    <div className="max-w-5xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-3 backdrop-blur-xl"
                        >
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h4 className="font-bold text-red-400 mb-1">Publishing Error</h4>
                                <p className="text-sm text-red-300">{error}</p>
                            </div>
                            <button
                                onClick={() => setError(null)}
                                className="text-red-400 hover:text-red-300 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    </div>
                </div>
            )}

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-neutral-950/80 backdrop-blur-xl border-t border-white/10 p-4 z-50">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-white/40 text-xs">Progress</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-white">{actuallyAdjustedCount}</span>
                            <span className="text-sm text-white/40">/ {ratings.length} adjusted</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="px-6 py-3 rounded-xl font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={saving}
                            className="px-8 py-3 bg-primary hover:bg-primary/90 text-black font-bold rounded-xl shadow-[0_0_20px_-5px_rgba(34,197,94,0.4)] transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    Publishing...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Publish Ratings
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
