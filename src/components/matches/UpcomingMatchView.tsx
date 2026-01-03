'use client';

import { useState } from 'react';
import { Calendar, MapPin, Trophy, Users, TrendingUp, MessageSquare } from 'lucide-react';
import { MatchPredictionCard } from '@/components/predictions/MatchPredictionCard';
import { MatchVotePoll } from '@/components/predictions/MatchVotePoll';
import { cn } from '@/lib/utils';

interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    color: string;
}

interface Match {
    id: string;
    sport: string;
    homeTeam: Team;
    awayTeam: Team;
    homeScore?: number;
    awayScore?: number;
    status: 'UPCOMING' | 'LIVE' | 'FINISHED';
    startTime: string;
    venue: string;
    competition: string;
}

interface UpcomingMatchViewProps {
    match: Match;
}

export function UpcomingMatchView({ match }: UpcomingMatchViewProps) {
    const [activeTab, setActiveTab] = useState<'prediction' | 'poll'>('prediction');

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return {
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
        };
    };

    const matchDate = formatDate(match.startTime);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                {/* Background Gradient */}
                <div
                    className="absolute inset-0 opacity-20"
                    style={{
                        background: `linear-gradient(135deg, ${match.homeTeam.color} 0%, ${match.awayTeam.color} 100%)`,
                    }}
                />

                <div className="relative max-w-7xl mx-auto px-4 py-12">
                    {/* Match Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 bg-purple-600/20 text-purple-400 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                            <Calendar className="w-4 h-4" />
                            <span>UPCOMING MATCH</span>
                        </div>

                        <h1 className="text-2xl md:text-3xl font-bold text-gray-400 mb-2">
                            {match.competition}
                        </h1>

                        <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>{matchDate.dayOfWeek}, {matchDate.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <span>{match.venue}</span>
                            </div>
                        </div>
                    </div>

                    {/* Teams Display */}
                    <div className="grid grid-cols-3 gap-8 items-center max-w-4xl mx-auto mb-8">
                        {/* Home Team */}
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="relative">
                                <div
                                    className="absolute inset-0 blur-2xl opacity-30"
                                    style={{ backgroundColor: match.homeTeam.color }}
                                />
                                <img
                                    src={match.homeTeam.logo}
                                    alt={match.homeTeam.name}
                                    className="relative w-24 h-24 md:w-32 md:h-32 object-contain"
                                />
                            </div>
                            <div>
                                <h2 className="text-xl md:text-2xl font-bold text-white">
                                    {match.homeTeam.name}
                                </h2>
                                <p className="text-sm text-gray-400">Home</p>
                            </div>
                        </div>

                        {/* VS & Time */}
                        <div className="flex flex-col items-center space-y-3">
                            <div className="text-5xl md:text-6xl font-bold text-gray-600">VS</div>
                            <div className="bg-gray-800 rounded-lg px-6 py-3 border border-gray-700">
                                <p className="text-2xl md:text-3xl font-bold text-white">
                                    {matchDate.time}
                                </p>
                            </div>
                        </div>

                        {/* Away Team */}
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="relative">
                                <div
                                    className="absolute inset-0 blur-2xl opacity-30"
                                    style={{ backgroundColor: match.awayTeam.color }}
                                />
                                <img
                                    src={match.awayTeam.logo}
                                    alt={match.awayTeam.name}
                                    className="relative w-24 h-24 md:w-32 md:h-32 object-contain"
                                />
                            </div>
                            <div>
                                <h2 className="text-xl md:text-2xl font-bold text-white">
                                    {match.awayTeam.name}
                                </h2>
                                <p className="text-sm text-gray-400">Away</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Prediction/Poll Tabs */}
                        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                            {/* Tab Headers */}
                            <div className="flex border-b border-gray-800">
                                <button
                                    onClick={() => setActiveTab('prediction')}
                                    className={cn(
                                        "flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center gap-2",
                                        activeTab === 'prediction'
                                            ? "bg-purple-600 text-white"
                                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                                    )}
                                >
                                    <TrendingUp className="w-4 h-4" />
                                    <span>Predict Score</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('poll')}
                                    className={cn(
                                        "flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center gap-2",
                                        activeTab === 'poll'
                                            ? "bg-purple-600 text-white"
                                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                                    )}
                                >
                                    <Users className="w-4 h-4" />
                                    <span>Vote Winner</span>
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="p-6">
                                {activeTab === 'prediction' ? (
                                    <MatchPredictionCard match={match} />
                                ) : (
                                    <MatchVotePoll match={match} />
                                )}
                            </div>
                        </div>

                        {/* Match Info */}
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 p-6">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-yellow-500" />
                                Match Information
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">Competition</p>
                                    <p className="text-white font-semibold">{match.competition}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">Venue</p>
                                    <p className="text-white font-semibold">{match.venue}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">Date</p>
                                    <p className="text-white font-semibold">{matchDate.date}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">Kick-off</p>
                                    <p className="text-white font-semibold">{matchDate.time}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">Sport</p>
                                    <p className="text-white font-semibold capitalize">{match.sport}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">Status</p>
                                    <span className="inline-flex items-center px-3 py-1 bg-orange-600/20 text-orange-500 rounded-full text-sm font-semibold">
                                        {match.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Quick Poll */}
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Quick Vote</h3>
                            <MatchVotePoll match={match} compact />
                        </div>

                        {/* Countdown */}
                        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4 text-center">Match Starts In</h3>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                {['Days', 'Hours', 'Mins', 'Secs'].map((unit, i) => (
                                    <div key={unit} className="bg-black/30 rounded-lg p-3">
                                        <div className="text-2xl font-bold text-white">
                                            {i === 0 ? '2' : i === 1 ? '14' : i === 2 ? '32' : '45'}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">{unit}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Discussion */}
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-blue-500" />
                                Discussion
                            </h3>
                            <p className="text-sm text-gray-400 mb-4">
                                Join the conversation about this match!
                            </p>
                            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-colors">
                                View Comments
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
