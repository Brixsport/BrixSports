'use client';

import { Player } from '@/types';

interface FullPitchLineupsProps {
    homeTeam: {
        name: string;
        logo: string;
        color: string;
        formation?: string;
    };
    awayTeam: {
        name: string;
        logo: string;
        color: string;
        formation?: string;
    };
    homePlayers: Record<string, Player>;
    awayPlayers: Record<string, Player>;
    homeLineup: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean; isStarter?: boolean }>;
    awayLineup: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean; isStarter?: boolean }>;
    onPlayerClick: (player: Player) => void;
}

// Helper to normalize position string to line category
const parsePositionToLine = (pos: string): string => {
    const p = pos.toLowerCase().trim();

    // Goalkeeper
    if (p.includes('gk') || p.includes('goalkeeper')) return 'GK';

    // Defenders
    if (p.includes('lb') || p.includes('rb') || p.includes('cb') ||
        p.includes('lwb') || p.includes('rwb') ||
        p.includes('def') || p.includes('back')) return 'DEF';

    // Defensive Midfielders
    if (p.includes('dm') || p.includes('defensive mid') || p.includes('cdm')) return 'DM';

    // Attacking Midfielders
    if (p.includes('am') || p.includes('attacking mid') || p.includes('cam')) return 'AM';

    // Midfielders (general)
    if (p.includes('cm') || p.includes('lm') || p.includes('rm') ||
        p.includes('mid')) return 'MID';

    // Forwards
    if (p.includes('st') || p.includes('cf') || p.includes('lw') ||
        p.includes('rw') || p.includes('fw') || p.includes('forward') ||
        p.includes('striker') || p.includes('wing')) return 'FW';

    return 'MID'; // Default fallback
};

interface ProcessedPlayer {
    player: Player;
    rating: number;
    position: string;
    line: string;
    isCaptain: boolean;
    isMotM: boolean;
    isStarter: boolean;
}

