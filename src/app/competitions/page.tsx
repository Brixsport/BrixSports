'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChevronRight, LayoutGrid, ListOrdered, Activity, Loader2, AlertCircle, Calendar, Clock, MapPin, Star, ArrowLeft, Users } from 'lucide-react';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import MatchCalendar from '@/components/MatchCalendar';
import { isSameDay } from 'date-fns';
import { TeamLogo } from '@/lib/utils/team-logo';
import { useFavorites } from '@/hooks/useFavorites';

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

function CompetitionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialComp = searchParams.get('competition');

  const { isFavoriteCompetition, toggleCompetition } = useFavorites();
  const [view, setView] = useState<'standings' | 'matches' | 'brackets'>('standings');
  const [selectedSport, setSelectedSport] = useState<SportType>('All');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [groups, setGroups] = useState<CompetitionGroup[]>([]);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [brackets, setBrackets] = useState<BracketRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // 1. Fetch all competitions on mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/competitions');
        const data = await res.json();

        if (data.competitions) {
          setCompetitions(data.competitions);
          setGroups(data.groups || []);

          let defaultComp = null;
          // Try from URL
          if (initialComp) {
            defaultComp = data.competitions.find((c: Competition) => c.name === initialComp);
          }

          // Fallback to first available (BUSA preferred)
          if (!defaultComp) {
            const busa = data.competitions.find((c: Competition) => c.name.toUpperCase().includes('BUSA'));
            defaultComp = busa || data.competitions[0];
          }

          if (defaultComp) {
            setSelectedComp(defaultComp);
            // If it's a specific sport competition, set that sport
            if (defaultComp.sport) {
              setSelectedSport(defaultComp.sport as SportType);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching competitions:', err);
        setError('Failed to load competitions');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // 2. When selectedComp changes, fetch data
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
          return;
        }

        // Fetch Standings
        const standingsRes = await fetch(`/api/${fetchSport.toLowerCase()}/standings?competitionId=${selectedComp.id}&competition=${encodeURIComponent(selectedComp.name)}`);
        const sData = await standingsRes.json();
        if (sData.success) setStandings(sData.standings || []);
        else setStandings([]);

        // Fetch Matches
        const matchesRes = await fetch(`/api/${fetchSport.toLowerCase()}/matches?competitionId=${selectedComp.id}&competition=${encodeURIComponent(selectedComp.name)}`);
        const mData = await matchesRes.json();
        if (mData.success && mData.matches) {
          setMatches(mData.matches);
        } else {
          setMatches([]);
        }

        // Fetch Brackets
        const bracketRes = await fetch(`/api/brackets?competitionId=${selectedComp.id}&competition=${encodeURIComponent(selectedComp.name)}&sport=${fetchSport}`);
        const bData = await bracketRes.json();
        if (bData.rounds) setBrackets(bData.rounds);
        else setBrackets([]);

      } catch (err) {
        console.error('Error fetching details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [selectedComp, selectedSport]);

  // Filter competitions for the current sport tab
  const filteredCompetitions = selectedSport === 'All'
    ? competitions
    : competitions.filter(c => c.isMultiSport || c.sport === selectedSport);

  // BACKLOG-229: one pill per competition series (deduped across seasons),
  // not one per raw row -- avoids showing e.g. 3 identical "BUSA League
  // Football" pills for 3 season-instances with no way to tell them apart.
  const filteredGroups = selectedSport === 'All'
    ? groups
    : groups.filter(g => g.latest.isMultiSport || g.sport === selectedSport);

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

  const renderStandingsTable = (rows: Standing[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Pos</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Team</th>
            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">P</th>
            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">W</th>
            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">{selectedSport === 'Basketball' ? 'L' : 'D'}</th>
            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">{selectedSport === 'Basketball' ? 'PCT' : 'L'}</th>
            <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">GD/DIFF</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-primary text-center">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id}
              className="border-b border-white/5 hover:bg-white/5 transition-colors group"
            >
              <td className="px-6 py-4">
                <span className={`text-lg font-display italic ${idx < 3 ? 'text-primary' : 'text-white/20'}`}>
                  {idx + 1}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 relative flex-shrink-0 bg-white/5 rounded-lg p-1 flex items-center justify-center">
                    <TeamLogo logo={row.team.logo} name={row.team.name} size="sm" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black uppercase tracking-tight truncate">{row.team.name}</p>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{row.team.university}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-center font-bold text-white/80">{row.played}</td>
              <td className="px-4 py-4 text-center font-bold text-primary">{row.won}</td>
              <td className="px-4 py-4 text-center font-bold text-white/60">{selectedSport === 'Basketball' ? row.lost : row.drawn}</td>
              <td className="px-4 py-4 text-center font-bold text-white/40">{selectedSport === 'Basketball' ? ((row.won / (row.played || 1)) * 100).toFixed(0) + '%' : row.lost}</td>
              <td className="px-4 py-4 text-center font-bold text-white/40">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
              <td className="px-6 py-4 text-center">
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg font-display italic text-lg border border-primary/20">
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

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-12">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-12">
        <header className="space-y-6 md:space-y-8 border-b border-white/5 pb-8">
          {/* Identity row: back + logo/name/filter block (left) -- star (end) */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                aria-label="Back"
                className="shrink-0 p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white"
              >
                <ArrowLeft size={20} />
              </button>
              {selectedComp?.logo && (
                <div className="w-14 h-14 md:w-20 md:h-20 shrink-0 bg-white/5 rounded-2xl border border-white/10 p-2 flex items-center justify-center">
                  <TeamLogo logo={selectedComp.logo} name={selectedComp.name} size="lg" />
                </div>
              )}
              <div className="text-left">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy size={14} className="text-primary" />
                  {selectedGroup && selectedGroup.seasons.length > 1 ? (
                    <select
                      value={selectedComp?.id || ''}
                      onChange={(e) => {
                        const chosen = selectedGroup.seasons.find(s => s.id === e.target.value);
                        if (chosen) setSelectedComp(chosen);
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-white/60 bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 focus:outline-none focus:border-primary/50"
                    >
                      {selectedGroup.seasons.map((s) => (
                        <option key={s.id} value={s.id}>{s.season || 'Unknown Season'}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                      {selectedComp?.season || 'Current Season'}
                    </span>
                  )}
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    • {selectedComp?.status || 'Active'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="font-display text-2xl md:text-5xl tracking-tighter italic uppercase leading-none">
                    {selectedComp?.name || 'Competition Viewer'}
                  </h1>
                </div>
                {!!selectedComp?.numberOfTeams && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 bg-primary/10 border border-primary/20 rounded-lg">
                    <Users size={12} className="text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                      {selectedComp.numberOfTeams} Teams Registered
                    </span>
                  </div>
                )}
                <p className="text-white/60 text-sm max-w-xl">
                  {selectedComp?.description || `Managing standings, fixtures, and results for ${selectedComp?.name || 'this competition'}.`}
                </p>
              </div>
            </div>

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

          {/* View Toggle */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto">
            <button
              onClick={() => setView('standings')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${view === 'standings' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
            >
              <ListOrdered size={14} />
              <span>Standings</span>
            </button>
            <button
              onClick={() => setView('matches')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${view === 'matches' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
            >
              <Calendar size={14} />
              <span>Matches</span>
            </button>
            <button
              onClick={() => setView('brackets')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${view === 'brackets' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
            >
              <LayoutGrid size={14} />
              <span>Brackets</span>
            </button>
          </div>
        </header>

        {/* Sport & Competition Selector */}
        <div className="space-y-4 md:space-y-6">
          <div className="flex justify-center overflow-x-auto">
            <div className="inline-flex bg-white/5 p-1 rounded-2xl border border-white/10 gap-1">
              {(['All', 'Football', 'Basketball', 'Track'] as SportType[]).map((sport) => (
                <button
                  key={sport}
                  onClick={() => {
                    setSelectedSport(sport);
                    const firstGroupForSport = sport === 'All'
                      ? groups[0]
                      : groups.find(g => g.sport === sport);
                    if (firstGroupForSport) setSelectedComp(firstGroupForSport.latest);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedSport === sport ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
                >
                  <Activity size={12} />
                  {sport}
                </button>
              ))}
            </div>
          </div>

          {filteredGroups.length > 0 && (
            <div className="flex justify-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {filteredGroups.map((group) => (
                <button
                  key={group.groupKey}
                  onClick={() => {
                    setSelectedComp(group.latest);
                    if (group.sport && group.sport !== selectedSport) {
                      setSelectedSport(group.sport as SportType);
                    }
                  }}
                  className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border ${selectedGroup?.groupKey === group.groupKey ? 'border-primary text-primary bg-primary/10' : 'border-white/10 text-white/40 hover:text-white'}`}
                >
                  {group.name}
                </button>
              ))}
            </div>
          )}
        </div>

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
              {/* Fixtures Calendar / Date Picker */}
              {matches.length > 0 && (
                <MatchCalendar
                  fixtures={matches}
                  selectedDate={selectedDate || new Date(matches[0].startTime)}
                  onDateSelect={(date) => setSelectedDate(date)}
                />
              )}

              {/* Optional: Info about current filter */}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matches
                    .filter((match) =>
                      selectedDate
                        ? isSameDay(new Date(match.startTime), selectedDate)
                        : true
                    )
                    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                    .map((match) => (
                    <div key={match.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-primary/30 transition-all">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-widest">
                          <Calendar size={12} />
                          <span>{new Date(match.startTime).toLocaleDateString()}</span>
                          <span className="w-1 h-1 bg-white/20 rounded-full" />
                          <Clock size={12} />
                          <span>{new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black ${match.status === 'LIVE' ? 'bg-red-500 animate-pulse' : match.status === 'FINISHED' ? 'bg-white/10 text-white/40' : 'bg-primary/20 text-primary'}`}>
                          {match.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="text-right flex-1">
                            <p className="font-bold text-sm uppercase truncate">{match.homeTeam?.name || 'Home'}</p>
                          </div>
                          <div className="w-10 h-10 bg-white/5 rounded-lg p-1 flex items-center justify-center">
                            <TeamLogo logo={match.homeTeam?.logo} name={match.homeTeam?.name ?? ''} size="sm" />
                          </div>
                        </div>

                        <div className="px-4 text-center">
                          <div className="bg-white/5 px-4 py-1 rounded-lg border border-white/10">
                            <span className="font-display italic text-xl">
                              {match.homeScore} - {match.awayScore}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-white/5 rounded-lg p-1 flex items-center justify-center">
                            <TeamLogo logo={match.awayTeam?.logo} name={match.awayTeam?.name ?? ''} size="sm" />
                          </div>
                          <div className="text-left flex-1">
                            <p className="font-bold text-sm uppercase truncate">{match.awayTeam?.name || 'Away'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-widest">
                        <MapPin size={12} />
                        <span>{match.venue || 'TBD'}</span>
                      </div>
                    </div>
                  ))}
                </div>
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
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function CompetitionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    }>
      <CompetitionsContent />
    </Suspense>
  );
}
