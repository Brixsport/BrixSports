'use client';

import { Shirt } from 'lucide-react';
import { Player } from '@/types';
import { cn } from '@/lib/utils';
// Import explicitly to ensure type availability (though dynamic import is used below for component)
import type { PitchPlayer } from './lineup/ResponsivePitch';
// We'll use a dynamic import for the component inside the render to match previous pattern if needed, 
// but standard import is better for type safety. Let's use standard import.
import { ResponsivePitch } from './lineup/ResponsivePitch';
import { inferPlacementLegacy, resolveSlot, toPitchCoords } from '@/lib/lineup/placement';

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
    homeSubs?: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean; isMotM?: boolean }>;
    awaySubs?: Array<{ playerId: string; rating: number; position?: string; isCaptain?: boolean; isMotM?: boolean }>;
    onPlayerClick: (player: Player) => void;
    sport?: string; // 'Football' or 'Basketball'
    variant?: '11-a-side' | '5-a-side' | 'basketball' | '3x3';
    events?: any[]; // Match events for goal/assist tracking
}

// ========== FORMATION CONFIGURATION ==========
// X: 0-100 (Left->Right)
// Y: 0-100 (Home Perspective: 0=GK line, 100=Striker line) -> We will map this to 0-50/50-100 later.
// Note: We use a "Home Bottom" standard for defining these.
// 0 = Keeper, 10-30 = Defense, 40-60 = Midfield, 70-90 = Attack.

// Default fallback -- football/5-a-side moved to src/lib/lineup/placement.ts
// (LEGACY_FORMATION_TEMPLATES) and src/lib/lineup/formations.ts; kept here as
// plain literals since they're only ever used to pick a fallback formation
// *string* to pass in, not to look up slot coordinates directly.
const DEFAULT_FORMATION = '4-4-2';
const DEFAULT_FORMATION_5ASIDE = '1-2-1';
const DEFAULT_FORMATION_BASKETBALL = 'basketball';
const DEFAULT_FORMATION_3x3 = '3x3';

