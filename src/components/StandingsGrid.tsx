'use client';

import { TEAMS } from '@/lib/mock-data';
import { Trophy } from 'lucide-react';

export function StandingsGrid() {
  return (
    <div className="bg-white/5 rounded-[32px] border border-white/10 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Trophy size={20} className="text-primary" />
        <h3 className="font-display text-xl tracking-tight italic">TOP UNIVERSITIES</h3>
      </div>
      <div className="space-y-4">
        {TEAMS.slice(0, 5).map((team, index) => (
          <div key={team.id} className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white/20 w-4">{index + 1}</span>
              <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-lg group-hover:bg-white/10 transition-colors">
                {team.logo}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold truncate max-w-[120px]">{team.name}</span>
                <span className="text-[10px] text-white/40 uppercase tracking-wider">{team.shortName}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold font-display italic">
               <div className="flex flex-col items-end">
                  <span className="text-white/20 text-[8px] uppercase tracking-tighter not-italic">Points</span>
                  <span className="text-primary">{25 - index * 3}</span>
               </div>
            </div>
          </div>
        ))}
      </div>
      <button className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-bold tracking-widest uppercase transition-colors border border-white/5">
        FULL STANDINGS
      </button>
    </div>
  );
}
