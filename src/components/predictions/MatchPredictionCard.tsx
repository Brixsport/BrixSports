'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Trophy, Users, Target, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    color: string;
}

interface Match {
    id: string;
    homeTeam: Team;
    awayTeam: Team;
    startTime: string;
    competition: string;
    sport: string;
    status?: 'UPCOMING' | 'LIVE' | 'FINISHED';
}

interface PredictionStats {
    totalPredictions: number;
    homeWinPercentage: number;
    awayWinPercentage: number;
    drawPercentage: number;
    averageHomeScore: number;
    averageAwayScore: number;
}

interface MatchPredictionCardProps {
    match: Match;
    onPredictionSubmit?: () => void;
}

export function MatchPredictionCard({ match, onPredictionSubmit }: MatchPredictionCardProps) {
    const { user, isAuthenticated } = useAuth();
    const [homeScore, setHomeScore] = useState(0);
    const [awayScore, setAwayScore] = useState(0);
    const [confidence, setConfidence] = useState(50);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [userPrediction, setUserPrediction] = useState<any>(null);
    const [stats, setStats] = useState<PredictionStats | null>(null);
    const [showStats, setShowStats] = useState(false);
    const { socket, isConnected } = useWebSocket({ autoConnect: true });

    // Listen for real-time stats updates
    useEffect(() => {
        if (isConnected && socket) {
            const handlePredictionUpdate = (data: any) => {
                if (data.matchId === match.id) {
                    fetchPredictionStats();
                }
            };
            socket.on('prediction:updated', handlePredictionUpdate);
            return () => {
                socket.off('prediction:updated', handlePredictionUpdate);
            };
        }
    }, [isConnected, socket, match.id]);

    // Determine max score based on sport
    const isBasketball = match.sport?.toLowerCase() === 'basketball';
    const maxScore = isBasketball ? 200 : 20;
    const scoreStep = isBasketball ? 1 : 1; // Can be adjusted if needed

    // Fetch user's existing prediction and stats
    useEffect(() => {
        if (isAuthenticated && user) {
            fetchUserPrediction();
            fetchPredictionStats();
        }
    }, [match.id, user, isAuthenticated]);

    const fetchUserPrediction = async () => {
        try {
            const response = await fetch(`/api/predictions?matchId=${match.id}&userId=${user?.id}`);
            if (response.ok) {
                const data = await response.json();
                if (data.prediction) {
                    setUserPrediction(data.prediction);
                    setHomeScore(data.prediction.predictedHomeScore);
                    setAwayScore(data.prediction.predictedAwayScore);
                    setConfidence(data.prediction.confidence || 50);
                    setSubmitted(true);
                }
            }
        } catch (error) {
            console.error('Error fetching prediction:', error);
        }
    };

    const fetchPredictionStats = async () => {
        try {
            const response = await fetch(`/api/predictions/stats?matchId=${match.id}`);
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleSubmit = async () => {
        if (!isAuthenticated || !user) {
            alert('Please sign in to make predictions');
            return;
        }

        setSubmitting(true);
        try {
            const predictedWinner =
                homeScore > awayScore ? 'home' :
                    awayScore > homeScore ? 'away' :
                        'draw';

            const response = await fetch('/api/predictions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId: match.id,
                    userId: user.id,
                    predictedHomeScore: homeScore,
                    predictedAwayScore: awayScore,
                    predictedWinner,
                    confidence,
                }),
            });

            if (response.ok) {
                setSubmitted(true);
                await fetchPredictionStats();
                socket?.emit('prediction:submit', { matchId: match.id });
                onPredictionSubmit?.();
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to submit prediction');
            }
        } catch (error) {
            console.error('Error submitting prediction:', error);
            alert('Failed to submit prediction');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        setSubmitted(false);
    };

    const getPredictedWinner = () => {
        if (homeScore > awayScore) return 'home';
        if (awayScore > homeScore) return 'away';
        return 'draw';
    };

    const getWinnerText = () => {
        const winner = getPredictedWinner();
        if (winner === 'home') return match.homeTeam.shortName;
        if (winner === 'away') return match.awayTeam.shortName;
        return 'Draw';
    };

    return (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-1.5 md:p-2 bg-primary/20 rounded-lg">
                            <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base md:text-lg">Make Your Prediction</h3>
                            <p className="text-white/60 text-xs md:text-sm hidden sm:block">Earn points for accurate predictions!</p>
                        </div>
                    </div>

                    {stats && (
                        <button
                            onClick={() => setShowStats(!showStats)}
                            className="flex items-center gap-1 md:gap-2 bg-white/5 hover:bg-white/10 text-white px-2 md:px-4 py-1.5 md:py-2 rounded-lg transition-colors"
                        >
                            <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                            <span className="text-xs md:text-sm font-semibold">
                                {stats.totalPredictions}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Prediction Stats (Collapsible) */}
            {showStats && stats && stats.totalPredictions > 0 && (
                <div className="px-6 py-4 bg-white/5 border-b border-white/10">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-primary">
                                {stats.homeWinPercentage.toFixed(0)}%
                            </div>
                            <div className="text-xs text-white/40 mt-1">{match.homeTeam.shortName} Win</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white/60">
                                {stats.drawPercentage.toFixed(0)}%
                            </div>
                            <div className="text-xs text-white/40 mt-1">Draw</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-primary">
                                {stats.awayWinPercentage.toFixed(0)}%
                            </div>
                            <div className="text-xs text-white/40 mt-1">{match.awayTeam.shortName} Win</div>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/40">
                        <Users className="w-4 h-4" />
                        <span>Average prediction: {stats.averageHomeScore.toFixed(1)} - {stats.averageAwayScore.toFixed(1)}</span>
                    </div>
                </div>
            )}

            {/* Match Status Warning */}
            {match.status === 'LIVE' && (
                <div className="px-6 py-4 bg-red-900/20 border-b border-red-500/20">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <p className="text-sm font-semibold text-red-200">
                            Match is currently LIVE - Predictions are closed
                        </p>
                    </div>
                </div>
            )}

            {match.status === 'FINISHED' && (
                <div className="px-6 py-4 bg-white/5 border-b border-white/10">
                    <p className="text-sm font-semibold text-white/60 text-center">
                        Match has ended - Predictions are closed
                    </p>
                </div>
            )}

            {/* Prediction Form */}
            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                {/* Score Prediction */}
                <div className="grid grid-cols-3 gap-2 md:gap-4 items-center">
                    {/* Home Team */}
                    <div className="flex flex-col items-center space-y-2 md:space-y-3">
                        <img
                            src={match.homeTeam.logo}
                            alt={match.homeTeam.name}
                            className="w-10 h-10 md:w-16 md:h-16 object-contain"
                        />
                        <h4 className="font-bold text-white text-center text-xs md:text-base">{match.homeTeam.shortName}</h4>

                        {/* Score Input */}
                        <div className="flex items-center gap-1 md:gap-2">
                            <button
                                onClick={() => setHomeScore(Math.max(0, homeScore - scoreStep))}
                                disabled={submitted || match.status === 'LIVE' || match.status === 'FINISHED'}
                                className="w-7 h-7 md:w-8 md:h-8 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors text-sm md:text-base"
                            >
                                -
                            </button>
                            <div className="w-12 h-10 md:w-16 md:h-12 bg-white/10 rounded-lg flex items-center justify-center">
                                <span className="text-xl md:text-2xl font-bold text-white">{homeScore}</span>
                            </div>
                            <button
                                onClick={() => setHomeScore(Math.min(maxScore, homeScore + scoreStep))}
                                disabled={submitted || match.status === 'LIVE' || match.status === 'FINISHED'}
                                className="w-7 h-7 md:w-8 md:h-8 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors text-sm md:text-base"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* VS */}
                    <div className="flex flex-col items-center">
                        <div className="text-xl md:text-3xl font-bold text-white/40">VS</div>
                        <div className="mt-1 md:mt-2 text-[10px] md:text-sm text-white/40 hidden sm:block">Final Score</div>
                    </div>

                    {/* Away Team */}
                    <div className="flex flex-col items-center space-y-2 md:space-y-3">
                        <img
                            src={match.awayTeam.logo}
                            alt={match.awayTeam.name}
                            className="w-10 h-10 md:w-16 md:h-16 object-contain"
                        />
                        <h4 className="font-bold text-white text-center text-xs md:text-base">{match.awayTeam.shortName}</h4>

                        {/* Score Input */}
                        <div className="flex items-center gap-1 md:gap-2">
                            <button
                                onClick={() => setAwayScore(Math.max(0, awayScore - scoreStep))}
                                disabled={submitted || match.status === 'LIVE' || match.status === 'FINISHED'}
                                className="w-7 h-7 md:w-8 md:h-8 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors text-sm md:text-base"
                            >
                                -
                            </button>
                            <div className="w-12 h-10 md:w-16 md:h-12 bg-white/10 rounded-lg flex items-center justify-center">
                                <span className="text-xl md:text-2xl font-bold text-white">{awayScore}</span>
                            </div>
                            <button
                                onClick={() => setAwayScore(Math.min(maxScore, awayScore + scoreStep))}
                                disabled={submitted || match.status === 'LIVE' || match.status === 'FINISHED'}
                                className="w-7 h-7 md:w-8 md:h-8 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors text-sm md:text-base"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                {/* Confidence Slider */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-white/60 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" />
                            Confidence Level
                        </label>
                        <span className="text-lg font-bold text-white">{confidence}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={confidence}
                        onChange={(e) => setConfidence(parseInt(e.target.value))}
                        disabled={submitted || match.status === 'LIVE' || match.status === 'FINISHED'}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                        style={{
                            background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${confidence}%, #ffffff20 ${confidence}%, #ffffff20 100%)`
                        }}
                    />
                    <div className="flex justify-between text-xs text-white/40">
                        <span>Not Sure</span>
                        <span>Very Confident</span>
                    </div>
                </div>

                {/* Prediction Summary */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                            <p className="text-xs md:text-sm text-white/60">Your Prediction</p>
                            <p className="text-base md:text-xl font-bold text-white mt-1">
                                {getWinnerText()} to win
                            </p>
                            <p className="text-xs md:text-sm text-white/40 mt-1">
                                Score: {homeScore} - {awayScore}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs md:text-sm text-white/60">Points</p>
                            <p className="text-xl md:text-2xl font-bold text-primary mt-1">
                                {Math.round(confidence * 1.5)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                {!isAuthenticated ? (
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm text-yellow-200">
                                <a href="/auth/login" className="font-semibold underline hover:text-yellow-100">
                                    Sign in
                                </a>
                                {' '}to make predictions and compete on the leaderboard!
                            </p>
                        </div>
                    </div>
                ) : submitted ? (
                    <div className="space-y-3">
                        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-green-200">
                                    Prediction submitted successfully!
                                </p>
                                <p className="text-xs text-green-300/70 mt-1">
                                    You'll earn points when the match ends
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleUpdate}
                            className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg font-semibold transition-colors"
                        >
                            Update Prediction
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={cn(
                            "w-full py-4 rounded-lg font-bold text-white transition-all transform hover:scale-[1.02]",
                            submitting
                                ? "bg-white/10 cursor-not-allowed"
                                : "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                        )}
                    >
                        {submitting ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Submitting...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <Trophy className="w-5 h-5" />
                                <span>Submit Prediction</span>
                            </div>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
