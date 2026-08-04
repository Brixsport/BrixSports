'use client';

import { useMatchTimer } from '@/hooks/useWebSocket';

interface LiveMatchStatusProps {
    matchId: string;
    sport: string;
    variant?: 'default' | 'badge';
    fallbackPeriod?: string;
}

const PERIOD_LABELS: Record<string, string> = {
    FIRST_HALF: '1ST HALF',
    HALF_TIME: 'HT',
    SECOND_HALF: '2ND HALF',
    EXTRA_TIME_1: 'ET',
    EXTRA_TIME_2: 'ET',
    EXTRA_TIME_BREAK: 'ET HT',
    PENALTY_SHOOTOUT: 'PK',
    FINISHED: 'FT',
    // Basketball
    Q1: 'Q1',
    Q2: 'Q2',
    Q3: 'Q3',
    Q4: 'Q4',
    OT: 'OT',
};

export default function LiveMatchStatus({ matchId, sport, variant = 'default', fallbackPeriod }: LiveMatchStatusProps) {
    const { time: matchTime, isStale } = useMatchTimer(matchId);

    // No WS data ever received (fresh page load before first tick) — use DB fallback period.
    if (!matchTime) {
        // BUG-135: a genuine second overtime is 'OT2' (etc), not the flat 'OT' this
        // map only has -- fall back to showing the raw period rather than the
        // generic 'LIVE' for any OT-prefixed value this map doesn't have an exact key for.
        const fallbackLabel = fallbackPeriod
            ? (PERIOD_LABELS[fallbackPeriod] ?? (fallbackPeriod.startsWith('OT') ? fallbackPeriod : 'LIVE'))
            : 'LIVE';
        if (variant === 'badge') {
            return (
                <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    {fallbackLabel}
                </div>
            );
        }
        return (
            <div className="text-red-500 text-xs font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                {fallbackLabel}
            </div>
        );
    }

    // Determine what to show based on period
    let label: React.ReactNode = '';
    const minute = matchTime.minute;
    const extra = matchTime.extraTime > 0 ? `+${matchTime.extraTime}` : '';

    // BUG-135: a real second (or later) overtime is 'OT2'/'OT3'/etc, not the flat
    // 'OT' this switch used to match exactly -- normalize to 'OT' for the switch's
    // discriminant only; the case body below still displays the real matchTime.period.
    const switchPeriod = matchTime.period?.startsWith('OT') ? 'OT' : matchTime.period;

    switch (switchPeriod) {
        case 'HALF_TIME':
            label = 'HT';
            break;
        case 'FINISHED':
            label = 'FT';
            break;
        case 'EXTRA_TIME_BREAK':
            label = 'ET HT';
            break;
        case 'PENALTIES':
            label = 'PEN';
            break;
        case 'EXTRA_TIME_1':
        case 'EXTRA_TIME_2':
            label = (
                <span className="flex items-center">
                    <span className="text-[8px] mr-0.5 opacity-70">ET</span>
                    {minute}'
                    {extra && <span className="text-amber-400 font-black ml-0.5">{extra}</span>}
                </span>
            );
            break;
        case 'Q1':
        case 'Q2':
        case 'Q3':
        case 'Q4':
        case 'OT':
            // BasketballLogger now emits a real per-second countdown (mm/second =
            // remaining time in the quarter, not elapsed -- opposite semantics from
            // football's minute field). Render it once live data actually exists;
            // fall back to the bare quarter label if a viewer's socket hasn't
            // received a tick yet (fresh page load) or the value's gone stale.
            label = matchTime.second != null && !isStale ? (
                <span>
                    {matchTime.period} {minute}:{String(matchTime.second).padStart(2, '0')}
                </span>
            ) : matchTime.period;
            break;
        default:
            label = (
                <span>
                    {minute}'
                    {extra && <span className="text-amber-400 font-black ml-0.5">{extra}</span>}
                </span>
            );
    }

    if (variant === 'badge') {
        return (
            <div className={`flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg shadow-red-500/20 ${isStale ? 'opacity-50' : ''}`}>
                <div className={`w-2 h-2 bg-white rounded-full ${isStale ? '' : 'animate-pulse'}`} />
                <div className="flex items-center">{label}</div>
            </div>
        );
    }

    return (
        <div className={`text-red-500 text-xs font-bold flex items-center gap-1 ${isStale ? 'opacity-50' : ''}`}>
            <span className={`w-1.5 h-1.5 bg-red-500 rounded-full ${isStale ? '' : 'animate-pulse'}`}></span>
            <div className="flex items-center">{label}</div>
        </div>
    );
}
