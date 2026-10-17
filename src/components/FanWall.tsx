'use client';

import { MessageSquare, Heart } from 'lucide-react';

const SHOUTOUTS = [
  { id: 1, user: 'Tolu_UNILAG', school: 'UNILAG', text: 'Marines taking the trophy home this year! 🌊🌊', likes: 24 },
  { id: 2, user: 'BeninBoy', school: 'UNIBEN', text: 'Royals are ready. UNILAG should watch out.', likes: 18 },
  { id: 3, user: 'IfeQueen', school: 'OAU', text: 'Great Ife! 🐘 The giants are awake.', likes: 32 },
];

export function FanWall() {
  return (
    <div className="bg-muted rounded-[32px] border border-border p-6">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare size={20} className="text-primary" />
        <h3 className="font-display text-xl tracking-tight italic uppercase">Campus Pulse</h3>
      </div>
      <div className="space-y-4">
        {SHOUTOUTS.map((shout) => (
          <div key={shout.id} className="bg-muted rounded-2xl p-4 border border-border hover:border-border transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-primary tracking-widest uppercase">{shout.school}</span>
              <div className="flex items-center gap-1 text-[10px] text-foreground/40">
                <Heart size={10} />
                {shout.likes}
              </div>
            </div>
            <p className="text-xs font-medium leading-relaxed mb-2">"{shout.text}"</p>
            <span className="text-[10px] text-foreground/20">@{shout.user}</span>
          </div>
        ))}
      </div>
      <button className="w-full mt-6 py-3 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black tracking-widest uppercase hover:opacity-90 transition-opacity">
        POST SHOUTOUT
      </button>
    </div>
  );
}