// Formation-driven line geometry with fixed vertical ratios (PERCENTAGES)
const LINE_Y_RATIOS: Record<string, number> = {
    'FW': 22,
    'AM': 38,
    'MID': 45,
    'DM': 52,
    'DEF': 65,
    'GK': 82
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

    // Process lineup using formation-driven line geometry
    const processLineup = (players: Record<string, Player>, lineup: any[], isHome: boolean) => {
        const processed: ProcessedPlayer[] = [];

        // 1. Process all players and assign to lines
        lineup.forEach(entry => {
            const player = players[entry.playerId];
            if (!player) return;
            processed.push({
                player,
                rating: entry.rating || 0, // No fake ratings - use 0 if not available
                position: entry.position || player.position,
                line: parsePositionToLine(entry.position || player.position || ''),
                isCaptain: !!entry.isCaptain,
                isMotM: !!entry.isMotM,
                isStarter: entry.isStarter !== false // Default to true if not specified
            });
        });

        // 2. Separate starters and substitutes
        const starters = processed.filter(p => p.isStarter);
        const substitutes = processed.filter(p => !p.isStarter);

        // 3. Group starters by line
        const lineMap: Record<string, ProcessedPlayer[]> = {
            GK: starters.filter(p => p.line === 'GK'),
            DEF: starters.filter(p => p.line === 'DEF'),
            DM: starters.filter(p => p.line === 'DM'),
            MID: starters.filter(p => p.line === 'MID'),
            AM: starters.filter(p => p.line === 'AM'),
            FW: starters.filter(p => p.line === 'FW'),
        };

        // 4. Render starters with formation-based positioning
        const allLines = ['GK', 'DEF', 'DM', 'MID', 'AM', 'FW'];

        const starterNodes = allLines.flatMap((lineName) => {
            const linePlayers = lineMap[lineName];
            if (linePlayers.length === 0) return [];

            // Get fixed Y ratio for this line (PERCENTAGES)
            const yRatio = LINE_Y_RATIOS[lineName];
            const top = isHome ? `${yRatio}%` : `${100 - yRatio}%`;

            // Calculate horizontal distribution (PERCENTAGES)
            const pitchWidth = 100;
            const usableWidth = pitchWidth * 0.8;
            const startX = (pitchWidth - usableWidth) / 2;
            const playersInLine = linePlayers.length;

            return linePlayers.map((p, index) => {
                // Mathematical horizontal distribution
                const left = playersInLine === 1
                    ? '50%'
                    : `${startX + ((index + 1) * (usableWidth / (playersInLine + 1)))}%`;

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
                        isGoalkeeper={p.line === 'GK'}
                        size="normal"
                    />
                );
            });
        });

        return { starterNodes, substitutes };
    };

    const homeResult = processLineup(homePlayers, homeLineup, true);
    const awayResult = processLineup(awayPlayers, awayLineup, false);

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

            {/* Full Pitch - Starters Only */}
            <div className="relative w-full aspect-[9/16] bg-gradient-to-b from-green-900/40 via-green-800/40 to-green-900/40 rounded-2xl overflow-hidden border border-white/10">
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

                {/* Home Team Starters */}
                <div className="absolute inset-0">
                    {homeResult.starterNodes}
                </div>

                {/* Away Team Starters */}
                <div className="absolute inset-0">
                    {awayResult.starterNodes}
                </div>
            </div>

            {/* Bench - Horizontal List Below Pitch */}
            {(homeResult.substitutes.length > 0 || awayResult.substitutes.length > 0) && (
                <div className="space-y-4 px-4">
                    {/* Home Bench */}
                    {homeResult.substitutes.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <img src={homeTeam.logo} alt={homeTeam.name} className="w-5 h-5 object-contain" />
                                <span className="text-sm font-semibold text-white/60">Substitutes</span>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {homeResult.substitutes.map((sub) => (
                                    <BenchPlayer
                                        key={sub.player.id}
                                        player={sub.player}
                                        rating={sub.rating}
                                        position={sub.position}
                                        teamColor={homeTeam.color}
                                        onClick={() => onPlayerClick(sub.player)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Away Bench */}
                    {awayResult.substitutes.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <img src={awayTeam.logo} alt={awayTeam.name} className="w-5 h-5 object-contain" />
                                <span className="text-sm font-semibold text-white/60">Substitutes</span>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {awayResult.substitutes.map((sub) => (
                                    <BenchPlayer
                                        key={sub.player.id}
                                        player={sub.player}
                                        rating={sub.rating}
                                        position={sub.position}
                                        teamColor={awayTeam.color}
                                        onClick={() => onPlayerClick(sub.player)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
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
    size?: 'normal' | 'small';
}

function PlayerDot({ player, rating, position, isCaptain, isMotM, style, onClick, teamColor, isGoalkeeper, size = 'normal' }: PlayerDotProps) {
    // Get rating color based on performance (NO COLOR OVERLOAD - subtle colors)
    const getRatingColor = (rating: number) => {
        if (rating === 0) return 'bg-white/10 text-white/40 border-white/20'; // No rating yet
        if (rating >= 7.5) return 'bg-green-500/90 text-white border-green-400';
        if (rating >= 7.0) return 'bg-green-600/90 text-white border-green-500';
        if (rating >= 6.5) return 'bg-yellow-500/90 text-black border-yellow-400';
        if (rating >= 6.0) return 'bg-yellow-600/90 text-white border-yellow-500';
        if (rating >= 5.5) return 'bg-orange-500/90 text-white border-orange-400';
        return 'bg-red-500/90 text-white border-red-400';
    };

    const sizeClasses = size === 'small'
        ? 'w-8 h-8'
        : 'w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14';

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
                className={`relative ${sizeClasses} rounded-full border-2 flex items-center justify-center transition-all group-hover:scale-110 group-hover:z-30 shadow-lg ${isGoalkeeper ? 'bg-yellow-500/95 border-yellow-300 ring-2 ring-yellow-400/50' : 'bg-white/95 border-white'
                    }`}
                style={{ backgroundColor: isGoalkeeper ? undefined : teamColor }}
            >
                <span className={`text-xs md:text-base font-black ${isGoalkeeper ? 'text-black' : 'text-white drop-shadow-lg'}`}>
                    {player.number}
                </span>
            </div>

            {/* Rating Badge - Only show if rating exists */}
            {rating > 0 && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-20">
                    <div className={`px-1.5 py-0.5 rounded border-2 font-bold text-[10px] md:text-sm shadow-lg leading-none ${getRatingColor(rating)}`}>
                        {rating.toFixed(1)}
                    </div>
                </div>
            )}

            {/* Player name below rating */}
            <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
                <p className="text-[9px] md:text-xs font-bold text-white drop-shadow-lg text-center bg-black/50 px-1.5 py-0.5 rounded leading-none">
                    {player.jerseyName || player.name.split(' ').pop()}
                </p>
            </div>

            {/* Enhanced tooltip on hover - Desktop only */}
            <div className="hidden md:block absolute top-full left-1/2 -translate-x-1/2 mt-14 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                <div className="bg-black/95 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20 whitespace-nowrap shadow-xl">
                    <p className="text-xs font-bold text-white">{player.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-white/60 uppercase">{position}</span>
                        {rating > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${rating >= 7.0 ? 'bg-green-500/20 text-green-400' :
                                    rating >= 6.0 ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-red-500/20 text-red-400'
                                }`}>
                                ⭐ {rating.toFixed(1)}
                            </span>
                        )}
                        {isMotM && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-300">
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

interface BenchPlayerProps {
    player: Player;
    rating: number;
    position: string;
    teamColor: string;
    onClick: () => void;
}

function BenchPlayer({ player, rating, position, teamColor, onClick }: BenchPlayerProps) {
    const getRatingColor = (rating: number) => {
        if (rating === 0) return 'bg-white/10 text-white/40';
        if (rating >= 7.0) return 'bg-green-500/20 text-green-400';
        if (rating >= 6.0) return 'bg-yellow-500/20 text-yellow-400';
        return 'bg-red-500/20 text-red-400';
    };

    return (
        <div
            onClick={onClick}
            className="flex-shrink-0 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 cursor-pointer transition-all hover:scale-105"
        >
            {/* Jersey number */}
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: teamColor + '40', color: '#fff' }}
            >
                {player.number}
            </div>

            {/* Player info */}
            <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                    {player.jerseyName || player.name.split(' ').pop()}
                </div>
                <div className="text-[10px] text-white/60">{position}</div>
            </div>

            {/* Rating - Only show if exists */}
            {rating > 0 && (
                <div className={`ml-auto px-2 py-1 rounded text-xs font-bold ${getRatingColor(rating)}`}>
                    {rating.toFixed(1)}
                </div>
            )}
        </div>
    );
}
