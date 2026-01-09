'use client';

import { Player } from '@/types';

interface FullPitchLineupsProps {
    homeTeam: {
        name: string;
        logo: string;
        color: string;
    };
    awayTeam: {
        name: string;
        logo: string;
        color: string;
    };
    homePlayers: Record<string, Player>;
    awayPlayers: Record<string, Player>;
    homeLineup: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean }>;
    awayLineup: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean }>;
    onPlayerClick: (player: Player) => void;
}

// Helper to normalize position string
const parsePosition = (pos: string): string => {
    const p = pos.toLowerCase().trim();
    if (p.includes('gk') || p.includes('goalkeeper')) return 'GK';

    // Defenders
    if (p.includes('lb') || p.includes('left back')) return 'LB';
    if (p.includes('rb') || p.includes('right back')) return 'RB';
    if (p.includes('cb') || p.includes('central defender')) return 'CB';
    if (p.includes('def') || p.includes('defender')) return 'CB'; // Generic def -> CB
    if (p.includes('wb')) return p.includes('l') ? 'LWB' : 'RWB';

    // Midfielders
    if (p.includes('dm') || p.includes('defensive mid')) return 'DM';
    if (p.includes('am') || p.includes('attacking mid')) return 'AM';
    if (p.includes('lm') || p.includes('left mid')) return 'LM';
    if (p.includes('rm') || p.includes('right mid')) return 'RM';
    if (p.includes('cm') || p.includes('central mid') || p.includes('mid')) return 'CM';

    // Forwards
    if (p.includes('lw') || p.includes('left wing')) return 'LW';
    if (p.includes('rw') || p.includes('right wing')) return 'RW';
    if (p.includes('st') || p.includes('striker')) return 'ST';
    if (p.includes('cf') || p.includes('center forward')) return 'ST'; // Treat CF as ST for simplicity
    if (p.includes('fw') || p.includes('forward')) return 'ST';

    return 'CM'; // Default fallback
};

interface ProcessedPlayer {
    player: Player;
    rating: number;
    position: string;
    role: string;
    isCaptain: boolean;
    isMotM: boolean;
}

// Calculate position styles
const getPlayerStyle = (role: string, index: number, totalInRole: number, isHome: boolean, hasWideInLayer: boolean) => {
    // 1. Determine Y (Vertical) Depth %
    // Home team 0->100, Away team 100->0
    let yBase = 0;

    switch (role) {
        case 'GK': yBase = 5; break;
        case 'LB': case 'RB': case 'CB': case 'LWB': case 'RWB': yBase = 18; break; // Defensive Line
        case 'DM': yBase = 30; break;
        case 'CM': case 'LM': case 'RM': yBase = 38; break;
        case 'AM': yBase = 44; break;
        case 'LW': case 'RW': case 'ST': yBase = 48; break;
        default: yBase = 38;
    }

    const top = isHome ? `${yBase}%` : `${100 - yBase}%`;

    // 2. Determine X (Horizontal) %
    let left = '50%';

    // Fixed side positions
    if (role === 'LB' || role === 'LWB') left = '10%';
    else if (role === 'RB' || role === 'RWB') left = '90%';
    else if (role === 'LM' || role === 'LW') left = '15%';
    else if (role === 'RM' || role === 'RW') left = '85%';
    else {
        // Central roles (CB, DM, CM, AM, ST) - distribute evenly in center
        // If there are wide players in this layer (e.g. Back 4 has LB/RB), we squeeze the central ones

        let widthSpan = 80; // Default span
        let startX = 10;

        // Adjust for specific layers that mix fixed and dynamic
        if (role === 'CB' && hasWideInLayer) {
            // If we have LB/RB, CBs should be compactly in center
            widthSpan = 40;
            startX = 30;
        }

        if (totalInRole === 1) left = '50%';
        else {
            const step = widthSpan / (totalInRole + 1); // +1 to create margins
            const percent = startX + (step * (index + 1));
            left = `${percent}%`;
        }
    }

    return { top, left };
};

