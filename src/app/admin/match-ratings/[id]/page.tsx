'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RatingCalculator } from '@/lib/ratingCalculator';

interface PlayerRating {
    id: string;
    playerId: string;
    autoRating: number;
    finalRating: number | null;
    adjustmentNotes: string | null;
    isMotM: boolean;
    player: {
        id: string;
        name: string;
        position: string;
        number: number;
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
    const [filter, setFilter] = useState<'all' | 'needsReview' | 'adjusted'>('all');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRatings();
    }, [matchId]);

    const fetchRatings = async () => {
        try {
            const response = await fetch(`/api/matches/${matchId}/ratings/adjust`);
            if (!response.ok) throw new Error('Failed to fetch ratings');

            const data = await response.json();
            setMatch(data.match);
            setRatings(data.ratings);

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
            setError(err instanceof Error ? err.message : 'Failed to load ratings');
        } finally {
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
        // Clear all MOTM flags
        newMap.forEach((value, key) => {
            value.isMotM = key === playerId;
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

            const response = await fetch(`/api/matches/${matchId}/ratings/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ratings: ratingsToSubmit })
            });

            if (!response.ok) throw new Error('Failed to save ratings');

            // Success - redirect to match page
            router.push(`/matches/${matchId}`);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save ratings');
        } finally {
            setSaving(false);
        }
    };

    const filteredRatings = ratings.filter(r => {
        if (filter === 'needsReview') return r.needsReview;
        if (filter === 'adjusted') {
            const adjusted = adjustedRatings.get(r.playerId);
            return adjusted && adjusted.rating !== r.autoRating;
        }
        return true;
    });

    const adjustedCount = Array.from(adjustedRatings.values()).filter((v, i) => {
        const original = ratings[i];
        return original && v.rating !== original.autoRating;
    }).length;

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-white/60">Loading ratings...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">❌ {error}</p>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-2">📊 Adjust Final Ratings</h1>
                            <p className="text-white/60">Match Status: <span className="text-green-400">FINISHED</span></p>
                        </div>
                        <button
                            onClick={() => router.back()}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            ← Back
                        </button>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-white/60">Progress:</span>
                        <div className="flex-1 bg-white/10 rounded-full h-2">
                            <div
                                className="bg-primary h-full rounded-full transition-all"
                                style={{ width: `${(adjustedCount / ratings.length) * 100}%` }}
                            ></div>
                        </div>
                        <span className="text-white font-medium">{adjustedCount}/{ratings.length}</span>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg transition-colors ${filter === 'all' ? 'bg-primary text-black' : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        All ({ratings.length})
                    </button>
                    <button
                        onClick={() => setFilter('needsReview')}
                        className={`px-4 py-2 rounded-lg transition-colors ${filter === 'needsReview' ? 'bg-primary text-black' : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        Needs Review ({ratings.filter(r => r.needsReview).length})
                    </button>
                    <button
                        onClick={() => setFilter('adjusted')}
                        className={`px-4 py-2 rounded-lg transition-colors ${filter === 'adjusted' ? 'bg-primary text-black' : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        Adjusted ({adjustedCount})
                    </button>
                </div>

                {/* Ratings List */}
                <div className="space-y-4 mb-6">
                    {filteredRatings.map((rating) => {
                        const adjusted = adjustedRatings.get(rating.playerId) || { rating: rating.autoRating, notes: '', isMotM: false };
                        const hasChanged = adjusted.rating !== rating.autoRating;

                        return (
                            <div
                                key={rating.playerId}
                                className={`bg-white/5 backdrop-blur-sm rounded-xl p-6 border transition-all ${rating.needsReview
                                        ? 'border-yellow-500/50'
                                        : hasChanged
                                            ? 'border-green-500/50'
                                            : 'border-white/10'
                                    }`}
                            >
                                {/* Player Info */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                            <span className="text-xl font-black text-primary">{rating.player.number}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{rating.player.name}</h3>
                                            <p className="text-sm text-white/60">{rating.player.position}</p>
                                        </div>
                                    </div>
                                    {rating.needsReview && (
                                        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full">
                                            ⚠️ Low Auto-Rating
                                        </span>
                                    )}
                                </div>

                                {/* Rating Slider */}
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-white/60">
                                            Auto: <span className="text-white font-medium">{rating.autoRating.toFixed(1)}</span>
                                        </span>
                                        <span className="text-sm text-white/60">
                                            Final: <span className={`font-bold ${RatingCalculator.getRatingColor(adjusted.rating)}`}>
                                                {adjusted.rating.toFixed(1)}
                                            </span>
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        step="0.1"
                                        value={adjusted.rating}
                                        onChange={(e) => handleRatingChange(rating.playerId, parseFloat(e.target.value))}
                                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
                                    />
                                    <div className="flex justify-between text-xs text-white/40 mt-1">
                                        <span>1.0</span>
                                        <span>5.0</span>
                                        <span>10.0</span>
                                    </div>
                                </div>

                                {/* Quick Presets */}
                                <div className="flex gap-2 mb-4">
                                    <button
                                        onClick={() => handlePreset(rating.playerId, 'poor')}
                                        className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition-colors"
                                    >
                                        Poor 5.5
                                    </button>
                                    <button
                                        onClick={() => handlePreset(rating.playerId, 'average')}
                                        className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm rounded-lg transition-colors"
                                    >
                                        Average 6.5
                                    </button>
                                    <button
                                        onClick={() => handlePreset(rating.playerId, 'good')}
                                        className="flex-1 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm rounded-lg transition-colors"
                                    >
                                        Good 7.5
                                    </button>
                                    <button
                                        onClick={() => handlePreset(rating.playerId, 'excellent')}
                                        className="flex-1 px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary text-sm rounded-lg transition-colors"
                                    >
                                        Excellent 8.5
                                    </button>
                                </div>

                                {/* Suggestion */}
                                {rating.suggestion && (
                                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                                        <p className="text-xs text-blue-400">
                                            💡 {rating.suggestion.suggestion}
                                        </p>
                                        <p className="text-xs text-blue-400/60 mt-1">
                                            Suggested range: {rating.suggestion.min.toFixed(1)} - {rating.suggestion.max.toFixed(1)}
                                        </p>
                                    </div>
                                )}

                                {/* Notes */}
                                <textarea
                                    value={adjusted.notes}
                                    onChange={(e) => handleNotesChange(rating.playerId, e.target.value)}
                                    placeholder="Add notes (optional)..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-white/40 text-sm mb-4 resize-none"
                                    rows={2}
                                />

                                {/* MOTM */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={adjusted.isMotM}
                                        onChange={() => handleMotMChange(rating.playerId)}
                                        className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-primary"
                                    />
                                    <span className="text-sm text-white/80">⭐ Man of the Match</span>
                                </label>
                            </div>
                        );
                    })}
                </div>

                {/* Actions */}
                <div className="sticky bottom-4 bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                    <div className="flex gap-4">
                        <button
                            onClick={() => router.back()}
                            className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={saving}
                            className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 text-black font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Publishing...' : '✓ Publish Final Ratings'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
