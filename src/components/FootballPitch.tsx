'use client';

import { Player } from '@/types';

interface FootballPitchProps {
    players: Record<string, Player>;
    lineup: Array<{ playerId: string; rating: number; position?: string }>;
    teamName: string;
    onPlayerClick: (player: Player) => void;
    isHome?: boolean;
}

// Helper to determine player position on pitch based on their role
const getPositionStyle = (position: string, index: number, totalInPosition: number): React.CSSProperties => {
    const positionLower = position.toLowerCase();

    // Vertical positioning (top to bottom)
    let top = '50%';
    if (positionLower.includes('gk') || positionLower.includes('goalkeeper')) {
        top = '5%';
    } else if (positionLower.includes('def') || positionLower.includes('cb') || positionLower.includes('lb') || positionLower.includes('rb')) {
        top = '20%';
    } else if (positionLower.includes('mid') || positionLower.includes('cm') || positionLower.includes('dm') || positionLower.includes('am')) {
        top = positionLower.includes('dm') ? '35%' : positionLower.includes('am') ? '55%' : '45%';
    } else if (positionLower.includes('fw') || positionLower.includes('st') || positionLower.includes('cf') || positionLower.includes('lw') || positionLower.includes('rw')) {
        top = '75%';
    }

    // Horizontal positioning (left to right)
    let left = '50%';
    if (totalInPosition === 1) {
        left = '50%';
    } else if (totalInPosition === 2) {
        left = index === 0 ? '30%' : '70%';
    } else if (totalInPosition === 3) {
        left = index === 0 ? '20%' : index === 1 ? '50%' : '80%';
    } else if (totalInPosition === 4) {
        left = index === 0 ? '15%' : index === 1 ? '38%' : index === 2 ? '62%' : '85%';
    } else if (totalInPosition === 5) {
        left = index === 0 ? '10%' : index === 1 ? '30%' : index === 2 ? '50%' : index === 3 ? '70%' : '90%';
    }

    // Adjust for wide positions
    if (positionLower.includes('lw') || positionLower.includes('lb') || positionLower.includes('lm')) {
        left = '15%';
    } else if (positionLower.includes('rw') || positionLower.includes('rb') || positionLower.includes('rm')) {
        left = '85%';
    }

    return { top, left, transform: 'translate(-50%, -50%)' };
};

// Group players by position type
const groupPlayersByPosition = (
    players: Record<string, Player>,
    lineup: Array<{ playerId: string; rating: number; position?: string }>
) => {
    const groups: Record<string, Array<{ player: Player; rating: number; position: string }>> = {
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
            groups.GK.push({ player, rating: entry.rating, position: entry.position || player.position });
        } else if (pos.includes('def') || pos.includes('cb') || pos.includes('lb') || pos.includes('rb')) {
            groups.DEF.push({ player, rating: entry.rating, position: entry.position || player.position });
        } else if (pos.includes('mid') || pos.includes('cm') || pos.includes('dm') || pos.includes('am') || pos.includes('lm') || pos.includes('rm')) {
            groups.MID.push({ player, rating: entry.rating, position: entry.position || player.position });
        } else if (pos.includes('fw') || pos.includes('st') || pos.includes('cf') || pos.includes('lw') || pos.includes('rw') || pos.includes('forward') || pos.includes('striker')) {
            groups.FWD.push({ player, rating: entry.rating, position: entry.position || player.position });
        } else {
            // Default to midfielder if unknown
            groups.MID.push({ player, rating: entry.rating, position: entry.position || player.position });
        }
    });

    return groups;
};

export function FootballPitch({ players, lineup, teamName, onPlayerClick, isHome = true }: FootballPitchProps) {
    const groups = groupPlayersByPosition(players, lineup);

    return (
        <div className="relative w-full aspect-[2/3] bg-gradient-to-b from-green-900/40 to-green-800/40 rounded-2xl overflow-hidden border border-white/10">
            {/* Pitch markings */}
            <div className="absolute inset-0 opacity-20">
                {/* Center circle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/40 rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/40 rounded-full"></div>

                {/* Penalty areas */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-20 border-2 border-white/40 border-t-0"></div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-20 border-2 border-white/40 border-b-0"></div>

                {/* Goal areas */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-12 border-2 border-white/40 border-t-0"></div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-12 border-2 border-white/40 border-b-0"></div>

                {/* Halfway line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/40"></div>
            </div>

            {/* Team name */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-black/60 backdrop-blur-sm px-4 py-1 rounded-full border border-white/20">
                    <span className="text-xs font-bold uppercase tracking-wider text-white">{teamName}</span>
                </div>
            </div>

            {/* Players */}
            <div className="absolute inset-0">
                {/* Goalkeeper */}
                {groups.GK.map((item, index) => (
                    <PlayerDot
                        key={item.player.id}
                        player={item.player}
                        rating={item.rating}
                        position={item.position}
                        style={getPositionStyle(item.position, index, groups.GK.length)}
                        onClick={() => onPlayerClick(item.player)}
                        isGoalkeeper
                    />
                ))}

                {/* Defenders */}
                {groups.DEF.map((item, index) => (
                    <PlayerDot
                        key={item.player.id}
                        player={item.player}
                        rating={item.rating}
                        position={item.position}
                        style={getPositionStyle(item.position, index, groups.DEF.length)}
                        onClick={() => onPlayerClick(item.player)}
                    />
                ))}

                {/* Midfielders */}
                {groups.MID.map((item, index) => (
                    <PlayerDot
                        key={item.player.id}
                        player={item.player}
                        rating={item.rating}
                        position={item.position}
                        style={getPositionStyle(item.position, index, groups.MID.length)}
                        onClick={() => onPlayerClick(item.player)}
                    />
                ))}

                {/* Forwards */}
                {groups.FWD.map((item, index) => (
                    <PlayerDot
                        key={item.player.id}
                        player={item.player}
                        rating={item.rating}
                        position={item.position}
                        style={getPositionStyle(item.position, index, groups.FWD.length)}
                        onClick={() => onPlayerClick(item.player)}
                    />
                ))}
            </div>
        </div>
    );
}

interface PlayerDotProps {
    player: Player;
    rating: number;
    position: string;
    style: React.CSSProperties;
    onClick: () => void;
    isGoalkeeper?: boolean;
}

function PlayerDot({ player, rating, position, style, onClick, isGoalkeeper }: PlayerDotProps) {
    return (
        <div
            className="absolute cursor-pointer group"
            style={style}
            onClick={onClick}
        >
            {/* Player circle */}
            <div className={`relative w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all group-hover:scale-110 ${isGoalkeeper
                    ? 'bg-yellow-500/90 border-yellow-300'
                    : rating >= 8
                        ? 'bg-blue-500/90 border-blue-300'
                        : rating >= 7
                            ? 'bg-primary/90 border-primary'
                            : 'bg-white/90 border-white/60'
                }`}>
                <span className={`text-xs font-black ${isGoalkeeper || rating >= 7 ? 'text-black' : 'text-gray-800'}`}>
                    {player.number}
                </span>
            </div>

            {/* Player info tooltip */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                <div className="bg-black/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/20 whitespace-nowrap">
                    <p className="text-xs font-bold text-white">{player.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-white/60 uppercase">{position}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${rating >= 8 ? 'bg-blue-500/20 text-blue-400' :
                                rating >= 7 ? 'bg-primary/20 text-primary' :
                                    'bg-white/20 text-white/60'
                            }`}>
                            {rating.toFixed(1)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
