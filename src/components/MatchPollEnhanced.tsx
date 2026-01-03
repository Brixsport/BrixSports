'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Users, TrendingUp, CheckCircle2, Clock, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import PollComments from './PollComments';

interface PollOption {
    id: string;
    label: string;
    teamId?: string | null;
    votes?: number;
}

interface Poll {
    id: string;
    matchId: string;
    question: string;
    pollType: string;
    options: PollOption[];
    status: string;
    totalVotes: number;
    endsAt: Date | null;
}

interface MatchPollProps {
    matchId: string;
    userId?: string;
    liveUpdates?: boolean; // Enable live poll results updates
}

export default function MatchPollEnhanced({ matchId, userId, liveUpdates = true }: MatchPollProps) {
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
    const [hasVoted, setHasVoted] = useState<Record<string, boolean>>({});
    const [voting, setVoting] = useState<Record<string, boolean>>({});
    const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchPolls();
        
        // Set up live updates if enabled
        if (liveUpdates) {
            const interval = setInterval(() => {
                fetchPolls();
            }, 5000); // Update every 5 seconds

            return () => clearInterval(interval);
        }
    }, [matchId, liveUpdates]);

    const fetchPolls = async () => {
        try {
            const response = await fetch(`/api/polls?matchId=${matchId}`);
            if (response.ok) {
                const data = await response.json();
                setPolls(data);

                // Check if user has voted on each poll
                for (const poll of data) {
                    checkUserVote(poll.id);
                }
            }
        } catch (error) {
            console.error('Error fetching polls:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkUserVote = async (pollId: string) => {
        try {
            const url = userId 
                ? `/api/polls/vote?pollId=${pollId}&userId=${userId}`
                : `/api/polls/vote?pollId=${pollId}`;
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setHasVoted(prev => ({ ...prev, [pollId]: data.hasVoted }));
                if (data.vote) {
                    setSelectedOptions(prev => ({ ...prev, [pollId]: data.vote.optionId }));
                }
            }
        } catch (error) {
            console.error('Error checking vote:', error);
        }
    };

    const handleVote = async (pollId: string, optionId: string) => {
        setVoting(prev => ({ ...prev, [pollId]: true }));

        try {
            const response = await fetch('/api/polls/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pollId, optionId, userId }),
            });

            if (response.ok) {
                setHasVoted(prev => ({ ...prev, [pollId]: true }));
                setSelectedOptions(prev => ({ ...prev, [pollId]: optionId }));
                // Refresh poll data to get updated vote counts
                fetchPolls();
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to submit vote');
            }
        } catch (error) {
            console.error('Error voting:', error);
            alert('Failed to submit vote');
        } finally {
            setVoting(prev => ({ ...prev, [pollId]: false }));
        }
    };

    const toggleComments = (pollId: string) => {
        setExpandedComments(prev => ({ ...prev, [pollId]: !prev[pollId] }));
    };

    const getPercentage = (votes: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((votes / total) * 100);
    };

    const getTimeRemaining = (endsAt: Date | null) => {
        if (!endsAt) return null;
        
        const now = new Date();
        const end = new Date(endsAt);
        const diff = end.getTime() - now.getTime();
        
        if (diff <= 0) return 'Ended';
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h left`;
        }
        if (hours > 0) return `${hours}h ${minutes}m left`;
        return `${minutes}m left`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (polls.length === 0) {
        return null;
    }

    return (
        <div className="space-y-6">
            {polls.map((poll) => {
                const userVoted = hasVoted[poll.id];
                const selectedOption = selectedOptions[poll.id];
                const isVoting = voting[poll.id];
                const timeRemaining = getTimeRemaining(poll.endsAt);
                const commentsExpanded = expandedComments[poll.id];

                return (
                    <motion.div
                        key={poll.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden"
                    >
                        {/* Poll Header */}
                        <div className="p-6 border-b border-slate-700/50">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BarChart3 className="w-5 h-5 text-blue-400" />
                                        <span className="text-sm font-medium text-blue-400 uppercase tracking-wide">
                                            {poll.pollType.replace('_', ' ')}
                                        </span>
                                        {liveUpdates && (
                                            <span className="flex items-center gap-1 text-xs text-blue-400">
                                                <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                                                Live
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">
                                        {poll.question}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-slate-400">
                                        <div className="flex items-center gap-1">
                                            <Users className="w-4 h-4" />
                                            <span>{poll.totalVotes} votes</span>
                                        </div>
                                        {timeRemaining && (
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                <span>{timeRemaining}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {userVoted && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full">
                                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                                        <span className="text-sm font-medium text-blue-400">Voted</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Poll Options */}
                        <div className="p-6 space-y-3">
                            <AnimatePresence mode="wait">
                                {poll.options.map((option) => {
                                    const percentage = getPercentage(option.votes || 0, poll.totalVotes);
                                    const isSelected = selectedOption === option.id;
                                    const isLeading = userVoted && option.votes === Math.max(...poll.options.map(o => o.votes || 0));

                                    return (
                                        <motion.button
                                            key={option.id}
                                            onClick={() => !userVoted && !isVoting && handleVote(poll.id, option.id)}
                                            disabled={userVoted || isVoting || poll.status !== 'active'}
                                            className={`
                                                relative w-full p-4 rounded-xl border-2 transition-all duration-300
                                                ${userVoted 
                                                    ? 'cursor-default' 
                                                    : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                                                }
                                                ${isSelected 
                                                    ? 'border-blue-500 bg-blue-500/10' 
                                                    : 'border-slate-700/50 bg-slate-800/50 hover:border-slate-600'
                                                }
                                                ${isLeading && userVoted ? 'ring-2 ring-blue-500/50' : ''}
                                            `}
                                            whileHover={!userVoted ? { scale: 1.02 } : {}}
                                            whileTap={!userVoted ? { scale: 0.98 } : {}}
                                        >
                                            {/* Progress Bar */}
                                            {userVoted && (
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${percentage}%` }}
                                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                                    className={`
                                                        absolute inset-0 rounded-xl
                                                        ${isLeading 
                                                            ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/20' 
                                                            : 'bg-gradient-to-r from-blue-500/10 to-blue-600/10'
                                                        }
                                                    `}
                                                />
                                            )}

                                            {/* Content */}
                                            <div className="relative flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {isSelected && (
                                                        <CheckCircle2 className="w-5 h-5 text-blue-400" />
                                                    )}
                                                    <span className="text-lg font-semibold text-white">
                                                        {option.label}
                                                    </span>
                                                    {isLeading && userVoted && (
                                                        <TrendingUp className="w-5 h-5 text-blue-400" />
                                                    )}
                                                </div>
                                                {userVoted && (
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm text-slate-400">
                                                            {option.votes || 0} votes
                                                        </span>
                                                        <span className="text-xl font-bold text-white min-w-[4rem] text-right">
                                                            {percentage}%
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </AnimatePresence>
                        </div>

                        {/* Comments Toggle */}
                        <div className="border-t border-slate-700/50">
                            <button
                                onClick={() => toggleComments(poll.id)}
                                className="w-full px-6 py-4 flex items-center justify-between text-slate-300 hover:bg-slate-800/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <MessageCircle className="w-5 h-5" />
                                    <span className="font-medium">Discussion</span>
                                </div>
                                {commentsExpanded ? (
                                    <ChevronUp className="w-5 h-5" />
                                ) : (
                                    <ChevronDown className="w-5 h-5" />
                                )}
                            </button>

                            {/* Comments Section */}
                            <AnimatePresence>
                                {commentsExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="border-t border-slate-700/50 overflow-hidden"
                                    >
                                        <div className="p-6">
                                            <PollComments pollId={poll.id} userId={userId} />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        {!userVoted && poll.status === 'active' && (
                            <div className="px-6 pb-6">
                                <p className="text-sm text-slate-400 text-center">
                                    Select an option to cast your vote
                                </p>
                            </div>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
}

