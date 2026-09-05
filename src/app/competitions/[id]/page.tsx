'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, ListOrdered, Loader2, AlertCircle, Calendar, Star, ArrowLeft, Users, BarChart3 } from 'lucide-react';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MatchCalendar from '@/components/MatchCalendar';
import { isSameDay } from 'date-fns';
import { TeamLogo } from '@/lib/utils/team-logo';
import { useFavorites } from '@/hooks/useFavorites';
import { PlayerProfileOverlay } from '@/components/PlayerProfileOverlay';
import { TeamProfileOverlay } from '@/components/TeamProfileOverlay';

type SportType = 'All' | 'Football' | 'Basketball' | 'Track';

interface Competition {
  id: string;
  name: string;
  sport: SportType | null;
  isMultiSport?: boolean;
  season?: string;
  status?: string;
  description?: string;
  logo?: string | null;
  numberOfTeams?: number | null;
}

// BACKLOG-229: mirrors api/competitions' own buildCompetitionGroups() shape --
// one entry per competition "series" (same name/sport/host org across seasons),
// `seasons` sorted newest-first. Known fragility inherited as-is: grouping is
// exact-name-string matching, not a real FK-based series concept (flagged in
// the standings/comp-stats audit, session 53) -- a differently-worded name for
// a new season silently won't link up here either.
interface CompetitionGroup {
  groupKey: string;
  name: string;
  sport: SportType | null;
  latest: Competition;
  seasons: Competition[];
}

interface Standing {
  id: string;
  teamId: string;
  team: {
    name: string;
    shortName: string;
    logo: string;
    university: string;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  groupName?: string | null;
}

interface Match {
  id: string;
  homeTeam: { name: string; shortName: string; logo: string };
  awayTeam: { name: string; shortName: string; logo: string };
  homeScore: number;
  awayScore: number;
  startTime: string;
  status: string;
  venue: string;
  competition: string;
  round?: string | null;
}

interface BracketNode {
  id: string;
  title: string;
  status: string;
  homeTeam: any;
  awayTeam: any;
  homeScore: number;
  awayScore: number;
}

interface BracketRound {
  round: string;
  matches: BracketNode[];
}

interface StatLeader {
  rank: number;
  player: { id: string; name: string; number: number | null; image: string | null };
  team: { name: string } | null;
  highlightedStat: number;
}

interface CompTeam {
  id: string;
  name: string;
  shortName: string;
  logo: string | null;
  playerCount?: number;
}

interface CompPlayer {
  id: string;
  name: string;
  number: number | null;
  position: string;
  rating: number | null;
  team?: { id: string; shortName: string; logo: string | null; sport?: string } | null;
}

// Sport-appropriate leaderboard categories -- football's Goals/Assists/Yellow
// Cards match the Figma Stats-tab reference directly; basketball has no such
// reference, so this uses its own real stat categories (Points/Rebounds/
// Assists) from the same /api/players/stats/leaders endpoint rather than
// forcing football's categories onto a sport they don't apply to.
const STAT_CATEGORIES: Record<string, { type: string; label: string }[]> = {
  Football: [
    { type: 'goals', label: 'Goals' },
    { type: 'assists', label: 'Assists' },
    { type: 'yellowCards', label: 'Yellow Cards' },
  ],
  Basketball: [
    { type: 'points', label: 'Points' },
    { type: 'rebounds', label: 'Rebounds' },
    { type: 'assists', label: 'Assists' },
  ],
};

type ViewTab = 'standings' | 'matches' | 'brackets' | 'stats';
const VALID_TABS: ViewTab[] = ['standings', 'matches', 'brackets', 'stats'];

function CompetitionHubContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const competitionId = params.id as string;

