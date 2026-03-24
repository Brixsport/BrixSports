'use client';

import { PLAYERS, TEAMS } from '@/lib/mock-data';
import { Star } from 'lucide-react';

export function TopPlayers() {
  return (
    <div className="bg-white/5 rounded-[32px] border border-white/10 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Star size={20} className="text-secondary" />
        <h3 className="font-display text-xl tracking-tight italic">EYEPOINTS LEADERS</h3>
      </div>
      <div className="space-y-4">
        {PLAYERS.sort((a, b) => b.eyePoints - a.eyePoints).slice(0, 5).map((player, index) => {
          const team = (player as typeof player & { team?: typeof TEAMS[number] }).team || TEAMS.find(t => t.id === player.teamId);
          return (
            <div key={player.id} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-white/20 to-transparent rounded-full flex items-center justify-center text-xl overflow-hidden border border-white/10">
                    <span className="opacity-40">{team?.logo}</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-[#050505] flex items-center justify-center text-[8px] font-black text-black">
                    {player.number}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold truncate max-w-[120px]">{player.name}</span>
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">{team?.name}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                  <span className="text-white/20 text-[8px] uppercase tracking-tighter">Eyes</span>
                  <span className="text-secondary font-display text-lg leading-none italic">{player.eyePoints}</span>
              </div>
            </div>
          );
        })}
      </div>
      <button className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-bold tracking-widest uppercase transition-colors border border-white/5">
        PLAYER STATS
      </button>
    </div>
  );
}
