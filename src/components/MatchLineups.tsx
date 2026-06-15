'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Shield, Target, TrendingUp, Star, ArrowRightLeft, ZoomIn, ZoomOut, Maximize2, GitCompare, X } from 'lucide-react';
import { FullPitchLineups } from './FullPitchLineups';
import { PlayerStatsModal } from './PlayerStatsModal';
import { TeamLogo } from '@/lib/utils/team-logo';
import { PlayerComparison } from './PlayerComparison';

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
    const [comparisonMode, setComparisonMode] = useState(false);
    const [comparisonPlayers, setComparisonPlayers] = useState<any[]>([]);
    const [zoomLevel, setZoomLevel] = useState(1);

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

        homeStarters.forEach((player: any, index: number) => {
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
                isStarter: player.isStarter !== false,
                stats: player.stats,
            });
        });
    }

    // Process away team
    const awayLineupData = lineups.away;
    if (awayLineupData) {
        const awayStarters = Array.isArray(awayLineupData)
            ? awayLineupData
            : (awayLineupData.starters || []);

        awayStarters.forEach((player: any, index: number) => {
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
                isStarter: player.isStarter !== false,
                stats: player.stats,
            });
        });
    }

    // Handle player click
    const handlePlayerClick = (player: any) => {
        if (comparisonMode) {
            // In comparison mode, select up to 2 players
            if (comparisonPlayers.length < 2) {
                const playerData = lineups.home?.find((p: any) => p.id === player.id) ||
                    lineups.away?.find((p: any) => p.id === player.id);
                setComparisonPlayers([...comparisonPlayers, { ...player, ...playerData }]);
            }
        } else {
            // Normal mode - show player stats
            const playerData = lineups.home?.find((p: any) => p.id === player.id) ||
                lineups.away?.find((p: any) => p.id === player.id);
            setSelectedPlayer({ ...player, ...playerData });
            setShowPlayerModal(true);
        }
    };

    // Toggle comparison mode
    const toggleComparisonMode = () => {
        setComparisonMode(!comparisonMode);
        setComparisonPlayers([]);
    };

    // Clear comparison
    const clearComparison = () => {
        setComparisonPlayers([]);
    };

    // Zoom controls
    const handleZoomIn = () => setZoomLevel(Math.min(zoomLevel + 0.25, 2));
    const handleZoomOut = () => setZoomLevel(Math.max(zoomLevel - 0.25, 0.5));
    const handleResetZoom = () => setZoomLevel(1);

    // Get substitutes for both teams
    const homeSubstitutes = Array.isArray(lineups.home)
        ? lineups.home.filter((p: any) => p.isStarter === false)
        : (lineups.home?.substitutes || []);
    const awaySubstitutes = Array.isArray(lineups.away)
        ? lineups.away.filter((p: any) => p.isStarter === false)
        : (lineups.away?.substitutes || []);

    // Get substitutions if available
    const substitutions = lineups.substitutions || lineups.home?.substitutions || lineups.away?.substitutions || [];

    return (
        <div className="space-y-8">
            {/* Control Bar - Hidden on mobile, shown on desktop */}
            <div className="hidden md:flex items-center justify-between gap-4 px-4">
                {/* Comparison Mode Toggle */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleComparisonMode}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all ${comparisonMode
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/5 hover:bg-white/10 text-white/80'
                            }`}
                    >
                        <GitCompare className="w-4 h-4" />
                        Compare Players
                    </button>

                    {comparisonMode && (
                        <div className="flex items-center gap-2 text-sm text-white/60">
                            <span>Select {2 - comparisonPlayers.length} more player{2 - comparisonPlayers.length !== 1 ? 's' : ''}</span>
                            {comparisonPlayers.length > 0 && (
                                <button
                                    onClick={clearComparison}
                                    className="text-red-400 hover:text-red-300"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                    <button
                        onClick={handleZoomOut}
                        disabled={zoomLevel <= 0.5}
                        className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleResetZoom}
                        className="px-3 py-2 rounded-lg hover:bg-white/10 text-sm font-semibold transition-colors"
                        title="Reset Zoom"
                    >
                        {Math.round(zoomLevel * 100)}%
                    </button>
                    <button
                        onClick={handleZoomIn}
                        disabled={zoomLevel >= 2}
                        className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-white/10 mx-1"></div>
                    <button
                        onClick={handleResetZoom}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        title="Fit to Screen"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Selected Players for Comparison */}
            {comparisonMode && comparisonPlayers.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 px-4"
                >
                    <span className="text-sm text-white/60">Selected:</span>
                    {comparisonPlayers.map((player, index) => (
                        <div
                            key={player.id}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg"
                        >
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                                style={{ backgroundColor: player.team.color }}
                            >
                                {player.number}
                            </div>
                            <span className="text-sm font-semibold">{player.jerseyName || player.name}</span>
                        </div>
                    ))}
                </motion.div>
            )}

            {/* Full Pitch View - Large and Scrollable with Zoom */}
            <div
                className="w-full overflow-hidden"
                style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.3s ease-out',
                }}
            >
                <FullPitchLineups
                    homeTeam={{
                        name: homeTeam.name,
                        logo: homeTeam.logo,
                        color: homeTeam.color,
                        formation: lineups.homeFormation || '4-4-2',
                    }}
                    awayTeam={{
                        name: awayTeam.name,
                        logo: awayTeam.logo,
                        color: awayTeam.color,
                        formation: lineups.awayFormation || '4-4-2',
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

            {/* Player Comparison */}
            <AnimatePresence>
                {comparisonMode && comparisonPlayers.length === 2 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-6"
                    >
                        <PlayerComparison
                            player1={{
                                ...comparisonPlayers[0],
                                team: comparisonPlayers[0].team,
                            }}
                            player2={{
                                ...comparisonPlayers[1],
                                team: comparisonPlayers[1].team,
                            }}
                            sport={sport as any}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Substitutions Section - List Below */}
            {substitutions.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6"
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

            {/* Bench Players - If no substitutions recorded yet */}
            {substitutions.length === 0 && (homeSubstitutes.length > 0 || awaySubstitutes.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Home Bench */}
                    {homeSubstitutes.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/5 border border-white/10 rounded-2xl p-6"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <TeamLogo logo={homeTeam.logo} name={homeTeam.name} size="sm" />
                                <div>
                                    <h3 className="font-bold">{homeTeam.name}</h3>
                                    <p className="text-sm text-white/60">Substitutes</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {homeSubstitutes.map((player: any, index: number) => (
                                    <PlayerCard key={index} player={player} teamColor={homeTeam.color} />
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Away Bench */}
                    {awaySubstitutes.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white/5 border border-white/10 rounded-2xl p-6"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <TeamLogo logo={awayTeam.logo} name={awayTeam.name} size="sm" />
                                <div>
                                    <h3 className="font-bold">{awayTeam.name}</h3>
                                    <p className="text-sm text-white/60">Substitutes</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {awaySubstitutes.map((player: any, index: number) => (
                                    <PlayerCard key={index} player={player} teamColor={awayTeam.color} />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>
            )}
        </div>
    );
}

// Player Card Component for Substitutes
const PlayerCard = ({ player, teamColor }: any) => (
    <div className="p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-white/20 transition-all">
        <div className="flex items-center gap-3">
            {/* Jersey Number */}
            <div
                className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                style={{ backgroundColor: teamColor + '30' }}
            >
                {player.number}
            </div>

            {/* Player Info */}
            <div className="flex-1">
                <div className="font-semibold">{player.jerseyName || player.name}</div>
                <div className="text-sm text-white/60">{player.position}</div>
            </div>

            {/* Rating */}
            {player.rating && player.rating > 0 && (
                <div className="text-right">
                    <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="font-bold">{player.rating.toFixed(1)}</span>
                    </div>
                </div>
            )}
        </div>
    </div>
);

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
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                            style={{ backgroundColor: teamColor + '30' }}
                        >
                            {substitution.playerOut?.number || '?'}
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
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                            style={{ backgroundColor: teamColor + '30' }}
                        >
                            {substitution.playerIn?.number || '?'}
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

