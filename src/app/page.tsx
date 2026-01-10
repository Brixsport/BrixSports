'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Calendar, User, Search, Bell, Menu, X, ChevronRight, ChevronLeft, Play } from 'lucide-react';
import { format, addDays, isSameDay } from 'date-fns';
import { Player, Team, Match } from '@/types';
import { MatchOverlay } from '@/components/MatchOverlay';
import { BasketballMatchOverlay } from '@/components/BasketballMatchOverlay';
import GlobalSearch from '@/components/GlobalSearch';
import { PlayerProfileOverlay } from '@/components/PlayerProfileOverlay';
import { NotificationToast, useNotifications } from '@/components/Notifications';
import { SettingsOverlay } from '@/components/SettingsOverlay';
import { TeamProfileOverlay } from '@/components/TeamProfileOverlay';
import { useFavorites } from '@/hooks/useFavorites';
import { LiveNowSection } from '@/components/livestream';

// Helper function to validate image paths
const isValidImagePath = (path: string | undefined): boolean => {
  if (!path || path.trim() === '') return false;
  // Check if it's a valid path (starts with / or http)
  return path.startsWith('/') || path.startsWith('http');
};

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('ALL');
  const [activeSport, setActiveSport] = useState('BASKETBALL'); // Default to basketball

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Date Filter
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Overlay States
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Authentication State
  const [user, setUser] = useState<any>(null);

  const { notifications, addNotification, removeNotification } = useNotifications();
  const { favoriteTeams, favoritePlayers } = useFavorites();

  // Fetch matches from API (both basketball and football)
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);

        // Fetch both basketball and football matches in parallel
        const [basketballResponse, footballResponse] = await Promise.all([
          fetch('/api/basketball/matches'),
          fetch('/api/football/matches')
        ]);

        const basketballData = await basketballResponse.json();
        const footballData = await footballResponse.json();

        const allMatches = [];

        // Transform basketball matches
        if (basketballData.success && basketballData.matches) {
          const basketballMatches = basketballData.matches.map((match: any) => {
            let dbStats = {};
            try {
              dbStats = typeof match.stats === 'string' ? JSON.parse(match.stats) : (match.stats || {});
            } catch (e) {
              console.error('Error parsing match stats:', e);
            }

            return {
              id: match.id,
              homeTeamId: match.homeTeamId,
              awayTeamId: match.awayTeamId,
              homeScore: match.homeScore || 0,
              awayScore: match.awayScore || 0,
              status: match.status,
              startTime: match.startTime,
              venue: match.venue,
              competition: match.competition,
              sport: 'Basketball',
              matchType: 'competition',
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              events: [],
              stats: {
                possession: [0, 0],
                shots: [0, 0],
                shotsOnTarget: [0, 0],
                corners: [0, 0],
                fouls: [0, 0],
                yellowCards: [0, 0],
                redCards: [0, 0],
                ...dbStats
              }
            };
          });
          allMatches.push(...basketballMatches);
        }

        // Transform football matches
        if (footballData.success && footballData.matches) {
          const footballMatches = footballData.matches.map((match: any) => {
            let dbStats = {};
            try {
              dbStats = typeof match.stats === 'string' ? JSON.parse(match.stats) : (match.stats || {});
            } catch (e) {
              console.error('Error parsing match stats:', e);
            }

            return {
              id: match.id,
              homeTeamId: match.homeTeamId,
              awayTeamId: match.awayTeamId,
              homeScore: match.homeScore || 0,
              awayScore: match.awayScore || 0,
              status: match.status,
              startTime: match.startTime,
              venue: match.venue,
              competition: match.competition,
              sport: 'Football',
              matchType: 'competition',
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              events: [],
              stats: dbStats
            };
          });
          allMatches.push(...footballMatches);
        }

        setMatches(allMatches);
      } catch (error) {
        console.error('Error fetching matches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  // Listen for match status changes from logger
  useEffect(() => {
    const handleMatchStatusChange = (event: any) => {
      console.log('🔄 Match status changed, refreshing matches...', event.detail);
      // Refetch matches to get updated status
      const fetchMatches = async () => {
        try {
          const [basketballResponse, footballResponse] = await Promise.all([
            fetch('/api/basketball/matches'),
            fetch('/api/football/matches')
          ]);

          const basketballData = await basketballResponse.json();
          const footballData = await footballResponse.json();

          const allMatches = [];

          if (basketballData.success && basketballData.matches) {
            const basketballMatches = basketballData.matches.map((match: any) => {
              let dbStats = {};
              try {
                dbStats = typeof match.stats === 'string' ? JSON.parse(match.stats) : (match.stats || {});
              } catch (e) {
                console.error('Error parsing match stats:', e);
              }

              return {
                id: match.id,
                homeTeamId: match.homeTeamId,
                awayTeamId: match.awayTeamId,
                homeScore: match.homeScore || 0,
                awayScore: match.awayScore || 0,
                status: match.status,
                startTime: match.startTime,
                venue: match.venue,
                competition: match.competition,
                sport: 'Basketball',
                matchType: 'competition',
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                events: [],
                stats: {
                  possession: [0, 0],
                  shots: [0, 0],
                  shotsOnTarget: [0, 0],
                  corners: [0, 0],
                  fouls: [0, 0],
                  yellowCards: [0, 0],
                  redCards: [0, 0],
                  ...dbStats
                }
              };
            });
            allMatches.push(...basketballMatches);
          }

          if (footballData.success && footballData.matches) {
            const footballMatches = footballData.matches.map((match: any) => {
              let dbStats = {};
              try {
                dbStats = typeof match.stats === 'string' ? JSON.parse(match.stats) : (match.stats || {});
              } catch (e) {
                console.error('Error parsing match stats:', e);
              }

              return {
                id: match.id,
                homeTeamId: match.homeTeamId,
                awayTeamId: match.awayTeamId,
                homeScore: match.homeScore || 0,
                awayScore: match.awayScore || 0,
                status: match.status,
                startTime: match.startTime,
                venue: match.venue,
                competition: match.competition,
                sport: 'Football',
                matchType: 'competition',
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                events: [],
                stats: dbStats
              };
            });
            allMatches.push(...footballMatches);
          }

          setMatches(allMatches);

          // Show notification
          addNotification({
            title: 'Match Started!',
            message: `A match is now LIVE`,
            type: 'info'
          });
        } catch (error) {
          console.error('Error refreshing matches:', error);
        }
      };

      fetchMatches();
    };

    // Listen for custom event from logger
    window.addEventListener('MATCH_STATUS_CHANGE', handleMatchStatusChange);

    return () => {
      window.removeEventListener('MATCH_STATUS_CHANGE', handleMatchStatusChange);
    };
  }, [addNotification]);

  // Check for existing auth on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    addNotification({
      title: 'Logged Out',
      message: 'You have been successfully logged out',
      type: 'info'
    });
  };

  // Handle successful login
  const handleAuthSuccess = (userData: any) => {
    setUser(userData);
    addNotification({
      title: 'Welcome!',
      message: `Logged in as ${userData.name}`,
      type: 'info'
    });
  };

  // Enhanced filtering logic
  const filteredMatches = matches.filter(m => {
    // Sport filter
    if (activeSport !== 'ALL') {
      const sportMatch = activeSport === 'FOOTBALL' ? m.sport === 'Football' :
        activeSport === 'BASKETBALL' ? m.sport === 'Basketball' : true;
      if (!sportMatch) return false;
    }

    // Status filter
    if (activeTab !== 'ALL') {
      if (activeTab === 'FAVORITES') {
        const isFavorite = favoriteTeams.includes(m.homeTeamId) || favoriteTeams.includes(m.awayTeamId);
        if (!isFavorite) return false;
      } else if (m.status !== activeTab) {
        return false;
      }
    }

    // Date filter - only apply if a date is selected
    if (selectedDate) {
      const matchDate = new Date(m.startTime);
      if (!isSameDay(matchDate, selectedDate)) {
        return false;
      }
    }

    return true;
  });

  // Sort matches by start time in reverse chronological order (most recent first)
  const sortedMatches = [...filteredMatches].sort((a, b) =>
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  // Group matches by round (for basketball) or date (for other sports)
  const groupedMatches = sortedMatches.reduce((groups: any, match: any) => {
    let groupKey: string = '';

    if (match.sport === 'Basketball') {
      let roundNum: number | undefined;
      try {
        // Try to get round from stats
        const stats = typeof match.stats === 'string' ? JSON.parse(match.stats) : match.stats;
        roundNum = stats?.round;
      } catch (e) { }

      if (!roundNum || isNaN(roundNum) || roundNum > 100 || roundNum < 1) {
        // Fallback to date-based calculation
        const matchDate = new Date(match.startTime);

        // Handle 2026 Playoffs explicitly
        if (matchDate.getFullYear() === 2026 && matchDate.getMonth() === 0) { // Jan 2026
          const d = matchDate.getDate();
          if (d === 7) { groupKey = "Semi-Finals Game 1"; }
          else if (d === 11) { groupKey = "Semi-Finals Game 2"; }
          else if (d === 14) { groupKey = "Semi-Finals Game 3"; }
          else { groupKey = "Playoffs"; }

          // Ensure existing logic skips
          roundNum = undefined;
        } else if (!isNaN(matchDate.getTime())) {
          const startDate = new Date('2025-01-15'); // Tournament start date
          const daysDiff = Math.floor((matchDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const calcRound = Math.floor(daysDiff / 7) + 1;
          if (calcRound > 0 && calcRound < 20) { // Limit to 20 rounds to avoid 52
            roundNum = calcRound;
          }
        }
      }

      if (groupKey) {
        // already set
      } else if (roundNum) {
        groupKey = `Round ${roundNum}`;
      } else {
        // Ultimate fallback: Use date
        groupKey = new Date(match.startTime).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
      }
    } else {
      // For other sports, group by date
      groupKey = new Date(match.startTime).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(match);
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          {/* Main Nav Bar */}
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center font-display text-lg -skew-x-12 text-black">B</div>
                <span className="font-display text-xl tracking-tight hidden sm:block">BRIXSPORT</span>
              </Link>

              {/* Desktop Links */}
              <div className="hidden md:flex items-center gap-1">
                <Link href="/teams" className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-primary hover:bg-white/5 rounded transition-colors">
                  Teams
                </Link>
                <Link href="/lineups" className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-primary hover:bg-white/5 rounded transition-colors relative">
                  Lineup Builder
                  <span className="absolute -top-1 -right-1 bg-primary text-black text-[8px] font-black px-1 rounded">NEW</span>
                </Link>
                <Link href="/news" className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-primary hover:bg-white/5 rounded transition-colors">
                  News
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <Search size={18} className="text-white/60" />
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors relative"
              >
                <Bell size={18} className="text-white/60" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full"></span>
                )}
              </button>
              <div className="hidden sm:flex items-center gap-2">
                {user ? (
                  <button
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition-all text-xs font-bold uppercase tracking-wider"
                    onClick={() => router.push('/profile')}
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-black text-xs font-bold">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="max-w-[100px] truncate">{user.name}</span>
                  </button>
                ) : (
                  <button
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition-all text-xs font-bold uppercase tracking-wider"
                    onClick={() => router.push('/login')}
                  >
                    <User size={16} />
                    <span>Sign In</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Sport Tabs */}
          <div className="flex items-center gap-1 pb-2 overflow-x-auto scrollbar-hide">
            {['ALL', 'FOOTBALL', 'BASKETBALL'].map((sport) => (
              <button
                key={sport}
                onClick={() => setActiveSport(sport)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activeSport === sport
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-white/40 hover:text-white/60'
                  }`}
              >
                {sport}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-28 pb-12">
        <div className="max-w-7xl mx-auto px-4">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide">
            {['ALL', 'LIVE', 'FINISHED', 'UPCOMING', 'FAVORITES'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activeTab === tab
                  ? 'bg-primary text-black'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {tab === 'LIVE' && <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>}
                {tab}
              </button>
            ))}
          </div>

          {/* Date Filter - SofaScore Style */}
          <div className="mb-6 bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              {/* Left side - Title */}
              <div className="flex items-center gap-3">
                <Calendar size={18} className="text-primary" />
                <h3 className="font-bold text-sm">Matches</h3>
              </div>

              {/* Right side - Date Navigation */}
              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1 w-full sm:w-auto">
                <button
                  onClick={() => setSelectedDate(selectedDate ? addDays(selectedDate, -1) : addDays(new Date(), -1))}
                  className="p-2 hover:bg-white/10 rounded transition-colors"
                  aria-label="Previous day"
                >
                  <ChevronLeft size={18} className="text-white/60" />
                </button>
                <div className="px-3 sm:px-4 text-xs sm:text-sm font-semibold text-white min-w-[100px] sm:min-w-[120px] text-center">
                  {selectedDate ? format(selectedDate, 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy')}
                </div>
                <button
                  onClick={() => setSelectedDate(selectedDate ? addDays(selectedDate, 1) : addDays(new Date(), 1))}
                  className="p-2 hover:bg-white/10 rounded transition-colors"
                  aria-label="Next day"
                >
                  <ChevronRight size={18} className="text-white/60" />
                </button>
              </div>
            </div>
          </div>

          {/* Football Hub Banner */}
          {activeSport === 'FOOTBALL' && (
            <Link href="/football">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 bg-gradient-to-r from-green-600/20 to-green-400/20 border border-green-500/20 rounded-2xl p-4 hover:border-green-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                      <Trophy size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg flex items-center gap-2 text-white">
                        BUSA LEAGUE FOOTBALL
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/20">OFFICIAL HUB</span>
                      </h3>
                      <p className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
                        View standings, stats leaders, teams, and player profiles
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/5 p-2 rounded-full group-hover:bg-white/10 transition-colors">
                    <ChevronRight size={20} className="text-white/40 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </motion.div>
            </Link>
          )}

          {/* Basketball Hub Banner */}
          {activeSport === 'BASKETBALL' && (
            <Link href="/basketball">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 bg-gradient-to-r from-orange-600/20 to-orange-400/20 border border-orange-500/20 rounded-2xl p-4 hover:border-orange-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                      <Trophy size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg flex items-center gap-2 text-white">
                        BUSA LEAGUE BASKETBALL
                        <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20">OFFICIAL HUB</span>
                      </h3>
                      <p className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
                        View standings, stats leaders, teams, and player profiles
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/5 p-2 rounded-full group-hover:bg-white/10 transition-colors">
                    <ChevronRight size={20} className="text-white/40 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </motion.div>
            </Link>
          )}

          {/* Live Now Section */}
          <div className="mb-8">
            <LiveNowSection />
          </div>

          {/* Live Center Button */}
          {matches.filter(m => m.status === 'LIVE').length > 0 && (
            <Link href="/live">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 bg-gradient-to-r from-red-500/10 to-primary/10 border border-red-500/20 rounded-2xl p-4 hover:border-red-500/40 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                      <Play size={20} className="text-red-500 fill-red-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        LIVE CENTER
                      </h3>
                      <p className="text-xs text-white/60">
                        {matches.filter(m => m.status === 'LIVE').length} matches live now
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-white/40 group-hover:text-primary transition-colors" />
                </div>
              </motion.div>
            </Link>
          )}

          {/* Matches by Date */}
          {Object.keys(groupedMatches).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(groupedMatches).map(([date, dateMatches]: [string, any]) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <Calendar size={16} className="text-white/40" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">{date}</h2>
                    {/* Show actual date for basketball rounds */}
                    {date.startsWith('Round') && dateMatches.length > 0 && (
                      <span className="text-xs text-white/40">
                        {new Date(dateMatches[0].startTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    )}
                    <div className="flex-1 h-px bg-white/5"></div>
                  </div>

                  {/* Matches */}
                  <div className="space-y-2">
                    {dateMatches.map((match: Match) => (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => setSelectedMatch(match)}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 rounded-xl p-4 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          {/* Teams */}
                          <div className="flex-1 space-y-2">
                            {/* Home Team */}
                            <div className="flex items-center gap-3">
                              {isValidImagePath(match.homeTeam?.logo) ? (
                                <div className="w-8 h-8 relative rounded overflow-hidden bg-white/5">
                                  <Image
                                    src={match.homeTeam!.logo}
                                    alt={match.homeTeam!.name}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center text-xs font-bold">
                                  {match.homeTeam?.shortName || 'H'}
                                </div>
                              )}
                              <span className="font-semibold text-sm">
                                {match.homeTeam?.name || 'Home Team'}
                              </span>
                              {match.status !== 'UPCOMING' && (
                                <span className={`ml-auto text-lg font-bold ${match.homeScore > match.awayScore ? 'text-primary' : 'text-white/40'}`}>
                                  {match.homeScore}
                                </span>
                              )}
                            </div>

                            {/* Away Team */}
                            <div className="flex items-center gap-3">
                              {isValidImagePath(match.awayTeam?.logo) ? (
                                <div className="w-8 h-8 relative rounded overflow-hidden bg-white/5">
                                  <Image
                                    src={match.awayTeam!.logo}
                                    alt={match.awayTeam!.name}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center text-xs font-bold">
                                  {match.awayTeam?.shortName || 'A'}
                                </div>
                              )}
                              <span className="font-semibold text-sm">
                                {match.awayTeam?.name || 'Away Team'}
                              </span>
                              {match.status !== 'UPCOMING' && (
                                <span className={`ml-auto text-lg font-bold ${match.awayScore > match.homeScore ? 'text-primary' : 'text-white/40'}`}>
                                  {match.awayScore}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Status */}
                          <div className="ml-4 text-right">
                            {match.isStreaming && (
                              <div className="mb-2 inline-flex items-center gap-1 bg-red-600/20 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse border border-red-500/20">
                                <span>●</span> LIVE STREAM
                              </div>
                            )}
                            {match.status === 'LIVE' && (
                              <div className="flex items-center gap-1.5 text-red-500 text-xs font-bold mb-1">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                LIVE
                              </div>
                            )}
                            {match.status === 'UPCOMING' && (
                              <div className="text-xs text-white/60">
                                {new Date(match.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                            {match.status === 'FINISHED' && (
                              <div className="text-xs text-white/40 font-bold">
                                FT
                              </div>
                            )}
                            <div className="text-xs text-white/40 mt-1">
                              {match.competition}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <Trophy size={48} className="mx-auto text-white/10 mb-4" />
              <p className="text-white/40 font-bold">No matches found</p>
              <p className="text-white/20 text-sm mt-2">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </main>

      {/* Overlays */}
      <AnimatePresence>
        {selectedMatch && (
          selectedMatch.sport === 'Basketball' ? (
            <BasketballMatchOverlay
              match={selectedMatch}
              onClose={() => setSelectedMatch(null)}
              onSelectTeam={(team) => {
                setSelectedTeam({ ...team, sport: 'Basketball' });
                setSelectedMatch(null);
              }}
              onSelectPlayer={(player) => {
                setSelectedPlayer({ ...player, sport: 'Basketball' });
                setSelectedMatch(null);
              }}
            />
          ) : (
            <MatchOverlay
              match={selectedMatch}
              onClose={() => setSelectedMatch(null)}
              onSelectPlayer={(player) => {
                setSelectedPlayer({ ...player, sport: 'Football' });
                setSelectedMatch(null);
              }}
            />
          )
        )}
        {selectedPlayer && (
          <PlayerProfileOverlay
            player={selectedPlayer}
            sport={selectedPlayer.sport}
            onClose={() => setSelectedPlayer(null)}
          />
        )}
        {selectedTeam && (
          <TeamProfileOverlay
            team={selectedTeam}
            sport={(selectedTeam as any).sport || 'Football'}
            onClose={() => setSelectedTeam(null)}
            onSelectPlayer={(player) => {
              setSelectedPlayer({ ...player, sport: (selectedTeam as any).sport || 'Football' });
              setSelectedTeam(null);
            }}
          />
        )}
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/98 backdrop-blur-xl flex items-start justify-center pt-20 px-4"
            onClick={() => setIsSearchOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl">
              <GlobalSearch
                autoFocus
                onClose={() => setIsSearchOpen(false)}
              />
            </div>
          </motion.div>
        )}
        {isSettingsOpen && (
          <SettingsOverlay
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </AnimatePresence>

      <NotificationToast
        notifications={notifications}
        onClose={removeNotification}
      />

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black pt-20 px-4 md:hidden"
          >
            <div className="flex flex-col gap-4 text-lg font-display uppercase">
              <Link href="/teams" className="text-white/60 hover:text-white transition-colors" onClick={() => setIsMenuOpen(false)}>Teams</Link>
              <Link href="/lineups" className="text-white/60 hover:text-white transition-colors flex items-center gap-2" onClick={() => setIsMenuOpen(false)}>
                Lineup Builder
                <span className="bg-primary text-black text-[10px] font-black px-2 py-0.5 rounded">NEW</span>
              </Link>
              <Link href="/news" className="text-white/60 hover:text-white transition-colors" onClick={() => setIsMenuOpen(false)}>News</Link>
              <Link href="/transfers" className="text-white/60 hover:text-white transition-colors" onClick={() => setIsMenuOpen(false)}>Transfers</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
