'use client';

import { Player } from '@/types';
// Import explicitly to ensure type availability (though dynamic import is used below for component)
import type { PitchPlayer } from './lineup/ResponsivePitch';
// We'll use a dynamic import for the component inside the render to match previous pattern if needed, 
// but standard import is better for type safety. Let's use standard import.
import { ResponsivePitch } from './lineup/ResponsivePitch';

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
    homeLineup: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean; isStarter?: boolean; isMotM?: boolean }>;
    awayLineup: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean; isStarter?: boolean; isMotM?: boolean }>;
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

// Formation lines
const FOOTBALL_LINES = ['GK', 'DEF', 'DM', 'AM', 'FW'];
const BASKETBALL_LINES = ['GUARD', 'FORWARD', 'CENTER'];

// Y-Ratios (Depth percentages for each line) - Standardized for 0-100 logic
const FOOTBALL_LINE_Y_RATIOS: Record<string, number> = {
    'FW': 15,
    'AM': 28,
    'DM': 42,
    'DEF': 58,
    'GK': 75
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
    const allLines = isBasketball ? BASKETBALL_LINES : FOOTBALL_LINES;

    // Parse formation string to get expected player distribution (optional, used for validation if needed)
    const parseFormation = (formation: string): Record<string, number> => {
        if (isBasketball) return { 'GUARD': 2, 'FORWARD': 2, 'CENTER': 1 };

        // Football formation parsing (e.g., "4-4-2")
        const parts = formation.split('-').map(n => parseInt(n, 10));
        const formationMap: Record<string, number> = { 'GK': 1 };

        if (parts.length >= 3) {
            formationMap['DEF'] = parts[0];
            if (parts.length === 4) {
                formationMap['DM'] = parts[1];
                formationMap['AM'] = parts[2];
                formationMap['FW'] = parts[3];
            } else if (parts.length === 3) {
                const totalMidfielders = parts[1];
                formationMap['FW'] = parts[2];
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
    const processLineupForPitch = (players: Record<string, Player>, lineup: any[], isHome: boolean, formation: string): PitchPlayer[] => {
        const pitchPlayers: PitchPlayer[] = [];

        // 1. Assign Lines
        const playersWithLines = lineup.map(entry => {
            const player = players[entry.playerId];
            if (!player) return null;
            const actualPosition = entry.position || player.position || 'MID';
            const assignedLine = parsePositionToLine(actualPosition, sport);
            return {
                player,
                entry,
                line: assignedLine,
                position: actualPosition
            };
        }).filter((p): p is NonNullable<typeof p> => p !== null && (p.entry.isStarter !== false));

        // 2. Group by Line
        const lineGroups: Record<string, typeof playersWithLines> = {};
        allLines.forEach(line => lineGroups[line] = []);
        playersWithLines.forEach(p => {
            if (lineGroups[p.line]) {
                lineGroups[p.line].push(p);
            }
            // Fallback for MID or unmapped positions
            else {
                // Try to put generic MIDs in DM (often safer) or split if possible
                if (lineGroups['DM']) lineGroups['DM'].push(p);
                else if (lineGroups['AM']) lineGroups['AM'].push(p);
                // Last resort: put in first available group after GK
                else if (isBasketball && lineGroups['GUARD']) lineGroups['GUARD'].push(p);
                else if (!isBasketball && lineGroups['DEF']) lineGroups['DEF'].push(p);
            }
        });

        // 3. Calculate Positions (Percentages)
        Object.entries(lineGroups).forEach(([line, linePlayers]) => {
            if (linePlayers.length === 0) return;

            // Sort left-to-right based on position name
            linePlayers.sort((a, b) => {
                const posA = a.position.toLowerCase();
                const posB = b.position.toLowerCase();
                if (posA.includes('l') && !posB.includes('l')) return -1;
                if (!posA.includes('l') && posB.includes('l')) return 1;
                if (posA.includes('r') && !posB.includes('r')) return 1;
                if (!posA.includes('r') && posB.includes('r')) return -1;
                return 0;
            });

            // Y-Coordinate (Vertical Depth)
            // We use a 0-100 system where 0 is Top and 100 is Bottom.
            // Home Team: Bottom Half (50-100)
            // Away Team: Top Half (0-50)

            let y: number;

            if (isBasketball) {
                // Basketball spacing (vertical half court logic per team? actually full court usually)
                // Assuming full court view:
                // Home defends bottom, Away defends top.
                if (isHome) {
                    if (line === 'GUARD') y = 75;
                    else if (line === 'CENTER') y = 90;
                    else y = 60; // FORWARD
                } else {
                    if (line === 'GUARD') y = 25;
                    else if (line === 'CENTER') y = 10;
                    else y = 40; // FORWARD
                }
            } else {
                // Football
                if (isHome) {
                    // Home is Bottom (50-100)
                    // GK: 92%, DEF: 82%, DM: 70%, AM: 60%, FW: 53%
                    if (line === 'GK') y = 92;
                    else if (line === 'DEF') y = 82;
                    else if (line === 'DM') y = 70;
                    else if (line === 'AM') y = 62;
                    else if (line === 'FW') y = 54;
                    else y = 70;
                } else {
                    // Away is Top (0-50)
                    // GK: 8%, DEF: 18%, DM: 30%, AM: 38%, FW: 46%
                    if (line === 'GK') y = 8;
                    else if (line === 'DEF') y = 18;
                    else if (line === 'DM') y = 30;
                    else if (line === 'AM') y = 38;
                    else if (line === 'FW') y = 46;
                    else y = 30;
                }
            }

            // X-Coordinate (Horizontal Width)
            const count = linePlayers.length;
            // Use 90% width to leave 5% margin on each side
            const availableWidth = 90;
            const startX = 5;
            const spacing = availableWidth / (count + 1);

            linePlayers.forEach((p, index) => {
                // formula: start + spacing * (i+1)
                const x = startX + (spacing * (index + 1));

                pitchPlayers.push({
                    player: p.player,
                    position: { x, y },
                    rating: p.entry.rating || 0,
                    isCaptain: !!p.entry.isCaptain,
                    isMotM: !!p.entry.isMotM,
                });
            });
        });

        return pitchPlayers;
    };

    // Get Substitutes separately
    const getSubstitutes = (players: Record<string, Player>, lineup: any[]) => {
        return lineup
            .filter(entry => entry.isStarter === false)
            .map(entry => {
                const player = players[entry.playerId];
                if (!player) return null;
                return {
                    player,
                    rating: entry.rating || 0,
                    position: entry.position || player.position || 'SUB',
                    teamColor: '' // Handled by render
                };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);
    };

    const homePitchPlayers = processLineupForPitch(homePlayers, homeLineup, true, homeTeam.formation || '4-4-2');
    const awayPitchPlayers = processLineupForPitch(awayPlayers, awayLineup, false, awayTeam.formation || '4-4-2');

    const allPitchPlayers = [...homePitchPlayers, ...awayPitchPlayers];
    const homeSubs = getSubstitutes(homePlayers, homeLineup);
    const awaySubs = getSubstitutes(awayPlayers, awayLineup);

    return (
        <div className="w-full space-y-4 md:space-y-6">
            {/* Team Headers */}
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

            {/* Responsive Pitch Component */}
            <div className="w-full max-w-lg mx-auto md:max-w-xl lg:max-w-2xl px-2">
                <ResponsivePitch
                    players={allPitchPlayers}
                    homeTeamColor={homeTeam.color}
                    awayTeamColor={awayTeam.color}
                    onPlayerClick={onPlayerClick}
                    orientation="vertical"
                />
            </div>

            {/* Bench Section */}
            {(homeSubs.length > 0 || awaySubs.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
                    {/* Home Bench */}
                    {homeSubs.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                                <img src={homeTeam.logo} alt={homeTeam.name} className="w-6 h-6 object-contain" />
                                <span className="font-bold text-sm">Valid Substitutes</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {homeSubs.map((sub) => (
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
                    {awaySubs.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 border-b border-white/10 pb-2 justify-end md:justify-start">
                                <img src={awayTeam.logo} alt={awayTeam.name} className="w-6 h-6 object-contain order-first md:order-last" />
                                <span className="font-bold text-sm">Valid Substitutes</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {awaySubs.map((sub) => (
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
            {/* Jersey number */}
            <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold"
                style={{ backgroundColor: teamColor + '40', color: '#fff' }}
            >
                {player.number}
            </div>

            {/* Player info */}
            <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-white truncate max-w-[150px]">
                    {player.jerseyName || player.name.split(' ').pop()}
                </div>
                <div className="text-[9px] sm:text-[10px] text-white/60">{position}</div>
            </div>

            {/* Rating */}
            {rating > 0 && (
                <div className={`ml-auto px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${getRatingColor(rating)}`}>
                    {rating.toFixed(1)}
                </div>
            )}
        </div>
    );
}
