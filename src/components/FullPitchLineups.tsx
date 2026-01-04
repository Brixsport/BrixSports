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

// Helper to determine player position on pitch (0-100% scale)
const getPositionOnPitch = (position: string, index: number, totalInPosition: number, isHome: boolean) => {
    const positionLower = position.toLowerCase();

    // Vertical positioning (0% = top/home goal, 100% = bottom/away goal)
    let verticalPercent = 50;

    if (positionLower.includes('gk') || positionLower.includes('goalkeeper')) {
        verticalPercent = isHome ? 5 : 95;
    } else if (positionLower.includes('def') || positionLower.includes('cb') || positionLower.includes('lb') || positionLower.includes('rb')) {
        verticalPercent = isHome ? 18 : 82;
    } else if (positionLower.includes('mid') || positionLower.includes('cm') || positionLower.includes('dm') || positionLower.includes('am')) {
        if (positionLower.includes('dm')) {
            verticalPercent = isHome ? 32 : 68;
        } else if (positionLower.includes('am')) {
            verticalPercent = isHome ? 45 : 55;
        } else {
            verticalPercent = isHome ? 38 : 62;
        }
    } else if (positionLower.includes('fw') || positionLower.includes('st') || positionLower.includes('cf') || positionLower.includes('lw') || positionLower.includes('rw')) {
        verticalPercent = isHome ? 52 : 48;
    }

    // Horizontal positioning (left to right)
    let horizontalPercent = 50;
    if (totalInPosition === 1) {
        horizontalPercent = 50;
    } else if (totalInPosition === 2) {
        horizontalPercent = index === 0 ? 30 : 70;
    } else if (totalInPosition === 3) {
        horizontalPercent = index === 0 ? 20 : index === 1 ? 50 : 80;
    } else if (totalInPosition === 4) {
        horizontalPercent = index === 0 ? 15 : index === 1 ? 38 : index === 2 ? 62 : 85;
    } else if (totalInPosition === 5) {
        horizontalPercent = index === 0 ? 10 : index === 1 ? 30 : index === 2 ? 50 : index === 3 ? 70 : 90;
    }

    // Adjust for wide positions
    if (positionLower.includes('lw') || positionLower.includes('lb') || positionLower.includes('lm')) {
        horizontalPercent = 12;
    } else if (positionLower.includes('rw') || positionLower.includes('rb') || positionLower.includes('rm')) {
        horizontalPercent = 88;
    }

    return { top: `${verticalPercent}%`, left: `${horizontalPercent}%` };
};

