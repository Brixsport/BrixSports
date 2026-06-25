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
};

export default function LiveMatchStatus({ matchId, sport, variant = 'default', fallbackPeriod }: LiveMatchStatusProps) {
    const matchTime = useMatchTimer(matchId);

    if (!matchTime) {
        const fallbackLabel = fallbackPeriod ? (PERIOD_LABELS[fallbackPeriod] ?? 'LIVE') : 'LIVE';
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

    switch (matchTime.period) {
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
            <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg shadow-red-500/20">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <div className="flex items-center">{label}</div>
            </div>
        );
    }

    return (
        <div className="text-red-500 text-xs font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            <div className="flex items-center">{label}</div>
        </div>
    );
}
