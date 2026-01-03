'use client';

import { motion } from 'framer-motion';
import { Users, Shield, Target, TrendingUp, Star } from 'lucide-react';

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

    const PlayerCard = ({ player, teamColor }: any) => (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-white/20 transition-all"
        >
            <div className="flex items-center gap-3">
                {/* Jersey Number */}
                <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg relative"
                    style={{ backgroundColor: teamColor + '30' }}
                >
                    {player.number}
                    {player.isStarter && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#050505]" title="Starter" />
                    )}
                </div>

                {/* Player Info */}
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <div className="font-semibold">{player.jerseyName || player.name}</div>
                        {player.isStarter && (
                            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                                Starter
                            </span>
                        )}
                    </div>
                    <div className="text-sm text-white/60">{player.position}</div>
                </div>

                {/* Rating */}
                {player.rating && (
                    <div className="text-right">
                        <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="font-bold text-lg">{player.rating.toFixed(1)}</span>
                        </div>
                        <div className="text-xs text-white/60">Rating</div>
                    </div>
                )}
            </div>

            {/* Player Stats (if available) */}
            {player.stats && (
                <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="grid grid-cols-5 gap-3 text-xs">
                        <div className="text-center">
                            <div className="font-bold text-2xl text-blue-500">{player.stats.points || 0}</div>
                            <div className="text-white/60 text-[10px]">PTS</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-lg text-green-500">{player.stats.rebounds || 0}</div>
                            <div className="text-white/60 text-[10px]">REB</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-lg text-purple-500">{player.stats.assists || 0}</div>
                            <div className="text-white/60 text-[10px]">AST</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-lg text-yellow-500">{player.stats.steals || 0}</div>
                            <div className="text-white/60 text-[10px]">STL</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-lg text-red-500">{player.stats.blocks || 0}</div>
                            <div className="text-white/60 text-[10px]">BLK</div>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );

    const TeamLineup = ({ team, players, teamColor }: any) => {
        // Group players by position for football
        const groupedPlayers = sport === 'Football' ? {
            'Goalkeeper': players.filter((p: any) => ['GK', 'gk'].includes(p.position)),
            'Defenders': players.filter((p: any) => ['CB', 'LB', 'RB', 'LWB', 'RWB', 'lb', 'lcb', 'cb', 'rcb', 'rb', 'lwb', 'rwb'].includes(p.position)),
            'Midfielders': players.filter((p: any) => ['CM', 'CDM', 'CAM', 'LM', 'RM', 'cdm', 'lcdm', 'rcdm', 'lm', 'lcm', 'cm', 'rcm', 'rm', 'lam', 'cam', 'ram'].includes(p.position)),
            'Forwards': players.filter((p: any) => ['ST', 'CF', 'LW', 'RW', 'lw', 'rw', 'st', 'lst', 'rst'].includes(p.position)),
        } : null;

        return (
            <div>
                {/* Team Header */}
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                    <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: teamColor + '20' }}
                    >
                        {team.logo ? (
                            <img src={team.logo} alt={team.name} className="w-12 h-12 object-contain" />
                        ) : (
                            <span className="text-2xl font-bold">{team.shortName.substring(0, 2)}</span>
                        )}
                    </div>
                    <div>
                        <div className="font-bold text-xl">{team.name}</div>
                        <div className="text-white/60">{players.length} players</div>
                    </div>
                </div>

                {/* Players */}
                {sport === 'Football' && groupedPlayers ? (
                    <div className="space-y-6">
                        {Object.entries(groupedPlayers).map(([position, posPlayers]: [string, any]) => (
                            posPlayers.length > 0 && (
                                <div key={position}>
                                    <div className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                                        {position === 'Goalkeeper' && <Shield className="w-4 h-4" />}
                                        {position === 'Defenders' && <Shield className="w-4 h-4" />}
                                        {position === 'Midfielders' && <TrendingUp className="w-4 h-4" />}
                                        {position === 'Forwards' && <Target className="w-4 h-4" />}
                                        {position}
                                    </div>
                                    <div className="space-y-2">
                                        {posPlayers.map((player: any, index: number) => (
                                            <PlayerCard key={index} player={player} teamColor={teamColor} />
                                        ))}
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                ) : sport === 'Basketball' ? (
                    <div className="space-y-6">
                        {/* Starters */}
                        {players.filter((p: any) => p.isStarter).length > 0 && (
                            <div>
                                <div className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Starting Five
                                </div>
                                <div className="space-y-2">
                                    {players.filter((p: any) => p.isStarter).map((player: any, index: number) => (
                                        <PlayerCard key={index} player={player} teamColor={teamColor} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Substitutes */}
                        {players.filter((p: any) => !p.isStarter).length > 0 && (
                            <div>
                                <div className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Bench
                                </div>
                                <div className="space-y-2">
                                    {players.filter((p: any) => !p.isStarter).map((player: any, index: number) => (
                                        <PlayerCard key={index} player={player} teamColor={teamColor} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {players.map((player: any, index: number) => (
                            <PlayerCard key={index} player={player} teamColor={teamColor} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Home Team */}
            {lineups.home && lineups.home.length > 0 && (
                <TeamLineup
                    team={homeTeam}
                    players={lineups.home}
                    teamColor={homeTeam.color}
                />
            )}

            {/* Away Team */}
            {lineups.away && lineups.away.length > 0 && (
                <TeamLineup
                    team={awayTeam}
                    players={lineups.away}
                    teamColor={awayTeam.color}
                />
            )}
        </div>
    );
}

