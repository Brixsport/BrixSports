'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Star, ChevronDown, ChevronUp, Loader2, Activity, ArrowLeft } from 'lucide-react';
import { TeamLogo } from '@/lib/utils/team-logo';
import { useFavorites } from '@/hooks/useFavorites';
import { useResilientFetch } from '@/hooks/useResilientFetch';
import { LoadFailedState } from '@/components/resilience/ReadPathStates';
import { parseSafeDate, safeToLocale } from '@/lib/safe-date';

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

interface CompetitionsResponse {
  groups: CompetitionGroup[];
}

const isCompetitionsResponse = (body: unknown): body is CompetitionsResponse =>
  typeof body === 'object' && body !== null && Array.isArray((body as { groups?: unknown }).groups);

export default function CompetitionsDirectoryPage() {
  const router = useRouter();
  const { isFavoriteCompetition, toggleCompetition } = useFavorites();

  // BACKLOG-471: a failed fetch must show a retry state, never "No competitions found".
  const { data, isLoading: loading, loadError, retry } = useResilientFetch<CompetitionsResponse>(
    '/api/competitions',
    { validate: isCompetitionsResponse }
  );
  const groups = data?.groups ?? [];
  const loadFailed = loadError !== null && data === null;
  const [sportFilter, setSportFilter] = useState<SportType>('All');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [nearestMatches, setNearestMatches] = useState<Record<string, NearestMatch[]>>({});
  const [matchesLoading, setMatchesLoading] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState<Record<string, boolean>>({});

  const filteredGroups = groups.filter((g) => {
    if (sportFilter === 'All') return true;
    if (sportFilter === 'Other') return g.sport !== 'Football' && g.sport !== 'Basketball';
    return g.sport === sportFilter;
  });

  // BACKLOG-289: the inline match preview is fetched only for the row the user
  // actually expands, on demand -- never eagerly for the whole list, to avoid
  // N+1 requests across the directory.
  const loadPreview = async (group: CompetitionGroup) => {
    if (nearestMatches[group.groupKey] || !group.sport) return;

    try {
      setMatchesLoading(group.groupKey);
      setPreviewFailed((prev) => ({ ...prev, [group.groupKey]: false }));
      const res = await fetch(`/api/${group.sport.toLowerCase()}/matches?competitionId=${group.latest.id}&competition=${encodeURIComponent(group.latest.name)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const all: NearestMatch[] = body.success && body.matches ? body.matches : [];
      const now = Date.now();
      // Unparseable startTime sorts last instead of poisoning the comparator with NaN.
      const distance = (m: NearestMatch) => {
        const d = parseSafeDate(m.startTime);
        return d ? Math.abs(d.getTime() - now) : Number.MAX_SAFE_INTEGER;
      };
      const nearest = [...all].sort((a, b) => distance(a) - distance(b)).slice(0, 3);
      setNearestMatches((prev) => ({ ...prev, [group.groupKey]: nearest }));
    } catch (err) {
      // Not cached: a failure is not "no nearby matches", and collapse/expand or the retry button re-fetches.
      console.error('Error fetching nearest matches:', err);
      setPreviewFailed((prev) => ({ ...prev, [group.groupKey]: true }));
    } finally {
      setMatchesLoading(null);
    }
  };

  const handleExpand = async (group: CompetitionGroup) => {
    if (expandedKey === group.groupKey) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(group.groupKey);
    await loadPreview(group);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="shrink-0 p-2 -ml-2 rounded-full hover:bg-muted transition-colors text-foreground/60 hover:text-foreground"
          >
            <ArrowLeft size={20} />
          </button>
          <Trophy size={18} className="text-primary" />
          <h1 className="font-display text-xl italic uppercase tracking-widest">Competitions</h1>
        </div>

        {/* Sport filter -- flex-1 per tab so all 4 fit the row width, no
            horizontal scroll (matches the Figma directory screen). */}
        <div className="flex bg-muted p-1 rounded-2xl border border-border">
          {(['All', 'Football', 'Basketball', 'Other'] as SportType[]).map((sport) => (
            <button
              key={sport}
              onClick={() => setSportFilter(sport)}
              className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sportFilter === sport ? 'bg-primary text-primary-foreground' : 'text-foreground/40 hover:text-foreground'}`}
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
        ) : loadFailed ? (
          <LoadFailedState title="Couldn't load competitions" onRetry={retry} />
        ) : filteredGroups.length === 0 ? (
          <div className="p-16 text-center bg-muted border border-border rounded-[32px]">
            <Trophy className="w-10 h-10 text-foreground/10 mx-auto mb-4" />
            <p className="text-foreground/20 font-black uppercase tracking-widest text-xs italic">No competitions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredGroups.map((group) => {
              const isExpanded = expandedKey === group.groupKey;
              const preview = nearestMatches[group.groupKey];
              return (
                <div key={group.groupKey} className="bg-muted border border-border rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <button
                      onClick={() => router.push(`/competitions/${group.latest.id}`)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="w-11 h-11 shrink-0 bg-muted rounded-xl border border-border p-1.5 flex items-center justify-center">
                        <TeamLogo logo={group.latest.logo} name={group.name} size="md" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black uppercase tracking-tight truncate">{group.name}</p>
                        <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest truncate">
                          {group.latest.season || group.latest.status || group.sport || 'Multi-Sport'}
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => toggleCompetition(group.latest.id)}
                      aria-label={isFavoriteCompetition(group.latest.id) ? 'Remove from favourites' : 'Add to favourites'}
                      className="shrink-0 p-2 rounded-full hover:bg-muted transition-colors"
                    >
                      <Star
                        size={18}
                        className={isFavoriteCompetition(group.latest.id) ? 'text-primary fill-primary' : 'text-foreground/40'}
                      />
                    </button>

                    <button
                      onClick={() => handleExpand(group)}
                      aria-label={isExpanded ? 'Collapse nearest matches' : 'Show nearest matches'}
                      className="shrink-0 p-2 rounded-full hover:bg-muted transition-colors text-foreground/40 hover:text-foreground"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border/50 px-3 pb-3 pt-1 space-y-1">
                      {matchesLoading === group.groupKey ? (
                        <div className="py-4 flex justify-center">
                          <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        </div>
                      ) : previewFailed[group.groupKey] ? (
                        <div className="py-4 text-center" role="alert">
                          <p className="text-[10px] text-foreground/40 font-black uppercase tracking-widest mb-2">Couldn&apos;t load matches</p>
                          <button
                            type="button"
                            onClick={() => loadPreview(group)}
                            className="text-[10px] font-black uppercase tracking-widest text-primary underline"
                          >
                            Try again
                          </button>
                        </div>
                      ) : !preview || preview.length === 0 ? (
                        <p className="text-[10px] text-foreground/20 font-black uppercase tracking-widest text-center py-4">No nearby matches</p>
                      ) : (
                        preview.map((match) => (
                          <div key={match.id} className="flex items-center justify-between py-2 text-xs">
                            <span className="text-foreground/40 font-bold uppercase tracking-widest text-[10px] w-16 shrink-0">
                              {safeToLocale(match.startTime, 'date', { month: 'short', day: 'numeric' }, 'TBD')}
                            </span>
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <TeamLogo logo={match.homeTeam?.logo} name={match.homeTeam?.name ?? ''} size="sm" />
                              <span className="truncate font-bold">{match.homeTeam?.name || 'TBD'}</span>
                            </div>
                            <span className="px-2 text-foreground/40 font-black shrink-0">
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
