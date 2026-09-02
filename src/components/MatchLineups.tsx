'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Target, TrendingUp, ArrowRightLeft, Share2, Shirt } from 'lucide-react';
import { toast } from 'sonner';
import { FullPitchLineups } from './FullPitchLineups';
import { PlayerStatsModal } from './PlayerStatsModal';
import { TeamLogo } from '@/lib/utils/team-logo';

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
                <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white/60 mb-2">Lineups not available</h3>
                <p className="text-white/40">Team lineups will be displayed here once available</p>
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

    // Get substitutions if available
    const substitutions = lineups.substitutions || lineups.home?.substitutions || lineups.away?.substitutions || [];

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
            {/* Share LineUp - sticky just under the (also sticky) match header, so once that
                header slides away on scroll this takes over the top spot instead of leaving a gap */}
            <div className="sticky top-0 z-30 flex justify-end px-4 py-2 bg-[#050505]">
                <button
                    onClick={handleShareLineup}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold transition-colors"
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

            {/* Substitutions Section - List Below */}
            {substitutions.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-6 mx-4"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Substitutions</h3>
                            <p className="text-sm text-white/60">{substitutions.length} changes made</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {substitutions.map((sub: any, index: number) => (
                            <SubstitutionCard
                                key={index}
                                substitution={sub}
                                homeTeam={homeTeam}
                                awayTeam={awayTeam}
                            />
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// Substitution Card Component
const SubstitutionCard = ({ substitution, homeTeam, awayTeam }: any) => {
    const team = substitution.team === 'home' ? homeTeam : awayTeam;
    const teamColor = team.color;

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all">
            <div className="flex items-center gap-4">
                {/* Team Logo */}
                <TeamLogo logo={team.logo} name={team.name} size="sm" />

                {/* Substitution Details */}
                <div className="flex-1 flex items-center gap-4">
                    {/* Player Out */}
                    <div className="flex items-center gap-2 flex-1">
                        <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                            <Shirt className="absolute inset-0 w-full h-full opacity-60" fill={teamColor} stroke="rgba(248,113,113,0.9)" strokeWidth={1.5} />
                            <span className="relative z-10 text-[10px] font-bold text-white">
                                {substitution.playerOut?.number || '?'}
                            </span>
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-semibold text-red-400">
                                {substitution.playerOut?.name || 'Unknown'}
                            </div>
                            <div className="text-xs text-white/60">OUT</div>
                        </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRightLeft className="w-5 h-5 text-white/40 flex-shrink-0" />

                    {/* Player In */}
                    <div className="flex items-center gap-2 flex-1">
                        <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                            <Shirt className="absolute inset-0 w-full h-full" fill={teamColor} stroke="rgba(74,222,128,0.9)" strokeWidth={1.5} />
                            <span className="relative z-10 text-[10px] font-bold text-white">
                                {substitution.playerIn?.number || '?'}
                            </span>
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-semibold text-green-400">
                                {substitution.playerIn?.name || 'Unknown'}
                            </div>
                            <div className="text-xs text-white/60">IN</div>
                        </div>
                    </div>
                </div>

                {/* Time */}
                {substitution.minute && (
                    <div className="text-right">
                        <div className="text-sm font-bold text-white/80">{substitution.minute}'</div>
                        <div className="text-xs text-white/60">
                            {substitution.half === 2 ? '2nd Half' : '1st Half'}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

