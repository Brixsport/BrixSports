'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Star, ChevronDown, ChevronUp, Loader2, Activity, ArrowLeft } from 'lucide-react';
import { TeamLogo } from '@/lib/utils/team-logo';
import { useFavorites } from '@/hooks/useFavorites';

type SportType = 'All' | 'Football' | 'Basketball' | 'Other';

interface Competition {
  id: string;
  name: string;
  sport: 'Football' | 'Basketball' | 'Track' | null;
  isMultiSport?: boolean;
  season?: string;
  status?: string;
  logo?: string | null;
}

// BACKLOG-229: mirrors api/competitions' own buildCompetitionGroups() shape --
// one row per competition series (deduped across seasons), not one per raw row.
interface CompetitionGroup {
  groupKey: string;
  name: string;
  sport: Competition['sport'];
  latest: Competition;
  seasons: Competition[];
}

interface NearestMatch {
  id: string;
  homeTeam: { name: string; shortName: string; logo: string };
  awayTeam: { name: string; shortName: string; logo: string };
  homeScore: number;
  awayScore: number;
  startTime: string;
  status: string;
}

export default function CompetitionsDirectoryPage() {
  const router = useRouter();
  const { isFavoriteCompetition, toggleCompetition } = useFavorites();

  const [groups, setGroups] = useState<CompetitionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState<SportType>('All');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [nearestMatches, setNearestMatches] = useState<Record<string, NearestMatch[]>>({});
  const [matchesLoading, setMatchesLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/competitions');
        const data = await res.json();
        setGroups(data.groups || []);
      } catch (err) {
        console.error('Error fetching competitions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  const filteredGroups = groups.filter((g) => {
    if (sportFilter === 'All') return true;
    if (sportFilter === 'Other') return g.sport !== 'Football' && g.sport !== 'Basketball';
    return g.sport === sportFilter;
  });

  // BACKLOG-289: the inline match preview is fetched only for the row the user
  // actually expands, on demand -- never eagerly for the whole list, to avoid
  // N+1 requests across the directory.
  const handleExpand = async (group: CompetitionGroup) => {
    if (expandedKey === group.groupKey) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(group.groupKey);
    if (nearestMatches[group.groupKey] || !group.sport) return;

    try {
      setMatchesLoading(group.groupKey);
      const res = await fetch(`/api/${group.sport.toLowerCase()}/matches?competitionId=${group.latest.id}&competition=${encodeURIComponent(group.latest.name)}`);
      const data = await res.json();
      const all: NearestMatch[] = data.success && data.matches ? data.matches : [];
      const now = Date.now();
      const nearest = [...all]
        .sort((a, b) => Math.abs(new Date(a.startTime).getTime() - now) - Math.abs(new Date(b.startTime).getTime() - now))
        .slice(0, 3);
      setNearestMatches((prev) => ({ ...prev, [group.groupKey]: nearest }));
    } catch (err) {
      console.error('Error fetching nearest matches:', err);
      setNearestMatches((prev) => ({ ...prev, [group.groupKey]: [] }));
    } finally {
      setMatchesLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="shrink-0 p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <Trophy size={18} className="text-primary" />
          <h1 className="font-display text-xl italic uppercase tracking-widest">Competitions</h1>
        </div>

        {/* Sport filter -- flex-1 per tab so all 4 fit the row width, no
            horizontal scroll (matches the Figma directory screen). */}
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
          {(['All', 'Football', 'Basketball', 'Other'] as SportType[]).map((sport) => (
            <button
              key={sport}
              onClick={() => setSportFilter(sport)}
              className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sportFilter === sport ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
            >
              <Activity size={12} className="shrink-0" />
              <span className="truncate">{sport}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-16 text-center bg-white/5 border border-white/10 rounded-[32px]">
            <Trophy className="w-10 h-10 text-white/10 mx-auto mb-4" />
            <p className="text-white/20 font-black uppercase tracking-widest text-xs italic">No competitions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredGroups.map((group) => {
              const isExpanded = expandedKey === group.groupKey;
              const preview = nearestMatches[group.groupKey];
              return (
                <div key={group.groupKey} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <button
                      onClick={() => router.push(`/competitions/${group.latest.id}`)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="w-11 h-11 shrink-0 bg-white/5 rounded-xl border border-white/10 p-1.5 flex items-center justify-center">
                        <TeamLogo logo={group.latest.logo} name={group.name} size="md" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black uppercase tracking-tight truncate">{group.name}</p>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest truncate">
                          {group.latest.season || group.latest.status || group.sport || 'Multi-Sport'}
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => toggleCompetition(group.latest.id)}
                      aria-label={isFavoriteCompetition(group.latest.id) ? 'Remove from favourites' : 'Add to favourites'}
                      className="shrink-0 p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <Star
                        size={18}
                        className={isFavoriteCompetition(group.latest.id) ? 'text-primary fill-primary' : 'text-white/40'}
                      />
                    </button>

                    <button
                      onClick={() => handleExpand(group)}
                      aria-label={isExpanded ? 'Collapse nearest matches' : 'Show nearest matches'}
                      className="shrink-0 p-2 rounded-full hover:bg-white/10 transition-colors text-white/40 hover:text-white"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-white/5 px-3 pb-3 pt-1 space-y-1">
                      {matchesLoading === group.groupKey ? (
                        <div className="py-4 flex justify-center">
                          <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        </div>
                      ) : !preview || preview.length === 0 ? (
                        <p className="text-[10px] text-white/20 font-black uppercase tracking-widest text-center py-4">No nearby matches</p>
                      ) : (
                        preview.map((match) => (
                          <div key={match.id} className="flex items-center justify-between py-2 text-xs">
                            <span className="text-white/40 font-bold uppercase tracking-widest text-[10px] w-16 shrink-0">
                              {new Date(match.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <TeamLogo logo={match.homeTeam?.logo} name={match.homeTeam?.name ?? ''} size="sm" />
                              <span className="truncate font-bold">{match.homeTeam?.name || 'TBD'}</span>
                            </div>
                            <span className="px-2 text-white/40 font-black shrink-0">
                              {match.status === 'UPCOMING' ? 'vs' : `${match.homeScore}-${match.awayScore}`}
                            </span>
                            <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
                              <span className="truncate font-bold text-right">{match.awayTeam?.name || 'TBD'}</span>
                              <TeamLogo logo={match.awayTeam?.logo} name={match.awayTeam?.name ?? ''} size="sm" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
