'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

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
    sport?: string;
}

interface PollData {
    totalVotes: number;
    homeVotes: number;
    awayVotes: number;
    drawVotes: number;
    userVote?: 'home' | 'away' | 'draw' | null;
}

interface MatchVotePollProps {
    match: Match;
    compact?: boolean;
}

export function MatchVotePoll({ match, compact = false }: MatchVotePollProps) {
    const { user, isAuthenticated } = useAuth();
    const [pollData, setPollData] = useState<PollData>({
        totalVotes: 0,
        homeVotes: 0,
        awayVotes: 0,
        drawVotes: 0,
        userVote: null,
    });
    const [voting, setVoting] = useState(false);
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        fetchPollData();
    }, [match.id]);

    const fetchPollData = async () => {
        try {
            const response = await fetch(`/api/polls?matchId=${match.id}&type=match_winner`);
            if (response.ok) {
                const data = await response.json();
                if (data.poll) {
                    const options = JSON.parse(data.poll.options);
                    const homeOption = options.find((o: any) => o.teamId === match.homeTeam.id);
                    const awayOption = options.find((o: any) => o.teamId === match.awayTeam.id);
                    const drawOption = options.find((o: any) => o.id === 'draw');

                    setPollData({
                        totalVotes: data.poll.totalVotes || 0,
                        homeVotes: homeOption?.votes || 0,
                        awayVotes: awayOption?.votes || 0,
                        drawVotes: drawOption?.votes || 0,
                        userVote: data.userVote?.optionId || null,
                    });

                    if (data.userVote) {
                        setShowResults(true);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching poll data:', error);
        }
    };

    const handleVote = async (choice: 'home' | 'away' | 'draw') => {
        if (!isAuthenticated) {
            alert('Please sign in to vote');
            return;
        }

        setVoting(true);
        try {
            const response = await fetch('/api/polls/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId: match.id,
                    optionId: choice,
                    userId: user?.id,
                }),
            });

            if (response.ok) {
                await fetchPollData();
                setShowResults(true);
            }
        } catch (error) {
            console.error('Error voting:', error);
        } finally {
            setVoting(false);
        }
    };

    const getPercentage = (votes: number) => {
        if (pollData.totalVotes === 0) return 0;
        return Math.round((votes / pollData.totalVotes) * 100);
    };

    const getWinningChoice = () => {
        const max = Math.max(pollData.homeVotes, pollData.awayVotes, pollData.drawVotes);
        if (pollData.homeVotes === max) return 'home';
        if (pollData.awayVotes === max) return 'away';
        return 'draw';
    };

    if (compact) {
        return (
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-purple-500" />
                        Who will win?
                    </h4>
                    <span className="text-xs text-gray-400">
                        {pollData.totalVotes} votes
                    </span>
                </div>

                {!showResults && isAuthenticated ? (
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => handleVote('home')}
                            disabled={voting}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white py-2 px-3 rounded-lg text-xs font-semibold transition-colors"
                        >
                            {match.homeTeam.shortName}
                        </button>
                        <button
                            onClick={() => handleVote('draw')}
                            disabled={voting}
                            className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 text-white py-2 px-3 rounded-lg text-xs font-semibold transition-colors"
                        >
                            Draw
                        </button>
                        <button
                            onClick={() => handleVote('away')}
                            disabled={voting}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white py-2 px-3 rounded-lg text-xs font-semibold transition-colors"
                        >
                            {match.awayTeam.shortName}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {[
                            { label: match.homeTeam.shortName, votes: pollData.homeVotes, choice: 'home', color: 'blue' },
                            { label: 'Draw', votes: pollData.drawVotes, choice: 'draw', color: 'gray' },
                            { label: match.awayTeam.shortName, votes: pollData.awayVotes, choice: 'away', color: 'red' },
                        ].map((option) => (
                            <div key={option.choice} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className={cn(
                                        "font-medium",
                                        pollData.userVote === option.choice && "text-green-400"
                                    )}>
                                        {option.label}
                                        {pollData.userVote === option.choice && " ✓"}
                                    </span>
                                    <span className="text-gray-400">{getPercentage(option.votes)}%</span>
                                </div>
                                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full transition-all duration-500",
                                            option.color === 'blue' && "bg-blue-500",
                                            option.color === 'gray' && "bg-gray-500",
                                            option.color === 'red' && "bg-red-500"
                                        )}
                                        style={{ width: `${getPercentage(option.votes)}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg">Match Poll</h3>
                            <p className="text-white/80 text-sm">Vote for the winner!</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white/20 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-semibold">
                            {pollData.totalVotes} votes
                        </span>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {!showResults && isAuthenticated ? (
                    <>
                        <p className="text-center text-gray-400">Who do you think will win this match?</p>

                        <div className="grid grid-cols-1 gap-4">
                            {/* Home Team Vote */}
                            <button
                                onClick={() => handleVote('home')}
                                disabled={voting}
                                className="group relative bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-700 disabled:to-gray-800 rounded-xl p-6 transition-all transform hover:scale-[1.02] disabled:cursor-not-allowed"
                            >
                                <div className="flex items-center gap-4">
                                    <img
                                        src={match.homeTeam.logo}
                                        alt={match.homeTeam.name}
                                        className="w-16 h-16 object-contain"
                                    />
                                    <div className="flex-1 text-left">
                                        <h4 className="text-xl font-bold text-white">{match.homeTeam.name}</h4>
                                        <p className="text-sm text-white/70">Home Team</p>
                                    </div>
                                    <CheckCircle className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
                                </div>
                            </button>

                            {/* Draw Vote */}
                            <button
                                onClick={() => handleVote('draw')}
                                disabled={voting}
                                className="group relative bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 disabled:from-gray-700 disabled:to-gray-800 rounded-xl p-6 transition-all transform hover:scale-[1.02] disabled:cursor-not-allowed"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                                        <TrendingUp className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <h4 className="text-xl font-bold text-white">Draw</h4>
                                        <p className="text-sm text-white/70">Equal Score</p>
                                    </div>
                                    <CheckCircle className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
                                </div>
                            </button>

                            {/* Away Team Vote */}
                            <button
                                onClick={() => handleVote('away')}
                                disabled={voting}
                                className="group relative bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-700 disabled:to-gray-800 rounded-xl p-6 transition-all transform hover:scale-[1.02] disabled:cursor-not-allowed"
                            >
                                <div className="flex items-center gap-4">
                                    <img
                                        src={match.awayTeam.logo}
                                        alt={match.awayTeam.name}
                                        className="w-16 h-16 object-contain"
                                    />
                                    <div className="flex-1 text-left">
                                        <h4 className="text-xl font-bold text-white">{match.awayTeam.name}</h4>
                                        <p className="text-sm text-white/70">Away Team</p>
                                    </div>
                                    <CheckCircle className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
                                </div>
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="text-center">
                            <p className="text-gray-400 text-sm mb-2">Current Results</p>
                            {pollData.userVote && (
                                <p className="text-green-400 text-sm font-semibold">
                                    ✓ You voted for {
                                        pollData.userVote === 'home' ? match.homeTeam.shortName :
                                            pollData.userVote === 'away' ? match.awayTeam.shortName :
                                                'Draw'
                                    }
                                </p>
                            )}
                        </div>

                        {/* Results */}
                        <div className="space-y-4">
                            {[
                                { label: match.homeTeam.name, logo: match.homeTeam.logo, votes: pollData.homeVotes, choice: 'home', color: 'from-blue-600 to-blue-700' },
                                { label: 'Draw', votes: pollData.drawVotes, choice: 'draw', color: 'from-gray-600 to-gray-700' },
                                { label: match.awayTeam.name, logo: match.awayTeam.logo, votes: pollData.awayVotes, choice: 'away', color: 'from-red-600 to-red-700' },
                            ].map((option) => {
                                const percentage = getPercentage(option.votes);
                                const isWinning = getWinningChoice() === option.choice && pollData.totalVotes > 0;
                                const isUserVote = pollData.userVote === option.choice;

                                return (
                                    <div
                                        key={option.choice}
                                        className={cn(
                                            "relative rounded-xl overflow-hidden border-2 transition-all",
                                            isWinning ? "border-yellow-500" : "border-gray-700",
                                            isUserVote && "ring-2 ring-green-500"
                                        )}
                                    >
                                        {/* Background Bar */}
                                        <div
                                            className={cn("absolute inset-0 bg-gradient-to-r opacity-20 transition-all duration-500", option.color)}
                                            style={{ width: `${percentage}%` }}
                                        />

                                        {/* Content */}
                                        <div className="relative p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {option.logo && (
                                                    <img
                                                        src={option.logo}
                                                        alt={option.label}
                                                        className="w-10 h-10 object-contain"
                                                    />
                                                )}
                                                <div>
                                                    <p className="font-bold text-white flex items-center gap-2">
                                                        {option.label}
                                                        {isWinning && <span className="text-yellow-500">👑</span>}
                                                        {isUserVote && <span className="text-green-500">✓</span>}
                                                    </p>
                                                    <p className="text-sm text-gray-400">{option.votes} votes</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-bold text-white">{percentage}%</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {!isAuthenticated && (
                            <div className="text-center pt-4">
                                <p className="text-sm text-gray-400">
                                    <a href="/auth/login" className="text-purple-500 hover:text-purple-400 font-semibold">
                                        Sign in
                                    </a>
                                    {' '}to vote!
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