export function FullPitchLineups({
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    homeLineup,
    awayLineup,
    homeSubs: propHomeSubs,
    awaySubs: propAwaySubs,
    onPlayerClick,
    sport = 'Football',
    variant,
    events = []
}: FullPitchLineupsProps) {
    const isBasketball = sport === 'Basketball';

    // Calculate goals, assists and card status per player from events
    const playerStats = new Map<string, { goals: number; assists: number; card?: 'yellow' | 'red'; penalty?: boolean }>();

    events.forEach((event: any) => {
        if (!event.playerId) return;

        const stats = playerStats.get(event.playerId) || { goals: 0, assists: 0 };
        const isGoalEvent = event.type === 'Goal' || event.type === 'Penalty';

        // Count goals (in-game penalty conversions count as goals too, per FootballLogger's own model)
        if (isGoalEvent) {
            stats.goals++;
            if (event.type === 'Penalty') stats.penalty = true;
        }

        // Track card status (Red Card supersedes an earlier Yellow Card, incl. second-yellow)
        if (event.type === 'Yellow Card' && stats.card !== 'red') {
            stats.card = 'yellow';
        } else if (event.type === 'Red Card') {
            stats.card = 'red';
        }

        // Count assists (check both assistPlayerId and relatedPlayerId)
        const assisterId = event.assistPlayerId || event.relatedPlayerId;
        if (assisterId && isGoalEvent) {
            const assisterStats = playerStats.get(assisterId) || { goals: 0, assists: 0 };
            assisterStats.assists++;
            playerStats.set(assisterId, assisterStats);
        }

        playerStats.set(event.playerId, stats);
    });

    // *** Formation Slot Mapping -- BACKLOG-323: explicit stored placement when
    // available, else the frozen BACKLOG-322 role-bucket-inference heuristic. ***
    const processLineupForPitch = (players: Record<string, Player>, lineup: any[], isHome: boolean, formation: string): PitchPlayer[] => {
        if (isBasketball) {
            return processBasketballLineup(players, lineup, isHome);
        }

        const starters = lineup.filter(entry => entry.isStarter !== false);
        const isV2 = starters.length > 0 && starters.every(entry => typeof entry.slotId === 'string' && entry.slotId.length > 0);

        if (isV2) {
            const pitchPlayers: PitchPlayer[] = [];
            starters.forEach(entry => {
                const player = players[entry.playerId];
                if (!player) return;

                const slot = resolveSlot(formation, entry.slotId);
                const coords = slot
                    ? toPitchCoords(slot, isHome)
                    : (typeof entry.x === 'number' && typeof entry.y === 'number')
                        ? toPitchCoords({ x: entry.x, y: entry.y }, isHome)
                        : null;
                if (!coords) return; // unresolvable slot on a stale formation -- drop rather than mis-place

                const stats = playerStats.get(entry.playerId) || { goals: 0, assists: 0 };
                pitchPlayers.push({
                    player,
                    position: coords,
                    rating: entry.rating || 0,
                    isCaptain: !!entry.isCaptain,
                    isMotM: !!entry.isMotM,
                    goals: stats.goals,
                    assists: stats.assists,
                    card: stats.card,
                    penalty: stats.penalty,
                    isSubstituted: !!entry.isSubstituted,
                    subMinute: entry.subMinute,
                });
            });
            return pitchPlayers;
        }

        const fallback = variant === '5-a-side' ? DEFAULT_FORMATION_5ASIDE : DEFAULT_FORMATION;
        const cleanFormation = formation || fallback;
        return inferPlacementLegacy(players, lineup, isHome, cleanFormation, false, variant, playerStats);
    };

    // Minimal fallback for non-football (not the focus of refactor)
    const processBasketballLineup = (players: Record<string, Player>, lineup: any[], isHome: boolean) => {
        // [Existing logic wrapper or simplified]
        return lineup.map((entry, i) => ({
            player: players[entry.playerId],
            position: { x: 20 + (i % 3) * 30, y: isHome ? 70 : 30 }, // Dummy placement
            rating: entry.rating || 0
        })).filter(p => p.player) as PitchPlayer[];
    };

    const getFallbackFormation = () => {
        if (variant === '3x3') return DEFAULT_FORMATION_3x3;
        if (variant === 'basketball') return DEFAULT_FORMATION_BASKETBALL;
        if (variant === '5-a-side') return DEFAULT_FORMATION_5ASIDE;
        return DEFAULT_FORMATION;
    };

    const homePitchPlayers = processLineupForPitch(homePlayers, homeLineup, true, homeTeam.formation || getFallbackFormation());
    const awayPitchPlayers = processLineupForPitch(awayPlayers, awayLineup, false, awayTeam.formation || getFallbackFormation());

    const allPitchPlayers = [...homePitchPlayers, ...awayPitchPlayers];

    // Helper to get subs (unchanged logic)
    const getSubstitutes = (players: Record<string, Player>, lineup: any[], propSubs?: any[]) => {
        if (propSubs && propSubs.length > 0) {
            return propSubs.map(entry => {
                const player = players[entry.playerId];
                if (!player) return null;
                return {
                    player,
                    rating: entry.rating || 0,
                    position: entry.position || player.position || 'SUB',
                    teamColor: ''
                };
            }).filter((p): p is NonNullable<typeof p> => p !== null);
        }
        return lineup
            .filter(entry => entry.isStarter === false)
            .map(entry => {
                const player = players[entry.playerId];
                if (!player) return null;
                return {
                    player,
                    rating: entry.rating || 0,
                    position: entry.position || player.position || 'SUB',
                    teamColor: ''
                };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);
    };

    const homeSubs = getSubstitutes(homePlayers, homeLineup, propHomeSubs);
    const awaySubs = getSubstitutes(awayPlayers, awayLineup, propAwaySubs);

    return (
        <div className="w-full space-y-4 md:space-y-6">
            {/* Team Headers */}
            <div className="hidden md:flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <img src={homeTeam.logo} alt={homeTeam.name} className="w-10 h-10 object-contain" />
                    <div>
                        <span className="font-bold text-lg">{homeTeam.name}</span>
                        <div className="text-sm text-white/60">{homeTeam.formation || getFallbackFormation()}</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <span className="font-bold text-lg">{awayTeam.name}</span>
                        <div className="text-sm text-white/60">{awayTeam.formation || getFallbackFormation()}</div>
                    </div>
                    <img src={awayTeam.logo} alt={awayTeam.name} className="w-10 h-10 object-contain" />
                </div>
            </div>

            {/* Responsive Pitch Component - grows with the viewport (mobile-first, but should keep
                looking substantial on bigger screens, not shrink to a small centered card). The
                previous bug was an aspect-ratio that got progressively TALLER at each breakpoint
                (sm:aspect-[3/5] lg:aspect-[3/4]), so height ballooned out of proportion to width on
                wide screens while jersey/icon sizing (a % of width) didn't grow to match - that's
                what produced the huge dead gaps between rows. Keeping ONE fixed ratio at every
                breakpoint means width and height now scale together, so jerseys/ratings/icons
                (already sized as a % of the container) grow right along with the field itself. */}
            <div className="w-full mx-auto px-0 py-2 sm:py-3 lg:py-4">
                <div
                    className={`
                        relative
                        w-full mx-auto
                        ${variant === '5-a-side' || variant === '3x3'
                            ? 'aspect-[1/2] max-w-[420px]'
                            : variant === 'basketball'
                                ? 'aspect-[2/3] max-w-[520px]'
                                : 'aspect-[3/4] max-w-[720px]'}
                    `}
                >
                    <ResponsivePitch
                        players={allPitchPlayers}
                        homeTeamColor={homeTeam.color}
                        awayTeamColor={awayTeam.color}
                        onPlayerClick={onPlayerClick}
                        orientation="vertical"
                        variant={variant}
                    />
                </div>
            </div>

            {/* Substitutes - paired side-by-side rows (matches Figma: centered header between team badges, one home + one away sub per row) */}
            {(homeSubs.length > 0 || awaySubs.length > 0) && (
                <div className="px-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                        <img src={homeTeam.logo} alt={homeTeam.name} className="w-6 h-6 object-contain" />
                        <span className="font-bold text-sm text-white/80">Substitutes</span>
                        <img src={awayTeam.logo} alt={awayTeam.name} className="w-6 h-6 object-contain" />
                    </div>
                    <div className="space-y-2">
                        {Array.from({ length: Math.max(homeSubs.length, awaySubs.length) }).map((_, i) => (
                            <div key={i} className="grid grid-cols-2 gap-3">
                                {homeSubs[i] ? (
                                    <BenchPlayer
                                        player={homeSubs[i].player}
                                        rating={homeSubs[i].rating}
                                        position={homeSubs[i].position}
                                        teamColor={homeTeam.color}
                                        onClick={() => onPlayerClick(homeSubs[i].player)}
                                    />
                                ) : <div />}
                                {awaySubs[i] ? (
                                    <BenchPlayer
                                        player={awaySubs[i].player}
                                        rating={awaySubs[i].rating}
                                        position={awaySubs[i].position}
                                        teamColor={awayTeam.color}
                                        onClick={() => onPlayerClick(awaySubs[i].player)}
                                        reverse
                                    />
                                ) : <div />}
                            </div>
                        ))}
                    </div>
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
    reverse?: boolean;
}

function BenchPlayer({ player, rating, position, teamColor, onClick, reverse }: BenchPlayerProps) {
    const getRatingColor = (rating: number) => {
        if (rating === 0) return 'bg-white/10 text-white/40';
        if (rating >= 7.0) return 'bg-green-500/20 text-green-400';
        if (rating >= 6.0) return 'bg-yellow-500/20 text-yellow-400';
        return 'bg-red-500/20 text-red-400';
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-center gap-1.5 sm:gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 cursor-pointer transition-all",
                reverse && "flex-row-reverse text-right"
            )}
        >
            {/* Jersey icon (matches on-pitch treatment) */}
            <div className="relative w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center shrink-0">
                <Shirt className="absolute inset-0 w-full h-full" fill={teamColor} stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} />
                <span className="relative z-10 text-[9px] sm:text-[10px] font-bold text-white">{player.number}</span>
            </div>

            {/* Player info */}
            <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-semibold text-white truncate">
                    {player.jerseyName || player.name.split(' ').pop()}
                </div>
                <div className="text-[9px] sm:text-[10px] text-white/60">{position}</div>
            </div>

            {/* Rating */}
            {rating > 0 && (
                <div className={`shrink-0 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${getRatingColor(rating)}`}>
                    {rating.toFixed(1)}
                </div>
            )}
        </div>
    );
}
