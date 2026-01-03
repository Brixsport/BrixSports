'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trophy,
    Target,
    TrendingUp,
    Calendar,
    Clock,
    Users,
    Award,
    Zap,
    ChevronRight,
    Star,
    Flame,
    ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface Match {
    id: string;
    homeTeam: { id: string; name: string; logo: string };
    awayTeam: { id: string; name: string; logo: string };
    date: string;
    time: string;
    competition: string;
    status: string;
    homeScore?: number;
    awayScore?: number;
}

interface Prediction {
    matchId: string;
    predictedHomeScore: number;
    predictedAwayScore: number;
    confidence: number;
}

interface LeaderboardEntry {
    userId: string;
    userName: string;
    totalPoints: number;
    accuracy: number;
    correctPredictions: number;
    totalPredictions: number;
    streak: number;
    rank: number;
}

export default function PredictionsPage() {
    const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
    const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [userStats, setUserStats] = useState({
        totalPoints: 0,
        accuracy: 0,
        rank: 0,
        streak: 0,
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'predict' | 'leaderboard'>('predict');

    // Mock user ID
    const userId = 'user-1';
    const userName = 'Guest User';

    useEffect(() => {
        fetchUpcomingMatches();
        fetchLeaderboard();
        fetchUserStats();
        fetchUserPredictions();
    }, []);

    const fetchUpcomingMatches = async () => {
        try {
            const response = await fetch('/api/matches?status=upcoming&limit=10');
            const data = await response.json();
            setUpcomingMatches(data.matches || []);
        } catch (error) {
            console.error('Error fetching matches:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLeaderboard = async () => {
        try {
            const response = await fetch('/api/predictions/leaderboard?limit=10');
            const data = await response.json();
            setLeaderboard(data.leaderboard || []);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        }
    };

    const fetchUserStats = async () => {
        try {
            const response = await fetch(`/api/predictions/stats?userId=${userId}`);
            const data = await response.json();
            setUserStats(data.stats || userStats);
        } catch (error) {
            console.error('Error fetching user stats:', error);
        }
    };

    const fetchUserPredictions = async () => {
        try {
            const response = await fetch(`/api/predictions?userId=${userId}`);
            const data = await response.json();
            const predictionsMap: Record<string, Prediction> = {};
            data.predictions?.forEach((pred: any) => {
                predictionsMap[pred.matchId] = pred;
            });
            setPredictions(predictionsMap);
        } catch (error) {
            console.error('Error fetching predictions:', error);
        }
    };

    const handlePredictionChange = (matchId: string, field: string, value: number) => {
        setPredictions((prev) => ({
            ...prev,
            [matchId]: {
                ...prev[matchId],
                [field]: value,
                confidence: prev[matchId]?.confidence || 50,
            },
        }));
    };

    const handleSubmitPrediction = async (matchId: string) => {
        const prediction = predictions[matchId];
        if (!prediction) return;

        const winner =
            prediction.predictedHomeScore > prediction.predictedAwayScore
                ? 'home'
                : prediction.predictedHomeScore < prediction.predictedAwayScore
                    ? 'away'
                    : 'draw';

        try {
            const response = await fetch('/api/predictions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...prediction,
                    userId,
                    matchId,
                    predictedWinner: winner,
                }),
            });

            if (response.ok) {
                alert('Prediction submitted successfully!');
                fetchUserStats();
            }
        } catch (error) {
            console.error('Error submitting prediction:', error);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                Back
                            </Link>
                            <div className="h-6 w-px bg-slate-700" />
                            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                                Match Predictions
                            </h1>
                        </div>

                        {/* User Stats */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/20">
                                <Trophy className="w-5 h-5 text-yellow-400" />
                                <span className="font-bold text-white">{userStats.totalPoints} pts</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-blue-500/20 rounded-lg border border-blue-500/20">
                                <Target className="w-5 h-5 text-blue-400" />
                                <span className="font-bold text-white">{userStats.accuracy}%</span>
                            </div>
                            {userStats.streak > 0 && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-lg border border-red-500/20">
                                    <Flame className="w-5 h-5 text-orange-400" />
                                    <span className="font-bold text-white">{userStats.streak} streak</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="flex gap-2 mb-8">
                    <button
                        onClick={() => setActiveTab('predict')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'predict'
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/50'
                            : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                            }`}
                    >
                        <Target className="w-5 h-5" />
                        Make Predictions
                    </button>
                    <button
                        onClick={() => setActiveTab('leaderboard')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'leaderboard'
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/50'
                            : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
                            }`}
                    >
                        <Trophy className="w-5 h-5" />
                        Leaderboard
                    </button>
                </div>

                {/* Content */}
                {activeTab === 'predict' ? (
                    <div className="space-y-6">
                        {loading ? (
                            <div className="space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="animate-pulse bg-slate-800/50 rounded-2xl h-48" />
                                ))}
                            </div>
                        ) : upcomingMatches.length === 0 ? (
                            <div className="text-center py-20">
                                <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                <h3 className="text-2xl font-bold text-slate-400 mb-2">No upcoming matches</h3>
                                <p className="text-slate-500">Check back later for new matches to predict!</p>
                            </div>
                        ) : (
                            upcomingMatches.map((match, index) => (
                                <PredictionCard
                                    key={match.id}
                                    match={match}
                                    prediction={predictions[match.id]}
                                    onPredictionChange={handlePredictionChange}
                                    onSubmit={handleSubmitPrediction}
                                    index={index}
                                />
                            ))
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Top 3 Podium */}
                        <div className="lg:col-span-3">
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                {leaderboard.slice(0, 3).map((entry, index) => (
                                    <PodiumCard key={entry.userId} entry={entry} position={index + 1} />
                                ))}
                            </div>
                        </div>

                        {/* Full Leaderboard */}
                        <div className="lg:col-span-3">
                            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
                                <div className="p-6 border-b border-slate-700">
                                    <h2 className="text-2xl font-bold text-white">Full Leaderboard</h2>
                                </div>
                                <div className="divide-y divide-slate-700">
                                    {leaderboard.map((entry) => (
                                        <LeaderboardRow key={entry.userId} entry={entry} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PredictionCard({ match, prediction, onPredictionChange, onSubmit, index }: {
    match: Match;
    prediction?: Prediction;
    onPredictionChange: (matchId: string, field: string, value: number) => void;
    onSubmit: (matchId: string) => void;
    index: number;
}) {
    const [homeScore, setHomeScore] = useState(prediction?.predictedHomeScore || 0);
    const [awayScore, setAwayScore] = useState(prediction?.predictedAwayScore || 0);
    const [confidence, setConfidence] = useState(prediction?.confidence || 50);

    const handleScoreChange = (team: 'home' | 'away', value: number) => {
        const score = Math.max(0, Math.min(10, value));
        if (team === 'home') {
            setHomeScore(score);
            onPredictionChange(match.id, 'predictedHomeScore', score);
        } else {
            setAwayScore(score);
            onPredictionChange(match.id, 'predictedAwayScore', score);
        }
    };

    const handleConfidenceChange = (value: number) => {
        setConfidence(value);
        onPredictionChange(match.id, 'confidence', value);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/50 transition-all"
        >
            {/* Match Info */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm font-semibold border border-purple-500/20">
                        {match.competition}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Calendar className="w-4 h-4" />
                        {new Date(match.date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Clock className="w-4 h-4" />
                        {match.time}
                    </div>
                </div>
            </div>

            {/* Teams and Scores */}
            <div className="grid grid-cols-7 gap-4 items-center mb-6">
                {/* Home Team */}
                <div className="col-span-3 flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <Users className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-lg truncate">{match.homeTeam.name}</h3>
                    </div>
                </div>

                {/* Score Inputs */}
                <div className="col-span-1 flex flex-col items-center gap-2">
                    <input
                        type="number"
                        min="0"
                        max="10"
                        value={homeScore}
                        onChange={(e) => handleScoreChange('home', parseInt(e.target.value) || 0)}
                        className="w-16 h-16 text-center text-3xl font-bold bg-slate-700 border-2 border-slate-600 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    <span className="text-xs text-slate-500 font-semibold">HOME</span>
                </div>

                <div className="col-span-1 flex items-center justify-center">
                    <span className="text-2xl font-bold text-slate-600">VS</span>
                </div>

                <div className="col-span-1 flex flex-col items-center gap-2">
                    <input
                        type="number"
                        min="0"
                        max="10"
                        value={awayScore}
                        onChange={(e) => handleScoreChange('away', parseInt(e.target.value) || 0)}
                        className="w-16 h-16 text-center text-3xl font-bold bg-slate-700 border-2 border-slate-600 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    <span className="text-xs text-slate-500 font-semibold">AWAY</span>
                </div>

                {/* Away Team */}
                <div className="col-span-3 flex items-center gap-3 flex-row-reverse">
                    <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <Users className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                        <h3 className="font-bold text-white text-lg truncate">{match.awayTeam.name}</h3>
                    </div>
                </div>
            </div>

            {/* Confidence Slider */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-300">Confidence Level</label>
                    <span className="text-sm font-bold text-cyan-400">{confidence}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={confidence}
                    onChange={(e) => handleConfidenceChange(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
            </div>

            {/* Submit Button */}
            <button
                onClick={() => onSubmit(match.id)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-cyan-500/50 transition-all"
            >
                <Target className="w-5 h-5" />
                Submit Prediction
            </button>
        </motion.div>
    );
}

function PodiumCard({ entry, position }: { entry: LeaderboardEntry; position: number }) {
    const colors = {
        1: 'from-yellow-500 to-orange-500',
        2: 'from-slate-400 to-slate-500',
        3: 'from-amber-700 to-amber-800',
    };

    const heights = {
        1: 'h-48',
        2: 'h-40',
        3: 'h-32',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: position * 0.1 }}
            className={`bg-gradient-to-br ${colors[position as keyof typeof colors]} rounded-2xl p-6 ${heights[position as keyof typeof heights]} flex flex-col items-center justify-center text-white relative overflow-hidden`}
        >
            <div className="absolute top-4 right-4 text-6xl font-black opacity-10">#{position}</div>
            <Trophy className="w-12 h-12 mb-3" />
            <h3 className="font-bold text-lg mb-1">{entry.userName}</h3>
            <p className="text-2xl font-black mb-1">{entry.totalPoints} pts</p>
            <p className="text-sm opacity-90">{entry.accuracy}% accuracy</p>
        </motion.div>
    );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
    return (
        <div className="p-4 hover:bg-slate-700/30 transition-colors">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                        #{entry.rank}
                    </div>
                    <div>
                        <h3 className="font-bold text-white">{entry.userName}</h3>
                        <p className="text-sm text-slate-400">
                            {entry.correctPredictions}/{entry.totalPredictions} correct
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-2xl font-bold text-white">{entry.totalPoints}</p>
                        <p className="text-xs text-slate-400">points</p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-blue-400">{entry.accuracy}%</p>
                        <p className="text-xs text-slate-400">accuracy</p>
                    </div>
                    {entry.streak > 0 && (
                        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/20">
                            <Flame className="w-4 h-4" />
                            <span className="font-bold">{entry.streak}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

