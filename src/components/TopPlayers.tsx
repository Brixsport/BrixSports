'use client';

import { PLAYERS, TEAMS } from '@/lib/mock-data';
import { Star } from 'lucide-react';

export function TopPlayers() {
  return (
    <div className="bg-muted rounded-[32px] border border-border p-6">
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
                  <div className="w-10 h-10 bg-gradient-to-br from-white/20 to-transparent rounded-full flex items-center justify-center text-xl overflow-hidden border border-border">
                    <span className="opacity-40">{team?.logo}</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-background flex items-center justify-center text-[8px] font-black text-black">
                    {player.number}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold truncate max-w-[120px]">{player.name}</span>
                  <span className="text-[10px] text-foreground/40 uppercase tracking-wider">{team?.name}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                  <span className="text-foreground/20 text-[8px] uppercase tracking-tighter">Eyes</span>
                  <span className="text-secondary font-display text-lg leading-none italic">{player.eyePoints}</span>
              </div>
            </div>
          );
        })}
      </div>
      <button className="w-full mt-6 py-3 bg-muted hover:bg-muted/70 rounded-2xl text-[10px] font-bold tracking-widest uppercase transition-colors border border-border">
        PLAYER STATS
      </button>
    </div>
  );
}
