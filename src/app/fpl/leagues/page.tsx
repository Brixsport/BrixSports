'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Trophy,
    Users,
    Plus,
    Search,
    Copy,
    Check,
    Crown,
    TrendingUp,
    TrendingDown,
    Medal,
    Lock,
    Globe,
    LogIn,
    Settings
} from 'lucide-react';

interface League {
    id: string;
    name: string;
    code: string;
    leagueType: 'classic' | 'head_to_head';
    isPrivate: boolean;
    currentMembers: number;
    maxMembers: number;
    isAdmin: boolean;
}

interface LeagueMember {
    rank: number;
    lastRank: number;
    teamName: string;
    managerName: string;
    totalPoints: number;
    gameweekPoints: number;
}

export default function LeaguesPage() {
    const router = useRouter();
    const [myLeagues, setMyLeagues] = useState<League[]>([]);
    const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
    const [leagueStandings, setLeagueStandings] = useState<LeagueMember[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMyLeagues();
    }, []);

    useEffect(() => {
        if (selectedLeague) {
            fetchLeagueStandings(selectedLeague.id);
        }
    }, [selectedLeague]);

    const fetchMyLeagues = async () => {
        try {
            // Mock data - replace with actual API call
            const mockLeagues: League[] = [
                {
                    id: 'league_1',
                    name: 'Friends League',
                    code: 'ABC123',
                    leagueType: 'classic',
                    isPrivate: true,
                    currentMembers: 12,
                    maxMembers: 20,
                    isAdmin: true,
                },
                {
                    id: 'league_2',
                    name: 'Global Champions',
                    code: 'XYZ789',
                    leagueType: 'classic',
                    isPrivate: false,
                    currentMembers: 156,
                    maxMembers: 200,
                    isAdmin: false,
                },
            ];
            setMyLeagues(mockLeagues);
            if (mockLeagues.length > 0) {
                setSelectedLeague(mockLeagues[0]);
            }
        } catch (error) {
            console.error('Error fetching leagues:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLeagueStandings = async (leagueId: string) => {
        try {
            // Mock standings
            const mockStandings: LeagueMember[] = [
                { rank: 1, lastRank: 2, teamName: 'Dream Team FC', managerName: 'John Doe', totalPoints: 1456, gameweekPoints: 89 },
                { rank: 2, lastRank: 1, teamName: 'Victory Squad', managerName: 'Jane Smith', totalPoints: 1442, gameweekPoints: 76 },
                { rank: 3, lastRank: 3, teamName: 'Champions United', managerName: 'Mike Johnson', totalPoints: 1398, gameweekPoints: 82 },
                { rank: 4, lastRank: 5, teamName: 'Elite Eleven', managerName: 'Sarah Williams', totalPoints: 1367, gameweekPoints: 91 },
                { rank: 5, lastRank: 4, teamName: 'Goal Getters', managerName: 'Tom Brown', totalPoints: 1345, gameweekPoints: 68 },
            ];
            setLeagueStandings(mockStandings);
        } catch (error) {
            console.error('Error fetching standings:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading leagues...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-white/70 hover:text-white mb-4"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back
                    </button>

                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-4xl font-bold text-white">My Leagues</h1>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowJoinModal(true)}
                                className="px-6 py-3 bg-white/10 backdrop-blur-md text-white font-bold rounded-xl hover:bg-white/20 transition-colors border border-white/20 flex items-center gap-2"
                            >
                                <LogIn className="w-5 h-5" />
                                Join League
                            </button>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold rounded-xl hover:scale-105 transition-transform flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Create League
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* My Leagues List */}
                    <div className="lg:col-span-1">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                            <h2 className="text-xl font-bold text-white mb-4">Your Leagues ({myLeagues.length})</h2>
                            <div className="space-y-3">
                                {myLeagues.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Trophy className="w-12 h-12 text-white/30 mx-auto mb-3" />
                                        <p className="text-white/50 mb-4">No leagues yet</p>
                                        <button
                                            onClick={() => setShowCreateModal(true)}
                                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:scale-105 transition-transform"
                                        >
                                            Create Your First League
                                        </button>
                                    </div>
                                ) : (
                                    myLeagues.map(league => (
                                        <button
                                            key={league.id}
                                            onClick={() => setSelectedLeague(league)}
                                            className={`w-full text-left p-4 rounded-lg border transition-all ${selectedLeague?.id === league.id
                                                    ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="text-white font-bold">{league.name}</p>
                                                        {league.isAdmin && (
                                                            <Crown className="w-4 h-4 text-yellow-400" />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-white/70">
                                                        {league.isPrivate ? (
                                                            <Lock className="w-3 h-3" />
                                                        ) : (
                                                            <Globe className="w-3 h-3" />
                                                        )}
                                                        <span>{league.leagueType === 'classic' ? 'Classic' : 'H2H'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-white/70">
                                                <Users className="w-4 h-4" />
                                                <span>{league.currentMembers}/{league.maxMembers} members</span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* League Details & Standings */}
                    <div className="lg:col-span-2">
                        {selectedLeague ? (
                            <div className="space-y-6">
                                {/* League Info */}
                                <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <h2 className="text-2xl font-bold text-white">{selectedLeague.name}</h2>
                                                {selectedLeague.isAdmin && (
                                                    <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                                        <Settings className="w-5 h-5 text-white/70" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-white/70">
                                                <div className="flex items-center gap-2">
                                                    {selectedLeague.isPrivate ? (
                                                        <>
                                                            <Lock className="w-4 h-4" />
                                                            <span>Private</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Globe className="w-4 h-4" />
                                                            <span>Public</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Trophy className="w-4 h-4" />
                                                    <span>{selectedLeague.leagueType === 'classic' ? 'Classic League' : 'Head-to-Head'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <LeagueCodeCard code={selectedLeague.code} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                            <p className="text-white/70 text-sm mb-1">Members</p>
                                            <p className="text-2xl font-bold text-white">
                                                {selectedLeague.currentMembers}/{selectedLeague.maxMembers}
                                            </p>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                            <p className="text-white/70 text-sm mb-1">Your Rank</p>
                                            <p className="text-2xl font-bold text-white">
                                                {leagueStandings.length > 0 ? '3rd' : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Standings */}
                                <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                                    <h3 className="text-xl font-bold text-white mb-4">League Standings</h3>
                                    <div className="space-y-2">
                                        {leagueStandings.map((member, index) => (
                                            <div
                                                key={index}
                                                className={`p-4 rounded-lg border transition-all ${index < 3
                                                        ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30'
                                                        : 'bg-white/5 border-white/10'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    {/* Rank */}
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-gray-900' :
                                                                index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-900' :
                                                                    index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                                                                        'bg-white/10 text-white'
                                                            }`}>
                                                            {index < 3 ? (
                                                                <Medal className="w-5 h-5" />
                                                            ) : (
                                                                member.rank
                                                            )}
                                                        </div>
                                                        {/* Rank Change */}
                                                        {member.rank !== member.lastRank && (
                                                            <div className={`flex items-center ${member.rank < member.lastRank ? 'text-blue-400' : 'text-red-400'
                                                                }`}>
                                                                {member.rank < member.lastRank ? (
                                                                    <TrendingUp className="w-4 h-4" />
                                                                ) : (
                                                                    <TrendingDown className="w-4 h-4" />
                                                                )}
                                                                <span className="text-xs ml-1">
                                                                    {Math.abs(member.rank - member.lastRank)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Team Info */}
                                                    <div className="flex-1">
                                                        <p className="text-white font-bold">{member.teamName}</p>
                                                        <p className="text-white/70 text-sm">{member.managerName}</p>
                                                    </div>

                                                    {/* Points */}
                                                    <div className="text-right">
                                                        <p className="text-2xl font-bold text-white">{member.totalPoints}</p>
                                                        <p className="text-white/70 text-sm">
                                                            GW: {member.gameweekPoints}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white/10 backdrop-blur-md rounded-xl p-12 border border-white/20 text-center">
                                <Trophy className="w-16 h-16 text-white/30 mx-auto mb-4" />
                                <p className="text-white/50 text-lg">Select a league to view standings</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create League Modal */}
            {showCreateModal && (
                <CreateLeagueModal onClose={() => setShowCreateModal(false)} onCreated={fetchMyLeagues} />
            )}

            {/* Join League Modal */}
            {showJoinModal && (
                <JoinLeagueModal onClose={() => setShowJoinModal(false)} onJoined={fetchMyLeagues} />
            )}
        </div>
    );
}

function LeagueCodeCard({ code }: { code: string }) {
    const [copied, setCopied] = useState(false);

    const copyCode = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-white/5 rounded-lg p-3 border border-white/20">
            <p className="text-white/70 text-xs mb-1">League Code</p>
            <div className="flex items-center gap-2">
                <p className="text-white font-mono font-bold text-lg">{code}</p>
                <button
                    onClick={copyCode}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                >
                    {copied ? (
                        <Check className="w-4 h-4 text-blue-400" />
                    ) : (
                        <Copy className="w-4 h-4 text-white/70" />
                    )}
                </button>
            </div>
        </div>
    );
}

function CreateLeagueModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [name, setName] = useState('');
    const [isPrivate, setIsPrivate] = useState(true);
    const [leagueType, setLeagueType] = useState<'classic' | 'head_to_head'>('classic');
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) {
            alert('Please enter a league name');
            return;
        }

        try {
            setCreating(true);
            await fetch('/api/fpl/leagues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    adminUserId: 'user_1',
                    isPrivate,
                    leagueType,
                }),
            });
            onCreated();
            onClose();
        } catch (error) {
            console.error('Error creating league:', error);
            alert('Failed to create league');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl p-8 max-w-md w-full border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-6">Create New League</h2>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-white/70 text-sm mb-2 block">League Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter league name..."
                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 outline-none focus:border-yellow-400"
                        />
                    </div>

                    <div>
                        <label className="text-white/70 text-sm mb-2 block">League Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setLeagueType('classic')}
                                className={`p-3 rounded-lg border transition-all ${leagueType === 'classic'
                                        ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50'
                                        : 'bg-white/5 border-white/20 hover:bg-white/10'
                                    }`}
                            >
                                <p className="text-white font-semibold">Classic</p>
                                <p className="text-white/70 text-xs">Total points</p>
                            </button>
                            <button
                                onClick={() => setLeagueType('head_to_head')}
                                className={`p-3 rounded-lg border transition-all ${leagueType === 'head_to_head'
                                        ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50'
                                        : 'bg-white/5 border-white/20 hover:bg-white/10'
                                    }`}
                            >
                                <p className="text-white font-semibold">H2H</p>
                                <p className="text-white/70 text-xs">Weekly matches</p>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-white/70 text-sm mb-2 block">Privacy</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setIsPrivate(true)}
                                className={`p-3 rounded-lg border transition-all ${isPrivate
                                        ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50'
                                        : 'bg-white/5 border-white/20 hover:bg-white/10'
                                    }`}
                            >
                                <Lock className="w-5 h-5 text-white mx-auto mb-1" />
                                <p className="text-white font-semibold text-sm">Private</p>
                            </button>
                            <button
                                onClick={() => setIsPrivate(false)}
                                className={`p-3 rounded-lg border transition-all ${!isPrivate
                                        ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50'
                                        : 'bg-white/5 border-white/20 hover:bg-white/10'
                                    }`}
                            >
                                <Globe className="w-5 h-5 text-white mx-auto mb-1" />
                                <p className="text-white font-semibold text-sm">Public</p>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={creating}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50"
                    >
                        {creating ? 'Creating...' : 'Create League'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function JoinLeagueModal({ onClose, onJoined }: { onClose: () => void; onJoined: () => void }) {
    const [code, setCode] = useState('');
    const [joining, setJoining] = useState(false);

    const handleJoin = async () => {
        if (!code.trim()) {
            alert('Please enter a league code');
            return;
        }

        try {
            setJoining(true);
            await fetch('/api/fpl/leagues/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leagueCode: code.toUpperCase(),
                    teamId: 'team_1',
                    userId: 'user_1',
                }),
            });
            onJoined();
            onClose();
        } catch (error) {
            console.error('Error joining league:', error);
            alert('Failed to join league');
        } finally {
            setJoining(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl p-8 max-w-md w-full border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-6">Join League</h2>

                <div className="mb-6">
                    <label className="text-white/70 text-sm mb-2 block">League Code</label>
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="Enter 6-character code..."
                        maxLength={6}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-center font-mono text-xl placeholder-white/50 outline-none focus:border-yellow-400"
                    />
                    <p className="text-white/50 text-sm mt-2">Ask the league admin for the code</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleJoin}
                        disabled={joining || code.length !== 6}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-500 text-white font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50"
                    >
                        {joining ? 'Joining...' : 'Join League'}
                    </button>
                </div>
            </div>
        </div>
    );
}

