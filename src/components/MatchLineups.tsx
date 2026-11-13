'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Target, TrendingUp, ArrowRightLeft, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { FullPitchLineups } from './FullPitchLineups';
import { PlayerStatsModal } from './PlayerStatsModal';
import { TeamLogo } from '@/lib/utils/team-logo';
import { formatEventMinute } from '@/lib/eventMinute';
import { deriveSubstitutions } from '@/lib/lineup/substitutions';

interface MatchLineupsProps {
    lineups: any;
    sport: string;
    homeTeam: any;
    awayTeam: any;
    events?: any[];
}

export default function MatchLineups({ lineups, sport, homeTeam, awayTeam, events = [] }: MatchLineupsProps) {
    // State for interactive features
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
    const [showPlayerModal, setShowPlayerModal] = useState(false);

    if (!lineups || (!lineups.home && !lineups.away)) {
        return (
            <div className="text-center py-20">
                <Users className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground/60 mb-2">Lineups not available</h3>
                <p className="text-foreground/40">Team lineups will be displayed here once available</p>
            </div>
        );
    }

    // Convert lineup data to the format expected by FullPitchLineups
    const homePlayers: Record<string, any> = {};
    const awayPlayers: Record<string, any> = {};
    const homeLineupArray: any[] = [];
    const awayLineupArray: any[] = [];

    // Process home team
    const homeLineupData = lineups.home;
    if (homeLineupData) {
        const homeStarters = Array.isArray(homeLineupData)
            ? homeLineupData
            : (homeLineupData.starters || []);
        // Substitutes live in their own array in the API shape ({ starters, substitutes }),
        // separate from the isStarter flag on individual records - they were previously never
        // read at all, so the bench/Substitutes section silently had no data to render.
        const homeBench: any[] = Array.isArray(homeLineupData) ? [] : (homeLineupData.substitutes || []);

        [...homeStarters.map((p: any) => ({ ...p, isStarter: true })), ...homeBench.map((p: any) => ({ ...p, isStarter: false }))]
            .forEach((player: any, index: number) => {
                const playerId = player.id || player.playerId || `home-${index}`;
                homePlayers[playerId] = {
                    id: playerId,
                    name: player.name || 'Unknown',
                    jerseyName: player.jerseyName || player.name?.split(' ').pop() || 'Unknown',
                    number: player.number || player.jerseyNumber || index + 1,
                    position: player.position || 'MID',
                    team: homeTeam,
                };
                homeLineupArray.push({
                    playerId,
                    rating: player.rating || 0,
                    position: player.position || 'MID',
                    isCaptain: player.isCaptain || false,
                    // BACKLOG-321: was dropped here even after the API response
                    // started carrying it -- PitchPlayer.tsx's gold highlight never
                    // received a real value regardless of the server-side fix alone.
                    isMotM: player.isMotM || false,
                    isStarter: player.isStarter,
                    stats: player.stats,
                    // BACKLOG-323: explicit stored placement, when present -- previously
                    // flattened away here, forcing every render back through read-time
                    // role-bucket inference even for lineups that already have a real slot.
                    slotId: player.slotId,
                    x: player.x,
                    y: player.y,
                });
            });
    }

    // Process away team
    const awayLineupData = lineups.away;
    if (awayLineupData) {
        const awayStarters = Array.isArray(awayLineupData)
            ? awayLineupData
            : (awayLineupData.starters || []);
        const awayBench: any[] = Array.isArray(awayLineupData) ? [] : (awayLineupData.substitutes || []);

        [...awayStarters.map((p: any) => ({ ...p, isStarter: true })), ...awayBench.map((p: any) => ({ ...p, isStarter: false }))]
            .forEach((player: any, index: number) => {
                const playerId = player.id || player.playerId || `away-${index}`;
                awayPlayers[playerId] = {
                    id: playerId,
                    name: player.name || 'Unknown',
                    jerseyName: player.jerseyName || player.name?.split(' ').pop() || 'Unknown',
                    number: player.number || player.jerseyNumber || index + 1,
                    position: player.position || 'MID',
                    team: awayTeam,
                };
                awayLineupArray.push({
                    playerId,
                    rating: player.rating || 0,
                    position: player.position || 'MID',
                    isCaptain: player.isCaptain || false,
                    // BACKLOG-321: was dropped here even after the API response
                    // started carrying it -- PitchPlayer.tsx's gold highlight never
                    // received a real value regardless of the server-side fix alone.
                    isMotM: player.isMotM || false,
                    isStarter: player.isStarter,
                    stats: player.stats,
                    // BACKLOG-323: explicit stored placement, when present -- see the
                    // matching comment in the home-team block above.
                    slotId: player.slotId,
                    x: player.x,
                    y: player.y,
                });
            });
    }

    // Handle player click - show player stats (comparison lives on its own dedicated page)
    const handlePlayerClick = (player: any) => {
        const playerData = lineups.home?.find((p: any) => p.id === player.id) ||
            lineups.away?.find((p: any) => p.id === player.id);
        setSelectedPlayer({ ...player, ...playerData });
        setShowPlayerModal(true);
    };

    // Substitutions come from the Substitution events (out = playerId, in = relatedPlayerId); the stored
    // lineup never carries them. Names fall back to the lineup players when an event row has no player object.
    const substitutions = deriveSubstitutions(events).map((r) => {
        const isHome = r.teamId
            ? r.teamId === homeTeam.id
            : !!(r.outId && homePlayers[r.outId]);
        const lookup = isHome ? homePlayers : awayPlayers;
        const name = (id: string | null, own: string | null) => own || (id ? (lookup[id]?.jerseyName || lookup[id]?.name) : null) || 'Unknown';
        const num = (id: string | null, own: number | string | null) => own ?? (id ? lookup[id]?.number : null) ?? null;
        return {
            ...r,
            side: (isHome ? 'home' : 'away') as 'home' | 'away',
            outName: name(r.outId, r.outName),
            inName: name(r.inId, r.inName),
            outNumber: num(r.outId, r.outNumber),
            inNumber: num(r.inId, r.inNumber),
        };
    });

    // Share the lineup via the native share sheet, falling back to clipboard when unavailable
    const handleShareLineup = async () => {
        const shareData = {
            title: `${homeTeam.name} vs ${awayTeam.name} — Lineups`,
            text: `${homeTeam.name} vs ${awayTeam.name} lineups on BrixSports`,
            url: typeof window !== 'undefined' ? window.location.href : '',
        };

        try {
            if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share(shareData);
                return;
            }
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(shareData.url);
                toast.success('Lineup link copied to clipboard');
                return;
            }
            toast.error('Sharing is not supported on this device');
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                toast.error('Could not share lineup');
            }
        }
    };

    return (
        <div className="-mt-8">
            {/* Share LineUp -- BACKLOG-347: this used to be `sticky top-0 z-30` so it could
                take over the top spot once the (also sticky) match header fully disappeared on
                scroll. BACKLOG-339 replaced that disappearing header with a permanently-pinned
                compact navbar, so the header never leaves the top of the screen anymore -- both
                elements being independently `sticky top-0` meant this bar now permanently sits
                UNDERNEATH the header's own z-40 (confirmed live via `elementFromPoint`: the
                button became fully occluded and unclickable once scrolled), instead of "taking
                over" a spot the header no longer vacates. This bar's own justification for being
                sticky no longer exists -- back to a plain flow element. */}
            <div className="flex justify-end px-4 py-2">
                <button
                    onClick={handleShareLineup}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 border border-border text-xs font-semibold transition-colors"
                >
                    Share LineUp
                    <Share2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Full Pitch View */}
            <div className="w-full mt-1">
                <FullPitchLineups
                    homeTeam={{
                        name: homeTeam.name,
                        logo: homeTeam.logo,
                        color: homeTeam.color,
                        formation: lineups.home?.formation || lineups.homeFormation || '4-4-2',
                    }}
                    awayTeam={{
                        name: awayTeam.name,
                        logo: awayTeam.logo,
                        color: awayTeam.color,
                        formation: lineups.away?.formation || lineups.awayFormation || '4-4-2',
                    }}
                    homePlayers={homePlayers}
                    awayPlayers={awayPlayers}
                    homeLineup={homeLineupArray}
                    awayLineup={awayLineupArray}
                    onPlayerClick={handlePlayerClick}
                    sport={sport}
                    events={events}
                />
            </div>

            {/* Player Stats Modal */}
            <PlayerStatsModal
                player={selectedPlayer}
                isOpen={showPlayerModal}
                onClose={() => {
                    setShowPlayerModal(false);
                    setSelectedPlayer(null);
                }}
                teamColor={selectedPlayer?.team?.color || '#3b82f6'}
                rating={selectedPlayer?.rating || 0}
                averageRating={selectedPlayer?.averageRating || selectedPlayer?.stats?.averageRating}
                position={selectedPlayer?.position || 'MID'}
                stats={selectedPlayer?.stats}
                isCaptain={selectedPlayer?.isCaptain}
                isMotM={selectedPlayer?.isMotM}
            />

            {/* Substitutions: one row per change, home on the left and away on the right with the minute between,
                in the order they happened (the same layout the big score apps use). */}
            {substitutions.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-muted border border-border rounded-2xl p-4 sm:p-6 mt-6 mx-4"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Substitutions</h3>
                            <p className="text-sm text-foreground/60">{substitutions.length} {substitutions.length === 1 ? 'change' : 'changes'} made</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-b border-border pb-3 mb-1">
                        <TeamLogo logo={homeTeam.logo} name={homeTeam.name} size="sm" />
                        <TeamLogo logo={awayTeam.logo} name={awayTeam.name} size="sm" />
                    </div>

                    <ul className="divide-y divide-border">
                        {substitutions.map((sub) => (
                            <li key={sub.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-3">
                                <SubstitutionSide sub={sub} show={sub.side === 'home'} />
                                <span className="min-w-[2.5rem] text-center text-xs font-bold text-foreground/70 tabular-nums">
                                    {formatEventMinute(sub.minute) || '–'}
                                </span>
                                <SubstitutionSide sub={sub} show={sub.side === 'away'} alignRight />
                            </li>
                        ))}
                    </ul>
                </motion.div>
            )}
        </div>
    );
}

// One side of a substitution row: the player coming on (green) above the player going off (red).
const SubstitutionSide = ({ sub, show, alignRight }: { sub: { inName: string; outName: string; inNumber: number | string | null; outNumber: number | string | null }, show: boolean, alignRight?: boolean }) => {
    if (!show) return <div />;
    const line = (arrow: 'in' | 'out', name: string, number: number | string | null) => (
        <div className={`flex items-center gap-1.5 min-w-0 ${alignRight ? 'flex-row-reverse text-right' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className={`h-3 w-3 shrink-0 ${arrow === 'in' ? 'text-green-400' : 'text-red-400'}`} aria-label={arrow === 'in' ? 'On' : 'Off'}>
                <path d={arrow === 'in' ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M19 12l-7 7-7-7'} />
            </svg>
            <span className={`text-sm truncate ${arrow === 'in' ? 'font-semibold text-foreground' : 'text-foreground/60'}`}>{name}</span>
            {number !== null && number !== undefined && <span className="text-[10px] text-foreground/40 shrink-0">{number}</span>}
        </div>
    );
    return (
        <div className="space-y-1 min-w-0">
            {line('in', sub.inName, sub.inNumber)}
            {line('out', sub.outName, sub.outNumber)}
        </div>
    );
};
