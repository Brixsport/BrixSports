'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

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

import { useWebSocket } from '@/hooks/useWebSocket';

export function MatchVotePoll({ match, compact = false }: MatchVotePollProps) {
    const { user, isAuthenticated, openAuthModal } = useAuth();
    const { socket, isConnected } = useWebSocket({ autoConnect: true });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);
    // ... existing state ...
    const [pollData, setPollData] = useState<PollData>({
        totalVotes: 0,
        homeVotes: 0,
        awayVotes: 0,
        drawVotes: 0,
        userVote: null,
    });
    const [voting, setVoting] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Listen for real-time updates
    useEffect(() => {
        if (isConnected && socket) {
            const handlePollUpdate = (data: any) => {
                if (data.matchId === match.id) {
                    // Refetch full data to ensure accuracy or update locally if data payload is sufficient
                    fetchPollData();
                }
            };

            socket.on('poll:updated', handlePollUpdate);

            return () => {
                socket.off('poll:updated', handlePollUpdate);
            };
        }
    }, [isConnected, socket, match.id]);

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
                // Notify server of new vote
                socket?.emit('poll:vote', { matchId: match.id });
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
                        {pollData.totalVotes} vote{pollData.totalVotes !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Always show results in compact mode */}
                <div className="space-y-2">
                    {[
                        { label: match.homeTeam.shortName, votes: pollData.homeVotes, choice: 'home', teamColor: match.homeTeam.color },
                        { label: 'Draw', votes: pollData.drawVotes, choice: 'draw', teamColor: null },
                        { label: match.awayTeam.shortName, votes: pollData.awayVotes, choice: 'away', teamColor: match.awayTeam.color },
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
                                    className="h-full transition-all duration-500"
                                    style={{
                                        width: `${getPercentage(option.votes)}%`,
                                        background: option.teamColor ? option.teamColor : '#6b7280'
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Vote button if not voted yet */}
                {mounted && isAuthenticated && !pollData.userVote && (
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10">
                        <button
                            onClick={() => handleVote('home')}
                            disabled={voting}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white py-2 px-3 rounded-lg text-xs font-semibold transition-colors"
                        >
                            Vote
                        </button>
                        <button
                            onClick={() => handleVote('draw')}
                            disabled={voting}
                            className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 text-white py-2 px-3 rounded-lg text-xs font-semibold transition-colors"
                        >
                            Vote
                        </button>
                        <button
                            onClick={() => handleVote('away')}
                            disabled={voting}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white py-2 px-3 rounded-lg text-xs font-semibold transition-colors"
                        >
                            Vote
                        </button>
                    </div>
                )}

                {/* Sign in prompt */}
                {mounted && !isAuthenticated && (
                    <div className="text-center pt-2">
                        <button
                            onClick={() => openAuthModal()}
                            className="text-xs text-primary hover:text-primary/80 font-semibold"
                        >
                            Sign in to vote
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="bg-white/5 border-b border-white/10 px-4 md:px-6 py-3 md:py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-1.5 md:p-2 bg-primary/20 rounded-lg">
                            <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-base md:text-lg">Match Poll</h3>
                            <p className="text-white/60 text-xs md:text-sm hidden sm:block">
                                {pollData.userVote ? 'Results' : 'Vote for the winner!'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 md:gap-2 bg-white/10 text-white px-2 md:px-4 py-1.5 md:py-2 rounded-lg">
                        <Users className="w-3 h-3 md:w-4 md:h-4" />
                        <span className="text-xs md:text-sm font-semibold">
                            {pollData.totalVotes}
                        </span>
                    </div>
                </div>
            </div>

            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                {/* Show voting interface if not voted */}
                {mounted && !pollData.userVote && isAuthenticated ? (
                    <>
                        <p className="text-center text-white/60 text-sm">Who do you think will win this match?</p>

                        <div className="grid grid-cols-1 gap-3 md:gap-4">
                            {/* Home Team Vote */}
                            <button
                                onClick={() => handleVote('home')}
                                disabled={voting}
                                className="group relative bg-white/5 hover:bg-white/10 active:bg-white/15 border-2 border-white/10 hover:border-white/30 active:border-white/50 disabled:border-white/5 disabled:bg-white/5 rounded-xl p-4 md:p-6 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                    borderColor: voting ? undefined : `${match.homeTeam.color}00`,
                                }}
                                onMouseEnter={(e) => {
                                    if (!voting) e.currentTarget.style.borderColor = `${match.homeTeam.color}80`;
                                }}
                                onMouseLeave={(e) => {
                                    if (!voting) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                }}
                            >
                                <div className="flex items-center gap-3 md:gap-4">
                                    <img
                                        src={match.homeTeam.logo}
                                        alt={match.homeTeam.name}
                                        className="w-12 h-12 md:w-16 md:h-16 object-contain"
                                    />
                                    <div className="flex-1 text-left">
                                        <h4 className="text-lg md:text-xl font-bold text-white">{match.homeTeam.name}</h4>
                                        <p className="text-xs md:text-sm text-white/70">Home Team</p>
                                    </div>
                                    <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-white/30 group-hover:text-white/80 transition-colors" />
                                </div>
                            </button>

                            {/* Draw Vote */}
                            <button
                                onClick={() => handleVote('draw')}
                                disabled={voting}
                                className="group relative bg-white/5 hover:bg-white/10 active:bg-white/15 border-2 border-white/10 hover:border-white/30 active:border-white/50 disabled:border-white/5 disabled:bg-white/5 rounded-xl p-4 md:p-6 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <div className="flex items-center gap-3 md:gap-4">
                                    <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 rounded-full flex items-center justify-center">
                                        <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-white" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <h4 className="text-lg md:text-xl font-bold text-white">Draw</h4>
                                        <p className="text-xs md:text-sm text-white/70">Equal Score</p>
                                    </div>
                                    <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-white/30 group-hover:text-white/80 transition-colors" />
                                </div>
                            </button>

                            {/* Away Team Vote */}
                            <button
                                onClick={() => handleVote('away')}
                                disabled={voting}
                                className="group relative bg-white/5 hover:bg-white/10 active:bg-white/15 border-2 border-white/10 hover:border-white/30 active:border-white/50 disabled:border-white/5 disabled:bg-white/5 rounded-xl p-4 md:p-6 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                    borderColor: voting ? undefined : `${match.awayTeam.color}00`,
                                }}
                                onMouseEnter={(e) => {
                                    if (!voting) e.currentTarget.style.borderColor = `${match.awayTeam.color}80`;
                                }}
                                onMouseLeave={(e) => {
                                    if (!voting) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                }}
                            >
                                <div className="flex items-center gap-3 md:gap-4">
                                    <img
                                        src={match.awayTeam.logo}
                                        alt={match.awayTeam.name}
                                        className="w-12 h-12 md:w-16 md:h-16 object-contain"
                                    />
                                    <div className="flex-1 text-left">
                                        <h4 className="text-lg md:text-xl font-bold text-white">{match.awayTeam.name}</h4>
                                        <p className="text-xs md:text-sm text-white/70">Away Team</p>
                                    </div>
                                    <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-white/30 group-hover:text-white/80 transition-colors" />
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
                                { label: match.homeTeam.name, logo: match.homeTeam.logo, votes: pollData.homeVotes, choice: 'home', teamColor: match.homeTeam.color },
                                { label: 'Draw', votes: pollData.drawVotes, choice: 'draw', teamColor: null },
                                { label: match.awayTeam.name, logo: match.awayTeam.logo, votes: pollData.awayVotes, choice: 'away', teamColor: match.awayTeam.color },
                            ].map((option) => {
                                const percentage = getPercentage(option.votes);
                                const isWinning = getWinningChoice() === option.choice && pollData.totalVotes > 0;
                                const isUserVote = pollData.userVote === option.choice;

                                return (
                                    <div
                                        key={option.choice}
                                        className={cn(
                                            "relative rounded-xl overflow-hidden border-2 transition-all",
                                            isWinning ? "border-primary" : "border-white/10",
                                            isUserVote && "ring-2 ring-primary"
                                        )}
                                    >
                                        {/* Background Bar */}
                                        <div
                                            className="absolute inset-0 transition-all duration-500"
                                            style={{
                                                width: `${percentage}%`,
                                                background: option.teamColor ? `${option.teamColor}33` : 'rgba(107, 114, 128, 0.2)'
                                            }}
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
                                                        {isWinning && <span className="text-primary">👑</span>}
                                                        {isUserVote && <span className="text-primary">✓</span>}
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

                        {mounted && !isAuthenticated && (
                            <div className="text-center pt-4">
                                <p className="text-sm text-white/40">
                                    <button
                                        onClick={() => openAuthModal()}
                                        className="text-primary hover:text-primary/80 font-semibold cursor-pointer"
                                    >
                                        Sign in
                                    </button>
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
