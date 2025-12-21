'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Activity, Calendar, User, Search, Bell, Menu, X, TrendingUp, Zap, Star } from 'lucide-react';
import { MATCHES, Player, Team, Match, TEAMS } from '@/lib/mock-data';
import { StandingsGrid } from '@/components/StandingsGrid';
import { MatchCard, MatchRow } from '@/components/MatchComponents';
import { FanWall } from '@/components/FanWall';
import { MyFeed } from '@/components/MyFeed';
import { MatchOverlay } from '@/components/MatchOverlay';
import { SearchOverlay } from '@/components/SearchOverlay';
import { PlayerProfileOverlay } from '@/components/PlayerProfileOverlay';
import { NotificationToast, useNotifications } from '@/components/Notifications';
import { SettingsOverlay } from '@/components/SettingsOverlay';
import { useFavorites } from '@/hooks/useFavorites';

export default function Home() {
  const [activeTab, setActiveTab] = useState('LIVE');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Overlay States
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { notifications, addNotification, removeNotification } = useNotifications();
  const { favoriteTeams, favoritePlayers } = useFavorites();

  const filteredMatches = MATCHES.filter(m => activeTab === 'ALL' || m.status === activeTab);

  // Simulate real-time notifications for followed entities
  useEffect(() => {
    const timer = setTimeout(() => {
      if (favoriteTeams.length > 0) {
        const teamName = TEAMS.find(t => t.id === favoriteTeams[0])?.name;
        addNotification({
          title: 'Match Update',
          message: `${teamName} have just scored against OAU!`,
          type: 'match'
        });
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [favoriteTeams]);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-display text-xl -skew-x-12 text-black transition-transform hover:rotate-12">B</div>
              <span className="font-display text-2xl tracking-tight hidden sm:block">BRIXSPORT</span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-white/40">
              <a href="#" className="hover:text-primary transition-colors">Competitions</a>
              <a href="#" className="hover:text-primary transition-colors">Schools</a>
              <a href="#" className="hover:text-primary transition-colors">Draft</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <Search size={20} className="text-white/60" />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors relative"
            >
              <Bell size={20} className="text-white/60" />
              {notifications.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full"></span>
              )}
            </button>
            <button className="hidden sm:flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10 transition-all">
              <User size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Sign In</span>
            </button>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero / Live Spotlight */}
      <main className="pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Left - Info & Quick Links */}
            <div className="lg:col-span-1 space-y-8 hidden lg:block">
               <div className="bg-white/5 rounded-[32px] border border-white/10 p-6">
                  <div className="flex items-center gap-2 mb-4 text-primary">
                    <TrendingUp size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">Pulse</span>
                  </div>
                  <div className="space-y-4">
                    <div className="group cursor-pointer">
                      <p className="text-sm font-bold group-hover:text-primary transition-colors">UNILAG vs UNIBEN</p>
                      <p className="text-[10px] text-white/40">24.5k watching now</p>
                    </div>
                    <div className="group cursor-pointer">
                      <p className="text-sm font-bold group-hover:text-primary transition-colors">Eye Point Update</p>
                      <p className="text-[10px] text-white/40">Article • 5min read</p>
                    </div>
                  </div>
               </div>
               
               <MyFeed 
                 onSelectMatch={setSelectedMatch}
                 onSelectPlayer={setSelectedPlayer}
               />

               <StandingsGrid />
               <FanWall />
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-12">
              <section>
                <div className="flex items-center justify-between mb-6 leading-none">
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-3xl tracking-tight italic uppercase">LIVE ARENA</h2>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 text-red-500 rounded border border-red-500/20 text-[10px] font-bold tracking-widest uppercase animate-pulse">
                      <Activity size={12} />
                      LIVE
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]"></div>
                    <span className="text-[10px] font-black text-white/40 tracking-widest uppercase">Streaming</span>
                  </div>
                </div>

                <div className="space-y-6">
                  <AnimatePresence mode="popLayout">
                    {MATCHES.filter(m => m.status === 'LIVE').map((match) => (
                      <div key={match.id} onClick={() => setSelectedMatch(match)} className="cursor-pointer">
                        <MatchCard match={match} />
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              </section>

              {/* Filters & Schedule */}
              <section>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 self-start">
                    {['LIVE', 'UPCOMING', 'FINISHED', 'ALL'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 sm:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          activeTab === tab 
                            ? 'bg-primary text-black shadow-lg shadow-primary/20' 
                            : 'text-white/40 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-[10px] font-black uppercase italic text-white/60">
                      <Calendar size={14} />
                      MARCH 20, 2024
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredMatches.length > 0 ? (
                    filteredMatches.map((match) => (
                      <div key={match.id} onClick={() => setSelectedMatch(match)} className="cursor-pointer">
                        <MatchRow match={match} />
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[40px]">
                      <Trophy size={48} className="mx-auto text-white/10 mb-4" />
                      <p className="text-white/30 font-display text-xl uppercase italic">No {activeTab.toLowerCase()} matches</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Sidebar Right - Stats & Players */}
            <div className="lg:col-span-1 space-y-8">
               <div className="bg-primary group relative overflow-hidden rounded-[32px] p-8 text-black transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform">
                    <Zap size={80} fill="currentColor" />
                  </div>
                  <h3 className="font-display text-4xl leading-[0.9] italic mb-4 uppercase">SCOUT<br/>QUERY</h3>
                  <p className="text-[11px] font-bold leading-relaxed mb-6">Deep metrics for recursive recruiting. Access every high school and university data point.</p>
                  <button className="bg-black text-white px-6 py-3 rounded-full text-[10px] font-black tracking-widest uppercase hover:bg-black/90 transition-colors">
                    ACCESS DATA
                  </button>
               </div>
               <StandingsGrid className="lg:hidden" />
            </div>
          </div>
        </div>
      </main>

      {/* Overlays */}
      <AnimatePresence>
        {selectedMatch && (
          <MatchOverlay 
            match={selectedMatch} 
            onClose={() => setSelectedMatch(null)}
            onSelectPlayer={(player) => {
              setSelectedPlayer(player);
              setSelectedMatch(null);
            }}
          />
        )}
        {selectedPlayer && (
          <PlayerProfileOverlay 
            player={selectedPlayer}
            onClose={() => setSelectedPlayer(null)}
          />
        )}
        {isSearchOpen && (
          <SearchOverlay 
            onClose={() => setIsSearchOpen(false)}
            onSelectTeam={(team) => {
              console.log('Selected team:', team);
              setIsSearchOpen(false);
            }}
            onSelectPlayer={(player) => {
              setSelectedPlayer(player);
              setIsSearchOpen(false);
            }}
          />
        )}
        {isSettingsOpen && (
          <SettingsOverlay 
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </AnimatePresence>

      <NotificationToast 
        notifications={notifications} 
        onClose={removeNotification} 
      />

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black pt-20 px-4 md:hidden"
          >
            <div className="flex flex-col gap-6 text-xl font-display italic tracking-tight uppercase">
              <a href="#" className="text-primary" onClick={() => setIsMenuOpen(false)}>Scores</a>
              <a href="#" className="text-white/60 hover:text-white transition-colors" onClick={() => setIsMenuOpen(false)}>Schools</a>
              <a href="#" className="text-white/60 hover:text-white transition-colors" onClick={() => setIsMenuOpen(false)}>Draft</a>
              <hr className="border-white/5" />
              <button 
                onClick={() => { setIsSearchOpen(true); setIsMenuOpen(false); }}
                className="flex items-center gap-3 text-white/60"
              >
                <Search size={24} />
                SEARCH
              </button>
              <button 
                onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false); }}
                className="flex items-center gap-3 text-white/60"
              >
                <Bell size={24} />
                ALERTS
              </button>
              <button className="flex items-center gap-3 bg-primary text-black px-6 py-4 rounded-2xl font-bold tracking-tight">
                <User size={24} />
                SIGN IN
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
