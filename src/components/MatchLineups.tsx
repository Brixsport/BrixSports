'use client';

import { motion } from 'framer-motion';
import { Users, Shield, Target, TrendingUp, Star, ArrowRightLeft } from 'lucide-react';
import { FullPitchLineups } from './FullPitchLineups';

interface MatchLineupsProps {
    lineups: any;
    sport: string;
    homeTeam: any;
    awayTeam: any;
}

export default function MatchLineups({ lineups, sport, homeTeam, awayTeam }: MatchLineupsProps) {
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
    if (lineups.home && Array.isArray(lineups.home)) {
        lineups.home.forEach((player: any, index: number) => {
            const playerId = player.id || `home-${index}`;
            homePlayers[playerId] = {
                id: playerId,
                name: player.name || 'Unknown',
                jerseyName: player.jerseyName || player.name?.split(' ').pop() || 'Unknown',
                number: player.number || index + 1,
                position: player.position || 'MID',
            };
            homeLineupArray.push({
                playerId,
                rating: player.rating || 0,
                position: player.position || 'MID',
                isCaptain: player.isCaptain || false,
                isStarter: player.isStarter !== false, // Default to true
            });
        });
    }

    // Process away team
    if (lineups.away && Array.isArray(lineups.away)) {
        lineups.away.forEach((player: any, index: number) => {
            const playerId = player.id || `away-${index}`;
            awayPlayers[playerId] = {
                id: playerId,
                name: player.name || 'Unknown',
                jerseyName: player.jerseyName || player.name?.split(' ').pop() || 'Unknown',
                number: player.number || index + 1,
                position: player.position || 'MID',
            };
            awayLineupArray.push({
                playerId,
                rating: player.rating || 0,
                position: player.position || 'MID',
                isCaptain: player.isCaptain || false,
                isStarter: player.isStarter !== false,
            });
        });
    }

    // Get substitutes for both teams
    const homeSubstitutes = lineups.home?.filter((p: any) => p.isStarter === false) || [];
    const awaySubstitutes = lineups.away?.filter((p: any) => p.isStarter === false) || [];

    // Get substitutions if available
    const substitutions = lineups.substitutions || [];

    return (
        <div className="space-y-8">
            {/* Full Pitch View - Large and Scrollable */}
            <div className="w-full">
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
                    onPlayerClick={(player) => {
                        // Handle player click - could open a modal with player stats
                        console.log('Player clicked:', player);
                    }}
                    sport={sport}
                />
            </div>

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
                                <img src={homeTeam.logo} alt={homeTeam.name} className="w-8 h-8 object-contain" />
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
                                <img src={awayTeam.logo} alt={awayTeam.name} className="w-8 h-8 object-contain" />
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
                <img src={team.logo} alt={team.name} className="w-8 h-8 object-contain" />

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
