'use client';

import { motion } from 'framer-motion';
import { Users, Shield, Target, TrendingUp, Star, Activity, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { getFormationById } from '@/lib/formations';

interface LineupPlayer {
    id: string;
    name: string;
    number: number;
    position: string;
    rating?: number;
    stats?: {
        goals?: number;
        assists?: number;
        saves?: number;
        points?: number;
        rebounds?: number;
    };
}

interface MatchLineupProps {
    homeLineup: LineupPlayer[];
    awayLineup: LineupPlayer[];
    homeTeam: any;
    awayTeam: any;
    homeFormation?: string;
    awayFormation?: string;
    sport: 'Football' | 'Basketball' | 'Track';
}

export function MatchLineup({
    homeLineup,
    awayLineup,
    homeTeam,
    awayTeam,
    homeFormation = '4-3-3',
    awayFormation = '4-3-3',
    sport,
}: MatchLineupProps) {
    const [view, setView] = useState<'visual' | 'list'>('visual');

    if (!homeLineup?.length && !awayLineup?.length) {
        return (
            <div className="text-center py-20">
                <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white/60 mb-2">Lineups not available</h3>
                <p className="text-white/40">Team lineups will be displayed here once available</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* View Toggle */}
            <div className="flex items-center justify-center gap-2">
                <button
                    onClick={() => setView('visual')}
                    className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${view === 'visual'
                        ? 'bg-primary text-black'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                >
                    Visual
                </button>
                <button
                    onClick={() => setView('list')}
                    className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${view === 'list'
                        ? 'bg-primary text-black'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                >
                    List
                </button>
            </div>

            {/* Content */}
            {view === 'visual' && sport === 'Football' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <FormationView
                        lineup={homeLineup}
                        team={homeTeam}
                        formation={homeFormation}
                        label="Home"
                        sport={sport}
                    />
                    <FormationView
                        lineup={awayLineup}
                        team={awayTeam}
                        formation={awayFormation}
                        label="Away"
                        sport={sport}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ListViewTeam lineup={homeLineup} team={homeTeam} sport={sport} label="Home" />
                    <ListViewTeam lineup={awayLineup} team={awayTeam} sport={sport} label="Away" />
                </div>
            )}
        </div>
    );
}



function FormationView({
    lineup,
    team,
    formation,
    label,
    sport
}: {
    lineup: LineupPlayer[];
    team: any;
    formation: string;
    label: string;
    sport: 'Football' | 'Basketball' | 'Track';
}) {
    const formationData = getFormationById(formation, sport as 'Football' | 'Basketball')?.positions || getFormationById('4-3-3', 'Football')?.positions || [];
    const startingEleven = lineup.slice(0, sport === 'Basketball' ? 5 : 11);

    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: team.color + '30' }}
                    >
                        {team.logo || team.shortName?.substring(0, 2)}
                    </div>
                    <div>
                        <p className="text-xs text-white/40 font-bold uppercase">{label}</p>
                        <p className="text-sm font-black uppercase tracking-tight">{team.name}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-white/40 font-bold uppercase">Formation</p>
                    <p className="text-lg font-display italic text-primary">{formation}</p>
                </div>
            </div>

            {/* Pitch */}
            <div className="relative w-full aspect-[2/3] bg-gradient-to-b from-blue-900/20 to-blue-950/40 rounded-3xl overflow-hidden border border-white/10">
                {/* Field Lines */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/20" />
                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/20" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/20 rounded-full" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-16 border-2 border-white/20 border-t-0" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-16 border-2 border-white/20 border-b-0" />
                </div>

                {/* Players */}
                {startingEleven.map((player, idx) => {
                    const pos = formationData[idx];
                    if (!pos) return null;

                    return (
                        <motion.div
                            key={player.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                        >
                            <div className="relative">
                                {/* Player Circle */}
                                <div
                                    className={`w-12 h-12 rounded-full flex items-center justify-center font-display text-lg font-bold transition-all group-hover:scale-110 border-2`}
                                    style={{
                                        backgroundColor: team.color,
                                        borderColor: player.rating && player.rating >= 8 ? '#FFD700' : 'rgba(255,255,255,0.3)',
                                    }}
                                >
                                    {player.number}
                                </div>

                                {/* Rating Badge */}
                                {player.rating && player.rating >= 8 && (
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                                        <Star size={12} className="text-black fill-black" />
                                    </div>
                                )}

                                {/* Player Info Tooltip */}
                                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-sm px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-white/20">
                                    <p className="text-xs font-black uppercase tracking-wider text-white">
                                        {player.name}
                                    </p>
                                    <p className="text-[10px] text-white/60 font-bold">{pos.position}</p>
                                    {player.rating && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <Star size={10} className="text-yellow-500" />
                                            <span className="text-xs font-bold text-yellow-500">
                                                {player.rating.toFixed(1)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Substitutes */}
            {lineup.length > 11 && (
                <div className="mt-4">
                    <p className="text-xs text-white/40 font-bold uppercase mb-2">Substitutes</p>
                    <div className="flex flex-wrap gap-2">
                        {lineup.slice(11).map((player) => (
                            <div
                                key={player.id}
                                className="px-3 py-1 bg-white/5 rounded-lg text-xs flex items-center gap-2"
                            >
                                <span
                                    className="w-6 h-6 rounded flex items-center justify-center font-bold"
                                    style={{ backgroundColor: team.color + '50' }}
                                >
                                    {player.number}
                                </span>
                                <span>{player.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ListViewTeam({
    lineup,
    team,
    sport,
    label,
}: {
    lineup: LineupPlayer[];
    team: any;
    sport: string;
    label: string;
}) {
    // Group players by position for football
    const groupedPlayers =
        sport === 'Football'
            ? {
                Goalkeeper: lineup.filter((p) => p.position === 'GK'),
                Defenders: lineup.filter((p) =>
                    ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position)
                ),
                Midfielders: lineup.filter((p) =>
                    ['CM', 'CDM', 'CAM', 'LM', 'RM'].includes(p.position)
                ),
                Forwards: lineup.filter((p) => ['ST', 'CF', 'LW', 'RW'].includes(p.position)),
            }
            : null;

    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: team.color + '20' }}
                >
                    {team.logo || team.shortName?.substring(0, 2)}
                </div>
                <div>
                    <p className="text-xs text-white/40 font-bold uppercase">{label}</p>
                    <p className="text-lg font-black uppercase tracking-tight">{team.name}</p>
                    <p className="text-xs text-white/60">{lineup.length} players</p>
                </div>
            </div>

            {/* Players */}
            {sport === 'Football' && groupedPlayers ? (
                <div className="space-y-6">
                    {Object.entries(groupedPlayers).map(([position, players]: [string, any]) =>
                        players.length > 0 ? (
                            <div key={position}>
                                <div className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                                    {position === 'Goalkeeper' && <Shield className="w-4 h-4" />}
                                    {position === 'Defenders' && <Shield className="w-4 h-4" />}
                                    {position === 'Midfielders' && <TrendingUp className="w-4 h-4" />}
                                    {position === 'Forwards' && <Target className="w-4 h-4" />}
                                    {position}
                                </div>
                                <div className="space-y-2">
                                    {players.map((player: LineupPlayer) => (
                                        <PlayerCard key={player.id} player={player} teamColor={team.color} sport={sport} />
                                    ))}
                                </div>
                            </div>
                        ) : null
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {lineup.map((player) => (
                        <PlayerCard key={player.id} player={player} teamColor={team.color} sport={sport} />
                    ))}
                </div>
            )}
        </div>
    );
}

function PlayerCard({ player, teamColor, sport }: { player: LineupPlayer; teamColor: string; sport: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-white/20 transition-all"
        >
            <div className="flex items-center gap-3">
                {/* Jersey Number */}
                <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg"
                    style={{ backgroundColor: teamColor + '30' }}
                >
                    {player.number}
                </div>

                {/* Player Info */}
                <div className="flex-1">
                    <div className="font-semibold">{player.name}</div>
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

            {/* Player Stats */}
            {player.stats && (
                <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-3 gap-2 text-xs">
                    {sport === 'Football' && (
                        <>
                            {(player.stats.goals || 0) > 0 && (
                                <div className="text-center">
                                    <div className="font-bold text-blue-500">{player.stats.goals}</div>
                                    <div className="text-white/60">Goals</div>
                                </div>
                            )}
                            {(player.stats.assists || 0) > 0 && (
                                <div className="text-center">
                                    <div className="font-bold text-blue-500">{player.stats.assists}</div>
                                    <div className="text-white/60">Assists</div>
                                </div>
                            )}
                            {(player.stats.saves || 0) > 0 && (
                                <div className="text-center">
                                    <div className="font-bold text-purple-500">{player.stats.saves}</div>
                                    <div className="text-white/60">Saves</div>
                                </div>
                            )}
                        </>
                    )}
                    {sport === 'Basketball' && (
                        <>
                            {(player.stats.points || 0) > 0 && (
                                <div className="text-center">
                                    <div className="font-bold text-blue-500">{player.stats.points}</div>
                                    <div className="text-white/60">Points</div>
                                </div>
                            )}
                            {(player.stats.rebounds || 0) > 0 && (
                                <div className="text-center">
                                    <div className="font-bold text-blue-500">{player.stats.rebounds}</div>
                                    <div className="text-white/60">Rebounds</div>
                                </div>
                            )}
                            {(player.stats.assists || 0) > 0 && (
                                <div className="text-center">
                                    <div className="font-bold text-purple-500">{player.stats.assists}</div>
                                    <div className="text-white/60">Assists</div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </motion.div>
    );
}

