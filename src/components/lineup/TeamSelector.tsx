'use client';

import { motion } from 'framer-motion';
import { Users } from 'lucide-react';

interface Match {
    homeTeam?: { name: string; shortName: string; logo: string };
    awayTeam?: { name: string; shortName: string; logo: string };
}

interface TeamSelectorProps {
    match: Match;
    onSelectTeam: (team: 'home' | 'away' | 'combined') => void;
}

export function TeamSelector({ match, onSelectTeam }: TeamSelectorProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-display italic uppercase mb-2">Select Team</h2>
                <p className="text-sm text-white/60">Choose which team's lineup to build, or create a Combined XI</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Home Team */}
                <TeamCard
                    team="home"
                    teamData={match.homeTeam}
                    onClick={() => onSelectTeam('home')}
                />

                {/* Combined XI */}
                <CombinedXICard
                    homeTeam={match.homeTeam}
                    awayTeam={match.awayTeam}
                    onClick={() => onSelectTeam('combined')}
                />

                {/* Away Team */}
                <TeamCard
                    team="away"
                    teamData={match.awayTeam}
                    onClick={() => onSelectTeam('away')}
                />
            </div>
        </div>
    );
}

function TeamCard({ team, teamData, onClick }: {
    team: 'home' | 'away';
    teamData?: { name: string; shortName: string; logo: string };
    onClick: () => void;
}) {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`p-8 rounded-2xl border-2 transition-all ${team === 'home'
                ? 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50'
                : 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
                }`}
        >
            <div className="text-center">
                <div className="h-24 flex items-center justify-center mb-4">
                    {teamData?.logo && (teamData.logo.startsWith('/') || teamData.logo.startsWith('http')) ? (
                        <img src={teamData.logo} alt={teamData.name} className="h-20 w-20 object-contain" />
                    ) : (
                        <span className="text-6xl">{teamData?.logo || '⚽'}</span>
                    )}
                </div>
                <h3 className="text-2xl font-display italic uppercase mb-2">
                    {teamData?.name || 'TBD'}
                </h3>
                <p className="text-sm text-white/60 uppercase tracking-wider">
                    {team} Team
                </p>
            </div>
        </motion.button>
    );
}

function CombinedXICard({ homeTeam, awayTeam, onClick }: {
    homeTeam?: { name: string; shortName: string; logo: string };
    awayTeam?: { name: string; shortName: string; logo: string };
    onClick: () => void;
}) {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="p-8 rounded-2xl border-2 bg-gradient-to-br from-purple-500/10 to-primary/10 border-primary/30 hover:border-primary/50 transition-all relative overflow-hidden"
        >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-primary/5 opacity-0 hover:opacity-100 transition-opacity" />

            <div className="text-center relative z-10">
                <div className="h-24 flex items-center justify-center mb-4 gap-2">
                    {/* Home team logo (smaller) */}
                    <div className="w-14 h-14 flex items-center justify-center">
                        {homeTeam?.logo && (homeTeam.logo.startsWith('/') || homeTeam.logo.startsWith('http')) ? (
                            <img src={homeTeam.logo} alt={homeTeam.name} className="h-12 w-12 object-contain opacity-80" />
                        ) : (
                            <span className="text-4xl opacity-80">{homeTeam?.logo || '⚽'}</span>
                        )}
                    </div>

                    {/* Combined icon */}
                    <div className="flex items-center justify-center">
                        <Users size={32} className="text-primary" />
                    </div>

                    {/* Away team logo (smaller) */}
                    <div className="w-14 h-14 flex items-center justify-center">
                        {awayTeam?.logo && (awayTeam.logo.startsWith('/') || awayTeam.logo.startsWith('http')) ? (
                            <img src={awayTeam.logo} alt={awayTeam.name} className="h-12 w-12 object-contain opacity-80" />
                        ) : (
                            <span className="text-4xl opacity-80">{awayTeam?.logo || '⚽'}</span>
                        )}
                    </div>
                </div>
                <h3 className="text-2xl font-display italic uppercase mb-2 text-primary">
                    Combined XI
                </h3>
                <p className="text-sm text-white/60 uppercase tracking-wider">
                    Best of Both Teams
                </p>
            </div>
        </motion.button>
    );
}
