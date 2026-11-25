import Link from 'next/link';
import { TeamLogo } from '@/lib/utils/team-logo';
import { safeToLocale } from '@/lib/safe-date';
import type { BracketRound } from '@/lib/competition-bracket';

export interface ProjectedPair {
  homeSeed: number;
  awaySeed: number;
  home: { name: string; logo?: string | null } | null;
  away: { name: string; logo?: string | null } | null;
}

function TeamLine({
  team,
  score,
  won,
  seed,
}: {
  team: { name: string; logo?: string | null } | null;
  score: number | null;
  won?: boolean;
  seed?: number;
}) {
  return (
    <div className="flex items-center gap-2 min-h-[32px]">
      {seed !== undefined && (
        <span className="w-5 shrink-0 text-center text-[0.625rem] font-black text-foreground/50">{seed}</span>
      )}
      <TeamLogo logo={team?.logo} name={team?.name ?? 'TBD'} size="sm" />
      <span className={`flex-1 min-w-0 truncate text-sm ${won ? 'font-black' : 'font-bold text-foreground/70'}`}>
        {team?.name ?? 'TBD'}
      </span>
      {score !== null && (
        <span className={`font-display italic text-lg ${won ? 'text-primary' : 'text-foreground/50'}`}>{score}</span>
      )}
    </div>
  );
}

export default function BracketView({
  rounds,
  projection,
}: {
  rounds: BracketRound[];
  projection: ProjectedPair[] | null;
}) {
  return (
    <div className="space-y-6">
      {rounds.map((round) => (
        <section key={round.label} aria-label={round.label} className="space-y-3">
          <h3 className="px-1 text-[0.625rem] font-black uppercase tracking-widest text-primary">{round.label}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {round.matches.map((m) => {
              const finished = m.status === 'FINISHED';
              const pens = m.shootout?.match(/^([0-9]+)-([0-9]+)/);
              const homeWon = finished && m.homeScore !== null && m.awayScore !== null && (m.homeScore > m.awayScore || (pens !== null && pens !== undefined && Number(pens[1]) > Number(pens[2])));
              const awayWon = finished && m.homeScore !== null && m.awayScore !== null && (m.awayScore > m.homeScore || (pens !== null && pens !== undefined && Number(pens[2]) > Number(pens[1])));
              const showScore = m.status !== 'UPCOMING';
              return (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="block rounded-2xl border border-border bg-muted p-3 hover:border-primary/40 transition-colors"
                >
                  <TeamLine team={m.home} score={showScore ? m.homeScore : null} won={homeWon} />
                  <div className="my-1 h-px bg-border/50" />
                  <TeamLine team={m.away} score={showScore ? m.awayScore : null} won={awayWon} />
                  <p className="mt-2 text-[0.625rem] font-bold uppercase tracking-widest text-foreground/50">
                    {finished ? (m.shootout ? `FT · ${m.shootout}` : 'FT') : m.status === 'LIVE' ? 'Live' : m.status === 'HALF_TIME' ? 'HT' : 'Upcoming'}
                    {' · '}
                    {safeToLocale(m.startTime ?? '', 'date', { day: 'numeric', month: 'short', year: 'numeric' }, 'Date TBC')}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {projection && projection.length > 0 && (
        <section aria-label="Projected quarter-finals" className="space-y-3">
          <div className="px-1">
            <h3 className="text-[0.625rem] font-black uppercase tracking-widest text-primary">Projected quarter-finals</h3>
            <p className="text-[0.625rem] text-foreground/50 mt-1">
              If the table finished today. Pairings change as results come in.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {projection.map((p) => (
              <div key={`${p.homeSeed}v${p.awaySeed}`} className="rounded-2xl border border-dashed border-border bg-muted/60 p-3">
                <TeamLine team={p.home} score={null} seed={p.homeSeed} />
                <div className="my-1 h-px bg-border/50" />
                <TeamLine team={p.away} score={null} seed={p.awaySeed} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