export function FullPitchLineups({
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    homeLineup,
    awayLineup,
    onPlayerClick
}: FullPitchLineupsProps) {

    // Process a lineup into layers
    const processLineup = (players: Record<string, Player>, lineup: any[], isHome: boolean) => {
        const processed: ProcessedPlayer[] = [];

        // 1. Process all players and assign normalized roles
        lineup.forEach(entry => {
            const player = players[entry.playerId];
            if (!player) return;
            processed.push({
                player,
                rating: entry.rating,
                position: entry.position || player.position,
                role: parsePosition(entry.position || player.position || ''),
                isCaptain: !!entry.isCaptain,
                isMotM: !!entry.isMotM
            });
        });

        // 2. Define logical layers in order from Goalkeeper to Forward
        // We will filter for only those that have players
        const allLayers = ['GK', 'DEF', 'DM', 'MID', 'AM', 'FWD'];

        const layerMap: Record<string, ProcessedPlayer[]> = {
            GK: processed.filter(p => p.role === 'GK'),
            DEF: processed.filter(p => ['LB', 'RB', 'CB', 'LWB', 'RWB'].includes(p.role)),
            DM: processed.filter(p => p.role === 'DM'),
            MID: processed.filter(p => ['CM', 'LM', 'RM'].includes(p.role)),
            AM: processed.filter(p => p.role === 'AM'),
            FWD: processed.filter(p => ['ST', 'LW', 'RW'].includes(p.role)),
        };

        // Identify which layers are active
        const activeLayers = allLayers.filter(l => layerMap[l].length > 0);

        // Calculate dynamic Y-spacing
        // Available space: from 6% (Goal) to 46% (Near Halfway)
        const minY = 6;
        const maxY = 46;

        const getDynamicY = (layerName: string) => {
            const index = activeLayers.indexOf(layerName);
            if (index === -1) return 25;
            if (activeLayers.length <= 1) return 25;

            // Distribute evenly
            const step = (maxY - minY) / (activeLayers.length - 1);
            return minY + (step * index);
        };

        // 3. Map to components
        return activeLayers.flatMap((layerName) => {
            const layerPlayers = layerMap[layerName];
            const yDepth = getDynamicY(layerName);

            // Special check: Does this distinct defensive/mid layer have wide players?
            const hasWide = layerPlayers.some(p => ['LB', 'RB', 'LM', 'RM'].includes(p.role));

            // Sub-group strictly for distribution logic
            const centralInLayer = layerPlayers.filter(p => !['LB', 'RB', 'LM', 'RM', 'LW', 'RW'].includes(p.role));

            return layerPlayers.map((p, i) => {
                let index = i;
                let total = layerPlayers.length;

                // If this is a distributed central role, recalculate its index amongst ONLY central peers
                if (!['LB', 'RB', 'LM', 'RM', 'LW', 'RW'].includes(p.role)) {
                    index = centralInLayer.indexOf(p);
                    total = centralInLayer.length;
                }

                // Use dynamic Y instead of fixed role-based Y
                const top = isHome ? `${yDepth}%` : `${100 - yDepth}%`;

                // Get X position from helper (we ignore its top return)
                const { left } = getPlayerStyle(p.role, index, total, isHome, hasWide);

                return (
                    <PlayerDot
                        key={p.player.id}
                        player={p.player}
                        rating={p.rating}
                        position={p.position}
                        isCaptain={p.isCaptain}
                        isMotM={p.isMotM}
                        style={{ top, left }}
                        onClick={() => onPlayerClick(p.player)}
                        teamColor={isHome ? homeTeam.color : awayTeam.color}
                        isGoalkeeper={p.role === 'GK'}
                    />
                );
            });
        });
    };

    return (
        <div className="w-full space-y-4">
            {/* Team Headers */}
            <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <img src={homeTeam.logo} alt={homeTeam.name} className="w-8 h-8 object-contain" />
                    <span className="font-bold text-lg">{homeTeam.name}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="font-bold text-lg">{awayTeam.name}</span>
                    <img src={awayTeam.logo} alt={awayTeam.name} className="w-8 h-8 object-contain" />
                </div>
            </div>

            {/* Full Pitch */}
            <div className="relative w-full aspect-[2/3] md:aspect-[9/16] bg-gradient-to-b from-green-900/40 via-green-800/40 to-green-900/40 rounded-2xl overflow-hidden border border-white/10">
                {/* Pitch markings */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-8 border-2 border-white/40 border-t-0 rounded-b-lg"></div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-20 border-2 border-white/40 border-t-0"></div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-12 border-2 border-white/40 border-t-0"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/40 rounded-full"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/40 rounded-full"></div>
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/40"></div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-20 border-2 border-white/40 border-b-0"></div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-12 border-2 border-white/40 border-b-0"></div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/4 h-8 border-2 border-white/40 border-b-0 rounded-t-lg"></div>
                </div>

                {/* Home Team */}
                <div className="absolute inset-0">
                    {processLineup(homePlayers, homeLineup, true)}
                </div>

                {/* Away Team */}
                <div className="absolute inset-0">
                    {processLineup(awayPlayers, awayLineup, false)}
                </div>
            </div>
        </div>
    );
}

function getFormationString(groups: Record<string, any[]>): string {
    // This is optional now as we don't display formation string in the main view anymore or calculate it differently
    return "";
}

interface PlayerDotProps {
    player: Player;
    rating: number;
    position: string;
    isCaptain: boolean;
    isMotM: boolean;
    style: { top: string; left: string };
    onClick: () => void;
    teamColor: string;
    isGoalkeeper?: boolean;
}

function PlayerDot({ player, rating, position, isCaptain, isMotM, style, onClick, teamColor, isGoalkeeper }: PlayerDotProps) {
    // Get rating color based on performance
    const getRatingColor = (rating: number) => {
        if (rating >= 7.5) return 'bg-green-500 text-white border-green-400';
        if (rating >= 7.0) return 'bg-green-600 text-white border-green-500';
        if (rating >= 6.5) return 'bg-yellow-500 text-black border-yellow-400';
        if (rating >= 6.0) return 'bg-yellow-600 text-white border-yellow-500';
        if (rating >= 5.5) return 'bg-orange-500 text-white border-orange-400';
        return 'bg-red-500 text-white border-red-400';
    };

    return (
        <div
            className="absolute cursor-pointer group z-10"
            style={{ ...style, transform: 'translate(-50%, -50%)' }}
            onClick={onClick}
        >
            {/* Man of the Match star */}
            {isMotM && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                    <div className="relative">
                        <div className="absolute inset-0 bg-yellow-400 blur-md opacity-60 animate-pulse"></div>
                        <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24" fill="gold" stroke="black" strokeWidth="1">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                    </div>
                </div>
            )}

            {/* Captain armband */}
            {isCaptain && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center z-20 border-2 border-black">
                    <span className="text-[8px] font-black text-black">C</span>
                </div>
            )}

            {/* Player circle with jersey number */}
            <div
                className={`relative w-9 h-9 md:w-14 md:h-14 rounded-full border-2 md:border-3 flex items-center justify-center transition-all group-hover:scale-110 group-hover:z-30 shadow-lg ${isGoalkeeper ? 'bg-yellow-500/95 border-yellow-300 ring-2 ring-yellow-400/50' : 'bg-white/95 border-white'
                    }`}
                style={{ backgroundColor: isGoalkeeper ? undefined : teamColor }}
            >
                <span className={`text-xs md:text-base font-black ${isGoalkeeper ? 'text-black' : 'text-white drop-shadow-lg'}`}>
                    {player.number}
                </span>
            </div>

            {/* Rating Badge - Always Visible (SofaScore style) */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-20">
                <div className={`px-1.5 py-0.5 rounded-md border-2 font-bold text-[10px] md:text-sm shadow-lg leading-none ${getRatingColor(rating)}`}>
                    {rating.toFixed(1)}
                </div>
            </div>

            {/* Player name below rating */}
            <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
                <p className="text-[9px] md:text-xs font-bold text-white drop-shadow-lg text-center bg-black/50 px-1.5 py-0.5 rounded leading-none">
                    {player.jerseyName || player.name.split(' ').pop()}
                </p>
            </div>

            {/* Enhanced tooltip on hover */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-14 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                <div className="bg-black/95 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20 whitespace-nowrap shadow-xl">
                    <p className="text-xs font-bold text-white">{player.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-white/60 uppercase">{position}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${rating >= 7.0 ? 'bg-green-500/20 text-green-400' :
                            rating >= 6.0 ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                            }`}>
                            ⭐ {rating.toFixed(1)}
                        </span>
                        {isMotM && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-300 flex items-center gap-0.5">
                                🏆 MOTM
                            </span>
                        )}
                        {isCaptain && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                                👑 CAPTAIN
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
