export function StatBar({ label, homeValue, awayValue, homeTeam, awayTeam, suffix = '' }: any) {
    const total = homeValue + awayValue;
    const homePercent = total > 0 ? (homeValue / total) * 100 : 50;

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="font-bold">{homeValue}{suffix}</span>
                <span className="text-white/60 text-xs uppercase tracking-wider">{label}</span>
                <span className="font-bold">{awayValue}{suffix}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                <div
                    className="h-full bg-primary"
                    style={{ width: `${homePercent}%` }}
                />
            </div>
        </div>
    );
}
