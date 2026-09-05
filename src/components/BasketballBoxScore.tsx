'use client';

import { useState } from 'react';
import { Activity } from 'lucide-react';
import { TeamLogo } from '@/lib/utils/team-logo';
import { computeBasketballBoxScore, type BoxScoreRow } from '@/lib/basketball/matchStats';

interface BasketballBoxScoreProps {
    events: any[];
    homeTeam: any;
    awayTeam: any;
}

// BACKLOG-326: Figma's net-new Box Score tab -- per-player TEAM(jersey+name+
// position)/PTS/AST/REB for this specific match, team-filterable ([home logo]/
// ALL/[away logo]). Whole-match snapshot, not quarter-scoped (that's BACKLOG-331's
// Stats tab). See computeBasketballBoxScore's own comment for the aggregation rules.
export default function BasketballBoxScore({ events, homeTeam, awayTeam }: BasketballBoxScoreProps) {
    const [filter, setFilter] = useState<'home' | 'all' | 'away'>('all');
    const { home, away } = computeBasketballBoxScore(events || [], homeTeam.id);

    if (home.length === 0 && away.length === 0) {
        return (
            <div className="text-center py-20">
                <Activity className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white/60 mb-2">No box score available</h3>
                <p className="text-white/40">Player stats will appear here once the game starts</p>
            </div>
        );
    }

    const renderTeamTable = (team: any, rows: BoxScoreRow[]) => (
        <div key={team.id} className="mb-6">
            <div className="flex items-center gap-2 mb-2 px-1">
                <TeamLogo logo={team.logo} name={team.name} color={team.color} size="sm" />
                <span className="font-bold text-sm">{team.shortName || team.name}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-white/5 text-white/60 text-[10px] uppercase tracking-wider">
                            <th className="text-left px-3 py-2 font-semibold">Player</th>
                            <th className="text-center px-3 py-2 font-semibold">PTS</th>
                            <th className="text-center px-3 py-2 font-semibold">AST</th>
                            <th className="text-center px-3 py-2 font-semibold">REB</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-3 py-4 text-center text-white/40">No player events yet</td>
                            </tr>
                        ) : (
                            rows.map(r => (
                                <tr key={r.playerId} className="border-t border-white/5">
                                    <td className="px-3 py-2">
                                        <div className="font-semibold">{r.jerseyName || r.name}</div>
                                        <div className="text-xs text-white/40">
                                            {r.number != null ? `#${r.number}` : ''}
                                            {r.number != null && r.position ? ' · ' : ''}
                                            {r.position || ''}
                                        </div>
                                    </td>
                                    <td className="text-center px-3 py-2 font-bold">{r.pts}</td>
                                    <td className="text-center px-3 py-2">{r.ast}</td>
                                    <td className="text-center px-3 py-2">{r.reb}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
                <button
                    onClick={() => setFilter('home')}
                    className={`p-2 rounded-full transition-all ${filter === 'home' ? 'bg-primary/20 ring-2 ring-primary' : 'bg-white/5 hover:bg-white/10'}`}
                    aria-label={`Show ${homeTeam.name} only`}
                >
                    <TeamLogo logo={homeTeam.logo} name={homeTeam.name} color={homeTeam.color} size="sm" />
                </button>
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${filter === 'all' ? 'bg-primary text-white' : 'bg-white/5 text-white/60 hover:text-white'}`}
                >
                    All
                </button>
                <button
                    onClick={() => setFilter('away')}
                    className={`p-2 rounded-full transition-all ${filter === 'away' ? 'bg-primary/20 ring-2 ring-primary' : 'bg-white/5 hover:bg-white/10'}`}
                    aria-label={`Show ${awayTeam.name} only`}
                >
                    <TeamLogo logo={awayTeam.logo} name={awayTeam.name} color={awayTeam.color} size="sm" />
                </button>
            </div>

            {(filter === 'home' || filter === 'all') && renderTeamTable(homeTeam, home)}
            {(filter === 'away' || filter === 'all') && renderTeamTable(awayTeam, away)}
        </div>
    );
}
