import { Trophy, Loader2 } from 'lucide-react';
import { useLiveStandings } from '@/hooks/useLiveStandings';

interface StandingsGridProps {
  competitionId?: string;
  sport?: string;
  title?: string;
}

export function StandingsGrid({
  competitionId = 'busa-league', // Default to BUSA
  sport,
  title = 'TOP UNIVERSITIES'
}: StandingsGridProps) {
  const { standings, loading } = useLiveStandings({ competitionId, sport });

  return (
    <div className="bg-white/5 rounded-[32px] border border-white/10 p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <Trophy size={20} className="text-primary" />
        <h3 className="font-display text-xl tracking-tight italic uppercase">{title}</h3>
      </div>

      <div className="space-y-4 flex-1">
        {loading && standings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-20">
            <Loader2 className="animate-spin" size={24} />
            <span className="text-[10px] font-black tracking-widest uppercase">Fetching Live Data...</span>
          </div>
        ) : standings.length > 0 ? (
          standings.slice(0, 6).map((standing, index) => (
            <div key={standing.teamId} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-white/20 w-4">{index + 1}</span>
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-xl group-hover:bg-primary/20 transition-all border border-white/5 group-hover:border-primary/30 overflow-hidden">
                  {standing.teamLogo ? (
                    <img src={standing.teamLogo} alt={standing.teamName} className="w-full h-full object-cover" />
                  ) : (
                    '🛡️'
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-tight truncate max-w-[120px]">{standing.teamName}</span>
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider truncate max-w-[100px]">{standing.university}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-black font-display italic">
                <div className="flex flex-col items-end">
                  <span className="text-white/20 text-[8px] uppercase tracking-tighter not-italic font-black">Points</span>
                  <span className="text-primary text-lg leading-none">{standing.points}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center opacity-20">
            <p className="text-[10px] font-black uppercase tracking-widest">No Standings Available</p>
          </div>
        )}
      </div>

      <button className="w-full mt-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-colors border border-white/5 hover:border-white/10">
        FULL STANDINGS
      </button>
    </div>
  );
}
