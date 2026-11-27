'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, ListOrdered, Loader2, AlertCircle, Calendar, Star, ArrowLeft, Users, BarChart3 } from 'lucide-react';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MatchCalendar from '@/components/MatchCalendar';
import { isSameDay } from 'date-fns';
import { parseSafeDate, safeToLocale } from '@/lib/safe-date';
import { TeamLogo } from '@/lib/utils/team-logo';
import { useFavorites } from '@/hooks/useFavorites';
import { LoadFailedState } from '@/components/resilience/ReadPathStates';
import BracketView, { type ProjectedPair } from '@/components/competitions/BracketView';
import { editionLabel } from '@/lib/competition-series';
import { deriveBracket, seedPairs, shootoutLabel, type BracketRound as BracketRoundView } from '@/lib/competition-bracket';

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
  structure?: string | null;
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
  shootoutHomeScore?: number | null;
  shootoutAwayScore?: number | null;
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
const TAB_META: Record<ViewTab, { label: string; icon: typeof ListOrdered }> = {
  standings: { label: 'Standings', icon: ListOrdered },
  matches: { label: 'Matches', icon: Calendar },
  brackets: { label: 'Brackets', icon: LayoutGrid },
  stats: { label: 'Stats', icon: BarChart3 },
};

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
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // BACKLOG-471: per-section failure flags so a failed detail fetch shows a retry
  // instead of "No standings data available" / "No matches scheduled".
  const [detailsFailed, setDetailsFailed] = useState({ standings: false, matches: false, brackets: false, stats: false });
  const [detailsKey, setDetailsKey] = useState(0);
  // True from the moment a competition is chosen until its standings, fixtures,
  // bracket and leaders have all settled, so a tab never claims "no data" mid-load.
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // Knockout rounds come from the fixtures themselves, so a bracket shows up as
  // soon as its matches exist; the stored bracket nodes are only a fallback.
  const bracketRounds = useMemo<BracketRoundView[]>(() => {
    const derived = deriveBracket(matches);
    if (derived.length > 0) return derived;
    return brackets.map((round, i) => ({
      label: round.round.replace(/_/g, ' '),
      rank: i,
      matches: round.matches.map((m) => ({
        id: m.id,
        status: m.status,
        startTime: null,
        home: m.homeTeam?.name ? { name: m.homeTeam.name, logo: m.homeTeam.logo } : null,
        away: m.awayTeam?.name ? { name: m.awayTeam.name, logo: m.awayTeam.logo } : null,
        homeScore: typeof m.homeScore === 'number' ? m.homeScore : null,
        awayScore: typeof m.awayScore === 'number' ? m.awayScore : null,
        shootout: null,
      })),
    }));
  }, [matches, brackets]);

  // A swiss-style league sends its top 8 into the quarter-finals: until those
  // fixtures exist, show who would meet whom if the table finished today.
  const projection = useMemo<ProjectedPair[] | null>(() => {
    if (selectedComp?.structure !== 'swiss-top8') return null;
    if (bracketRounds.some((r) => r.matches.length > 0)) return null;
    if (standings.length < 8) return null;
    return seedPairs(8).map((p) => ({
      homeSeed: p.homeSeed,
      awaySeed: p.awaySeed,
      home: standings[p.homeSeed - 1]?.team ?? null,
      away: standings[p.awaySeed - 1]?.team ?? null,
    }));
  }, [selectedComp, bracketRounds, standings]);

  const hasBracket = bracketRounds.length > 0 || projection !== null;
  const visibleTabs = VALID_TABS.filter((t) => t !== 'brackets' || hasBracket || detailsLoading);

  // The match calendar opens on the next fixture, or the latest one when the
  // competition is over, rather than on today's month.
  const focusDate = useMemo(() => {
    const times = matches
      .map((m) => parseSafeDate(m.startTime))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    if (times.length === 0) return new Date();
    const now = Date.now();
    return times.find((d) => d.getTime() >= now) ?? times[times.length - 1];
  }, [matches]);

  // 1. Fetch all competitions on mount, select the one this route was opened for
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        setLoadFailed(false);
        const res = await fetch('/api/competitions');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.competitions)) throw new Error('Unexpected response shape');

        setCompetitions(data.competitions);
        setGroups(data.groups || []);

        // "Not found" means the list loaded fine and this id isn't in it. A failed
        // load (caught below) proves nothing about whether the competition exists.
        const found = data.competitions.find((c: Competition) => c.id === competitionId);
        if (found) {
          setSelectedComp(found);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error('Error fetching competitions:', err);
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [competitionId, reloadKey]);

  // A first load that failed retries by itself when the connection returns.
  useEffect(() => {
    if (!loadFailed) return;
    const retryOnReconnect = () => setReloadKey((k) => k + 1);
    window.addEventListener('online', retryOnReconnect);
    return () => window.removeEventListener('online', retryOnReconnect);
  }, [loadFailed]);

  // 2. When selectedComp changes, fetch its standings/matches/brackets
  useEffect(() => {
    if (!selectedComp) return;

    const fetchDetails = async () => {
      setDetailsLoading(true);
      setDetailsFailed({ standings: false, matches: false, brackets: false, stats: false });

      // The selected COMPETITION always has a concrete sport (or none, if
      // multi-sport); only Football and Basketball have their own /api/<sport>/*
      // routes, so resolve the endpoint from that, never from a filter tab.
      const fetchSport = selectedComp.sport;
      if (!fetchSport) {
        setStandings([]);
        setMatches([]);
        setBrackets([]);
        setStatsLeaders({});
        setDetailsLoading(false);
        return;
      }

      const fetchJson = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      };
      const failed = { standings: false, matches: false, brackets: false, stats: false };
      const compQuery = `competitionId=${selectedComp.id}&competition=${encodeURIComponent(selectedComp.name)}`;
      const sportPath = fetchSport.toLowerCase();

      // The four sections are independent: fetch them together so a slow one does
      // not hold the others back, and each records its own failure.
      const loadStandings = async () => {
        try {
          const sData = await fetchJson(`/api/${sportPath}/standings?${compQuery}`);
          if (!sData.success) throw new Error('standings success=false');
          setStandings(sData.standings || []);
        } catch (err) {
          console.error('Error fetching standings:', err);
          failed.standings = true;
          setStandings([]);
        }
      };

      const loadMatches = async () => {
        try {
          const mData = await fetchJson(`/api/${sportPath}/matches?${compQuery}`);
          if (!mData.success) throw new Error('matches success=false');
          setMatches(mData.matches || []);
        } catch (err) {
          console.error('Error fetching matches:', err);
          failed.matches = true;
          setMatches([]);
        }
      };

      const loadBrackets = async () => {
        try {
          const bData = await fetchJson(`/api/brackets?${compQuery}&sport=${fetchSport}`);
          setBrackets(bData.rounds || []);
        } catch (err) {
          console.error('Error fetching brackets:', err);
          failed.brackets = true;
          setBrackets([]);
        }
      };

      // Stats tab leaderboards are competition-scoped from the start.
      const loadStats = async () => {
        const categories = STAT_CATEGORIES[fetchSport] || [];
        const statsResults = await Promise.all(
          categories.map((cat) =>
            fetchJson(`/api/players/stats/leaders?type=${cat.type}&${compQuery}&sport=${fetchSport}&limit=5`)
              .catch((err) => {
                console.error('Error fetching stat leaders:', err);
                failed.stats = true;
                return { leaders: [] };
              })
          )
        );
        const nextStats: Record<string, StatLeader[]> = {};
        categories.forEach((cat, i) => {
          nextStats[cat.type] = statsResults[i]?.leaders || [];
        });
        setStatsLeaders(nextStats);
      };

      try {
        await Promise.all([loadStandings(), loadMatches(), loadBrackets(), loadStats()]);
        setDetailsFailed(failed);
      } catch (err) {
        console.error('Error fetching details:', err);
        setDetailsFailed({ standings: true, matches: true, brackets: true, stats: true });
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchDetails();
  }, [selectedComp, detailsKey]);

  const selectedGroup = selectedComp
    ? groups.find(g => g.seasons.some(s => s.id === selectedComp.id))
    : undefined;

  // Group-stage competitions carry a `groupName` on each standings row (e.g.
  // "Group A") until the draw completes; everything else has it null. Only
  // split into per-group tables when the data actually has >1 distinct group
  // -- otherwise render the familiar single flat table.
  const standingsGroups = useMemo(() => {
    let withGroups = standings;
    if (!standings.some((s) => s.groupName)) {
      // Standings rows that carry no group name can still be split when the
      // fixtures are labelled "Group A", "Group B", ...: each team plays inside
      // exactly one group. Only apply it when every team can be placed.
      const teamGroup = new Map<string, string>();
      for (const m of matches) {
        const label = m.round?.match(/^group\s+([a-z0-9]+)$/i);
        if (!label) continue;
        const name = `Group ${label[1].toUpperCase()}`;
        if (m.homeTeam?.name) teamGroup.set(m.homeTeam.name, name);
        if (m.awayTeam?.name) teamGroup.set(m.awayTeam.name, name);
      }
      if (standings.length > 0 && standings.every((s) => teamGroup.has(s.team.name))) {
        withGroups = standings.map((s) => ({ ...s, groupName: teamGroup.get(s.team.name) ?? null }));
      }
    }
    const distinctGroups = Array.from(new Set(withGroups.map(s => s.groupName).filter(Boolean))) as string[];
    if (distinctGroups.length < 2) {
      return [{ groupName: null as string | null, rows: standings }];
    }
    return distinctGroups.sort().map(groupName => ({
      groupName,
      rows: withGroups.filter(s => s.groupName === groupName),
    }));
  }, [standings, matches]);

  // A competition has one favourite star for the whole series: it shows as set when
  // any of its seasons is favourited, and clearing it clears all of them.
  const seriesIds = selectedGroup ? selectedGroup.seasons.map((s) => s.id) : selectedComp ? [selectedComp.id] : [];
  const seriesFavourite = seriesIds.some((id) => isFavoriteCompetition(id));
  const toggleSeriesFavourite = async () => {
    if (!selectedComp) return;
    if (seriesFavourite) {
      for (const id of seriesIds.filter((i) => isFavoriteCompetition(i))) await toggleCompetition(id);
    } else {
      await toggleCompetition(selectedComp.id);
    }
  };

  // The Brackets tab disappears when there is no bracket; fall back to Standings.
  useEffect(() => {
    if (!detailsLoading && view === 'brackets' && !hasBracket) setViewState('standings');
  }, [detailsLoading, view, hasBracket]);

  // Pos+Team are merged into one sticky first column so they stay visible
  // while P/W/D/L/GD/PTS scroll underneath on narrow viewports -- otherwise
  // the whole table scrolls together and you lose track of which row is
  // which team. Sticky cells need a solid (non-transparent) background so
  // scrolled content doesn't show through underneath them.
  const isBasketball = selectedComp?.sport === 'Basketball';
  const isSwissTop8 = selectedComp?.structure === 'swiss-top8';
  const SWISS_QUALIFIERS = 8;

  const renderStandingsTable = (rows: Standing[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[340px]">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="sticky left-0 z-10 bg-card px-3 py-3 text-[0.5625rem] font-black uppercase tracking-widest text-foreground/40">Team</th>
            <th className="px-1.5 py-3 text-[0.5625rem] font-black uppercase tracking-widest text-foreground/40 text-center">P</th>
            <th className="px-1.5 py-3 text-[0.5625rem] font-black uppercase tracking-widest text-foreground/40 text-center">W</th>
            <th className="px-1.5 py-3 text-[0.5625rem] font-black uppercase tracking-widest text-foreground/40 text-center">{selectedComp?.sport === 'Basketball' ? 'L' : 'D'}</th>
            <th className="px-1.5 py-3 text-[0.5625rem] font-black uppercase tracking-widest text-foreground/40 text-center">{selectedComp?.sport === 'Basketball' ? 'PCT' : 'L'}</th>
            {isBasketball ? (
              <>
                <th className="px-1.5 py-3 text-[0.5625rem] font-black uppercase tracking-widest text-foreground/40 text-center">PF</th>
                <th className="px-1.5 py-3 text-[0.5625rem] font-black uppercase tracking-widest text-foreground/40 text-center">PA</th>
              </>
            ) : (
              <th className="px-1.5 py-3 text-[0.5625rem] font-black uppercase tracking-widest text-foreground/40 text-center">GD</th>
            )}
            <th className="sticky right-0 z-10 bg-card px-2.5 py-3 text-[0.5625rem] font-black uppercase tracking-widest text-primary text-center">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id}
              className={`hover:bg-muted/50 transition-colors group ${
                isSwissTop8 && idx === SWISS_QUALIFIERS - 1 && rows.length > SWISS_QUALIFIERS
                  ? 'border-b-2 border-dashed border-primary/60'
                  : 'border-b border-border/50'
              }`}
            >
              <td className="sticky left-0 z-10 bg-card group-hover:bg-muted px-3 py-2.5">
                <Link href={`/teams/${row.teamId}`} className="flex items-center gap-2 min-h-[44px]">
                  <span className={`text-sm font-display italic w-4 shrink-0 text-right ${isSwissTop8 && idx < SWISS_QUALIFIERS ? 'text-primary' : 'text-foreground/30'}`}>
                    {idx + 1}
                  </span>
                  <div className="w-8 h-8 relative flex-shrink-0 bg-muted rounded-lg p-1 flex items-center justify-center">
                    <TeamLogo logo={row.team.logo} name={row.team.name} size="sm" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-tight truncate max-w-[96px] sm:max-w-[130px]">{row.team.name}</p>
                  </div>
                </Link>
              </td>
              <td className="px-1.5 py-2.5 text-center text-xs font-bold text-foreground/80">{row.played}</td>
              <td className="px-1.5 py-2.5 text-center text-xs font-bold text-primary">{row.won}</td>
              <td className="px-1.5 py-2.5 text-center text-xs font-bold text-foreground/60">{selectedComp?.sport === 'Basketball' ? row.lost : row.drawn}</td>
              <td className="px-1.5 py-2.5 text-center text-xs font-bold text-foreground/40">{selectedComp?.sport === 'Basketball' ? ((row.won / (row.played || 1)) * 100).toFixed(0) + '%' : row.lost}</td>
              {isBasketball ? (
                <>
                  <td className="px-1.5 py-2.5 text-center text-xs font-bold text-foreground/60">{row.goalsFor}</td>
                  <td className="px-1.5 py-2.5 text-center text-xs font-bold text-foreground/40">{row.goalsAgainst}</td>
                </>
              ) : (
                <td className="px-1.5 py-2.5 text-center text-xs font-bold text-foreground/40">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
              )}
              <td className="sticky right-0 z-10 bg-card group-hover:bg-muted px-2.5 py-2.5 text-center">
                <span className="bg-primary/10 text-primary px-2 py-1 rounded-lg font-display italic text-sm border border-primary/20">
                  {row.points}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isSwissTop8 && rows.length > SWISS_QUALIFIERS && (
        <p className="px-3 py-3 text-[0.625rem] font-bold uppercase tracking-widest text-foreground/40">
          <span className="inline-block w-4 border-t-2 border-dashed border-primary/60 align-middle mr-2" />
          Top 8 advance to the quarter-finals
        </p>
      )}
    </div>
  );

  if (loading && competitions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (loadFailed && !selectedComp) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <LoadFailedState
          title="Couldn't load this competition"
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
          <p className="text-foreground/40 font-black uppercase tracking-widest text-sm mb-4">Competition not found</p>
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
    <div className="min-h-screen bg-background text-foreground p-4 md:p-12">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-12">
        <header className="space-y-4 border-b border-border/50 pb-8">
          {/* Utility row: back -- star. Own row, present on every tab (Figma's
              own Standings-tab frame vs Stats-tab frame disagree on this --
              back+star share a row on Standings, star floats alone with no
              back arrow at all on Stats. Splitting it out like this keeps
              back navigation reachable from every tab, which either frame
              alone would break.) */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => (window.history.length > 1 ? router.back() : router.push('/competitions'))}
              aria-label="Back"
              className="shrink-0 w-11 h-11 -ml-2 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-foreground/60 hover:text-foreground"
            >
              <ArrowLeft size={20} />
            </button>
            {selectedComp && (
              <button
                onClick={toggleSeriesFavourite}
                aria-label={seriesFavourite ? 'Remove from favourites' : 'Add to favourites'}
                className="shrink-0 w-11 h-11 -mr-2 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <Star
                  size={20}
                  className={seriesFavourite ? 'text-primary fill-primary' : 'text-foreground/40'}
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
                      if (chosen) router.push(`/competitions/${chosen.id}?tab=${view}`);
                    }}
                    className="text-[0.625rem] font-black uppercase tracking-widest text-foreground/60 bg-muted border border-border rounded-lg px-2 min-h-[44px] focus:outline-none focus:border-primary/50"
                  >
                    {selectedGroup.seasons.map((s) => (
                      <option key={s.id} value={s.id}>{[s.season || 'Unknown Season', editionLabel(s.name)].filter(Boolean).join(' · ')}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[0.625rem] font-black uppercase tracking-widest text-foreground/40">
                    {[selectedComp?.season, selectedComp?.status].filter(Boolean).join(' • ')}
                  </span>
                )}
              </div>
              {!!selectedComp?.numberOfTeams && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-lg">
                  <Users size={12} className="text-primary" />
                  <span className="text-[0.625rem] font-black uppercase tracking-widest text-primary">
                    {selectedComp.numberOfTeams} Teams Registered
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* View Toggle -- flex-1 per tab so all 4 always fit the row width,
              no horizontal scroll (Figma shows all 4 fitting on one line). */}
          <div role="tablist" aria-label="Competition sections" className="flex bg-muted p-1 rounded-2xl border border-border">
            {visibleTabs.map((tab) => {
              const Icon = TAB_META[tab].icon;
              return (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={view === tab}
                  onClick={() => setView(tab)}
                  className={`flex-1 flex items-center justify-center gap-1 px-1 min-h-[44px] rounded-xl text-[0.625rem] font-black uppercase tracking-widest transition-all ${view === tab ? 'bg-primary text-primary-foreground' : 'text-foreground/40 hover:text-foreground'}`}
                >
                  <Icon size={14} className="shrink-0" />
                  <span className="truncate">{TAB_META[tab].label}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* Content Area */}
        {detailsLoading && (
          <div className="flex items-center justify-center py-24" role="status" aria-label="Loading competition">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
        <AnimatePresence mode="wait">
          {!detailsLoading && view === 'standings' && (
            <motion.div
              key="standings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={standingsGroups.length > 1 ? 'space-y-8' : 'bg-muted border border-border rounded-[40px] overflow-hidden'}
            >
              {detailsFailed.standings && standings.length === 0 ? (
                <LoadFailedState title="Couldn't load standings" onRetry={() => setDetailsKey((k) => k + 1)} />
              ) : standings.length > 0 ? (
                standingsGroups.length > 1 ? (
                  standingsGroups.map(({ groupName, rows }) => (
                    <div key={groupName} className="space-y-3">
                      <h3 className="px-2 font-display text-lg italic uppercase tracking-widest text-primary">{groupName}</h3>
                      <div className="bg-muted border border-border rounded-[32px] overflow-hidden">
                        {renderStandingsTable(rows)}
                      </div>
                    </div>
                  ))
                ) : (
                  renderStandingsTable(standingsGroups[0].rows)
                )
              ) : (
                <div className="p-24 text-center">
                  <AlertCircle className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
                  <p className="text-foreground/20 font-black uppercase tracking-widest text-xs italic">No standings data available</p>
                </div>
              )}
            </motion.div>
          )}

          {!detailsLoading && view === 'matches' && (
            <motion.div
              key="matches"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {matches.length > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.625rem] font-black uppercase tracking-widest text-foreground/50">
                    {selectedDate
                      ? `Fixtures for ${selectedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
                      : `${matches.length} fixtures`}
                    {selectedDate && (
                      <button onClick={() => setSelectedDate(null)} className="ml-2 underline text-primary">
                        Clear
                      </button>
                    )}
                  </p>
                  <button
                    onClick={() => setShowCalendar((v) => !v)}
                    aria-expanded={showCalendar}
                    className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-border bg-muted text-[0.625rem] font-black uppercase tracking-widest text-foreground/70 hover:text-foreground"
                  >
                    <Calendar size={14} />
                    {showCalendar ? 'Hide calendar' : 'Calendar'}
                  </button>
                </div>
              )}

              {showCalendar && matches.length > 0 && (
                <MatchCalendar
                  fixtures={matches}
                  selectedDate={selectedDate || focusDate}
                  initialMonth={focusDate}
                  onDateSelect={(date) => setSelectedDate(date)}
                />
              )}

              {detailsFailed.matches && matches.length === 0 ? (
                <LoadFailedState title="Couldn't load fixtures" onRetry={() => setDetailsKey((k) => k + 1)} />
              ) : matches.length > 0 ? (
                (() => {
                  // Completed competitions read newest first (the final leads); anything
                  // still running reads in date order so the next fixtures come first.
                  const newestFirst = selectedComp?.status === 'completed';
                  const time = (m: Match) => parseSafeDate(m.startTime)?.getTime() ?? 0;
                  const filtered = matches
                    .filter((match) => {
                      if (!selectedDate) return true;
                      const matchDate = parseSafeDate(match.startTime);
                      return matchDate ? isSameDay(matchDate, selectedDate) : false;
                    })
                    .sort((a, b) => (newestFirst ? time(b) - time(a) : time(a) - time(b)));
                  const roundOrder: string[] = [];
                  const byRound = new Map<string, Match[]>();
                  filtered.forEach((match) => {
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
                        <div key={round} className="bg-muted border border-border rounded-2xl overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-3 bg-muted border-b border-border">
                            <LayoutGrid size={14} className="text-primary shrink-0" />
                            <span className="text-[0.625rem] font-black uppercase tracking-widest truncate">
                              {round === 'Matches' ? 'Matches' : round.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="divide-y divide-border/50">
                            {byRound.get(round)!.map((match) => {
                              const finished = match.status === 'FINISHED';
                              const live = match.status === 'LIVE' || match.status === 'HALF_TIME';
                              const pens = shootoutLabel(match);
                              const penScore = pens ? pens.match(/^([0-9]+)-([0-9]+)/) : null;
                              const homeWon = finished && (match.homeScore > match.awayScore || (penScore !== null && Number(penScore[1]) > Number(penScore[2])));
                              const awayWon = finished && (match.awayScore > match.homeScore || (penScore !== null && Number(penScore[2]) > Number(penScore[1])));
                              return (
                                <Link
                                  key={match.id}
                                  href={`/matches/${match.id}`}
                                  className="block px-4 py-3 hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <TeamLogo logo={match.homeTeam?.logo} name={match.homeTeam?.name ?? ''} size="sm" />
                                    <span className={`flex-1 min-w-0 text-sm leading-tight break-words ${homeWon ? 'font-black' : 'font-bold text-foreground/80'}`}>{match.homeTeam?.name || 'Home'}</span>
                                    <div className="flex flex-col items-center shrink-0 px-2 min-w-[3.5rem]">
                                      <span className="text-sm font-display italic text-primary">
                                        {match.status === 'UPCOMING' ? safeToLocale(match.startTime, 'time', { hour: '2-digit', minute: '2-digit' }, '--:--', []) : `${match.homeScore}-${match.awayScore}`}
                                      </span>
                                      {finished && <span className="text-[0.5rem] font-black uppercase tracking-widest text-foreground/50">{pens ? `FT · ${pens}` : 'FT'}</span>}
                                      {match.status === 'LIVE' && <span className="text-[0.5rem] font-black uppercase tracking-widest text-red-500 animate-pulse">Live</span>}
                                      {match.status === 'HALF_TIME' && <span className="text-[0.5rem] font-black uppercase tracking-widest text-red-500">HT</span>}
                                    </div>
                                    <span className={`flex-1 min-w-0 text-sm leading-tight break-words text-right ${awayWon ? 'font-black' : 'font-bold text-foreground/80'}`}>{match.awayTeam?.name || 'Away'}</span>
                                    <TeamLogo logo={match.awayTeam?.logo} name={match.awayTeam?.name ?? ''} size="sm" />
                                  </div>
                                  <div className="flex items-center justify-between text-[0.625rem] text-foreground/50 mt-2 pl-11">
                                    <span className="truncate">{live ? 'In play' : match.venue}</span>
                                    <span className="shrink-0 pl-2">{safeToLocale(match.startTime, 'date', { month: 'short', day: 'numeric', year: 'numeric' }, 'TBD')}</span>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div className="p-24 text-center bg-muted border border-border rounded-[40px]">
                  <Calendar className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
                  <p className="text-foreground/40 font-black uppercase tracking-widest text-xs italic">No matches scheduled</p>
                </div>
              )}
            </motion.div>
          )}

          {!detailsLoading && view === 'brackets' && (
            <motion.div
              key="brackets"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {detailsFailed.matches && matches.length === 0 ? (
                <LoadFailedState title="Couldn't load the bracket" onRetry={() => setDetailsKey((k) => k + 1)} />
              ) : (
                <BracketView rounds={bracketRounds} projection={projection} />
              )}
            </motion.div>
          )}

          {!detailsLoading && view === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {detailsFailed.stats && Object.values(statsLeaders).every((l) => l.length === 0) && (
                <LoadFailedState title="Couldn't load stats" onRetry={() => setDetailsKey((k) => k + 1)} />
              )}
              {!(detailsFailed.stats && Object.values(statsLeaders).every((l) => l.length === 0)) && (STAT_CATEGORIES[selectedComp?.sport || ''] || []).map((cat) => {
                const leaders = statsLeaders[cat.type] || [];
                return (
                  <div key={cat.type} className="bg-muted border border-border rounded-[32px] overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                      <h3 className="text-sm font-black uppercase tracking-widest">{cat.label}</h3>
                      {leaders.length > 0 && (
                        <Link
                          href={`/competitions/${competitionId}/stats/${cat.type}`}
                          className="text-[0.625rem] font-black uppercase tracking-widest text-primary hover:underline"
                        >
                          See all
                        </Link>
                      )}
                    </div>
                    {leaders.length > 0 ? (
                      <div className="divide-y divide-border/50">
                        {leaders.map((leader) => (
                          <Link
                            key={leader.player.id}
                            href={`/players/${leader.player.id}`}
                            className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 shrink-0 rounded-lg bg-primary/20 flex items-center justify-center text-[0.625rem] font-black text-primary">
                                {leader.player.number ?? '-'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate">{leader.player.name}</p>
                                <p className="text-[0.625rem] text-foreground/40 uppercase tracking-widest truncate">{leader.team?.name || ''}</p>
                              </div>
                            </div>
                            <span className="text-lg font-display italic text-primary shrink-0">{leader.highlightedStat}</span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[0.625rem] text-foreground/20 font-black uppercase tracking-widest text-center py-8">No data yet</p>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

export default function CompetitionHubPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    }>
      <CompetitionHubContent />
    </Suspense>
  );
}
