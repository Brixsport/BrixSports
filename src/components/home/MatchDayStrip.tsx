'use client';

import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDayLabel, stepMatchDay } from '@/lib/match-days';

interface MatchDayStripProps {
  /** Sorted day keys (yyyy-MM-dd): match days plus today. */
  days: string[];
  selected: string;
  todayKey: string;
  /** Days that have a LIVE match get a pulsing dot. */
  liveDays: ReadonlySet<string>;
  onSelect: (dayKey: string) => void;
}

/**
 * Horizontally scrollable strip of match days. Only days with fixtures (plus
 * today) are listed, and the arrows jump between them, so the viewer never
 * lands on an empty day.
 */
export function MatchDayStrip({ days, selected, todayKey, liveDays, onSelect }: MatchDayStripProps) {
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const prev = stepMatchDay(days, selected, -1);
  const next = stepMatchDay(days, selected, 1);

  // Centre the selected chip. scrollIntoView with block:'nearest' never scrolls the page itself.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [selected, days.length]);

  return (
    <div className="flex items-center gap-1 mb-4" role="group" aria-label="Match days">
      <button
        onClick={() => prev && onSelect(prev)}
        disabled={!prev}
        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Previous match day"
      >
        <ChevronLeft size={18} className="text-foreground/60" />
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto scrollbar-hide snap-x">
        {days.map(day => {
          const isSelected = day === selected;
          const { primary, secondary } = formatDayLabel(day, todayKey);
          return (
            <button
              key={day}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onSelect(day)}
              aria-current={isSelected ? 'date' : undefined}
              className={`relative shrink-0 snap-center min-h-11 min-w-[64px] px-3 rounded-lg flex flex-col items-center justify-center leading-tight transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground/60 hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wider">{primary}</span>
              <span className={`text-[10px] ${isSelected ? 'opacity-80' : 'text-foreground/40'}`}>{secondary}</span>
              {liveDays.has(day) && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" aria-label="Live" />
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => next && onSelect(next)}
        disabled={!next}
        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Next match day"
      >
        <ChevronRight size={18} className="text-foreground/60" />
      </button>
    </div>
  );
}