  const { isFavoriteCompetition, toggleCompetition } = useFavorites();
  const tabParam = searchParams.get('tab') as ViewTab | null;
  const [view, setViewState] = useState<ViewTab>(VALID_TABS.includes(tabParam as ViewTab) ? (tabParam as ViewTab) : 'standings');
  // Tabs are URL-addressable (?tab=standings|matches|brackets|stats) so each
  // is deep-linkable/shareable, matching how Figma treats them as distinct
  // screens rather than pure client state.
  const setView = (tab: ViewTab) => {
    setViewState(tab);
    router.replace(`/competitions/${competitionId}?tab=${tab}`, { scroll: false });
  };
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [groups, setGroups] = useState<CompetitionGroup[]>([]);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [brackets, setBrackets] = useState<BracketRound[]>([]);
  const [statsLeaders, setStatsLeaders] = useState<Record<string, StatLeader[]>>({});
  const [selectedTeam, setSelectedTeam] = useState<CompTeam | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<CompPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // 1. Fetch all competitions on mount, select the one this route was opened for
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/competitions');
        const data = await res.json();

        if (data.competitions) {
          setCompetitions(data.competitions);
          setGroups(data.groups || []);

          const found = data.competitions.find((c: Competition) => c.id === competitionId);
          if (found) {
            setSelectedComp(found);
          } else {
            setNotFound(true);
          }
        }
      } catch (err) {
        console.error('Error fetching competitions:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [competitionId]);

  // 2. When selectedComp changes, fetch its standings/matches/brackets
  useEffect(() => {
    if (!selectedComp) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);

        // BACKLOG-287: the selected SPORT TAB (All/Football/Basketball/Track) is
        // a filter, not necessarily a real sport with its own /api/<sport>/* route
        // -- only Football and Basketball do. The selected COMPETITION always has
        // a concrete sport (or none, if multi-sport), so resolve the fetch endpoint
        // from that instead of the tab value to avoid ever hitting /api/all/* or
        // /api/track/*, which don't exist.
        const fetchSport = selectedComp.sport;
        if (!fetchSport) {
          setStandings([]);
          setMatches([]);
          setBrackets([]);
          setStatsLeaders({});
          return;
        }

        const standingsRes = await fetch(`/api/${fetchSport.toLowerCase()}/standings?competitionId=${selectedComp.id}&competition=${encodeURIComponent(selectedComp.name)}`);
        const sData = await standingsRes.json();
        if (sData.success) setStandings(sData.standings || []);
        else setStandings([]);

        const matchesRes = await fetch(`/api/${fetchSport.toLowerCase()}/matches?competitionId=${selectedComp.id}&competition=${encodeURIComponent(selectedComp.name)}`);
        const mData = await matchesRes.json();
        if (mData.success && mData.matches) {
          setMatches(mData.matches);
        } else {
          setMatches([]);
        }

        const bracketRes = await fetch(`/api/brackets?competitionId=${selectedComp.id}&competition=${encodeURIComponent(selectedComp.name)}&sport=${fetchSport}`);
        const bData = await bracketRes.json();
        if (bData.rounds) setBrackets(bData.rounds);
        else setBrackets([]);

        // Stats tab leaderboards -- competition-scoped from the start (the
        // endpoint already supports competitionId; the global-fetch bug
        // BACKLOG-290 flagged was in /football/page.tsx's calling code, not
        // this endpoint, so this avoids that bug rather than carrying it in).
        const categories = STAT_CATEGORIES[fetchSport] || [];
        const statsResults = await Promise.all(
          categories.map((cat) =>
            fetch(`/api/players/stats/leaders?type=${cat.type}&competitionId=${selectedComp.id}&competition=${encodeURIComponent(selectedComp.name)}&sport=${fetchSport}&limit=5`)
              .then((r) => r.json())
              .catch(() => ({ leaders: [] }))
          )
        );
        const nextStats: Record<string, StatLeader[]> = {};
        categories.forEach((cat, i) => {
          nextStats[cat.type] = statsResults[i]?.leaders || [];
        });
        setStatsLeaders(nextStats);

      } catch (err) {
        console.error('Error fetching details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [selectedComp]);

  const selectedGroup = selectedComp
    ? groups.find(g => g.seasons.some(s => s.id === selectedComp.id))
    : undefined;

  // Group-stage competitions carry a `groupName` on each standings row (e.g.
  // "Group A") until the draw completes; everything else has it null. Only
  // split into per-group tables when the data actually has >1 distinct group
  // -- otherwise render the familiar single flat table.
  const standingsGroups = useMemo(() => {
    const distinctGroups = Array.from(new Set(standings.map(s => s.groupName).filter(Boolean))) as string[];
    if (distinctGroups.length < 2) {
      return [{ groupName: null as string | null, rows: standings }];
    }
    return distinctGroups.sort().map(groupName => ({
      groupName,
      rows: standings.filter(s => s.groupName === groupName),
    }));
  }, [standings]);

  // Pos+Team are merged into one sticky first column so they stay visible
  // while P/W/D/L/GD/PTS scroll underneath on narrow viewports -- otherwise
  // the whole table scrolls together and you lose track of which row is
  // which team. Sticky cells need a solid (non-transparent) background so
  // scrolled content doesn't show through underneath them.
  const renderStandingsTable = (rows: Standing[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[420px]">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="sticky left-0 z-10 bg-[#0c0c0e] px-3 py-3 text-[9px] font-black uppercase tracking-widest text-white/40">Team</th>
            <th className="px-2 py-3 text-[9px] font-black uppercase tracking-widest text-white/40 text-center">P</th>
            <th className="px-2 py-3 text-[9px] font-black uppercase tracking-widest text-white/40 text-center">W</th>
            <th className="px-2 py-3 text-[9px] font-black uppercase tracking-widest text-white/40 text-center">{selectedComp?.sport === 'Basketball' ? 'L' : 'D'}</th>
            <th className="px-2 py-3 text-[9px] font-black uppercase tracking-widest text-white/40 text-center">{selectedComp?.sport === 'Basketball' ? 'PCT' : 'L'}</th>
            <th className="px-2 py-3 text-[9px] font-black uppercase tracking-widest text-white/40 text-center">GD</th>
            <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-primary text-center">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id}
              onClick={() => setSelectedTeam({ id: row.teamId, name: row.team.name, shortName: row.team.shortName, logo: row.team.logo })}
              className="border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer"
            >
              <td className="sticky left-0 z-10 bg-[#0c0c0e] group-hover:bg-[#151517] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-display italic w-4 shrink-0 text-right ${idx < 3 ? 'text-primary' : 'text-white/20'}`}>
                    {idx + 1}
                  </span>
                  <div className="w-8 h-8 relative flex-shrink-0 bg-white/5 rounded-lg p-1 flex items-center justify-center">
                    <TeamLogo logo={row.team.logo} name={row.team.name} size="sm" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-tight truncate max-w-[130px]">{row.team.name}</p>
                  </div>
                </div>
              </td>
              <td className="px-2 py-2.5 text-center text-xs font-bold text-white/80">{row.played}</td>
              <td className="px-2 py-2.5 text-center text-xs font-bold text-primary">{row.won}</td>
              <td className="px-2 py-2.5 text-center text-xs font-bold text-white/60">{selectedComp?.sport === 'Basketball' ? row.lost : row.drawn}</td>
              <td className="px-2 py-2.5 text-center text-xs font-bold text-white/40">{selectedComp?.sport === 'Basketball' ? ((row.won / (row.played || 1)) * 100).toFixed(0) + '%' : row.lost}</td>
              <td className="px-2 py-2.5 text-center text-xs font-bold text-white/40">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
              <td className="px-3 py-2.5 text-center">
                <span className="bg-primary/10 text-primary px-2 py-1 rounded-lg font-display italic text-sm border border-primary/20">
                  {row.points}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading && competitions.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 font-black uppercase tracking-widest text-sm mb-4">Competition not found</p>
          <button
            onClick={() => router.push('/competitions')}
            className="text-primary text-sm font-bold uppercase tracking-widest hover:underline"
          >
            Back to Competitions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-12">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-12">
        <header className="space-y-4 border-b border-white/5 pb-8">
          {/* Utility row: back -- star. Own row, present on every tab (Figma's
              own Standings-tab frame vs Stats-tab frame disagree on this --
              back+star share a row on Standings, star floats alone with no
              back arrow at all on Stats. Splitting it out like this keeps
              back navigation reachable from every tab, which either frame
              alone would break.) */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="shrink-0 p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            >
              <ArrowLeft size={20} />
            </button>
            {selectedComp && (
              <button
                onClick={() => toggleCompetition(selectedComp.id)}
                aria-label={isFavoriteCompetition(selectedComp.id) ? 'Remove from favourites' : 'Add to favourites'}
                className="shrink-0 p-2 -mr-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <Star
                  size={20}
                  className={isFavoriteCompetition(selectedComp.id) ? 'text-primary fill-primary' : 'text-white/40'}
                />
              </button>
            )}
          </div>

          {/* Identity block: logo + name, then season/status line, then badge --
              no description paragraph, no boxed background behind the logo,
              matching both Figma reference frames. */}
          <div className="flex items-start gap-4">
            {selectedComp && (
              <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 flex items-center justify-center">
                <TeamLogo logo={selectedComp.logo} name={selectedComp.name} size="lg" />
              </div>
            )}
            <div className="text-left">
              <h1 className="font-display text-2xl md:text-4xl tracking-tighter italic uppercase leading-none mb-2">
                {selectedComp?.name || 'Competition Viewer'}
              </h1>
              <div className="flex items-center gap-2 mb-2">
                {selectedGroup && selectedGroup.seasons.length > 1 ? (
                  <select
                    value={selectedComp?.id || ''}
                    onChange={(e) => {
                      const chosen = selectedGroup.seasons.find(s => s.id === e.target.value);
                      if (chosen) router.push(`/competitions/${chosen.id}`);
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-white/60 bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 focus:outline-none focus:border-primary/50"
                  >
                    {selectedGroup.seasons.map((s) => (
                      <option key={s.id} value={s.id}>{s.season || 'Unknown Season'}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    {selectedComp?.season || 'Current Season'} • {selectedComp?.status || 'Active'}
                  </span>
                )}
              </div>
              {!!selectedComp?.numberOfTeams && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-lg">
                  <Users size={12} className="text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                    {selectedComp.numberOfTeams} Teams Registered
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* View Toggle -- flex-1 per tab so all 4 always fit the row width,
              no horizontal scroll (Figma shows all 4 fitting on one line). */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setView('standings')}
              className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'standings' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
            >
              <ListOrdered size={14} className="shrink-0" />
              <span className="truncate">Standings</span>
            </button>
            <button
              onClick={() => setView('matches')}
              className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'matches' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
            >
              <Calendar size={14} className="shrink-0" />
              <span className="truncate">Matches</span>
            </button>
            <button
              onClick={() => setView('brackets')}
              className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'brackets' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
            >
              <LayoutGrid size={14} className="shrink-0" />
              <span className="truncate">Brackets</span>
            </button>
            <button
              onClick={() => setView('stats')}
              className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'stats' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
            >
              <BarChart3 size={14} className="shrink-0" />
              <span className="truncate">Stats</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {view === 'standings' && (
            <motion.div
              key="standings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={standingsGroups.length > 1 ? 'space-y-8' : 'bg-white/5 border border-white/10 rounded-[40px] overflow-hidden'}
            >
              {standings.length > 0 ? (
                standingsGroups.length > 1 ? (
                  standingsGroups.map(({ groupName, rows }) => (
                    <div key={groupName} className="space-y-3">
                      <h3 className="px-2 font-display text-lg italic uppercase tracking-widest text-primary">{groupName}</h3>
                      <div className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
                        {renderStandingsTable(rows)}
                      </div>
                    </div>
                  ))
                ) : (
                  renderStandingsTable(standingsGroups[0].rows)
                )
              ) : (
                <div className="p-24 text-center">
                  <AlertCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/20 font-black uppercase tracking-widest text-xs italic">No standings data available</p>
                </div>
              )}
            </motion.div>
          )}

          {view === 'matches' && (
            <motion.div
              key="matches"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {matches.length > 0 && (
                <MatchCalendar
                  fixtures={matches}
                  selectedDate={selectedDate || new Date(matches[0].startTime)}
                  onDateSelect={(date) => setSelectedDate(date)}
                />
              )}

              {selectedDate && (
                <p className="text-xs text-white/50 text-center">
                  Showing fixtures for{' '}
                  {selectedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}{' '}
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="underline text-primary ml-1"
                  >
                    Clear
                  </button>
                </p>
              )}

              {matches.length > 0 ? (
                (() => {
                  // Figma groups matches under a round/stage header ("BUSA LEAGUE
                  // FOOTBALL - SEMI FINALS") rather than a flat grid. `round` is
                  // null for regular non-knockout matches -- those fall into a
                  // single ungrouped "Matches" bucket, so this degrades to
                  // today's flat list exactly when there's no round data.
                  const filtered = matches.filter((match) =>
                    selectedDate ? isSameDay(new Date(match.startTime), selectedDate) : true
                  );
                  const roundOrder: string[] = [];
                  const byRound = new Map<string, Match[]>();
                  filtered
                    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                    .forEach((match) => {
                      const key = match.round || 'Matches';
                      if (!byRound.has(key)) {
                        byRound.set(key, []);
                        roundOrder.push(key);
                      }
                      byRound.get(key)!.push(match);
                    });

                  return (
                    <div className="space-y-4">
                      {roundOrder.map((round) => (
                        <div key={round} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
                            <LayoutGrid size={14} className="text-primary shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-widest truncate">
                              {round === 'Matches' ? (selectedComp?.name || 'Matches') : `${selectedComp?.name || ''} - ${round.replace(/_/g, ' ')}`}
                            </span>
                          </div>
                          <div className="divide-y divide-white/5">
                            {byRound.get(round)!.map((match) => (
                              <div
                                key={match.id}
                                onClick={() => router.push(`/matches/${match.id}`)}
                                className="px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-3">
                                  <TeamLogo logo={match.homeTeam?.logo} name={match.homeTeam?.name ?? ''} size="sm" />
                                  <span className="flex-1 text-sm font-bold truncate">{match.homeTeam?.name || 'Home'}</span>
                                  <div className="flex flex-col items-center shrink-0 px-2">
                                    <span className="text-xs font-display italic text-primary">
                                      {match.status === 'UPCOMING' ? new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `${match.homeScore}-${match.awayScore}`}
                                    </span>
                                    {match.status === 'LIVE' && (
                                      <span className="text-[8px] font-black uppercase tracking-widest text-red-500 animate-pulse">Live</span>
                                    )}
                                  </div>
                                  <span className="flex-1 text-sm font-bold truncate text-right">{match.awayTeam?.name || 'Away'}</span>
                                  <TeamLogo logo={match.awayTeam?.logo} name={match.awayTeam?.name ?? ''} size="sm" />
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-white/30 mt-2 pl-11">
                                  <span className="truncate">{match.venue}</span>
                                  <span className="shrink-0 pl-2">{new Date(match.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div className="p-24 text-center bg-white/5 border border-white/10 rounded-[40px]">
                  <Calendar className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/20 font-black uppercase tracking-widest text-xs italic">No matches scheduled</p>
                </div>
              )}
            </motion.div>
          )}

          {view === 'brackets' && (
            <motion.div
              key="brackets"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {brackets.length > 0 ? (
                <div className="relative overflow-x-auto pb-8">
                  <div className="min-w-[1000px] relative p-8">
                    <div className="flex justify-around items-start gap-12">
                      {brackets.map((round) => (
                        <div key={round.round} className="flex-1 space-y-8">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary text-center mb-12">
                            {round.round.replace('_', ' ')}
                          </h3>
                          <div className="space-y-8">
                            {round.matches.map((match) => (
                              <div key={match.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-primary/30 transition-all">
                                <div className="flex justify-between items-center mb-4">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-white/30">{match.title}</span>
                                  <span className={`text-[8px] px-2 py-0.5 rounded font-black ${match.status === 'LIVE' ? 'bg-red-500 animate-pulse' : 'bg-white/10 text-white/40'}`}>
                                    {match.status}
                                  </span>
                                </div>
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <TeamLogo logo={match.homeTeam?.logo} name={match.homeTeam?.name ?? 'TBD'} size="sm" />
                                      <span className="text-[10px] font-black uppercase text-white/60">{match.homeTeam?.name || 'TBD'}</span>
                                    </div>
                                    <span className="font-display italic text-lg">{match.homeScore ?? '-'}</span>
                                  </div>
                                  <div className="h-px bg-white/5" />
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <TeamLogo logo={match.awayTeam?.logo} name={match.awayTeam?.name ?? 'TBD'} size="sm" />
                                      <span className="text-[10px] font-black uppercase text-white/60">{match.awayTeam?.name || 'TBD'}</span>
                                    </div>
                                    <span className="font-display italic text-lg">{match.awayScore ?? '-'}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-24 px-4 text-center bg-white/5 border border-white/10 rounded-[40px]">
                  <AlertCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/20 font-black uppercase tracking-widest text-xs italic">No bracket data available</p>
                  <p className="text-white/10 text-[10px] mt-2 italic">Knockout stages have not started yet.</p>
                </div>
              )}
            </motion.div>
          )}

          {view === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {(STAT_CATEGORIES[selectedComp?.sport || ''] || []).map((cat) => {
                const leaders = statsLeaders[cat.type] || [];
                return (
                  <div key={cat.type} className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                      <h3 className="text-sm font-black uppercase tracking-widest">{cat.label}</h3>
                      {leaders.length > 0 && (
                        <Link
                          href={`/competitions/${competitionId}/stats/${cat.type}`}
                          className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                        >
                          See all
                        </Link>
                      )}
                    </div>
                    {leaders.length > 0 ? (
                      <div className="divide-y divide-white/5">
                        {leaders.map((leader) => (
                          <div
                            key={leader.player.id}
                            onClick={() => setSelectedPlayer({ id: leader.player.id, name: leader.player.name, number: leader.player.number, position: '', rating: null })}
                            className="flex items-center justify-between px-6 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 shrink-0 rounded-lg bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
                                {leader.player.number ?? '-'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate">{leader.player.name}</p>
                                <p className="text-[10px] text-white/40 uppercase tracking-widest truncate">{leader.team?.name || ''}</p>
                              </div>
                            </div>
                            <span className="text-lg font-display italic text-primary shrink-0">{leader.highlightedStat}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-white/20 font-black uppercase tracking-widest text-center py-8">No data yet</p>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {selectedPlayer && (
        <PlayerProfileOverlay
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          sport={selectedComp?.sport || undefined}
        />
      )}
      {selectedTeam && (
        <TeamProfileOverlay
          team={selectedTeam as any}
          sport={selectedComp?.sport || undefined}
          onClose={() => setSelectedTeam(null)}
          onSelectPlayer={(p) => { setSelectedPlayer(p as any); setSelectedTeam(null); }}
        />
      )}
    </div>
  );
}

export default function CompetitionHubPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    }>
      <CompetitionHubContent />
    </Suspense>
  );
}
