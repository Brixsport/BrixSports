'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface TeamStatsChartProps {
    stats: {
        played: number;
        won: number;
        drawn: number;
        lost: number;
        [key: string]: any;
    };
}

export default function TeamStatsChart({ stats }: TeamStatsChartProps) {
    const pieData = [
        { name: 'Wins', value: stats.won },
        { name: 'Draws', value: stats.drawn },
        { name: 'Losses', value: stats.lost }
    ].filter(d => d.value > 0);

    // If no data, show empty state or handle gracefully
    if (pieData.length === 0) {
        return (
            <div className="absolute inset-0 flex items-center justify-center text-white/40 font-medium">
                No stats available
            </div>
        );
    }

    return (
        <>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {pieData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.name === 'Wins' ? '#3b82f6' : entry.name === 'Draws' ? '#f59e0b' : '#ef4444'}
                                stroke="rgba(0,0,0,0)"
                            />
                        ))}
                    </Pie>
                    <RechartsTooltip
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                    />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-3xl font-black">{stats.played}</span>
                <span className="text-xs text-white/40 uppercase font-bold">Total</span>
            </div>
        </>
    );
}
