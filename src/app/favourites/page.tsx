'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Users, Calendar, TrendingUp, Star, Trophy, Bell, BellOff } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { Coachmark } from '@/components/onboarding/Coachmark';
import { UnderlineTabs, UnderlineTab } from '@/components/ui/UnderlineTabs';
import { BackButton } from '@/components/ui/BackButton';
import Link from 'next/link';
import Image from 'next/image';

type FavTabId = 'matches' | 'teams' | 'competitions' | 'players';

const TOUR_ID = 'favourites-alert-toggle';

export default function FavouritesPage() {
    const {
        favoriteTeams,
        favoritePlayers,
        favoriteCompetitions,
        isTeamNotificationsEnabled,
        setTeamNotifications,
    } = useFavorites();
    const { user, isAuthenticated } = useAuth();
    const [teams, setTeams] = useState<any[]>([]);
    const [players, setPlayers] = useState<any[]>([]);
    const [competitions, setCompetitions] = useState<any[]>([]);
    // Fan Account Blueprint Phase 3: shown once, on the first team card's
    // alert toggle -- the one genuinely non-obvious control this page has.
    // Gated on both the kill-switch flag and this fan's own dismissal record;
    // scoped to authenticated fans only (dismissal has nowhere to persist
    // for an anonymous, account-less viewer).
    const [showTour, setShowTour] = useState(false);
    const firstToggleRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isAuthenticated || !user?.id) return;
        (async () => {
            try {
                const token = localStorage.getItem('authToken');
                const [flagRes, toursRes] = await Promise.all([
                    fetch('/api/feature-flags'),
                    fetch(`/api/users/${user.id}/tours`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                    }),
                ]);
                const flagData = flagRes.ok ? await flagRes.json() : { flags: {} };
                const toursData = toursRes.ok ? await toursRes.json() : { dismissedTourIds: [] };

                const flagEnabled = flagData.flags?.['features.onboarding.tour.enabled'] !== false;
                const alreadyDismissed = (toursData.dismissedTourIds || []).includes(TOUR_ID);
                setShowTour(flagEnabled && !alreadyDismissed);
            } catch (error) {
                console.error('Failed to check tour state:', error);
            }
        })();
    }, [isAuthenticated, user?.id]);
    const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<FavTabId | ''>('');

    useEffect(() => {
        fetchFavoriteData();
    }, [favoriteTeams, favoritePlayers, favoriteCompetitions]);

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

            // Fetch favorite players -- one batched request via the existing
            // ?ids= support on /api/players, instead of one GET per player.
            if (favoritePlayers.length > 0) {
                const res = await fetch(`/api/players?ids=${favoritePlayers.join(',')}`);
                if (res.ok) {
                    const data = await res.json();
                    setPlayers(data.players || []);
                } else {
                    setPlayers([]);
                }
            } else {
                setPlayers([]);
            }

            // Fetch favorite competitions
            if (favoriteCompetitions.length > 0) {
                const competitionsData = await Promise.all(
                    favoriteCompetitions.map(async (competitionId) => {
                        const res = await fetch(`/api/competitions/${competitionId}`);
                        if (res.ok) {
                            const data = await res.json();
                            return data.competition || null;
                        }
                        return null;
                    })
                );
                setCompetitions(competitionsData.filter(Boolean));
            } else {
                setCompetitions([]);
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

    const isEmpty = teams.length === 0 && players.length === 0 && competitions.length === 0;

    // Only categories with real data get a tab -- an empty category isn't
    // worth a selector option (matches the old stacked-sections behaviour,
    // which hid empty sections outright).
    const tabs: UnderlineTab[] = useMemo(() => {
        const t: UnderlineTab[] = [];
        if (upcomingMatches.length > 0) t.push({ id: 'matches', label: 'Matches', icon: <Calendar size={12} />, count: upcomingMatches.length });
        if (teams.length > 0) t.push({ id: 'teams', label: 'Teams', icon: <Users size={12} />, count: teams.length });
        if (competitions.length > 0) t.push({ id: 'competitions', label: 'Competitions', icon: <Trophy size={12} />, count: competitions.length });
        if (players.length > 0) t.push({ id: 'players', label: 'Players', icon: <Star size={12} />, count: players.length });
        return t;
    }, [upcomingMatches.length, teams.length, competitions.length, players.length]);

    // Default to the first available tab (Matches first -- it's the most
    // time-sensitive), and re-target if the active tab's data disappears.
    useEffect(() => {
        if (loading) return;
        const ids = tabs.map((t) => t.id);
        if (!ids.includes(activeTab)) {
            setActiveTab((ids[0] as FavTabId) || '');
        }
    }, [loading, tabs, activeTab]);

    // The team-alert-toggle coachmark anchors inside the Teams panel -- jump
    // there so a first-time viewer actually sees it instead of it silently
    // never mounting on whichever tab happened to be active.
    useEffect(() => {
        if (showTour && teams.length > 0) setActiveTab('teams');
    }, [showTour, teams.length]);

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

    return (
        <div className="min-h-screen bg-[#050505] text-white pb-24 md:pb-12">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-[#0a0a0a] border-b border-white/10 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-3">
                        <BackButton />
                        <Heart size={24} className="text-primary fill-primary" />
                        <div>
                            <h1 className="font-display text-3xl tracking-tighter italic uppercase leading-none">
                                Favourites
                            </h1>
                            <p className="text-sm text-white/60 mt-1">
                                {teams.length} teams • {players.length} players • {competitions.length} competitions
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
                                href="/players/compare"
                                className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors"
                            >
                                Browse Players
                            </Link>
                        </div>
                    </motion.div>
                ) : (
                    <div>
                        {tabs.length > 1 && (
                            <UnderlineTabs
                                tabs={tabs}
                                activeId={activeTab}
                                onChange={(id) => setActiveTab(id as FavTabId)}
                                layoutId="favouritesActiveTab"
                                className="mb-8"
                            />
                        )}

                        <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15 }}
                        >
                        {/* Upcoming Matches */}
                        {activeTab === 'matches' && upcomingMatches.length > 0 && (
                            <section>
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
                        {activeTab === 'teams' && teams.length > 0 && (
                            <section>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {teams.map((team, index) => {
                                        const alertsOn = isTeamNotificationsEnabled(team.id);
                                        return (
                                        <Link
                                            key={team.id}
                                            href={`/teams/${team.id}`}
                                            className="relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 rounded-xl p-6 transition-all group"
                                        >
                                            <button
                                                ref={index === 0 ? firstToggleRef : undefined}
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setTeamNotifications(team.id, !alertsOn);
                                                }}
                                                aria-label={alertsOn ? `Mute alerts for ${team.shortName}` : `Get alerts for ${team.shortName}`}
                                                title={alertsOn ? 'Alerts on -- tap to mute' : 'Alerts muted -- tap to enable'}
                                                className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${alertsOn
                                                        ? 'bg-primary/20 text-primary hover:bg-primary/30'
                                                        : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50'
                                                    }`}
                                            >
                                                {alertsOn ? <Bell size={14} /> : <BellOff size={14} />}
                                            </button>
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
                                        );
                                    })}
                                </div>
                                {showTour && (
                                    <Coachmark
                                        tourId={TOUR_ID}
                                        anchorRef={firstToggleRef}
                                        title="Control alerts per team"
                                        body="This bell is separate from the star — mute or unmute goal/match alerts for just this one team, without unfavoriting it."
                                        onDismissed={() => setShowTour(false)}
                                    />
                                )}
                            </section>
                        )}

                        {/* Favorite Competitions */}
                        {activeTab === 'competitions' && competitions.length > 0 && (
                            <section>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {competitions.map((competition) => (
                                        <Link
                                            key={competition.id}
                                            href={`/competitions/${competition.id}`}
                                            className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 rounded-xl p-4 transition-all group flex items-center gap-4"
                                        >
                                            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
                                                <Trophy size={20} className="text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-sm uppercase tracking-wider truncate">{competition.name}</h3>
                                                <p className="text-xs text-white/40">{competition.sport || 'Multi-Sport'}</p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Favorite Players */}
                        {activeTab === 'players' && players.length > 0 && (
                            <section>
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
                        </motion.div>
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
