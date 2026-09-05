'use client';

import { ArrowLeft, AlertCircle, Loader2, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { TeamLogo } from '@/lib/utils/team-logo';
import { PlayerProfileOverlay } from '@/components/PlayerProfileOverlay';

interface Competition {
  id: string;
  name: string;
  sport: string | null;
  season?: string;
  status?: string;
  logo?: string | null;
}

interface Leader {
  rank: number;
  player: { id: string; name: string; number: number | null; rating: number | null };
  team: { name: string; logo?: string } | null;
  highlightedStat: number;
}

// Figma's "See all" destination screen uses a fuller title than the summary
// card ("Goal Scorers" vs the card's "Goals") -- confirmed against
// 2203-3071_stats-d.png, the only full-list frame actually pulled.
const CATEGORY_TITLES: Record<string, string> = {
  goals: 'Goal Scorers',
  assists: 'Assist Leaders',
  yellowCards: 'Yellow Cards',
  points: 'Points Leaders',
  rebounds: 'Rebounds Leaders',
};

export default function StatCategoryPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;
  const category = params.category as string;

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string; number: number | null; position: string; rating: number | null } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const compRes = await fetch(`/api/competitions/${competitionId}`);
        const compData = await compRes.json();
        if (!compRes.ok || !compData.competition) {
          setNotFound(true);
          return;
        }
        setCompetition(compData.competition);

        const sport = compData.competition.sport;
        if (!sport) {
          setLeaders([]);
          return;
        }

        // BACKLOG-290 follow-up: full leaderboard, still competitionId-scoped
        // (same authoritative-id rule as the hub's own stats fetch) -- just a
        // higher limit than the hub's top-5 summary card.
        const leadersRes = await fetch(
          `/api/players/stats/leaders?type=${category}&competitionId=${competitionId}&sport=${sport}&limit=50`
        );
        const leadersData = await leadersRes.json();
        setLeaders(leadersData.leaders || []);
      } catch (err) {
        console.error('Error fetching stat category:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [competitionId, category]);

  if (loading) {
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

  const title = CATEGORY_TITLES[category] || category;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-12">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-12">
        <header className="space-y-4 border-b border-white/5 pb-8">
          <button
            onClick={() => router.push(`/competitions/${competitionId}?tab=stats`)}
            aria-label="Back to Stats"
            className="shrink-0 p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex items-start gap-4">
            {competition && (
              <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 flex items-center justify-center">
                <TeamLogo logo={competition.logo} name={competition.name} size="lg" />
              </div>
            )}
            <div className="text-left">
              <h1 className="font-display text-2xl md:text-4xl tracking-tighter italic uppercase leading-none mb-2">
                {competition?.name || ''}
              </h1>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                {competition?.season || 'Current Season'} • {competition?.status || 'Active'}
              </span>
            </div>
          </div>

          <h2 className="font-display text-xl italic uppercase tracking-widest">{title}</h2>
        </header>

        {leaders.length > 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Player Name</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Stat</span>
            </div>
            <div className="divide-y divide-white/5">
              {leaders.map((leader) => (
                <div
                  key={leader.player.id}
                  onClick={() => setSelectedPlayer({ id: leader.player.id, name: leader.player.name, number: leader.player.number, position: '', rating: leader.player.rating })}
                  className="flex items-center justify-between px-6 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-sm font-display italic w-5 shrink-0 text-right ${leader.rank <= 3 ? 'text-primary' : 'text-white/20'}`}>
                      {leader.rank}
                    </span>
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
                      {leader.player.number ?? '-'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{leader.player.name}</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest truncate">{leader.team?.name || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-lg font-display italic text-primary">{leader.highlightedStat}</span>
                    {typeof leader.player.rating === 'number' && (
                      <span className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full text-[10px] font-bold text-white/70">
                        {leader.player.rating.toFixed(1)}
                        <Star size={10} className="fill-primary text-primary" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-24 text-center bg-white/5 border border-white/10 rounded-[40px]">
            <AlertCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/20 font-black uppercase tracking-widest text-xs italic">No data yet</p>
          </div>
        )}
      </div>

      {selectedPlayer && (
        <PlayerProfileOverlay
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          sport={competition?.sport || undefined}
        />
      )}
    </div>
  );
}
