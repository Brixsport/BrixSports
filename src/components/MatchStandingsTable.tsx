'use client';

import Link from 'next/link';
import { ChevronRight, Loader2, Table2 } from 'lucide-react';
import { useLiveStandings, StandingRow } from '@/hooks/useLiveStandings';
import { TeamLogo } from '@/lib/utils/team-logo';

interface MatchStandingsTableProps {
    competitionId?: string | null;
    sport?: string;
    homeTeamId: string;
    awayTeamId: string;
}

interface ColumnDef {
    key: keyof StandingRow;
    label: string;
}

// Figma's Table tab has a genuinely different column *count* per sport, not just
// relabeled headers — basketball shows PF/PA explicitly (no draws), football
// collapses that into a single GD instead of separate GF/GA.
const FOOTBALL_COLUMNS: ColumnDef[] = [
    { key: 'played', label: 'PL' },
    { key: 'won', label: 'W' },
    { key: 'drawn', label: 'D' },
    { key: 'lost', label: 'L' },
    { key: 'goalDifference', label: 'GD' },
    { key: 'points', label: 'PTS' },
];

const BASKETBALL_COLUMNS: ColumnDef[] = [
    { key: 'played', label: 'PL' },
    { key: 'won', label: 'W' },
    { key: 'lost', label: 'L' },
    { key: 'goalsFor', label: 'PF' },
    { key: 'goalsAgainst', label: 'PA' },
    { key: 'goalDifference', label: 'PD' },
    { key: 'points', label: 'PTS' },
];

function formatCell(key: keyof StandingRow, value: number) {
    if (key === 'goalDifference') return value > 0 ? `+${value}` : `${value}`;
    return String(value);
}

export default function MatchStandingsTable({ competitionId, sport, homeTeamId, awayTeamId }: MatchStandingsTableProps) {
    const { standings, loading } = useLiveStandings({ competitionId: competitionId ?? '', sport });

    if (!competitionId) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-[24px] p-12 text-center">
                <Table2 className="w-16 h-16 mx-auto mb-4 text-white/20" />
                <h3 className="text-xl font-bold mb-2">Standings Unavailable</h3>
                <p className="text-white/60">This match isn't linked to a competition table.</p>
            </div>
        );
    }

    if (loading && standings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-white/40">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm font-semibold uppercase tracking-wider">Loading table…</span>
            </div>
        );
    }

    if (standings.length === 0) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-[24px] p-12 text-center">
                <Table2 className="w-16 h-16 mx-auto mb-4 text-white/20" />
                <h3 className="text-xl font-bold mb-2">No Standings Available</h3>
                <p className="text-white/60">The table for this competition hasn't been published yet.</p>
            </div>
        );
    }

    // Group-stage vs. single-table: scope to whichever group either match team is
    // in, if the competition uses groups at all. groupName is null/undefined until
    // a draw completes -- falls back to the full list for a single-table competition.
    const matchTeamRow = standings.find(s => s.teamId === homeTeamId || s.teamId === awayTeamId);
    const rows = matchTeamRow?.groupName
        ? standings.filter(s => s.groupName === matchTeamRow.groupName)
        : standings;

    const columns = sport?.toLowerCase() === 'basketball' ? BASKETBALL_COLUMNS : FOOTBALL_COLUMNS;

    return (
        <div className="bg-white/5 border border-white/10 rounded-[24px] overflow-hidden">
            {matchTeamRow?.groupName && (
                <div className="px-4 pt-4 text-xs font-bold uppercase tracking-widest text-white/40">
                    Group {matchTeamRow.groupName}
                </div>
            )}
            <div className="overflow-x-auto">
                {/* No forced min-width -- Figma fits every column without scrolling; the
                    overflow-x-auto above is a safety net for extreme cases (long team
                    names, many teams), not the expected default. */}
                <div>
                    {/* Header */}
                    <div className="flex items-center gap-1 px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/40 border-b border-white/10">
                        <span className="w-5 text-center flex-shrink-0">Pos</span>
                        <span className="flex-1">Team</span>
                        {columns.map(col => (
                            <span key={col.key} className="w-8 text-center flex-shrink-0">{col.label}</span>
                        ))}
                    </div>

                    {/* Rows -- position is the render-time index within `rows` (post
                        group-filter), never row.position: that field is computed
                        pre-sort inside useLiveStandings itself, so it goes stale the
                        moment this list is sliced to one group (same reason
                        StandingsGrid.tsx elsewhere never uses it either). */}
                    {rows.map((row, index) => {
                        const isMatchTeam = row.teamId === homeTeamId || row.teamId === awayTeamId;
                        return (
                            <div
                                key={row.teamId}
                                className={`flex items-center gap-1 px-3 py-3 border-b border-white/5 last:border-b-0 ${isMatchTeam ? 'bg-white/5' : ''
                                    }`}
                            >
                                <span className="w-5 text-center text-sm text-white/60 flex-shrink-0">{index + 1}</span>
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                                        <TeamLogo logo={row.teamLogo} name={row.teamName} size="sm" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold truncate">{row.teamName}</div>
                                        {row.university && (
                                            <div className="text-[10px] text-white/40 uppercase tracking-wide truncate">{row.university}</div>
                                        )}
                                    </div>
                                </div>
                                {columns.map(col => (
                                    <span
                                        key={col.key}
                                        className={`w-8 text-center text-sm flex-shrink-0 ${col.key === 'points' ? 'font-bold text-primary' : 'text-white/80'}`}
                                    >
                                        {formatCell(col.key, row[col.key] as number)}
                                    </span>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* /competitions/[id] defaults its view state to 'standings' on load
                (confirmed by reading the page's own useState default) -- no query
                param needed to land there. */}
            <Link
                href={`/competitions/${competitionId}`}
                className="flex items-center justify-center gap-1 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white border-t border-white/10 transition-colors"
            >
                View Full Standings
                <ChevronRight className="w-3.5 h-3.5" />
            </Link>
        </div>
    );
}
