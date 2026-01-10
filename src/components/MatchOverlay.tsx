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
import { useMatchEvents, useMatchStatus, usePlayerRatings, useMatchViewers, useMatchTimer } from '@/hooks/useWebSocket';

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

  // Real-time WebSocket Data
  const { status: liveStatus, score: liveScore } = useMatchStatus(
    match.id,
    match.status,
    { home: match.homeScore, away: match.awayScore }
  );
  const { events: liveEvents, latestEvent } = useMatchEvents(match.id);
  const liveRatings = usePlayerRatings(match.id);
  const viewerCount = useMatchViewers(match.id);
  const liveTime = useMatchTimer(match.id);

  // Ratings state (merge initial API fetch with live updates)
  const [ratings, setRatings] = useState<Record<string, { autoRating: number; finalRating: number | null; isMotM: boolean; notes: string | null }>>({});
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [ratingsFetched, setRatingsFetched] = useState(false);

  // Use team data from match object (already populated by API)
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;
  const { isFavoriteTeam, toggleTeam } = useFavorites();
  const { addNotification } = useNotifications();

  // Match time tracking (synced from logger)
  const [matchTime, setMatchTime] = useState<{ minute: number; extraTime: number; half: number }>({
    minute: 0,
    extraTime: 0,
    half: 1,
  });

  // Listen for match time updates from logger
  useEffect(() => {
    const handleTimeUpdate = (event: any) => {
      if (event.detail.matchId === match.id) {
        setMatchTime({
          minute: event.detail.minute,
          extraTime: event.detail.extraTime,
          half: event.detail.half,
        });
      }
    };

    window.addEventListener('MATCH_TIME_UPDATE', handleTimeUpdate);
    return () => window.removeEventListener('MATCH_TIME_UPDATE', handleTimeUpdate);
  }, [match.id]);

  // Sync match time from WebSocket updates
  useEffect(() => {
    if (liveTime) {
      setMatchTime(liveTime);
    }
  }, [liveTime]);

  // Listen for football events from logger (goals, cards, clearances, etc.)
  useEffect(() => {
    const handleFootballEvent = (event: any) => {
      if (event.detail.matchId === match.id) {
        const { event: newEvent, homeScore, awayScore, status } = event.detail;

        // Update match with new event
        setMatch(prev => ({
          ...prev,
          events: [...(prev.events || []), newEvent], // Safely handle undefined events
          homeScore: homeScore ?? prev.homeScore,
          awayScore: awayScore ?? prev.awayScore,
          status: status ?? prev.status,
        }));

        // Show notification for significant events
        if (newEvent.type === 'Goal' || newEvent.type === 'Penalty') {
          addNotification({
            title: 'GOAL!',
            message: `${newEvent.detail} has scored!`,
            type: 'match'
          });
        } else if (newEvent.type === 'Red Card') {
          addNotification({
            title: 'RED CARD!',
            message: `${newEvent.detail} has been sent off!`,
            type: 'match'
          });
        } else if (newEvent.type === 'Yellow Card') {
          addNotification({
            title: 'YELLOW CARD',
            message: `${newEvent.detail} has been booked`,
            type: 'match'
          });
        }
      }
    };

    window.addEventListener('FOOTBALL_EVENT', handleFootballEvent);
    return () => window.removeEventListener('FOOTBALL_EVENT', handleFootballEvent);
  }, [match.id, addNotification]);

  // Update match state from live socket data
  useEffect(() => {
    if (liveStatus && liveStatus !== match.status) {
      setMatch(prev => ({ ...prev, status: liveStatus as import('@/types').MatchStatus }));
      // Refetch complete match data when status changes to FINISHED
      if (liveStatus === 'FINISHED') {
        // Note: refetchMatchData is defined below, this will work due to hoisting
        setTimeout(() => refetchMatchData(), 100);
      }
    }
    if (liveScore) {
      setMatch(prev => ({ ...prev, homeScore: liveScore.home, awayScore: liveScore.away }));
    }
  }, [liveStatus, liveScore, match.status]);

  // Handle new live events from WebSocket
  useEffect(() => {
    if (latestEvent) {
      // Add event to match state if not already present
      setMatch(prev => {
        const eventExists = prev.events?.some(e => e.id === latestEvent.id);
        if (eventExists) return prev;

        // Cast to MatchEvent type to ensure compatibility
        const matchEvent: MatchEvent = {
          id: latestEvent.id,
          matchId: latestEvent.matchId,
          type: latestEvent.type as MatchEvent['type'],
          minute: latestEvent.minute,
          teamId: latestEvent.teamId || '',
          playerId: latestEvent.playerId ?? undefined,
          detail: latestEvent.detail || '',
          isEyePoint: latestEvent.isEyePoint ?? undefined,
        };

        return {
          ...prev,
          events: [...(prev.events || []), matchEvent],
        };
      });

      // Show notification for significant events
      if (latestEvent.type === 'Goal') {
        addNotification({
          title: 'GOAL!',
          message: `${latestEvent.detail} has scored!`,
          type: 'match'
        });
      }
      if (latestEvent.isEyePoint) {
        addNotification({
          title: 'EYE POINT AWARDED',
          message: `Exceptional performance by ${latestEvent.detail}`,
          type: 'scout'
        });
      }
    }
  }, [latestEvent, addNotification]);

  // Global Goal Notifications (Goals from OTHER matches)
  const { socket, isConnected } = useMatchEvents(match.id); // Reuse socket connection
  useEffect(() => {
    if (isConnected && socket) {
      const handleGlobalNotification = (data: { type: string, matchId: string, message: string }) => {
        // Only show if it's NOT the current match
        if (data.type === 'GOAL' && data.matchId !== match.id) {
          addNotification({
            title: 'GOAL UPDATE',
            message: data.message, // e.g. "GOAL! Manchester United scores!"
            type: 'match' // Distinct style?
          });
        }
      };

      socket.on('notification:global', handleGlobalNotification);
      return () => {
        socket.off('notification:global', handleGlobalNotification);
      };
    }
  }, [isConnected, socket, match.id, addNotification]);

  // Update ratings from live socket data
  useEffect(() => {
    if (Object.keys(liveRatings).length > 0) {
      setRatings(prev => {
        const newRatings = { ...prev };
        Object.entries(liveRatings).forEach(([playerId, rating]) => {
          if (newRatings[playerId]) {
            newRatings[playerId].autoRating = rating;
          } else {
            // Create basic entry if not exists
            newRatings[playerId] = {
              autoRating: rating,
              finalRating: null,
              isMotM: false,
              notes: null
            };
          }
        });
        return newRatings;
      });
    }
  }, [liveRatings]);

  // Helper function to refetch complete match data
  const refetchMatchData = async () => {
    try {
      const response = await fetch(`/api/matches/${match.id}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Refetched match data:', data);
        console.log('Events from API:', data.events);
        console.log('Stats from API:', data.match.stats);

        // Merge the API response properly - events are a separate property
        setMatch(prev => ({
          ...prev,
          ...data.match,
          homeTeam: data.match.homeTeam || prev.homeTeam,
          awayTeam: data.match.awayTeam || prev.awayTeam,
          events: data.events || prev.events || [], // Events come from separate property
          stats: data.match.stats || prev.stats, // Stats are already parsed by API
        }));
      }
    } catch (error) {
      console.error('Error refetching match data:', error);
    }
  };

  // Fetch complete match data on mount if events or stats are missing
  useEffect(() => {
    const needsInitialFetch = !match.events || match.events.length === 0 || !match.stats;
    if (needsInitialFetch) {
      console.log('Fetching initial match data - events:', match.events?.length, 'stats:', !!match.stats);
      refetchMatchData();
    }
  }, []); // Only run on mount

  // Listen for match status changes from logger
  useEffect(() => {
    const handleStatusChange = (event: any) => {
      if (event.detail.matchId === match.id) {
        console.log('🔴 [OVERLAY] Match status changed:', event.detail.status);
        console.log('🔴 [OVERLAY] Previous status:', match.status);
        // Update match state immediately
        setMatch(prev => {
          console.log('🔴 [OVERLAY] Updating match status from', prev.status, 'to', event.detail.status);
          return {
            ...prev,
            status: event.detail.status,
          };
        });

        // Refetch complete match data when match finishes
        if (event.detail.status === 'FINISHED') {
          refetchMatchData();
        }
      }
    };

    window.addEventListener('MATCH_STATUS_CHANGE', handleStatusChange);
    return () => window.removeEventListener('MATCH_STATUS_CHANGE', handleStatusChange);
  }, [match.id, match.status]);

  // Listen for ratings published events
  useEffect(() => {
    const handleRatingsPublished = (event: any) => {
      if (event.detail.matchId === match.id) {
        console.log('Ratings published for match:', match.id);
        // Refetch ratings to update lineup display
        if (activeTab === 'lineups' || match.status === 'FINISHED') {
          setRatingsFetched(false); // Reset to allow refetch
          // Ratings will be refetched by the existing useEffect
        }
      }
    };

    window.addEventListener('RATINGS_PUBLISHED', handleRatingsPublished);
    return () => window.removeEventListener('RATINGS_PUBLISHED', handleRatingsPublished);
  }, [match.id, activeTab, match.status]);

  // Log current match status for debugging
  useEffect(() => {
    console.log('🎯 [OVERLAY] Current match status:', match.status);
    console.log('🎯 [OVERLAY] Tabs will show:', {
      predict: match.status === 'UPCOMING',
      chat: match.status === 'LIVE',
    });
  }, [match.status]);

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



  // Helper function to extract player IDs from lineup (supports both formats)
  const getLineupPlayerIds = (lineup: any): string[] => {
    if (!lineup) return [];
    // New format: { starters: [...], substitutes: [...], status: 'published' }
    if (lineup.starters && Array.isArray(lineup.starters)) {
      return lineup.starters.map((p: any) => p.playerId);
    }
    // Legacy format: direct array
    if (Array.isArray(lineup)) {
      return lineup.map((e: any) => e.playerId);
    }
    return [];
  };

  // Helper function to check if lineup is published
  const isLineupPublished = (lineup: any): boolean => {
    if (!lineup) return false;
    // New format with status field
    if (lineup.status) {
      return lineup.status === 'published';
    }
    // Legacy format: if it exists and has data, consider it published
    if (Array.isArray(lineup) && lineup.length > 0) {
      return true;
    }
    // New format: if it has starters, consider it published
    if (lineup.starters && Array.isArray(lineup.starters) && lineup.starters.length > 0) {
      return true;
    }
    return false;
  };

  // Fetch player data when lineups or scout tab is opened
  useEffect(() => {
    const needsPlayers = (activeTab === 'lineups' || activeTab === 'scout') && match.lineups;
    if (!needsPlayers || loadingPlayers || playersFetched) return;

    const homePlayerIds = getLineupPlayerIds(match.lineups?.home);
    const awayPlayerIds = getLineupPlayerIds(match.lineups?.away);
    const playerIds = [...homePlayerIds, ...awayPlayerIds];

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
    >
      <div className="flex flex-col min-h-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`sticky top-0 z-10 bg-[#0a0a0a] border-b border-white/10 transition-all duration-300 ${isScrolled ? 'py-2 shadow-xl' : 'py-4'}`}>
          <div className="max-w-5xl mx-auto px-4">
            <div className={`relative flex items-center ${isScrolled ? 'mb-2' : 'mb-4'} transition-all duration-300`}>
              {/* Left: Close Button */}
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Center: Score Cluster (Absolutely Centered) */}
              {isScrolled && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-3">
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

              {/* Center: Competition Info (Expanded State) */}
              {!isScrolled && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    {match.competition}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-white/40 mt-1">
                    <div className="flex items-center gap-1 text-red-500 animate-pulse">
                      <Users size={12} />
                      <span className="font-bold">{viewerCount} Live</span>
                    </div>
                    <span>•</span>
                    <MapPin size={12} />
                    <span>{match.venue}</span>
                    <span>•</span>
                    <Calendar size={12} />
                    <span>{new Date(match.startTime).toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              {/* Right: Share Button */}
              <div className="ml-auto">
                <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <Share2 size={20} className="text-white/60" />
                </button>
              </div>
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
                <div className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  {match.status === 'LIVE' && (
                    <>
                      <Clock size={12} className="text-primary" />
                      <span className="text-primary">{matchTime.minute}'{matchTime.extraTime > 0 && `+${matchTime.extraTime}`}</span>
                      <span className="text-white/40">•</span>
                      <span>H{matchTime.half}</span>
                    </>
                  )}
                  {match.status === 'FINISHED' && 'FT'}
                  {match.status === 'UPCOMING' && match.status}
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

            {/* Tabs - Enhanced Mobile UI */}
            <div className="relative -mx-4 px-4">
              {/* Left Scroll Indicator */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0a0a0a] to-transparent pointer-events-none z-10" />

              {/* Right Scroll Indicator */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0a0a0a] to-transparent pointer-events-none z-10" />

              {/* Tabs Container */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      group relative flex items-center justify-center gap-2 
                      px-5 py-3 rounded-xl
                      text-xs sm:text-sm font-bold uppercase tracking-wider 
                      whitespace-nowrap transition-all duration-300
                      snap-start flex-shrink-0
                      min-w-[120px] sm:min-w-[140px]
                      ${activeTab === tab.id
                        ? 'bg-gradient-to-r from-primary via-primary to-yellow-400 text-black shadow-lg shadow-primary/30 scale-105'
                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white hover:scale-102 backdrop-blur-sm border border-white/10'
                      }
                    `}
                  >
                    {/* Icon with animation */}
                    <tab.icon
                      size={16}
                      className={`transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'
                        }`}
                    />

                    {/* Label - Hide on very small screens for some tabs */}
                    <span className={`${tab.id === 'watch' || tab.id === 'overview' || tab.id === 'lineups'
                      ? ''
                      : 'hidden xs:inline'
                      }`}>
                      {tab.label}
                    </span>

                    {/* Active indicator dot */}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-black rounded-full"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}

                    {/* Shine effect on active tab */}
                    {activeTab === tab.id && (
                      <div className="absolute inset-0 rounded-xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
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
                ) : isLineupPublished(match.lineups?.home) && isLineupPublished(match.lineups?.away) ? (
                  /* Full Pitch View - Both teams facing each other */
                  <FullPitchLineups
                    homeTeam={{
                      name: homeTeam?.name || 'Home',
                      logo: homeTeam?.logo || '',
                      color: homeTeam?.color || '#3B82F6',
                      formation: (match.lineups?.home as any)?.formation || '4-4-2'
                    }}
                    awayTeam={{
                      name: awayTeam?.name || 'Away',
                      logo: awayTeam?.logo || '',
                      color: awayTeam?.color || '#EF4444',
                      formation: (match.lineups?.away as any)?.formation || '4-4-2'
                    }}
                    homePlayers={players}
                    awayPlayers={players}
                    homeLineup={(() => {
                      if (!match.lineups?.home) return [];
                      const homeLineup = match.lineups.home as any;
                      // New format: { starters: [...], substitutes: [...] }
                      if (homeLineup.starters && Array.isArray(homeLineup.starters)) {
                        return homeLineup.starters.map((entry: any) => ({
                          playerId: entry.playerId,
                          position: entry.position,
                          rating: ratings[entry.playerId]?.finalRating || ratings[entry.playerId]?.autoRating || 6.0,
                          isCaptain: entry.isCaptain || false,
                          isMotM: ratings[entry.playerId]?.isMotM || false
                        }));
                      }
                      // Legacy format: direct array
                      if (Array.isArray(homeLineup)) {
                        return homeLineup.map((entry: any) => ({
                          ...entry,
                          rating: ratings[entry.playerId]?.finalRating || ratings[entry.playerId]?.autoRating || entry.rating || 6.0,
                          isMotM: ratings[entry.playerId]?.isMotM || false
                        }));
                      }
                      return [];
                    })()}
                    awayLineup={(() => {
                      if (!match.lineups?.away) return [];
                      const awayLineup = match.lineups.away as any;
                      // New format: { starters: [...], substitutes: [...] }
                      if (awayLineup.starters && Array.isArray(awayLineup.starters)) {
                        return awayLineup.starters.map((entry: any) => ({
                          playerId: entry.playerId,
                          position: entry.position,
                          rating: ratings[entry.playerId]?.finalRating || ratings[entry.playerId]?.autoRating || 6.0,
                          isCaptain: entry.isCaptain || false,
                          isMotM: ratings[entry.playerId]?.isMotM || false
                        }));
                      }
                      // Legacy format: direct array
                      if (Array.isArray(awayLineup)) {
                        return awayLineup.map((entry: any) => ({
                          ...entry,
                          rating: ratings[entry.playerId]?.finalRating || ratings[entry.playerId]?.autoRating || entry.rating || 6.0,
                          isMotM: ratings[entry.playerId]?.isMotM || false
                        }));
                      }
                      return [];
                    })()}
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
                  {match.stats?.possession && <StatRow label="Possession" values={match.stats.possession} suffix="%" />}
                  {match.stats?.expectedGoals && <StatRow label="Expected Goals (xG)" values={match.stats.expectedGoals} suffix="" />}
                  {match.stats?.shots && <StatRow label="Total Shots" values={match.stats.shots} />}
                  {match.stats?.shotsOnTarget && <StatRow label="Shots on Target" values={match.stats.shotsOnTarget} />}
                  {match.stats?.corners && <StatRow label="Corners" values={match.stats.corners} />}
                  {match.stats?.fouls && <StatRow label="Fouls" values={match.stats.fouls} />}
                  {match.stats?.yellowCards && <StatRow label="Yellow Cards" values={match.stats.yellowCards} />}
                  {match.stats?.redCards && <StatRow label="Red Cards" values={match.stats.redCards} />}

                  {/* Show message if no stats available */}
                  {(!match.stats || (
                    !match.stats.possession &&
                    !match.stats.shots &&
                    !match.stats.shotsOnTarget &&
                    !match.stats.corners &&
                    !match.stats.fouls
                  )) && (
                      <div className="py-8 text-center text-white/40">
                        No match statistics available yet
                      </div>
                    )}
                </div>

                {match.stats?.winProbability && (
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
                {match.events && match.events.length > 0 ? (
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
                            <div className="flex items-center gap-2">
                              {event.teamId && (
                                <img
                                  src={event.teamId === match.homeTeamId ? homeTeam?.logo : awayTeam?.logo}
                                  alt="Team"
                                  className="w-6 h-6 object-contain opacity-60 group-hover:opacity-100 transition-opacity"
                                />
                              )}
                              {event.playerId && players[event.playerId] && (
                                <span className="text-xs font-semibold text-white/60">
                                  {players[event.playerId].jerseyName || players[event.playerId].name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-12 text-center">
                    <Clock className="mx-auto mb-4 text-white/40" size={48} />
                    <p className="text-white/60 mb-2">No events yet</p>
                    <p className="text-white/40 text-sm">Match events will appear here as they happen</p>
                  </div>
                )}
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

