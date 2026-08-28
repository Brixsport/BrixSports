'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Star, Share2, TrendingUp, MapPin, Calendar, Ruler, Weight, Award, Activity, Heart, GitCompare } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { useNotifications } from './Notifications';

interface PlayerProfileOverlayProps {
  player: any;
  onClose: () => void;
  sport?: string;
}

export function PlayerProfileOverlay({ player: initialPlayer, onClose, sport }: PlayerProfileOverlayProps) {
  const [playerData, setPlayerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotifications();

  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/players/${initialPlayer.id}`);
        const data = await response.json();
        setPlayerData(data);
      } catch (error) {
        console.error('Error fetching player:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [initialPlayer.id]);

  // Parse attributes if they are a string (from DB)
  let parsedAttributes = initialPlayer.attributes;
  const rawAttributes = initialPlayer.attributes as any;
  if (typeof rawAttributes === 'string' && rawAttributes.trim() !== '') {
    try {
      parsedAttributes = JSON.parse(rawAttributes);
    } catch (e) {
      console.error('Error parsing player attributes:', e);
      parsedAttributes = undefined;
    }
  }

  const player = {
    ...initialPlayer,
    attributes: parsedAttributes as any,
    team: initialPlayer.team || playerData?.player?.team
  };

  const team = player.team;
  const playerSport = sport || team?.sport || 'Football';
  const stats = playerData?.stats || {};
  const recentMatches = playerData?.recentMatches || [];

  const { isFavoritePlayer, togglePlayer } = useFavorites();
  const isFav = isFavoritePlayer(String(player.id));

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
              <span className="text-[10px] font-black tracking-widest text-primary uppercase">{team?.shortName || 'BRX'}</span>
              <span className="text-[10px] text-white/20">•</span>
              <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">{player.position}</span>
              <span className="text-[10px] text-white/20">•</span>
              <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">{playerSport === 'Basketball' ? '🏀' : '⚽'} {playerSport}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/players/compare?player1=${player.id}&sport=${playerSport}`}
              className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Compare Player"
            >
              <GitCompare size={20} />
            </a>
            <button
              onClick={async () => {
                const shareData = {
                  title: `${player.name} - Player Profile`,
                  text: `Check out ${player.name}'s profile on Brix Sports!`,
                  url: `${window.location.origin}/players/${player.id}`,
                };
                if (navigator.share) {
                  await navigator.share(shareData);
                } else {
                  await navigator.clipboard.writeText(`${window.location.origin}/players/${player.id}`);
                  alert('Profile link copied to clipboard!');
                }
              }}
              className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Share Profile"
            >
              <Share2 size={20} />
            </button>
            <button
              onClick={() => {
                const isNowFollowing = !isFav;
                togglePlayer(String(player.id));
                addNotification({
                  title: isNowFollowing ? 'Player Followed' : 'Player Unfollowed',
                  message: isNowFollowing ? `You are now following ${player.name}` : `You have unfollowed ${player.name}`,
                  type: 'match'
                });
              }}
              className={`p-2 rounded-full transition-colors ${isFav ? 'bg-primary text-black' : 'hover:bg-white/10 text-primary'}`}
            >
              <Heart size={20} fill={isFav ? "currentColor" : "none"} />
            </button>
          </div>
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
                  {stats.rating != null ? stats.rating.toFixed(1) : '-'}
                </div>
              </div>

              <div className="flex-1 space-y-8 text-center md:text-left">
                <div>
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black tracking-widest uppercase border border-white/10">
                      {playerSport} Star
                    </span>
                    {player.eyePoints > 50 && (
                      <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-[10px] font-black tracking-widest uppercase border border-secondary/20">
                        Eye Point King
                      </span>
                    )}
                  </div>
                  <h1 className="text-5xl md:text-7xl font-display italic uppercase tracking-tighter leading-none mb-4">
                    {player.name}
                  </h1>
                  <p className="text-white/40 font-medium text-lg italic">{team?.name || 'Brix University'}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <InfoMeta icon={<Calendar size={14} />} label="Age" value={player.age?.toString() || '-'} />
                  <InfoMeta icon={<Ruler size={14} />} label="Height" value={player.height || '-'} />
                  <InfoMeta icon={<Award size={14} />} label="Points" value={player.eyePoints?.toString() || '0'} />
                  <InfoMeta icon={<MapPin size={14} />} label="Origin" value={player.nationality || 'Nigeria'} />
                </div>
              </div>
            </div>
          </section>

          {/* Attributes & Recent Form */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Attributes */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" />
                <h3 className="font-display italic uppercase tracking-tighter text-2xl">Attributes</h3>
              </div>
              <div className="bg-white/5 rounded-[32px] p-8 border border-white/5 space-y-6">
                {player.attributes && typeof player.attributes === 'object' ? (
                  Object.entries(player.attributes).map(([attr, val]) => (
                    <div key={attr} className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black tracking-widest uppercase text-white/40">
                        <span>{attr}</span>
                        <span className="text-white">{val as number}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${val}%` }}
                          className={`h-full ${(val as number) >= 85 ? 'bg-primary' : (val as number) >= 75 ? 'bg-secondary' : 'bg-white/40'}`}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-white/20 uppercase tracking-widest text-[10px] font-black">
                    No attribute data available
                  </div>
                )}
              </div>
            </div>

            {/* Recent Form */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-primary" />
                <h3 className="font-display italic uppercase tracking-tighter text-2xl">Recent Form</h3>
              </div>
              <div className="bg-white/5 rounded-[32px] p-8 border border-white/5 h-full flex flex-col justify-center gap-4">
                {loading ? (
                  <div className="text-center py-10 text-white/40">Loading...</div>
                ) : recentMatches.length > 0 ? (
                  recentMatches.slice(0, 3).map((matchData: any, index: number) => {
                    const eventCount = matchData.events?.length || 0;

                    // Calculate points for basketball or goals for football
                    let eventSummary = '';
                    if (playerSport === 'Basketball') {
                      const twoPointers = matchData.events?.filter((e: any) => e.type === '2PT_MADE').length || 0;
                      const threePointers = matchData.events?.filter((e: any) => e.type === '3PT_MADE').length || 0;
                      const freeThrows = matchData.events?.filter((e: any) => e.type === 'FREE_THROW').length || 0;
                      const points = (twoPointers * 2) + (threePointers * 3) + freeThrows;
                      eventSummary = `${points} Points`;
                    } else {
                      const goals = matchData.events?.filter((e: any) => e.type === 'GOAL').length || 0;
                      eventSummary = `${goals} Goals`;
                    }

                    return (
                      <div key={index} className={`flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 ${eventCount === 0 ? 'opacity-50' : ''}`}>
                        <span className="text-[10px] font-black tracking-widest uppercase text-white/40">
                          vs {matchData.match?.homeTeamId === team?.id ? matchData.match?.awayTeam?.shortName : matchData.match?.homeTeam?.shortName || 'TBD'}
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold italic">{eventCount > 0 ? eventSummary : '-'}</span>
                          <span className={`px-2 py-1 rounded-lg font-black text-xs ${eventCount > 0 ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/40'}`}>
                            {matchData.rating != null ? matchData.rating.toFixed(1) : '-'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 text-white/20 uppercase tracking-widest text-[10px] font-black">
                    No recent matches
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Season Stats */}
          <section className="bg-gradient-to-br from-white/5 to-transparent rounded-[48px] border border-white/10 p-8 md:p-12">
            <div className="flex items-center gap-2 mb-8">
              <Trophy size={18} className="text-primary" />
              <h3 className="font-display italic uppercase tracking-tighter text-2xl">Season Statistics</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {playerSport === 'Basketball' ? (
                <>
                  <StatCard label="Points" value={stats.totalPoints || 0} color="green" />
                  <StatCard label="Rebounds" value={stats.rebounds || 0} color="blue" />
                  <StatCard label="Assists" value={stats.assists || 0} color="purple" />
                  <StatCard label="Steals" value={stats.steals || 0} color="yellow" />
                </>
              ) : (
                <>
                  <StatCard label="Goals" value={stats.goals || 0} color="green" />
                  <StatCard label="Assists" value={stats.assists || 0} color="blue" />
                  <StatCard label="Appearances" value={stats.appearances || '-'} color="purple" />
                  <StatCard label="Yellow Cards" value={stats.yellowCards || 0} color="yellow" />
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </motion.div >
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

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colorClasses: Record<string, string> = {
    green: 'text-green-500',
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    yellow: 'text-yellow-500',
    red: 'text-red-500',
  };

  return (
    <div className="text-center p-6 bg-white/5 rounded-2xl border border-white/10">
      <div className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</div>
      <div className="text-xs text-white/60 mt-2 uppercase tracking-wider font-bold">{label}</div>
    </div>
  );
}

function Trophy({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
