'use client';

import { motion } from 'framer-motion';
import { X, Star, Share2, TrendingUp, MapPin, Calendar, Ruler, Weight, Award, Activity, Heart } from 'lucide-react';
import { Player, Team, TEAMS } from '@/lib/mock-data';
import { useFavorites } from '@/hooks/useFavorites';

interface PlayerProfileOverlayProps {
  player: Player;
  onClose: () => void;
}

export function PlayerProfileOverlay({ player, onClose }: PlayerProfileOverlayProps) {
  const team = TEAMS.find(t => t.id === player.teamId);
  const { isFavoritePlayer, togglePlayer } = useFavorites();
  const isFav = isFavoritePlayer(player.id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/98 backdrop-blur-2xl overflow-y-auto"
    >
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
          <div className="flex flex-col items-center">
            <h2 className="text-xl font-display italic uppercase tracking-tight">{player.name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-primary uppercase">{team?.shortName}</span>
              <span className="text-[10px] text-white/20">•</span>
              <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">{player.position}</span>
            </div>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-primary">
            <Star size={20} />
          </button>
        </div>

        <div className="max-w-4xl mx-auto w-full px-4 py-12 space-y-12 pb-32">
          {/* Main Info Card */}
          <section className="bg-gradient-to-br from-white/5 to-transparent rounded-[48px] border border-white/10 p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="relative">
                <div className="w-48 h-48 bg-white/5 rounded-[40px] flex items-center justify-center text-7xl font-display italic border border-white/10 relative overflow-hidden group">
                  {player.number}
                  <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-black font-black text-xl border-4 border-[#050505]">
                  {player.rating.toFixed(1)}
                </div>
              </div>

              <div className="flex-1 space-y-8 text-center md:text-left">
                <div>
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black tracking-widest uppercase border border-white/10">
                      Top Prospect
                    </span>
                    <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-[10px] font-black tracking-widest uppercase border border-secondary/20">
                      Eye Point King
                    </span>
                  </div>
                  <h1 className="text-5xl md:text-7xl font-display italic uppercase tracking-tighter leading-none mb-4">
                    {player.name}
                  </h1>
                  <p className="text-white/40 font-medium text-lg italic">{team?.university}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <InfoMeta icon={<Calendar size={14}/>} label="Age" value={player.age?.toString() || '-'} />
                  <InfoMeta icon={<Ruler size={14}/>} label="Height" value={player.height || '-'} />
                  <InfoMeta icon={<Award size={14}/>} label="Points" value={player.eyePoints.toString()} />
                  <InfoMeta icon={<MapPin size={14}/>} label="Origin" value={player.nationality || 'Nigeria'} />
                </div>
              </div>
            </div>
          </section>

          {/* Attributes Radar-like Visualization */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" />
                <h3 className="font-display italic uppercase tracking-tighter text-2xl">Attributes</h3>
              </div>
              <div className="bg-white/5 rounded-[32px] p-8 border border-white/5 space-y-6">
                {player.attributes && Object.entries(player.attributes).map(([attr, val]) => (
                  <div key={attr} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black tracking-widest uppercase text-white/40">
                      <span>{attr}</span>
                      <span className="text-white">{val}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${val}%` }}
                        className={`h-full ${val >= 85 ? 'bg-primary' : val >= 75 ? 'bg-secondary' : 'bg-white/40'}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-primary" />
                <h3 className="font-display italic uppercase tracking-tighter text-2xl">Recent Form</h3>
              </div>
              <div className="bg-white/5 rounded-[32px] p-8 border border-white/5 h-full flex flex-col justify-center gap-4">
                 <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black tracking-widest uppercase text-white/40">vs UNIBEN</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold italic">1 Goal</span>
                      <span className="px-2 py-1 bg-primary/20 text-primary rounded-lg font-black text-xs">8.5</span>
                    </div>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black tracking-widest uppercase text-white/40">vs OAU</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold italic">2 Assists</span>
                      <span className="px-2 py-1 bg-secondary/20 text-secondary rounded-lg font-black text-xs">8.2</span>
                    </div>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 opacity-50">
                    <span className="text-[10px] font-black tracking-widest uppercase text-white/40">vs UI</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold italic">-</span>
                      <span className="px-2 py-1 bg-white/10 text-white/40 rounded-lg font-black text-xs">6.8</span>
                    </div>
                 </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

function InfoMeta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-white/40">
        {icon}
        <span className="text-[10px] font-black tracking-widest uppercase">{label}</span>
      </div>
      <span className="text-sm font-bold italic translate-x-1">{value}</span>
    </div>
  );
}
