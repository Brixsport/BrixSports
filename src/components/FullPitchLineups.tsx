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
    sport?: string; // 'Football' or 'Basketball'
}

// Helper to normalize position string to line category
const parsePositionToLine = (pos: string, sport: string = 'Football'): string => {
    const p = pos.toLowerCase().trim();

    // Basketball positions
    if (sport === 'Basketball') {
        if (p.includes('pg') || p.includes('point guard')) return 'GUARD';
        if (p.includes('sg') || p.includes('shooting guard')) return 'GUARD';
        if (p.includes('sf') || p.includes('small forward')) return 'FORWARD';
        if (p.includes('pf') || p.includes('power forward')) return 'FORWARD';
        if (p.includes('c') || p.includes('center')) return 'CENTER';
        if (p.includes('guard')) return 'GUARD';
        if (p.includes('forward')) return 'FORWARD';
        return 'GUARD'; // Default
    }

    // Football positions
    if (p.includes('gk') || p.includes('goalkeeper')) return 'GK';

    // Defenders
    if (p.includes('lb') || p.includes('rb') || p.includes('cb') ||
        p.includes('lwb') || p.includes('rwb') ||
        p.includes('def') || p.includes('back')) return 'DEF';

    // Defensive Midfielders (includes ALL midfielders except AM)
    if (p.includes('dm') || p.includes('defensive mid') || p.includes('cdm') ||
        p.includes('cm') || p.includes('lm') || p.includes('rm') || p.includes('mid')) return 'DM';

    // Attacking Midfielders
    if (p.includes('am') || p.includes('attacking mid') || p.includes('cam')) return 'AM';

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
// Each team stays in their own half with proper spacing
// Home team: 50-95% (bottom half), Away team: 5-50% (top half when mirrored)
const FOOTBALL_LINE_Y_RATIOS: Record<string, number> = {
    'FW': 15,   // Forwards - closest to opponent's goal
    'AM': 28,   // Attacking Midfielders
    'DM': 41,   // Defensive Midfielders (includes all CMs)
    'DEF': 54,  // Defenders
    'GK': 70    // Goalkeeper - deepest position
};

const BASKETBALL_LINE_Y_RATIOS: Record<string, number> = {
    'GUARD': 20,
    'FORWARD': 35,
    'CENTER': 50
};


export function FullPitchLineups({
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    homeLineup,
    awayLineup,
    onPlayerClick,
    sport = 'Football'
}: FullPitchLineupsProps) {
    const isBasketball = sport === 'Basketball';
    const LINE_Y_RATIOS = isBasketball ? BASKETBALL_LINE_Y_RATIOS : FOOTBALL_LINE_Y_RATIOS;
    const allLines = isBasketball ? ['GUARD', 'FORWARD', 'CENTER'] : ['GK', 'DEF', 'DM', 'AM', 'FW'];

    // Parse formation string to get expected player distribution
    const parseFormation = (formation: string): Record<string, number> => {
        if (isBasketball) {
            // Basketball doesn't use formations the same way
            return { 'GUARD': 2, 'FORWARD': 2, 'CENTER': 1 };
        }

        // Football formation parsing (e.g., "4-4-2", "4-3-3", "3-5-2")
        const parts = formation.split('-').map(n => parseInt(n, 10));
        const formationMap: Record<string, number> = { 'GK': 1 };

        if (parts.length >= 3) {
            formationMap['DEF'] = parts[0]; // Defenders

            // Handle formations with attacking midfielders (e.g., 4-2-3-1)
            if (parts.length === 4) {
                formationMap['DM'] = parts[1]; // Defensive/Central midfielders
                formationMap['AM'] = parts[2]; // Attacking midfielders
                formationMap['FW'] = parts[3]; // Forwards
            } else if (parts.length === 3) {
                // Standard 3-part formation (e.g., 4-4-2, 4-3-3)
                const totalMidfielders = parts[1];
                formationMap['FW'] = parts[2]; // Forwards

                // Distribute midfielders between DM and AM based on common patterns
                if (totalMidfielders >= 4) {
                    formationMap['DM'] = Math.ceil(totalMidfielders / 2);
                    formationMap['AM'] = Math.floor(totalMidfielders / 2);
                } else {
                    formationMap['DM'] = totalMidfielders;
                }
            }
        }

        return formationMap;
    };

    // Process lineup using formation-driven line geometry
    const processLineup = (players: Record<string, Player>, lineup: any[], isHome: boolean, formation: string) => {
        const processed: ProcessedPlayer[] = [];
        const formationMap = parseFormation(formation);

        // 1. Process all players and assign to lines based on their ACTUAL position
        lineup.forEach(entry => {
            const player = players[entry.playerId];
            if (!player) return;

            // Use the position from the lineup entry (which should be position-aware)
            const actualPosition = entry.position || player.position || 'MID';
            const assignedLine = parsePositionToLine(actualPosition, sport);

            processed.push({
                player,
                rating: entry.rating || 0,
                position: actualPosition,
                line: assignedLine,
                isCaptain: !!entry.isCaptain,
                isMotM: !!entry.isMotM,
                isStarter: entry.isStarter !== false
            });
        });

        // 2. Separate starters and substitutes
        const starters = processed.filter(p => p.isStarter);
        const substitutes = processed.filter(p => !p.isStarter);

        // 3. Group starters by line
        const lineMap: Record<string, ProcessedPlayer[]> = {};
        allLines.forEach(line => {
            lineMap[line] = starters.filter(p => p.line === line);
        });

        // 4. Render starters with formation-based positioning
        const starterNodes = allLines.flatMap((lineName) => {
            const linePlayers = lineMap[lineName];
            if (linePlayers.length === 0) return [];

            // Get fixed Y ratio for this line (PERCENTAGES)
            const yRatio = LINE_Y_RATIOS[lineName];
            const top = isHome ? `${yRatio}%` : `${100 - yRatio}%`;

            // Calculate horizontal distribution with better spacing (PERCENTAGES)
            const pitchWidth = 100;
            const usableWidth = pitchWidth * 0.90; // Increased from 0.8 to 0.9 for more spacing
            const startX = (pitchWidth - usableWidth) / 2;
            const playersInLine = linePlayers.length;

            // Sort players by position for better visual distribution
            // GK: center, DEF: LB, CB, CB, RB, MID: LM, CM, CM, RM, FW: LW, ST, RW
            const sortedPlayers = [...linePlayers].sort((a, b) => {
                const posA = a.position.toLowerCase();
                const posB = b.position.toLowerCase();

                // Left positions come first
                if (posA.includes('l') && !posB.includes('l')) return -1;
                if (!posA.includes('l') && posB.includes('l')) return 1;

                // Right positions come last
                if (posA.includes('r') && !posB.includes('r')) return 1;
                if (!posA.includes('r') && posB.includes('r')) return -1;

                // Center positions in the middle
                return 0;
            });

            return sortedPlayers.map((p, index) => {
                // Mathematical horizontal distribution with better spacing
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

    const homeResult = processLineup(homePlayers, homeLineup, true, homeTeam.formation || '4-4-2');
    const awayResult = processLineup(awayPlayers, awayLineup, false, awayTeam.formation || '4-4-2');

    return (
        <div className="w-full space-y-4 md:space-y-6">
            {/* Team Headers - Hidden on mobile, shown on desktop */}
            <div className="hidden md:flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <img src={homeTeam.logo} alt={homeTeam.name} className="w-10 h-10 object-contain" />
                    <div>
                        <span className="font-bold text-lg">{homeTeam.name}</span>
                        <div className="text-sm text-white/60">{homeTeam.formation || '4-4-2'}</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <span className="font-bold text-lg">{awayTeam.name}</span>
                        <div className="text-sm text-white/60">{awayTeam.formation || '4-4-2'}</div>
                    </div>
                    <img src={awayTeam.logo} alt={awayTeam.name} className="w-10 h-10 object-contain" />
                </div>
            </div>

            {/* Playing Surface - Enhanced larger view */}
            {/* Full-width edge-to-edge on mobile, contained on desktop */}
            <div className={`relative w-full -mx-4 md:mx-0 ${isBasketball ? 'aspect-[68/120]' : 'aspect-[68/120]'
                } min-h-[600px] md:min-h-[700px] lg:min-h-[800px] bg-gradient-to-b ${isBasketball
                    ? 'from-orange-900/30 via-orange-800/30 to-orange-900/30'
                    : 'from-green-900/40 via-green-800/40 to-green-900/40'
                } md:rounded-2xl overflow-hidden border-0 md:border border-white/10 shadow-2xl`}>
                {/* Surface markings */}
                {isBasketball ? <BasketballCourtMarkings /> : <FootballPitchMarkings />}

                {/* Home Team Starters */}
                <div className="absolute inset-0">
                    {homeResult.starterNodes}
                </div>

                {/* Away Team Starters */}
                <div className="absolute inset-0">
                    {awayResult.starterNodes}
                </div>
            </div>

            {/* Bench - Horizontal List Below */}
            {(homeResult.substitutes.length > 0 || awayResult.substitutes.length > 0) && (
                <div className="space-y-4 px-4">
                    {/* Home Bench */}
                    {homeResult.substitutes.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <img src={homeTeam.logo} alt={homeTeam.name} className="w-5 h-5 object-contain" />
                                <span className="text-sm font-semibold text-white/60">Substitutes</span>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
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
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
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

// Football Pitch Markings Component - Enhanced for larger display
function FootballPitchMarkings() {
    return (
        <div className="absolute inset-0 opacity-25">
            {/* Outer boundary */}
            <div className="absolute inset-2 border-2 border-white/60 rounded-sm"></div>

            {/* Top penalty area */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2/3 h-[16%] border-2 border-white/60 border-t-0"></div>

            {/* Top goal area */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1/3 h-[8%] border-2 border-white/60 border-t-0"></div>

            {/* Top goal box */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1/5 h-[4%] border-2 border-white/60 border-t-0 rounded-b-md bg-white/5"></div>

            {/* Top penalty spot */}
            <div className="absolute top-[12%] left-1/2 -translate-x-1/2 w-2 h-2 bg-white/60 rounded-full"></div>

            {/* Top penalty arc */}
            <div className="absolute top-[16%] left-1/2 -translate-x-1/2 w-24 h-12 border-2 border-white/60 border-t-0 border-l-0 border-r-0 rounded-b-full"></div>

            {/* Center line */}
            <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-white/60"></div>

            {/* Center circle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/60 rounded-full"></div>

            {/* Center spot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/60 rounded-full"></div>

            {/* Bottom penalty area */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-2/3 h-[16%] border-2 border-white/60 border-b-0"></div>

            {/* Bottom goal area */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-[8%] border-2 border-white/60 border-b-0"></div>

            {/* Bottom goal box */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/5 h-[4%] border-2 border-white/60 border-b-0 rounded-t-md bg-white/5"></div>

            {/* Bottom penalty spot */}
            <div className="absolute bottom-[12%] left-1/2 -translate-x-1/2 w-2 h-2 bg-white/60 rounded-full"></div>

            {/* Bottom penalty arc */}
            <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 w-24 h-12 border-2 border-white/60 border-b-0 border-l-0 border-r-0 rounded-t-full"></div>

            {/* Corner arcs */}
            <div className="absolute top-2 left-2 w-8 h-8 border-2 border-white/60 border-t-0 border-l-0 rounded-br-full"></div>
            <div className="absolute top-2 right-2 w-8 h-8 border-2 border-white/60 border-t-0 border-r-0 rounded-bl-full"></div>
            <div className="absolute bottom-2 left-2 w-8 h-8 border-2 border-white/60 border-b-0 border-l-0 rounded-tr-full"></div>
            <div className="absolute bottom-2 right-2 w-8 h-8 border-2 border-white/60 border-b-0 border-r-0 rounded-tl-full"></div>
        </div>
    );
}

// Basketball Court Markings Component
function BasketballCourtMarkings() {
    return (
        <div className="absolute inset-0 opacity-20">
            {/* Top hoop and key */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 sm:w-20 h-1 bg-white/40"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-16 sm:h-20 border border-white/40 sm:border-2 border-t-0 rounded-b-full"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-12 sm:h-16 border border-white/40 sm:border-2 border-t-0"></div>

            {/* Center circle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-28 sm:h-28 border border-white/40 sm:border-2 rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/40 rounded-full"></div>
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/40"></div>

            {/* Bottom hoop and key */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 sm:w-20 h-1 bg-white/40"></div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-16 sm:h-20 border border-white/40 sm:border-2 border-b-0 rounded-t-full"></div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/4 h-12 sm:h-16 border border-white/40 sm:border-2 border-b-0"></div>

            {/* Three-point lines (simplified) */}
            <div className="absolute top-0 left-0 right-0 h-1/3 border-l-2 border-r-2 border-white/20 rounded-b-[50%]"></div>
            <div className="absolute bottom-0 left-0 right-0 h-1/3 border-l-2 border-r-2 border-white/20 rounded-t-[50%]"></div>
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

    // Mobile-responsive sizes - Larger for better visibility on bigger pitch
    const sizeClasses = size === 'small'
        ? 'w-10 h-10 sm:w-9 sm:h-9'
        : 'w-16 h-16 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-18 lg:h-18 xl:w-20 xl:h-20';

    return (
        <div
            className="absolute cursor-pointer group"
            style={{ ...style, transform: 'translate(-50%, -50%)' }}
            onClick={onClick}
        >
            {/* FIXED HEIGHT CONTAINER - This is the ONLY element that affects geometry */}
            <div className="relative" style={{ width: 0, height: 0 }}>
                {/* Man of the Match star - ABSOLUTE OVERLAY */}
                {isMotM && (
                    <div className="absolute -top-6 sm:-top-7 md:-top-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                        <div className="relative">
                            <div className="absolute inset-0 bg-yellow-400 blur-sm sm:blur-md opacity-60 animate-pulse"></div>
                            <svg className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 relative z-10" viewBox="0 0 24 24" fill="gold" stroke="black" strokeWidth="1">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Captain armband - ABSOLUTE OVERLAY */}
                {isCaptain && (
                    <div className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-3 h-3 sm:w-4 sm:h-4 bg-yellow-400 rounded-full flex items-center justify-center z-20 border border-black sm:border-2 pointer-events-none">
                        <span className="text-[6px] sm:text-[7px] md:text-[8px] font-black text-black">C</span>
                    </div>
                )}

                {/* Player circle with jersey number - FIXED SIZE */}
                <div
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${sizeClasses} rounded-full border border-white sm:border-2 flex items-center justify-center transition-all group-hover:scale-110 shadow-lg ${isGoalkeeper ? 'bg-yellow-500/95 border-yellow-300 ring-1 sm:ring-2 ring-yellow-400/50' : 'bg-white/95 border-white'
                        }`}
                    style={{ backgroundColor: isGoalkeeper ? undefined : teamColor }}
                >
                    <span className={`text-[10px] sm:text-xs md:text-sm lg:text-base font-black ${isGoalkeeper ? 'text-black' : 'text-white drop-shadow-lg'}`}>
                        {player.number}
                    </span>
                </div>

                {/* Rating Badge - ABSOLUTE OVERLAY (does NOT affect layout) */}
                {rating > 0 && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 sm:mt-1.5 z-20 pointer-events-none">
                        <div className={`px-1 py-0.5 sm:px-1.5 rounded border sm:border-2 font-bold text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs shadow-lg leading-none whitespace-nowrap ${getRatingColor(rating)}`}>
                            {rating.toFixed(1)}
                        </div>
                    </div>
                )}

                {/* Player name - ABSOLUTE OVERLAY */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-5 sm:mt-6 md:mt-7 z-10 whitespace-nowrap pointer-events-none">
                    <p className="text-[7px] sm:text-[8px] md:text-[9px] lg:text-xs font-bold text-white drop-shadow-lg text-center bg-black/50 px-1 py-0.5 sm:px-1.5 rounded leading-none">
                        {player.jerseyName || player.name.split(' ').pop()}
                    </p>
                </div>

                {/* Enhanced tooltip on hover - Hidden on mobile, shown on desktop */}
                <div className="hidden md:block absolute top-full left-1/2 -translate-x-1/2 mt-12 lg:mt-16 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
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
            className="flex-shrink-0 flex items-center gap-1.5 sm:gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
        >
            {/* Jersey number - Mobile responsive */}
            <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold"
                style={{ backgroundColor: teamColor + '40', color: '#fff' }}
            >
                {player.number}
            </div>

            {/* Player info - Mobile responsive */}
            <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-white truncate max-w-[80px] sm:max-w-[120px]">
                    {player.jerseyName || player.name.split(' ').pop()}
                </div>
                <div className="text-[9px] sm:text-[10px] text-white/60">{position}</div>
            </div>

            {/* Rating - Only show if exists - Mobile responsive */}
            {rating > 0 && (
                <div className={`ml-auto px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${getRatingColor(rating)}`}>
                    {rating.toFixed(1)}
                </div>
            )}
        </div>
    );
}
