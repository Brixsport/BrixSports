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

    // Mock user ID - in a real app this would come from auth
    const userId = 'user-1';

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
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Header */}
            <div className="border-b border-white/10 bg-[#0a0a0a]/50 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                <span className="text-sm font-bold uppercase tracking-widest">Back</span>
                            </Link>
                            <div className="h-6 w-px bg-white/10" />
                            <h1 className="text-2xl font-display italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
                                Match Predictions
                            </h1>
                        </div>

                        {/* User Stats */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-xl border border-primary/20">
                                <Trophy className="w-4 h-4 text-primary" />
                                <span className="font-bold text-sm">{userStats.totalPoints} PTS</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                                <Target className="w-4 h-4 text-white/60" />
                                <span className="font-bold text-sm">{userStats.accuracy}%</span>
                            </div>
                            {userStats.streak > 0 && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 rounded-xl border border-orange-500/20">
                                    <Flame className="w-4 h-4 text-orange-500" />
                                    <span className="font-bold text-sm">{userStats.streak} STREAK</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="flex gap-2 mb-10">
                    <button
                        onClick={() => setActiveTab('predict')}
                        className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${activeTab === 'predict'
                            ? 'bg-primary text-black shadow-lg shadow-primary/20 scale-105'
                            : 'bg-white/5 text-white/40 hover:bg-white/10'
                            }`}
                    >
                        <Target className="w-5 h-5" />
                        Predict
                    </button>
                    <button
                        onClick={() => setActiveTab('leaderboard')}
                        className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${activeTab === 'leaderboard'
                            ? 'bg-primary text-black shadow-lg shadow-primary/20 scale-105'
                            : 'bg-white/5 text-white/40 hover:bg-white/10'
                            }`}
                    >
                        <Trophy className="w-5 h-5" />
                        Leaderboard
                    </button>
                </div>

                {/* Content */}
                {activeTab === 'predict' ? (
                    <div className="space-y-8">
                        {loading ? (
                            <div className="space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="animate-pulse bg-white/5 rounded-3xl h-64" />
                                ))}
                            </div>
                        ) : upcomingMatches.length === 0 ? (
                            <div className="text-center py-24 bg-white/5 border border-white/10 rounded-[40px]">
                                <Calendar className="w-16 h-16 text-white/10 mx-auto mb-6" />
                                <h3 className="text-2xl font-display italic uppercase tracking-tight text-white/60 mb-2">No upcoming matches</h3>
                                <p className="text-white/40 text-sm">Check back later for new matches to predict!</p>
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
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Top 3 Podium */}
                        <div className="lg:col-span-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                                {leaderboard.slice(0, 3).map((entry, index) => (
                                    <PodiumCard key={entry.userId} entry={entry} position={index + 1} />
                                ))}
                            </div>
                        </div>

                        {/* Full Leaderboard */}
                        <div className="lg:col-span-3">
                            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[40px] overflow-hidden">
                                <div className="px-8 py-8 border-b border-white/10 bg-white/5">
                                    <h2 className="text-3xl font-display italic uppercase tracking-tighter text-white">Full Leaderboard</h2>
                                </div>
                                <div className="divide-y divide-white/5">
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[40px] p-8 md:p-12 hover:border-primary/40 transition-all group"
        >
            {/* Match Info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">
                        {match.competition}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-wider">
                        <Calendar className="w-4 h-4 opacity-50" />
                        {new Date(match.date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-wider">
                        <Clock className="w-4 h-4 opacity-50" />
                        {match.time}
                    </div>
                </div>
            </div>

            {/* Teams and Scores */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-8 md:gap-4 items-center mb-12">
                {/* Home Team */}
                <div className="col-span-3 flex items-center gap-6">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-2xl">
                        {match.homeTeam.logo ? (
                            <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-12 h-12 md:w-16 md:h-16 object-contain" />
                        ) : (
                            <Users className="w-10 h-10 text-white/10" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-display italic uppercase text-2xl md:text-3xl text-white tracking-tighter truncate">{match.homeTeam.name}</h3>
                    </div>
                </div>

                {/* Score Controls - Desktop & Mobile */}
                <div className="col-span-1 flex flex-row md:flex-col items-center justify-center gap-4">
                    <div className="flex flex-col items-center gap-3">
                        <button
                            onClick={() => handleScoreChange('home', homeScore + 1)}
                            className="w-12 h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                        >
                            <ChevronRight className="w-6 h-6 rotate-[270deg]" />
                        </button>
                        <div className="w-20 h-20 bg-white/10 border-2 border-primary/50 rounded-3xl flex items-center justify-center shadow-lg shadow-primary/10">
                            <span className="text-4xl font-black text-white">{homeScore}</span>
                        </div>
                        <button
                            onClick={() => handleScoreChange('home', homeScore - 1)}
                            className="w-12 h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                        >
                            <ChevronRight className="w-6 h-6 rotate-90" />
                        </button>
                        <span className="text-[10px] font-black uppercase text-white/20 tracking-widest mt-2">HOME</span>
                    </div>

                    <div className="hidden md:flex flex-col items-center py-4">
                        <div className="w-px h-12 bg-white/10" />
                        <span className="text-xl font-black text-white/20 italic my-2">VS</span>
                        <div className="w-px h-12 bg-white/10" />
                    </div>

                    <div className="flex flex-col items-center gap-3">
                        <button
                            onClick={() => handleScoreChange('away', awayScore + 1)}
                            className="w-12 h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                        >
                            <ChevronRight className="w-6 h-6 rotate-[270deg]" />
                        </button>
                        <div className="w-20 h-20 bg-white/10 border-2 border-primary/50 rounded-3xl flex items-center justify-center shadow-lg shadow-primary/10">
                            <span className="text-4xl font-black text-white">{awayScore}</span>
                        </div>
                        <button
                            onClick={() => handleScoreChange('away', awayScore - 1)}
                            className="w-12 h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                        >
                            <ChevronRight className="w-6 h-6 rotate-90" />
                        </button>
                        <span className="text-[10px] font-black uppercase text-white/20 tracking-widest mt-2">AWAY</span>
                    </div>
                </div>

                {/* Away Team */}
                <div className="col-span-3 flex items-center gap-6 flex-row-reverse">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-2xl">
                        {match.awayTeam.logo ? (
                            <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-12 h-12 md:w-16 md:h-16 object-contain" />
                        ) : (
                            <Users className="w-10 h-10 text-white/10" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                        <h3 className="font-display italic uppercase text-2xl md:text-3xl text-white tracking-tighter truncate">{match.awayTeam.name}</h3>
                    </div>
                </div>
            </div>

            {/* Confidence Slider */}
            <div className="mb-10 p-8 bg-white/5 border border-white/10 rounded-[32px]">
                <div className="flex items-center justify-between mb-6">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Confidence Level</label>
                    <span className="text-3xl font-black italic text-primary">{confidence}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={confidence}
                    onChange={(e) => handleConfidenceChange(parseInt(e.target.value))}
                    className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                    style={{
                        background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${confidence}%, #ffffff10 ${confidence}%, #ffffff10 100%)`
                    }}
                />
                <div className="flex justify-between mt-4">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Not Sure</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Absolute Certain</span>
                </div>
            </div>

            {/* Submit Button */}
            <button
                onClick={() => onSubmit(match.id)}
                className="w-full relative group/btn overflow-hidden px-8 py-6 bg-primary text-black rounded-3xl font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-primary/20"
            >
                <div className="relative z-10 flex items-center justify-center gap-3">
                    <Target className="w-6 h-6" />
                    <span>Confirm Prediction</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover/btn:animate-[shimmer_2s_infinite]" />
            </button>
        </motion.div>
    );
}

function PodiumCard({ entry, position }: { entry: LeaderboardEntry; position: number }) {
    const isFirst = position === 1;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: position * 0.1 }}
            className={`relative group bg-white/5 border ${isFirst ? 'border-primary' : 'border-white/10'} rounded-[40px] p-8 flex flex-col items-center justify-center overflow-hidden transition-all hover:bg-white/10`}
        >
            {isFirst && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
            )}

            <div className={`w-16 h-16 rounded-3xl ${isFirst ? 'bg-primary text-black' : 'bg-white/10 text-white/60'} flex items-center justify-center mb-6 relative z-10 shadow-2xl`}>
                <Trophy size={32} />
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#050505] border border-white/10 flex items-center justify-center text-xs font-black">
                    #{position}
                </div>
            </div>

            <h3 className="font-display italic uppercase text-2xl tracking-tighter mb-2">{entry.userName}</h3>
            <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-black text-primary tracking-tighter">{entry.totalPoints}</span>
                <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">PTS</span>
            </div>

            <div className="w-full grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
                <div className="text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">Accuracy</p>
                    <p className="font-bold text-white/80">{entry.accuracy}%</p>
                </div>
                <div className="text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">Streak</p>
                    <div className="flex items-center justify-center gap-1">
                        <Flame size={12} className="text-orange-500" />
                        <p className="font-bold text-white/80">{entry.streak}</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
    return (
        <div className="px-8 py-6 hover:bg-white/5 transition-all group border-l-4 border-transparent hover:border-primary">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 font-black italic text-xl group-hover:text-primary group-hover:border-primary/20 transition-all">
                        #{entry.rank}
                    </div>
                    <div>
                        <h3 className="font-bold text-white group-hover:text-primary transition-colors">{entry.userName}</h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                            {entry.correctPredictions}/{entry.totalPredictions} Correct
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-12">
                    <div className="text-right">
                        <p className="text-2xl font-black text-primary tracking-tighter">{entry.totalPoints}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Points</p>
                    </div>
                    <div className="hidden md:block text-right">
                        <p className="text-lg font-bold text-white/80">{entry.accuracy}%</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Accuracy</p>
                    </div>
                    {entry.streak > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
                            <Flame className="w-4 h-4" />
                            <span className="font-black italic text-sm">{entry.streak}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