// Group players by position type
const groupPlayersByPosition = (
    players: Record<string, Player>,
    lineup: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean }>
) => {
    const groups: Record<string, Array<{ player: Player; rating: number; position: string; isCaptain: boolean }>> = {
        GK: [],
        DEF: [],
        MID: [],
        FWD: []
    };

    lineup.forEach(entry => {
        const player = players[entry.playerId];
        if (!player) return;

        const pos = (entry.position || player.position || '').toLowerCase();

        if (pos.includes('gk') || pos.includes('goalkeeper')) {
            groups.GK.push({ player, rating: entry.rating, position: entry.position || player.position, isCaptain: entry.isCaptain || false });
        } else if (pos.includes('def') || pos.includes('cb') || pos.includes('lb') || pos.includes('rb')) {
            groups.DEF.push({ player, rating: entry.rating, position: entry.position || player.position, isCaptain: entry.isCaptain || false });
        } else if (pos.includes('mid') || pos.includes('cm') || pos.includes('dm') || pos.includes('am') || pos.includes('lm') || pos.includes('rm')) {
            groups.MID.push({ player, rating: entry.rating, position: entry.position || player.position, isCaptain: entry.isCaptain || false });
        } else if (pos.includes('fw') || pos.includes('st') || pos.includes('cf') || pos.includes('lw') || pos.includes('rw') || pos.includes('forward') || pos.includes('striker')) {
            groups.FWD.push({ player, rating: entry.rating, position: entry.position || player.position, isCaptain: entry.isCaptain || false });
        } else {
            groups.MID.push({ player, rating: entry.rating, position: entry.position || player.position, isCaptain: entry.isCaptain || false });
        }
    });

    return groups;
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
    const homeGroups = groupPlayersByPosition(homePlayers, homeLineup);
    const awayGroups = groupPlayersByPosition(awayPlayers, awayLineup);

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
            <div className="relative w-full aspect-[9/16] md:aspect-[9/14] bg-gradient-to-b from-green-900/40 via-green-800/40 to-green-900/40 rounded-2xl overflow-hidden border border-white/10">
                {/* Pitch markings */}
                <div className="absolute inset-0 opacity-20">
                    {/* Top goal */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/4 h-8 border-2 border-white/40 border-t-0 rounded-b-lg"></div>

                    {/* Top penalty area */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-20 border-2 border-white/40 border-t-0"></div>

                    {/* Top goal area */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-12 border-2 border-white/40 border-t-0"></div>

                    {/* Center circle */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/40 rounded-full"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/40 rounded-full"></div>

                    {/* Halfway line */}
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/40"></div>

                    {/* Bottom penalty area */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-20 border-2 border-white/40 border-b-0"></div>

                    {/* Bottom goal area */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-12 border-2 border-white/40 border-b-0"></div>

                    {/* Bottom goal */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/4 h-8 border-2 border-white/40 border-b-0 rounded-t-lg"></div>
                </div>

                {/* Home Team Players (Top half) */}
                <div className="absolute inset-0">
                    {Object.entries(homeGroups).map(([groupName, groupPlayers]) =>
                        groupPlayers.map((item, index) => {
                            const position = getPositionOnPitch(item.position, index, groupPlayers.length, true);
                            return (
                                <PlayerDot
                                    key={item.player.id}
                                    player={item.player}
                                    rating={item.rating}
                                    position={item.position}
                                    isCaptain={item.isCaptain}
                                    style={position}
                                    onClick={() => onPlayerClick(item.player)}
                                    teamColor={homeTeam.color}
                                    isGoalkeeper={groupName === 'GK'}
                                />
                            );
                        })
                    )}
                </div>

                {/* Away Team Players (Bottom half) */}
                <div className="absolute inset-0">
                    {Object.entries(awayGroups).map(([groupName, groupPlayers]) =>
                        groupPlayers.map((item, index) => {
                            const position = getPositionOnPitch(item.position, index, groupPlayers.length, false);
                            return (
                                <PlayerDot
                                    key={item.player.id}
                                    player={item.player}
                                    rating={item.rating}
                                    position={item.position}
                                    isCaptain={item.isCaptain}
                                    style={position}
                                    onClick={() => onPlayerClick(item.player)}
                                    teamColor={awayTeam.color}
                                    isGoalkeeper={groupName === 'GK'}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            {/* Formation Display */}
            <div className="flex items-center justify-between px-4 text-sm text-white/60">
                <div>Formation: {getFormationString(homeGroups)}</div>
                <div>Formation: {getFormationString(awayGroups)}</div>
            </div>
        </div>
    );
}

function getFormationString(groups: Record<string, any[]>): string {
    const def = groups.DEF.length;
    const mid = groups.MID.length;
    const fwd = groups.FWD.length;
    return `${def}-${mid}-${fwd}`;
}

interface PlayerDotProps {
    player: Player;
    rating: number;
    position: string;
    isCaptain: boolean;
    style: { top: string; left: string };
    onClick: () => void;
    teamColor: string;
    isGoalkeeper?: boolean;
}

function PlayerDot({ player, rating, position, isCaptain, style, onClick, teamColor, isGoalkeeper }: PlayerDotProps) {
    return (
        <div
            className="absolute cursor-pointer group z-10"
            style={{ ...style, transform: 'translate(-50%, -50%)' }}
            onClick={onClick}
        >
            {/* Captain armband */}
            {isCaptain && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center z-20 border-2 border-black">
                    <span className="text-[8px] font-black text-black">C</span>
                </div>
            )}

            {/* Player circle */}
            <div
                className={`relative w-11 h-11 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center transition-all group-hover:scale-125 group-hover:z-30 shadow-lg ${isGoalkeeper
                        ? 'bg-yellow-500/95 border-yellow-300'
                        : rating >= 8
                            ? 'bg-blue-500/95 border-blue-300'
                            : rating >= 7
                                ? 'bg-primary/95 border-primary'
                                : 'bg-white/95 border-white/70'
                    }`}
                style={{
                    backgroundColor: !isGoalkeeper && rating < 7 ? teamColor : undefined
                }}
            >
                <span className={`text-xs md:text-sm font-black ${isGoalkeeper || rating >= 7 ? 'text-black' : 'text-white'}`}>
                    {player.number}
                </span>
            </div>

            {/* Player info tooltip */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                <div className="bg-black/95 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20 whitespace-nowrap shadow-xl">
                    <p className="text-xs font-bold text-white">{player.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-white/60 uppercase">{position}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${rating >= 8 ? 'bg-blue-500/20 text-blue-400' :
                                rating >= 7 ? 'bg-primary/20 text-primary' :
                                    'bg-white/20 text-white/60'
                            }`}>
                            {rating.toFixed(1)}
                        </span>
                        {isCaptain && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                                CAPTAIN
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
