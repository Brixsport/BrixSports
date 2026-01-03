'use client';

import { motion } from 'framer-motion';
import { Player, Team } from '@/lib/mock-data';
import { Star, TrendingUp, Activity } from 'lucide-react';

interface LineupVisualizerProps {
  team: Team;
  players: Player[];
  formation?: string;
  sport: 'Football' | 'Basketball' | 'Track';
}

const FOOTBALL_FORMATIONS: Record<string, { position: string; x: number; y: number }[]> = {
  '4-3-3': [
    // GK
    { position: 'GK', x: 50, y: 95 },
    // Defense
    { position: 'LB', x: 20, y: 75 },
    { position: 'CB', x: 40, y: 75 },
    { position: 'CB', x: 60, y: 75 },
    { position: 'RB', x: 80, y: 75 },
    // Midfield
    { position: 'CM', x: 30, y: 50 },
    { position: 'CM', x: 50, y: 50 },
    { position: 'CM', x: 70, y: 50 },
    // Attack
    { position: 'LW', x: 20, y: 25 },
    { position: 'ST', x: 50, y: 20 },
    { position: 'RW', x: 80, y: 25 },
  ],
  '4-4-2': [
    { position: 'GK', x: 50, y: 95 },
    { position: 'LB', x: 20, y: 75 },
    { position: 'CB', x: 40, y: 75 },
    { position: 'CB', x: 60, y: 75 },
    { position: 'RB', x: 80, y: 75 },
    { position: 'LM', x: 20, y: 50 },
    { position: 'CM', x: 40, y: 50 },
    { position: 'CM', x: 60, y: 50 },
    { position: 'RM', x: 80, y: 50 },
    { position: 'ST', x: 40, y: 20 },
    { position: 'ST', x: 60, y: 20 },
  ],
};

const BASKETBALL_POSITIONS = [
  { position: 'PG', x: 50, y: 80, label: 'Point Guard' },
  { position: 'SG', x: 70, y: 60, label: 'Shooting Guard' },
  { position: 'SF', x: 30, y: 60, label: 'Small Forward' },
  { position: 'PF', x: 70, y: 40, label: 'Power Forward' },
  { position: 'C', x: 50, y: 30, label: 'Center' },
];

export function LineupVisualizer({ team, players, formation = '4-3-3', sport }: LineupVisualizerProps) {
  if (sport === 'Football') {
    return <FootballLineup team={team} players={players} formation={formation} />;
  } else if (sport === 'Basketball') {
    return <BasketballLineup team={team} players={players} />;
  } else if (sport === 'Track') {
    return <TrackLineup team={team} players={players} />;
  }
  return null;
}

function FootballLineup({ team, players, formation }: { team: Team; players: Player[]; formation: string }) {
  const formationData = FOOTBALL_FORMATIONS[formation] || FOOTBALL_FORMATIONS['4-3-3'];
  const startingPlayers = players.slice(0, 11);

  return (
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
      {startingPlayers.map((player, idx) => {
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
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-display text-lg font-bold transition-all group-hover:scale-110 border-2`}
                style={{ 
                  backgroundColor: team.color, 
                  borderColor: player.rating >= 8 ? '#FFD700' : 'rgba(255,255,255,0.3)'
                }}
              >
                {player.number}
              </div>

              {/* Rating Badge */}
              {player.rating >= 8 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                  <Star size={12} className="text-black fill-black" />
                </div>
              )}

              {/* Player Info Tooltip */}
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-sm px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-white/20">
                <p className="text-xs font-black uppercase tracking-wider text-white">{player.name}</p>
                <p className="text-[10px] text-white/60 font-bold">{pos.position}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star size={10} className="text-yellow-500" />
                  <span className="text-xs font-bold text-yellow-500">{player.rating}</span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* Formation Label */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Formation</p>
        <p className="text-lg font-display italic text-primary">{formation}</p>
      </div>
    </div>
  );
}

function BasketballLineup({ team, players }: { team: Team; players: Player[] }) {
  const startingFive = players.slice(0, 5);

  return (
    <div className="relative w-full aspect-[3/4] bg-gradient-to-b from-orange-900/20 to-orange-950/40 rounded-3xl overflow-hidden border border-white/10">
      {/* Court Lines */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/20" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 border-2 border-white/20 rounded-full" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-20 border-2 border-white/20 border-t-0 rounded-b-full" />
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/20" />
      </div>

      {/* Players */}
      {startingFive.map((player, idx) => {
        const pos = BASKETBALL_POSITIONS[idx];
        if (!pos) return null;

        return (
          <motion.div
            key={player.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div className="relative">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center font-display text-xl font-bold transition-all group-hover:scale-110 border-2`}
                style={{ 
                  backgroundColor: team.color, 
                  borderColor: player.rating >= 8 ? '#FFD700' : 'rgba(255,255,255,0.3)'
                }}
              >
                {player.number}
              </div>

              {player.rating >= 8 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                  <Star size={12} className="text-black fill-black" />
                </div>
              )}

              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-sm px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-white/20">
                <p className="text-xs font-black uppercase tracking-wider text-white">{player.name}</p>
                <p className="text-[10px] text-white/60 font-bold">{pos.label}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star size={10} className="text-yellow-500" />
                  <span className="text-xs font-bold text-yellow-500">{player.rating}</span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}

      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Starting Five</p>
        <p className="text-lg font-display italic text-primary">{team.shortName}</p>
      </div>
    </div>
  );
}

function TrackLineup({ team, players }: { team: Team; players: Player[] }) {
  return (
    <div className="w-full bg-gradient-to-br from-red-900/20 to-red-950/40 rounded-3xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="text-primary" size={20} />
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Team Roster</p>
          <p className="text-lg font-display italic text-white">{team.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {players.map((player, idx) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-display text-lg font-bold border-2`}
                  style={{ 
                    backgroundColor: team.color, 
                    borderColor: player.rating >= 8 ? '#FFD700' : 'rgba(255,255,255,0.3)'
                  }}
                >
                  {player.number}
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-tight text-white">{player.name}</p>
                  <p className="text-[10px] text-white/60 font-bold uppercase">{player.position}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {player.rating >= 8 && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
                <div className="text-right">
                  <p className="text-xs font-bold text-white/60">Rating</p>
                  <p className="text-lg font-display italic text-primary">{player.rating}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

