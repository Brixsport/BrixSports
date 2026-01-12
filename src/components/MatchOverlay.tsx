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
import { ResponsiveLineup } from '@/components/lineup/ResponsiveLineup';
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
  const [activeTab, setActiveTab] = useState(match.isStreaming ? 'watch' : 'overview');
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
  const [matchTime, setMatchTime] = useState<{ minute: number; extraTime: number; half: number; period?: string; announcedStoppage?: number }>({
    minute: 0,
    extraTime: 0,
    half: 1,
    announcedStoppage: 0,
  });
  // Team Ratings State
  const [teamRatings, setTeamRatings] = useState<{ home: number; away: number }>({ home: 0, away: 0 });

  // Listen for ratings updates
  useEffect(() => {
    const handleRatingsUpdate = (event: any) => {
      if (event.detail.matchId === match.id) {
        setTeamRatings(event.detail.teamRatings);
      }
    };

    window.addEventListener('MATCH_RATINGS_UPDATE', handleRatingsUpdate);
    return () => window.removeEventListener('MATCH_RATINGS_UPDATE', handleRatingsUpdate);
  }, [match.id]);

  // Listen for Undo events
  useEffect(() => {
    const handleUndo = (event: any) => {
      if (event.detail.matchId === match.id) {
        const { eventId, score, teamRatings: newTeamRatings } = event.detail;

        setMatch(prev => ({
          ...prev,
          events: (prev.events || []).filter(e => e.id !== eventId),
          homeScore: score.home,
          awayScore: score.away
        }));

        if (newTeamRatings) {
          setTeamRatings(newTeamRatings);
        }

        // Remove from local ratings if needed, or just let the next rating update handle it
        // Ideally we revert the specific rating change in the 'ratings' state map too
        // But simply refreshing via API or relying on MATCH_RATINGS_UPDATE is safer for now.
      }
    };

    window.addEventListener('MATCH_EVENT_UNDO', handleUndo);
    return () => window.removeEventListener('MATCH_EVENT_UNDO', handleUndo);
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
          events: [...(prev.events || []), newEvent],
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
      if (liveStatus === 'FINISHED') {
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
      setMatch(prev => {
        const eventExists = prev.events?.some(e => e.id === latestEvent.id);
        if (eventExists) return prev;

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

  // Global Goal Notifications
  const { socket, isConnected } = useMatchEvents(match.id);
  useEffect(() => {
    if (isConnected && socket) {
      const handleGlobalNotification = (data: { type: string, matchId: string, message: string }) => {
        if (data.type === 'GOAL' && data.matchId !== match.id) {
          addNotification({
            title: 'GOAL UPDATE',
            message: data.message,
            type: 'match'
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
        setMatch(prev => ({
          ...prev,
          ...data.match,
          homeTeam: data.match.homeTeam || prev.homeTeam,
          awayTeam: data.match.awayTeam || prev.awayTeam,
          events: data.events || prev.events || [],
          stats: data.match.stats || prev.stats,
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
      refetchMatchData();
    }
  }, []);

  // Listen for match status changes from logger
  useEffect(() => {
    const handleStatusChange = (event: any) => {
      if (event.detail.matchId === match.id) {
        setMatch(prev => ({
          ...prev,
          status: event.detail.status,
        }));

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
        if (activeTab === 'lineups' || match.status === 'FINISHED') {
          setRatingsFetched(false);
        }
      }
    };

    window.addEventListener('RATINGS_PUBLISHED', handleRatingsPublished);
    return () => window.removeEventListener('RATINGS_PUBLISHED', handleRatingsPublished);
  }, [match.id, activeTab, match.status]);

  const tabs = [
    ...(match.isStreaming ? [{ id: 'watch', label: 'Watch', icon: Play }] : []),
    { id: 'overview', label: 'Overview', icon: Trophy },
    { id: 'lineups', label: 'Lineups', icon: Users },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'standings', label: 'Table', icon: Table },
    ...(match.status === 'UPCOMING' ? [
      { id: 'predict', label: 'Predict', icon: Target },
      { id: 'poll', label: 'Poll', icon: BarChart3 },
    ] : []),
    ...(['UPCOMING', 'LIVE', 'FINISHED'].includes(match.status) ? [
      { id: 'chat', label: 'Chat', icon: MessageSquare },
    ] : []),
  ];

  // Helper function to extract player IDs from lineup
  const getLineupPlayerIds = (lineup: any): string[] => {
    if (!lineup) return [];
    let ids: string[] = [];

    // Check for structured lineup (starters + substitutes)
    if (lineup.starters && Array.isArray(lineup.starters)) {
      ids = [...ids, ...lineup.starters.map((p: any) => p.playerId)];
    }
    if (lineup.substitutes && Array.isArray(lineup.substitutes)) {
      ids = [...ids, ...lineup.substitutes.map((p: any) => p.playerId)];
    }

    // Fallback for flat array or empty structured lineup
    if (ids.length === 0 && Array.isArray(lineup)) {
      return lineup.map((e: any) => e.playerId);
    }

    return ids;
  };

  // Helper function to check if lineup is published
  const isLineupPublished = (lineup: any): boolean => {
    if (!lineup) return false;
    if (lineup.status) {
      return lineup.status === 'published';
    }
    if (Array.isArray(lineup) && lineup.length > 0) {
      return true;
    }
    if (lineup.starters && Array.isArray(lineup.starters) && lineup.starters.length > 0) {
      return true;
    }
    return false;
  };

  // Fetch player data when lineups tab is opened
  useEffect(() => {
    const needsPlayers = (activeTab === 'lineups' || activeTab === 'scout') && match.lineups;
    if (!needsPlayers || loadingPlayers || playersFetched) return;

    const homePlayerIds = getLineupPlayerIds(match.lineups?.home);
    const awayPlayerIds = getLineupPlayerIds(match.lineups?.away);
    const playerIds = [...homePlayerIds, ...awayPlayerIds];

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
        if (Array.isArray(data) && data.length > 0) {
          setStandings(data);
          setStandingsFetched(true);
        } else if (data.success && data.standings) {
          setStandings(data.standings);
          setStandingsFetched(true);
        } else {
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

  // Handle scroll
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

  // Format match status text
  const getStatusText = () => {
    if (match.status === 'FINISHED') return 'Full Time';

    if (match.status === 'LIVE') {
      const { minute, extraTime, half, period } = matchTime;

      if (period === 'HALF_TIME') return 'HT';
      if (period === 'FINISHED') return 'Full Time';

      let timeStr = `${minute}'`;
      if (extraTime > 0) timeStr += `+${extraTime}`;

      let halfStr = '';
      if (half === 1) halfStr = '1H';
      else if (half === 2) halfStr = '2H';
      else if (half === 3) halfStr = 'ET';
      else if (half === 4) halfStr = 'Pen';

      return halfStr ? `${timeStr} • ${halfStr}` : timeStr;
    }

    if (match.status === 'UPCOMING') {
      return new Date(match.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    return match.status;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col overflow-hidden"
    >
      <div className="flex flex-col min-h-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10 transition-all duration-300 ${isScrolled ? 'py-2' : 'pt-6 pb-0'}`}>
          <div className="max-w-5xl mx-auto px-4">
            {/* Top Bar */}
            <div className={`flex items-center justify-between ${isScrolled ? 'mb-2' : 'mb-6'}`}>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={18} className="text-white/80" />
              </button>

              <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">
                {match.competition}
              </span>

              <button className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
                <Share2 size={18} className="text-white/80" />
              </button>
            </div>

            {/* Main Score Area */}
            {!isScrolled && (
              <div className="flex items-center justify-between gap-2 sm:gap-8 mb-6">
                {/* Home Team */}
                <div className="flex items-center gap-3 sm:gap-4 flex-1 justify-end min-w-0">
                  <div className="flex flex-col items-end min-w-0">
                    <h3 className="font-bold text-sm sm:text-xl text-white leading-tight text-right truncate w-full">
                      {homeTeam?.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {teamRatings.home > 0 && (
                        <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-bold text-white/70">
                          {teamRatings.home.toFixed(1)} OVR
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); if (homeTeam) toggleTeam(homeTeam.id); }}
                        className="text-xs text-white/40 hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <Heart size={12} fill={isFavoriteTeam(homeTeam?.id || '') ? "currentColor" : "none"} />
                        <span className="hidden sm:inline">{isFavoriteTeam(homeTeam?.id || '') ? 'Following' : 'Follow'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="w-10 h-10 sm:w-16 sm:h-16 relative rounded-full overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 shadow-lg shadow-black/50">
                    {isValidImagePath(homeTeam?.logo) && homeTeam && (
                      <Image src={homeTeam.logo} alt={homeTeam.name} fill className="object-cover p-1" />
                    )}
                  </div>
                </div>

                {/* Score Center */}
                <div className="flex flex-col items-center px-2 sm:px-6 relative z-10">
                  <div className="flex items-center gap-2 sm:gap-4 bg-white/5 px-4 py-2 sm:px-6 sm:py-3 rounded-xl border border-white/10 shadow-inner backdrop-blur-sm">
                    <span className={`text-2xl sm:text-5xl font-black tabular-nums tracking-tighter ${match.homeScore > match.awayScore ? 'text-white' : 'text-white/60'}`}>
                      {match.homeScore}
                    </span>
                    <span className="text-white/20 text-xl sm:text-3xl font-light">:</span>
                    <span className={`text-2xl sm:text-5xl font-black tabular-nums tracking-tighter ${match.awayScore > match.homeScore ? 'text-white' : 'text-white/60'}`}>
                      {match.awayScore}
                    </span>
                  </div>

                  {/* Status Pill */}
                  <div className="mt-[-10px] bg-[#0a0a0a] px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm">
                    {match.status === 'LIVE' && ['FIRST_HALF', 'SECOND_HALF', 'EXTRA_TIME_1', 'EXTRA_TIME_2', 'PENALTY_SHOOTOUT'].includes(matchTime.period || '') && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />}
                    <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${match.status === 'LIVE' ? 'text-red-500' : 'text-white/60'}`}>
                      <div className="flex items-center gap-1">
                        {getStatusText()}
                        {match.status === 'LIVE' && matchTime.announcedStoppage && matchTime.announcedStoppage > 0 && (
                          <span className="ml-1 px-1 py-0.5 bg-white/10 rounded text-[9px] text-white font-bold border border-white/20">
                            +{matchTime.announcedStoppage}
                          </span>
                        )}
                      </div>
                    </span>
                  </div>
                </div>

                {/* Away Team */}
                <div className="flex items-center gap-3 sm:gap-4 flex-1 justify-start min-w-0">
                  <div className="w-10 h-10 sm:w-16 sm:h-16 relative rounded-full overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 shadow-lg shadow-black/50">
                    {isValidImagePath(awayTeam?.logo) && awayTeam && (
                      <Image src={awayTeam.logo} alt={awayTeam.name} fill className="object-cover p-1" />
                    )}
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <h3 className="font-bold text-sm sm:text-xl text-white leading-tight text-left truncate w-full">
                      {awayTeam?.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {teamRatings.away > 0 && (
                        <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-bold text-white/70">
                          {teamRatings.away.toFixed(1)} OVR
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); if (awayTeam) toggleTeam(awayTeam.id); }}
                        className="text-xs text-white/40 hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <Heart size={12} fill={isFavoriteTeam(awayTeam?.id || '') ? "currentColor" : "none"} />
                        <span className="hidden sm:inline">{isFavoriteTeam(awayTeam?.id || '') ? 'Following' : 'Follow'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Metadata Row */}
            {!isScrolled && (
              <div className="flex items-center justify-center gap-4 text-[10px] sm:text-xs text-white/40 mb-6 font-medium tracking-wide">
                <div className="flex items-center gap-1.5">
                  <Users size={12} />
                  <span>{viewerCount} watching</span>
                </div>
                <div className="w-1 h-1 bg-white/20 rounded-full" />
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} />
                  <span>{match.venue}</span>
                </div>
                <div className="w-1 h-1 bg-white/20 rounded-full" />
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  <span>{new Date(match.startTime).toLocaleDateString()}</span>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-6 overflow-x-auto scrollbar-hide border-b border-white/5 pb-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex items-center gap-2 pb-3 text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 group"
                >
                  <tab.icon
                    size={16}
                    className={`transition-colors ${activeTab === tab.id ? 'text-primary' : 'text-white/40 group-hover:text-white/60'}`}
                  />
                  <span className={`transition-colors ${activeTab === tab.id ? 'text-white' : 'text-white/40 group-hover:text-white/60'}`}>
                    {tab.label}
                  </span>

                  {/* Active indicator */}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          ref={scrollContainerRef}
          className="max-w-5xl mx-auto w-full px-4 py-6 overflow-y-auto flex-1 scrollbar-hide"
        >
          <AnimatePresence mode="wait">
            {/* Watch Tab */}
            {activeTab === 'watch' && match.isStreaming && match.streamUrl && (
              <motion.div
                key="watch"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
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
                className="grid grid-cols-2 gap-4"
              >
                <InfoCard icon={Trophy} label="Competition" value={match.competition} />
                <InfoCard icon={MapPin} label="Venue" value={match.venue} />
                <InfoCard
                  icon={Calendar}
                  label="Date"
                  value={new Date(match.startTime).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                />
                <InfoCard icon={Clock} label="Status" value={match.status} />
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
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/60 text-sm">Loading lineups...</p>
                  </div>
                ) : isLineupPublished(match.lineups?.home) && isLineupPublished(match.lineups?.away) ? (
                  <ResponsiveLineup
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
                      if (homeLineup.starters && Array.isArray(homeLineup.starters)) {
                        return homeLineup.starters.map((entry: any) => ({
                          playerId: entry.playerId,
                          position: entry.position,
                          rating: ratings[entry.playerId]?.finalRating || ratings[entry.playerId]?.autoRating || 0,
                          isCaptain: entry.isCaptain || false,
                          isMotM: ratings[entry.playerId]?.isMotM || false
                        }));
                      }
                      if (Array.isArray(homeLineup)) {
                        return homeLineup.map((entry: any) => ({
                          ...entry,
                          rating: ratings[entry.playerId]?.finalRating || ratings[entry.playerId]?.autoRating || entry.rating || 0,
                          isMotM: ratings[entry.playerId]?.isMotM || false
                        }));
                      }
                      return [];
                    })()}
                    awayLineup={(() => {
                      if (!match.lineups?.away) return [];
                      const awayLineup = match.lineups.away as any;
                      if (awayLineup.starters && Array.isArray(awayLineup.starters)) {
                        return awayLineup.starters.map((entry: any) => ({
                          playerId: entry.playerId,
                          position: entry.position,
                          rating: ratings[entry.playerId]?.finalRating || ratings[entry.playerId]?.autoRating || 0,
                          isCaptain: entry.isCaptain || false,
                          isMotM: ratings[entry.playerId]?.isMotM || false
                        }));
                      }
                      if (Array.isArray(awayLineup)) {
                        return awayLineup.map((entry: any) => ({
                          ...entry,
                          rating: ratings[entry.playerId]?.finalRating || ratings[entry.playerId]?.autoRating || entry.rating || 0,
                          isMotM: ratings[entry.playerId]?.isMotM || false
                        }));
                      }
                      return [];
                    })()}
                    homeSubs={(() => {
                      if (!match.lineups?.home) return [];
                      const homeLineup = match.lineups.home as any;
                      if (homeLineup.substitutes && Array.isArray(homeLineup.substitutes)) {
                        return homeLineup.substitutes.map((entry: any) => ({
                          playerId: entry.playerId,
                          position: entry.position,
                          rating: ratings[entry.playerId]?.finalRating || ratings[entry.playerId]?.autoRating || 0,
                          isMotM: ratings[entry.playerId]?.isMotM || false
                        }));
                      }
                      return [];
                    })()}
                    awaySubs={(() => {
                      if (!match.lineups?.away) return [];
                      const awayLineup = match.lineups.away as any;
                      if (awayLineup.substitutes && Array.isArray(awayLineup.substitutes)) {
                        return awayLineup.substitutes.map((entry: any) => ({
                          playerId: entry.playerId,
                          position: entry.position,
                          rating: ratings[entry.playerId]?.finalRating || ratings[entry.playerId]?.autoRating || 0,
                          isMotM: ratings[entry.playerId]?.isMotM || false
                        }));
                      }
                      return [];
                    })()}
                    events={match.events || []}
                    onPlayerClick={onSelectPlayer}
                  />
                ) : (
                  <div className="py-12 text-center">
                    <Users className="mx-auto mb-3 text-white/20" size={48} />
                    <p className="text-white/60 text-sm">No lineups available yet</p>
                    <p className="text-white/40 text-xs mt-1">Lineups will be published before the match starts</p>
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
                className="space-y-1"
              >
                {match.stats?.possession && <StatRow label="Ball Possession" values={match.stats.possession} suffix="%" showBar={true} />}
                {match.stats?.expectedGoals && <StatRow label="Expected Goals (xG)" values={match.stats.expectedGoals} suffix="" showBar={true} />}
                {match.stats?.shots && <StatRow label="Total Shots" values={match.stats.shots} showBar={false} />}
                {match.stats?.shotsOnTarget && <StatRow label="Shots on Target" values={match.stats.shotsOnTarget} showBar={false} />}
                {match.stats?.corners && <StatRow label="Corners" values={match.stats.corners} showBar={false} />}
                {match.stats?.fouls && <StatRow label="Fouls" values={match.stats.fouls} showBar={false} />}
                {match.stats?.yellowCards && <StatRow label="Yellow Cards" values={match.stats.yellowCards} showBar={false} />}
                {match.stats?.redCards && <StatRow label="Red Cards" values={match.stats.redCards} showBar={false} />}
                {match.stats?.offsides && <StatRow label="Offsides" values={match.stats.offsides} showBar={false} />}
                {match.stats?.freeKicks && <StatRow label="Free Kicks" values={match.stats.freeKicks} showBar={false} />}

                {(!match.stats || (
                  !match.stats.possession &&
                  !match.stats.shots &&
                  !match.stats.shotsOnTarget &&
                  !match.stats.corners &&
                  !match.stats.fouls &&
                  !match.stats.yellowCards &&
                  !match.stats.redCards &&
                  !match.stats.offsides &&
                  !match.stats.freeKicks
                )) && (
                    <div className="py-12 text-center">
                      <BarChart3 className="mx-auto mb-3 text-white/20" size={48} />
                      <p className="text-white/60 text-sm">No statistics available yet</p>
                      <p className="text-white/40 text-xs mt-1">Statistics will be available during the match</p>
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
                className="relative py-4 px-4"
              >
                {/* Central Line */}
                <div className="absolute left-[50%] top-6 bottom-6 w-px bg-white/10 -translate-x-1/2" />

                {match.events && match.events.length > 0 ? (
                  <div className="space-y-8 relative">
                    {[...match.events].reverse().map((event, index) => {
                      const isHomeTeam = event.teamId === match.homeTeamId;
                      const isGoal = event.type === 'Goal';
                      const isSub = event.type === 'Substitution';
                      const isCard = event.type.includes('Card');

                      return (
                        <div key={event.id || index} className={`flex items-center w-full ${isHomeTeam ? 'flex-row' : 'flex-row-reverse'}`}>

                          {/* Event Content Card */}
                          <div className={`w-[calc(50%-2rem)] ${isHomeTeam ? 'pr-4 text-right' : 'pl-4 text-left'}`}>
                            <div className="flex flex-col gap-1">
                              <div className={`flex items-center gap-2 ${isHomeTeam ? 'justify-end' : 'justify-start'}`}>
                                {isGoal && <div className="p-1.5 rounded-full bg-primary/20 text-primary"><Target size={14} /></div>}
                                {isSub && <div className="p-1.5 rounded-full bg-green-500/20 text-green-500"><RefreshCw size={14} /></div>}
                                {event.type === 'Red Card' && <div className="w-3 h-4 bg-red-500 rounded-sm shadow-sm" />}
                                {event.type === 'Yellow Card' && <div className="w-3 h-4 bg-yellow-500 rounded-sm shadow-sm" />}

                                <span className="font-bold text-sm text-white">{event.detail}</span>
                              </div>
                              <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">{event.type}</span>
                            </div>
                          </div>

                          {/* Center Time Marker */}
                          <div className="w-16 flex justify-center relative z-10">
                            <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center text-xs font-bold text-white/60 shadow-lg">
                              {event.minute}'
                            </div>
                          </div>

                          {/* Empty spacer for opposite side */}
                          <div className="w-[calc(50%-2rem)]" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center bg-white/5 rounded-xl border border-white/10">
                    <Clock className="mx-auto mb-3 text-white/20" size={48} />
                    <p className="text-white/60 text-sm">No events yet</p>
                    <p className="text-white/40 text-xs mt-1">Match events will appear here as they happen</p>
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
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/60 text-sm">Loading standings...</p>
                  </div>
                ) : standings.length > 0 ? (
                  <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-white/5">
                          <tr className="text-xs font-semibold text-white/60">
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
                                className={`border-t border-white/5 ${isHighlighted ? 'bg-primary/10 border-primary/20' : 'hover:bg-white/5'} transition-colors`}
                              >
                                <td className="px-4 py-3">
                                  <span className={`font-semibold ${index === 0 ? 'text-primary' : ''}`}>
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
                                  <span className="px-2 py-1 bg-primary/20 text-primary rounded text-sm font-semibold">
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
                  <div className="py-12 text-center">
                    <Table className="mx-auto mb-3 text-white/20" size={48} />
                    <p className="text-white/60 text-sm">No standings available</p>
                    <p className="text-white/40 text-xs mt-1">Standings data not available for this competition</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Predict Tab */}
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
                  <div className="py-12 text-center">
                    <p className="text-white/40 text-sm">Team data not available</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Fan Poll Tab */}
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
                  <div className="py-12 text-center">
                    <p className="text-white/40 text-sm">Team data not available</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Chat Tab */}
            {activeTab === 'chat' && ['UPCOMING', 'LIVE', 'FINISHED'].includes(match.status) && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="-mx-4 -my-6"
              >

                <div className="h-[calc(100vh-300px)] min-h-[500px]">
                  <LivestreamChat
                    matchId={match.id}
                    enabled={true}
                    className="h-full"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// InfoCard Component for Overview Tab
function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-primary" />
        <span className="text-xs font-semibold text-white/60">{label}</span>
      </div>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

// StatRow Component - Sofascore Style
function StatRow({ label, values, suffix = '', showBar = false }: { label: string; values: [number, number] | any; suffix?: string; showBar?: boolean }) {
  let homeValue = 0;
  let awayValue = 0;

  if (Array.isArray(values) && values.length >= 2) {
    homeValue = typeof values[0] === 'number' ? values[0] : parseFloat(values[0]) || 0;
    awayValue = typeof values[1] === 'number' ? values[1] : parseFloat(values[1]) || 0;
  } else if (typeof values === 'string') {
    const parts = values.split(',').map((v: string) => parseFloat(v.trim()) || 0);
    homeValue = parts[0] || 0;
    awayValue = parts[1] || 0;
  }

  const total = homeValue + awayValue;
  const homePercent = (homeValue / (total || 1)) * 100;

  return (
    <div className="bg-white/5 border-b border-white/5 last:border-b-0 py-4 px-4">
      {/* Top: Values and centered label */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold tabular-nums">{homeValue}{suffix}</span>
        <span className="text-xs text-white/60 font-medium">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{awayValue}{suffix}</span>
      </div>

      {/* Bottom: Progress bar (only for possession and xG) */}
      {showBar && (
        <div className="h-1 bg-white/10 rounded-full flex overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${homePercent}%` }}
            className="bg-primary h-full"
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          <div className="flex-1 bg-white/20 h-full" />
        </div>
      )}
    </div>
  );
}
