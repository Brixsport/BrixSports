'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Play, X, Trophy, Users, BarChart3, Clock, Star, MapPin, Calendar, Share2, Heart, RefreshCw, AlertCircle, Target, MessageSquare, Table } from 'lucide-react';
import { Team, Player, Match, MatchEvent } from '@/types';
import { useFavorites } from '@/hooks/useFavorites';
import { useNotifications } from './Notifications';
import { MatchPredictionCard } from '@/components/predictions/MatchPredictionCard';
import { MatchVotePoll } from '@/components/predictions/MatchVotePoll';
import { LivestreamChat } from '@/components/livestream/LivestreamChat';
import { LivestreamPlayer } from '@/components/livestream/LivestreamPlayer';
import { FootballPitch } from '@/components/FootballPitch';
import { FullPitchLineups } from '@/components/FullPitchLineups';

interface MatchOverlayProps {
  match: Match;
  onClose: () => void;
  onSelectPlayer: (player: Player) => void;
}

// Helper function to validate image paths
const isValidImagePath = (path: string | undefined): boolean => {
  if (!path || path.trim() === '') return false;
  return path.startsWith('/') || path.startsWith('http');
};

export function MatchOverlay({ match: initialMatch, onClose, onSelectPlayer }: MatchOverlayProps) {
  const [match, setMatch] = useState(initialMatch);
  const [activeTab, setActiveTab] = useState(match.isStreaming ? 'watch' : 'overview'); // Default to watch if streaming
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [standings, setStandings] = useState<any[]>([]);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [playersFetched, setPlayersFetched] = useState(false);
  const [standingsFetched, setStandingsFetched] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Ratings state
  const [ratings, setRatings] = useState<Record<string, { autoRating: number; finalRating: number | null; isMotM: boolean; notes: string | null }>>({});
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [ratingsFetched, setRatingsFetched] = useState(false);

  // Use team data from match object (already populated by API)
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;
  const { isFavoriteTeam, toggleTeam } = useFavorites();
  const { addNotification } = useNotifications();

  const tabs = [
    ...(match.isStreaming ? [{ id: 'watch', label: 'Watch Live', icon: Play }] : []),
    { id: 'overview', label: 'Overview', icon: Trophy },
    { id: 'lineups', label: 'Lineups', icon: Users },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'standings', label: 'Standings', icon: Table },
    // Conditional tabs
    ...(match.status === 'UPCOMING' ? [
      { id: 'predict', label: 'Predict', icon: Target },
      { id: 'poll', label: 'Fan Poll', icon: BarChart3 },
    ] : []),
    ...(match.status === 'LIVE' ? [
      { id: 'chat', label: 'Chat', icon: MessageSquare },
    ] : []),
  ];

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const { matchId, event, updatedMatch } = e.detail;
      if (matchId === match.id) {
        setMatch(updatedMatch);

        // Show notification for significant events
        if (event.type === 'Goal') {
          addNotification({
            title: 'GOAL!',
            message: `${event.detail} has scored!`,
            type: 'match'
          });
        }
        if (event.type === 'Eye Point') {
          addNotification({
            title: 'EYE POINT AWARDED',
            message: `Exceptional performance by ${event.detail}`,
            type: 'scout'
          });
        }
      }
    };

    window.addEventListener('MATCH_UPDATE', handleUpdate);
    return () => window.removeEventListener('MATCH_UPDATE', handleUpdate);
  }, [match.id, addNotification]);

  // Fetch player data when lineups or scout tab is opened
  useEffect(() => {
    const needsPlayers = (activeTab === 'lineups' || activeTab === 'scout') && match.lineups;
    if (!needsPlayers || loadingPlayers || playersFetched) return;

    const playerIds = [
      ...(match.lineups?.home.map(e => e.playerId) || []),
      ...(match.lineups?.away.map(e => e.playerId) || [])
    ];

    // Only fetch if we don't have all players
    const missingPlayers = playerIds.filter(id => !players[id]);
    if (missingPlayers.length === 0) return;

    const fetchPlayers = async () => {
      setLoadingPlayers(true);
      try {
        const response = await fetch(`/api/players?ids=${missingPlayers.join(',')}`);
        const data = await response.json();
        if (data.success && data.players) {
          const playerMap: Record<string, Player> = {};
          data.players.forEach((player: Player) => {
            playerMap[player.id] = player;
          });
          setPlayers(prev => ({ ...prev, ...playerMap }));
          setPlayersFetched(true);
        }
      } catch (error) {
        console.error('Error fetching players:', error);
      } finally {
        setLoadingPlayers(false);
      }
    };

    fetchPlayers();
  }, [activeTab, match.lineups, playersFetched]);

  // Fetch standings when standings tab is opened
  useEffect(() => {
    if (activeTab !== 'standings' || loadingStandings || standingsFetched) return;

    const fetchStandings = async () => {
      setLoadingStandings(true);
      try {
        const response = await fetch(`/api/standings?competition=${encodeURIComponent(match.competition)}`);
        const data = await response.json();
        // API returns standings directly as an array, not wrapped
        if (Array.isArray(data) && data.length > 0) {
          setStandings(data);
          setStandingsFetched(true);
        } else if (data.success && data.standings) {
          // Fallback for wrapped response format
          setStandings(data.standings);
          setStandingsFetched(true);
        } else {
          // Empty standings
          setStandings([]);
          setStandingsFetched(true);
        }
      } catch (error) {
        console.error('Error fetching standings:', error);
      } finally {
        setLoadingStandings(false);
      }
    };

    fetchStandings();
  }, [activeTab, match.competition, standingsFetched]);

  // Fetch ratings when lineups tab is active or match is finished
  useEffect(() => {
    const needsRatings = (activeTab === 'lineups' || match.status === 'FINISHED') && match.lineups;
    if (!needsRatings || loadingRatings || ratingsFetched) return;

    const fetchRatings = async () => {
      setLoadingRatings(true);
      try {
        const response = await fetch(`/api/matches/${match.id}/ratings`);
        if (response.ok) {
          const data = await response.json();
          const ratingsMap: Record<string, any> = {};
          data.ratings.forEach((r: any) => {
            ratingsMap[r.playerId] = {
              autoRating: r.autoRating,
              finalRating: r.finalRating,
              isMotM: r.isMotM,
              notes: r.adjustmentNotes
            };
          });
          setRatings(ratingsMap);
          setRatingsFetched(true);
        }
      } catch (error) {
        console.error('Error fetching ratings:', error);
      } finally {
        setLoadingRatings(false);
      }
    };

    fetchRatings();
  }, [activeTab, match.id, match.lineups, match.status, loadingRatings, ratingsFetched]);

  // Handle scroll with debouncing to prevent jitter
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollTop = scrollContainer.scrollTop;
          setIsScrolled(scrollTop > 50);
          ticking = false;
        });
        ticking = true;
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col overflow-hidden"
      onClick={onClose}
    >
      <div className="flex flex-col min-h-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`sticky top-0 z-10 bg-[#0a0a0a] border-b border-white/10 transition-all duration-300 ${isScrolled ? 'py-2 shadow-xl' : 'py-4'}`}>
          <div className="max-w-5xl mx-auto px-4">
            <div className={`flex items-center justify-between ${isScrolled ? 'mb-2' : 'mb-4'} transition-all duration-300`}>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <X size={20} />
                </button>
                {isScrolled && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 relative rounded overflow-hidden bg-white/5">
                        {isValidImagePath(homeTeam?.logo) && homeTeam && (
                          <Image src={homeTeam.logo} alt={homeTeam.name} fill className="object-cover" />
                        )}
                      </div>
                      <span className={`text-lg font-bold ${match.homeScore > match.awayScore ? 'text-primary' : 'text-white'}`}>{match.homeScore}</span>
                    </div>
                    <span className="text-white/20 text-sm">-</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${match.awayScore > match.homeScore ? 'text-primary' : 'text-white'}`}>{match.awayScore}</span>
                      <div className="w-6 h-6 relative rounded overflow-hidden bg-white/5">
                        {isValidImagePath(awayTeam?.logo) && awayTeam && (
                          <Image src={awayTeam.logo} alt={awayTeam.name} fill className="object-cover" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!isScrolled && (
                <div className="flex flex-col items-center text-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    {match.competition}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-white/40 mt-1">
                    <MapPin size={12} />
                    <span>{match.venue}</span>
                    <span>•</span>
                    <Calendar size={12} />
                    <span>{new Date(match.startTime).toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <Share2 size={20} className="text-white/60" />
              </button>
            </div>

            {/* Score Display (Full Size) - Hidden when scrolled */}
            <div className={`flex items-center justify-between overflow-hidden transition-all duration-500 ease-in-out ${isScrolled ? 'max-h-0 opacity-0 mb-0' : 'max-h-40 opacity-100 mb-6'}`}>
              {/* Home Team */}
              <div className="flex-1 flex flex-col items-center gap-3">
                <div className="w-16 h-16 relative rounded-xl overflow-hidden bg-white/5">
                  {isValidImagePath(homeTeam?.logo) ? (
                    <Image
                      src={homeTeam!.logo}
                      alt={homeTeam!.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      {homeTeam?.logo}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-lg">{homeTeam?.name}</h3>
                  <p className="text-xs text-white/40">{homeTeam?.shortName}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); if (homeTeam) toggleTeam(homeTeam.id); }}
                  className={`p-2 rounded-full border border-white/10 transition-all ${isFavoriteTeam(homeTeam?.id || '') ? 'bg-primary text-black' : 'bg-black text-white hover:bg-white/10'}`}
                >
                  <Heart size={14} fill={isFavoriteTeam(homeTeam?.id || '') ? "currentColor" : "none"} />
                </button>
              </div>

              {/* Score */}
              <div className="px-8 flex flex-col items-center gap-2">
                <div className="flex items-center gap-4">
                  <span className={`text-5xl font-bold ${match.homeScore > match.awayScore ? 'text-primary' : 'text-white/60'}`}>
                    {match.homeScore}
                  </span>
                  <span className="text-white/20 text-2xl">-</span>
                  <span className={`text-5xl font-bold ${match.awayScore > match.homeScore ? 'text-primary' : 'text-white/60'}`}>
                    {match.awayScore}
                  </span>
                </div>
                <div className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold uppercase tracking-wider">
                  {match.status === 'FINISHED' ? 'FT' : match.status === 'LIVE' ? "LIVE" : match.status}
                </div>
              </div>

              {/* Away Team */}
              <div className="flex-1 flex flex-col items-center gap-3">
                <div className="w-16 h-16 relative rounded-xl overflow-hidden bg-white/5">
                  {isValidImagePath(awayTeam?.logo) ? (
                    <Image
                      src={awayTeam!.logo}
                      alt={awayTeam!.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      {awayTeam?.logo}
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-lg">{awayTeam?.name}</h3>
                  <p className="text-xs text-white/40">{awayTeam?.shortName}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); if (awayTeam) toggleTeam(awayTeam.id); }}
                  className={`p-2 rounded-full border border-white/10 transition-all ${isFavoriteTeam(awayTeam?.id || '') ? 'bg-primary text-black' : 'bg-black text-white hover:bg-white/10'}`}
                >
                  <Heart size={14} fill={isFavoriteTeam(awayTeam?.id || '') ? "currentColor" : "none"} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activeTab === tab.id
                    ? 'bg-primary text-black'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          ref={scrollContainerRef}
          className="max-w-5xl mx-auto w-full px-4 py-8 overflow-y-auto flex-1"
        >
          <AnimatePresence mode="wait">
            {/* Watch Tab - For Live Streaming */}
            {activeTab === 'watch' && match.isStreaming && match.streamUrl && (
              <motion.div
                key="watch"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                  <LivestreamPlayer
                    streamUrl={match.streamUrl}
                    streamType={match.streamType || 'youtube'}
                    matchTitle={`${match.homeTeam?.name} vs ${match.awayTeam?.name}`}
                    isLive={match.status === 'LIVE'}
                  />
                </div>
              </motion.div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-4">Match Summary</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">{match.homeScore}</p>
                      <p className="text-xs text-white/40 mt-1">Goals</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{match.homeScore + match.awayScore}</p>
                      <p className="text-xs text-white/40 mt-1">Total Goals</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{match.awayScore}</p>
                      <p className="text-xs text-white/40 mt-1">Goals</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-4">Match Info</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">Competition</span>
                      <span className="font-semibold">{match.competition}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Venue</span>
                      <span className="font-semibold">{match.venue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Date</span>
                      <span className="font-semibold">
                        {new Date(match.startTime).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Status</span>
                      <span className="font-semibold">{match.status}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Lineups Tab */}
            {activeTab === 'lineups' && (
              <motion.div
                key="lineups"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {loadingPlayers ? (
                  <div className="py-20 text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/40">Loading lineups...</p>
                  </div>
                ) : match.lineups?.home && match.lineups?.away ? (
                  /* Full Pitch View - Both teams facing each other */
                  <FullPitchLineups
                    homeTeam={{
                      name: homeTeam?.name || 'Home',
                      logo: homeTeam?.logo || '',
                      color: homeTeam?.color || '#3B82F6'
                    }}
                    awayTeam={{
                      name: awayTeam?.name || 'Away',
                      logo: awayTeam?.logo || '',
                      color: awayTeam?.color || '#EF4444'
                    }}
                    homePlayers={players}
                    awayPlayers={players}
                    homeLineup={match.lineups.home.map(entry => ({
                      ...entry,
                      rating: ratings[entry.playerId]?.finalRating || ratings[entry.playerId]?.autoRating || entry.rating || 6.0,
                      isMotM: ratings[entry.playerId]?.isMotM || false
                    }))}
                    awayLineup={match.lineups.away.map(entry => ({
                      ...entry,
                      rating: ratings[entry.playerId]?.finalRating || ratings[entry.playerId]?.autoRating || entry.rating || 6.0,
                      isMotM: ratings[entry.playerId]?.isMotM || false
                    }))}
                    onPlayerClick={onSelectPlayer}
                  />
                ) : (
                  <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
                    <Users className="mx-auto mb-4 text-white/40" size={48} />
                    <p className="text-white/60 mb-2">No lineups available yet</p>
                    <p className="text-white/40 text-sm">Lineups will be published before the match starts</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white/5 rounded-2xl border border-white/10 p-6"
              >
                <h3 className="font-bold text-sm uppercase tracking-wider text-white/60 mb-6">Match Statistics</h3>
                <div className="space-y-6">
                  {match.stats.possession && <StatRow label="Possession" values={match.stats.possession} suffix="%" />}
                  {match.stats.expectedGoals && <StatRow label="Expected Goals (xG)" values={match.stats.expectedGoals} suffix="" />}
                  {match.stats.shots && <StatRow label="Total Shots" values={match.stats.shots} />}
                  {match.stats.shotsOnTarget && <StatRow label="Shots on Target" values={match.stats.shotsOnTarget} />}
                  {match.stats.corners && <StatRow label="Corners" values={match.stats.corners} />}
                  {match.stats.fouls && <StatRow label="Fouls" values={match.stats.fouls} />}
                  {match.stats.yellowCards && <StatRow label="Yellow Cards" values={match.stats.yellowCards} />}
                  {match.stats.redCards && <StatRow label="Red Cards" values={match.stats.redCards} />}

                  {/* Show message if no stats available */}
                  {!match.stats.possession && !match.stats.shots && !match.stats.shotsOnTarget &&
                    !match.stats.corners && !match.stats.fouls && (
                      <div className="py-8 text-center text-white/40">
                        No match statistics available yet
                      </div>
                    )}
                </div>

                {match.stats.winProbability && (
                  <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-4 text-center mt-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mb-1">Win Probability</p>
                    <div className="flex items-center justify-between text-xs font-bold italic">
                      <span>{homeTeam?.shortName} {match.stats.winProbability[0]}%</span>
                      <div className="h-1 flex-1 mx-4 bg-white/10 rounded-full overflow-hidden flex">
                        <div className="h-full bg-secondary" style={{ width: `${match.stats.winProbability[0]}%` }}></div>
                        <div className="h-full bg-white/20" style={{ width: `${match.stats.winProbability[1]}%` }}></div>
                      </div>
                      <span>{awayTeam?.shortName} {match.stats.winProbability[2]}%</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={18} className="text-primary" />
                  <h3 className="font-display italic uppercase tracking-tighter text-2xl">Timeline</h3>
                </div>
                <div className="space-y-4 relative">
                  <div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/5"></div>
                  {match.events.map((event) => (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={event.id}
                      className="flex items-start gap-6 relative"
                    >
                      <div className="relative z-10 w-8 h-8 rounded-full bg-black border border-white/10 flex items-center justify-center text-[10px] font-bold tabular-nums">
                        {event.minute}'
                      </div>
                      <div className="flex-1 bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between group hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${event.type === 'Goal' ? 'bg-primary/20 text-primary' :
                            event.type === 'Yellow Card' ? 'bg-yellow-500/20 text-yellow-500' :
                              event.type === 'Red Card' ? 'bg-red-500/20 text-red-500' :
                                event.type === 'Substitution' ? 'bg-blue-500/20 text-blue-400' :
                                  event.type === 'Eye Point' ? 'bg-secondary/20 text-secondary' :
                                    'bg-white/5 text-white/40'
                            }`}>
                            {event.type === 'Goal' ? <Trophy size={14} /> :
                              event.type === 'Substitution' ? <RefreshCw size={14} /> :
                                event.type === 'Eye Point' ? <Star size={14} fill="currentColor" /> :
                                  <AlertCircle size={14} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold uppercase tracking-tight italic">{event.type}</p>
                              {event.isEyePoint && (
                                <span className="bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest uppercase">+0.5 RATING</span>
                              )}
                            </div>
                            <p className="text-xs text-white/40">{event.detail}</p>
                          </div>
                        </div>
                        {event.teamId && (
                          <div className="text-xl opacity-40 group-hover:opacity-100 transition-opacity">
                            {event.teamId === match.homeTeamId ? homeTeam?.logo : awayTeam?.logo}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Standings Tab */}
            {activeTab === 'standings' && (
              <motion.div
                key="standings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {loadingStandings ? (
                  <div className="py-20 text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/40">Loading standings...</p>
                  </div>
                ) : standings.length > 0 ? (
                  <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-white/5">
                          <tr className="text-xs font-bold uppercase tracking-wider text-white/60">
                            <th className="px-4 py-3 text-left">Pos</th>
                            <th className="px-4 py-3 text-left">Team</th>
                            <th className="px-4 py-3 text-center">P</th>
                            <th className="px-4 py-3 text-center">W</th>
                            <th className="px-4 py-3 text-center">D</th>
                            <th className="px-4 py-3 text-center">L</th>
                            <th className="px-4 py-3 text-center">GF</th>
                            <th className="px-4 py-3 text-center">GA</th>
                            <th className="px-4 py-3 text-center">GD</th>
                            <th className="px-4 py-3 text-center">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((standing, index) => {
                            const isHomeTeam = standing.team?.id === match.homeTeamId;
                            const isAwayTeam = standing.team?.id === match.awayTeamId;
                            const isHighlighted = isHomeTeam || isAwayTeam;

                            return (
                              <tr
                                key={standing.id}
                                className={`border-t border-white/5 ${isHighlighted ? 'bg-primary/10 border-primary/20' : 'hover:bg-white/5'
                                  } transition-colors`}
                              >
                                <td className="px-4 py-3">
                                  <span className={`font-bold ${index === 0 ? 'text-primary' : ''}`}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {isValidImagePath(standing.team?.logo) ? (
                                      <div className="w-6 h-6 relative rounded overflow-hidden">
                                        <Image
                                          src={standing.team.logo}
                                          alt={standing.team.name}
                                          fill
                                          className="object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-6 h-6 flex items-center justify-center text-sm">
                                        {standing.team?.logo}
                                      </div>
                                    )}
                                    <span className="font-semibold text-sm">{standing.team?.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center font-semibold">{standing.played}</td>
                                <td className="px-4 py-3 text-center font-semibold text-green-500">{standing.won}</td>
                                <td className="px-4 py-3 text-center font-semibold text-yellow-500">{standing.drawn}</td>
                                <td className="px-4 py-3 text-center font-semibold text-red-500">{standing.lost}</td>
                                <td className="px-4 py-3 text-center font-semibold">{standing.goalsFor}</td>
                                <td className="px-4 py-3 text-center font-semibold">{standing.goalsAgainst}</td>
                                <td className={`px-4 py-3 text-center font-semibold ${standing.goalDifference > 0 ? 'text-green-500' :
                                  standing.goalDifference < 0 ? 'text-red-500' : ''
                                  }`}>
                                  {standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2 py-1 bg-primary/20 text-primary rounded text-sm font-bold">
                                    {standing.points}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
                    <p className="text-white/40">No standings available for this competition</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Predict Tab - For Upcoming Matches */}
            {activeTab === 'predict' && match.status === 'UPCOMING' && (
              <motion.div
                key="predict"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {match.homeTeam && match.awayTeam ? (
                  <MatchPredictionCard
                    match={{
                      id: match.id,
                      homeTeam: match.homeTeam,
                      awayTeam: match.awayTeam,
                      startTime: match.startTime,
                      competition: match.competition,
                      sport: match.sport,
                    }}
                  />
                ) : (
                  <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
                    <p className="text-white/40">Team data not available</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Fan Poll Tab - For Upcoming Matches */}
            {activeTab === 'poll' && match.status === 'UPCOMING' && (
              <motion.div
                key="poll"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {match.homeTeam && match.awayTeam ? (
                  <MatchVotePoll
                    match={{
                      id: match.id,
                      homeTeam: match.homeTeam,
                      awayTeam: match.awayTeam,
                      startTime: match.startTime,
                      sport: match.sport,
                    }}
                  />
                ) : (
                  <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
                    <p className="text-white/40">Team data not available</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Chat Tab - For Live Matches */}
            {activeTab === 'chat' && match.status === 'LIVE' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                  <div className="p-4 border-b border-white/10 flex items-center gap-3">
                    <MessageSquare className="text-primary" size={20} />
                    <div>
                      <h3 className="font-bold">Live Chat</h3>
                      <p className="text-xs text-white/60">Join the conversation</p>
                    </div>
                  </div>
                  <div className="h-[500px]">
                    <LivestreamChat
                      matchId={match.id}
                      enabled={true}
                      className="h-full"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div >
  );
}

function StatRow({ label, values, suffix = '' }: { label: string; values: [number, number] | any; suffix?: string }) {
  // Ensure values is a proper array
  let homeValue = 0;
  let awayValue = 0;

  if (Array.isArray(values) && values.length >= 2) {
    homeValue = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    awayValue = typeof values[1] === 'number' ? values[1] : parseFloat(values[1]) || 0;
  } else if (typeof values === 'string') {
    // Handle case where values might be a string like "51,42"
    const parts = values.split(',').map((v: string) => parseFloat(v.trim()) || 0);
    homeValue = parts[0] || 0;
    awayValue = parts[1] || 0;
  }

  const total = homeValue + awayValue;
  const homePercent = (homeValue / (total || 1)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-black tracking-widest uppercase mb-1">
        <span className={homeValue > awayValue ? 'text-primary' : 'text-white'}>{homeValue}{suffix}</span>
        <span className="text-white/20">{label}</span>
        <span className={awayValue > homeValue ? 'text-primary' : 'text-white'}>{awayValue}{suffix}</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full flex overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${homePercent}%` }}
          className="bg-primary h-full"
        />
        <div className="flex-1 bg-white/10 h-full"></div>
      </div>
    </div>
  );
}

function PlayerRow({ player, rating, onClick }: { player: Player; rating: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/30 group transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-black rounded-xl border border-white/10 flex items-center justify-center font-display italic group-hover:bg-primary group-hover:text-black transition-colors">
          {player.number}
        </div>
        <div className="text-left">
          <p className="text-sm font-bold uppercase italic group-hover:text-primary transition-colors">{player.name}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">{player.position}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-[9px] font-black text-secondary uppercase italic opacity-0 group-hover:opacity-100 transition-opacity">
          Scout View
        </div>
        <div className={`px-2 py-1 rounded-lg font-black text-xs min-w-[32px] text-center ${rating >= 8 ? 'bg-blue-500/20 text-blue-500' : rating >= 7 ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/40'}`}>
          {rating.toFixed(1)}
        </div>
      </div>
    </button>
  );
}

