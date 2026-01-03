'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Users, Calendar, TrendingUp, Star } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import Link from 'next/link';
import Image from 'next/image';

export default function FavouritesPage() {
    const { favoriteTeams, favoritePlayers } = useFavorites();
    const [teams, setTeams] = useState<any[]>([]);
    const [players, setPlayers] = useState<any[]>([]);
    const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFavoriteData();
    }, [favoriteTeams, favoritePlayers]);

    const fetchFavoriteData = async () => {
        setLoading(true);
        try {
            // Fetch favorite teams
            if (favoriteTeams.length > 0) {
                const teamsData = await Promise.all(
                    favoriteTeams.map(async (teamId) => {
                        const res = await fetch(`/api/teams/${teamId}`);
                        if (res.ok) return await res.json();
                        return null;
                    })
                );
                setTeams(teamsData.filter(Boolean));
            }

            // Fetch favorite players
            if (favoritePlayers.length > 0) {
                const playersData = await Promise.all(
                    favoritePlayers.map(async (playerId) => {
                        const res = await fetch(`/api/players/${playerId}`);
                        if (res.ok) return await res.json();
                        return null;
                    })
                );
                setPlayers(playersData.filter(Boolean));
            }

            // Fetch upcoming matches for favorite teams
            if (favoriteTeams.length > 0) {
                const res = await fetch('/api/matches?status=upcoming&limit=20');
                if (res.ok) {
                    const data = await res.json();
                    const filtered = data.matches?.filter((match: any) =>
                        favoriteTeams.includes(match.homeTeamId) ||
                        favoriteTeams.includes(match.awayTeamId)
                    ) || [];
                    setUpcomingMatches(filtered);
                }
            }
        } catch (error) {
            console.error('Error fetching favorites:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white/60">Loading your favourites...</p>
                </div>
            </div>
        );
    }

    const isEmpty = teams.length === 0 && players.length === 0;

    return (
        <div className="min-h-screen bg-[#050505] text-white pb-24 md:pb-12">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[#0a0a0a] border-b border-white/10 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-3">
                        <Heart size={24} className="text-primary fill-primary" />
                        <div>
                            <h1 className="font-display text-3xl tracking-tighter italic uppercase leading-none">
                                Favourites
                            </h1>
                            <p className="text-sm text-white/60 mt-1">
                                {teams.length} teams • {players.length} players
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {isEmpty ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-20"
                    >
                        <Heart size={64} className="mx-auto text-white/10 mb-6" />
                        <h2 className="text-2xl font-bold mb-2">No Favourites Yet</h2>
                        <p className="text-white/60 mb-8 max-w-md mx-auto">
                            Start following your favorite teams and players to see their latest updates here
                        </p>
                        <div className="flex gap-4 justify-center">
                            <Link
                                href="/teams"
                                className="px-6 py-3 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-colors"
                            >
                                Browse Teams
                            </Link>
                            <Link
                                href="/players"
                                className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors"
                            >
                                Browse Players
                            </Link>
                        </div>
                    </motion.div>
                ) : (
                    <div className="space-y-8">
                        {/* Upcoming Matches */}
                        {upcomingMatches.length > 0 && (
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar size={18} className="text-primary" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider">
                                        Upcoming Matches
                                    </h2>
                                </div>
                                <div className="space-y-3">
                                    {upcomingMatches.slice(0, 5).map((match) => (
                                        <Link
                                            key={match.id}
                                            href={`/matches/${match.id}`}
                                            className="block bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 rounded-xl p-4 transition-all"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1">
                                                    <span className="text-2xl">{match.homeTeam?.logo}</span>
                                                    <span className="font-semibold">{match.homeTeam?.shortName}</span>
                                                </div>
                                                <div className="px-4 text-white/40">vs</div>
                                                <div className="flex items-center gap-3 flex-1 justify-end">
                                                    <span className="font-semibold">{match.awayTeam?.shortName}</span>
                                                    <span className="text-2xl">{match.awayTeam?.logo}</span>
                                                </div>
                                            </div>
                                            <div className="mt-2 text-xs text-white/40 text-center">
                                                {new Date(match.startTime).toLocaleDateString()} • {match.competition}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Favorite Teams */}
                        {teams.length > 0 && (
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <Users size={18} className="text-primary" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider">
                                        Favorite Teams ({teams.length})
                                    </h2>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {teams.map((team) => (
                                        <Link
                                            key={team.id}
                                            href={`/teams/${team.id}`}
                                            className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 rounded-xl p-6 transition-all group"
                                        >
                                            <div className="text-center">
                                                <div className="text-5xl mb-3">{team.logo}</div>
                                                <h3 className="font-bold text-sm uppercase tracking-wider mb-1">
                                                    {team.shortName}
                                                </h3>
                                                <p className="text-xs text-white/40">{team.university}</p>
                                                {team.stats && (
                                                    <div className="mt-3 pt-3 border-t border-white/10 flex justify-around text-xs">
                                                        <div>
                                                            <div className="font-bold text-primary">{team.stats.won || 0}</div>
                                                            <div className="text-white/40">W</div>
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-red-500">{team.stats.lost || 0}</div>
                                                            <div className="text-white/40">L</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Favorite Players */}
                        {players.length > 0 && (
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <Star size={18} className="text-primary" />
                                    <h2 className="text-xl font-bold uppercase tracking-wider">
                                        Favorite Players ({players.length})
                                    </h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {players.map((player) => (
                                        <Link
                                            key={player.id}
                                            href={`/players/${player.id}`}
                                            className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 rounded-xl p-4 transition-all group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-2xl font-bold">
                                                    {player.number}
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-lg">{player.name}</h3>
                                                    <p className="text-sm text-white/60">{player.position}</p>
                                                    <p className="text-xs text-white/40 mt-1">{player.team?.name}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-primary">{player.rating}</div>
                                                    <div className="text-xs text-white/40">Rating</div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
