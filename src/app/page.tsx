'use client';

import { useState } from 'react';
import Image from "next/image";
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Activity, Calendar, LayoutDashboard, User, Search, Bell, Menu, X, ArrowRight, Star, TrendingUp, Zap } from 'lucide-react';
import { TEAMS, MATCHES, Team, Match } from '@/lib/mock-data';
import { StandingsGrid } from '@/components/StandingsGrid';
import { TopPlayers } from '@/components/TopPlayers';

export default function Home() {
  const [activeTab, setActiveTab] = useState('LIVE');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const filteredMatches = MATCHES.filter(m => activeTab === 'ALL' || m.status === activeTab);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-display text-xl -skew-x-12 text-black">B</div>
              <span className="font-display text-2xl tracking-tight hidden sm:block">BRIXSPORT</span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-white/60">
              <a href="#" className="text-white">Scores</a>
              <a href="#" className="hover:text-white transition-colors">News</a>
              <a href="#" className="hover:text-white transition-colors">Players</a>
              <a href="#" className="hover:text-white transition-colors">Competitions</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <Search size={20} className="text-white/60" />
            </button>
            <button className="p-2 hover:bg-white/5 rounded-full transition-colors relative">
              <Bell size={20} className="text-white/60" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full"></span>
            </button>
            <button className="hidden sm:flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10 transition-all">
              <User size={18} />
              <span className="text-sm">Sign In</span>
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
                    <span className="text-xs font-bold uppercase tracking-widest">Trending</span>
                  </div>
                  <div className="space-y-4">
                    <div className="group cursor-pointer">
                      <p className="text-sm font-bold group-hover:text-primary transition-colors">NUGA Finals: UNILAG vs UNIBEN</p>
                      <p className="text-[10px] text-white/40">24.5k watching now</p>
                    </div>
                    <div className="group cursor-pointer">
                      <p className="text-sm font-bold group-hover:text-primary transition-colors">Tunde Adeyemi: The Eye Point King?</p>
                      <p className="text-[10px] text-white/40">Interview • 15min read</p>
                    </div>
                  </div>
               </div>
               <StandingsGrid />
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
                    <span className="text-[10px] font-black text-white/40 tracking-widest uppercase">Streaming Now</span>
                  </div>
                </div>

                <div className="space-y-6">
                  <AnimatePresence mode="popLayout">
                    {MATCHES.filter(m => m.status === 'LIVE').map((match) => (
                      <MatchCard key={match.id} match={match} />
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
                        className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
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
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-xs italic text-white/60">
                      <Calendar size={14} />
                      MARCH 20, 2024
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredMatches.length > 0 ? (
                    filteredMatches.map((match) => (
                      <MatchRow key={match.id} match={match} />
                    ))
                  ) : (
                    <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[40px]">
                      <Trophy size={48} className="mx-auto text-white/10 mb-4" />
                      <p className="text-white/30 font-display text-xl">No {activeTab.toLowerCase()} matches found</p>
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
                  <h3 className="font-display text-4xl leading-[0.9] italic mb-4">PREMIUM<br/>EXPERIENCE</h3>
                  <p className="text-xs font-bold leading-relaxed mb-6">Unlock deep analytics, real-time university heatmaps, and exclusive NUGA coverage.</p>
                  <button className="bg-black text-white px-6 py-3 rounded-full text-[10px] font-black tracking-widest uppercase hover:bg-black/90 transition-colors">
                    GO PRO
                  </button>
               </div>
               <TopPlayers />
            </div>
          </div>
        </div>
      </main>

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
              <a href="#" className="text-primary">Scores</a>
              <a href="#" className="text-white/60 hover:text-white transition-colors">News</a>
              <a href="#" className="text-white/60 hover:text-white transition-colors">Players</a>
              <a href="#" className="text-white/60 hover:text-white transition-colors">Competitions</a>
              <hr className="border-white/5" />
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

function MatchCard({ match }: { match: Match }) {
  const homeTeam = TEAMS.find(t => t.id === match.homeTeamId);
  const awayTeam = TEAMS.find(t => t.id === match.awayTeamId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className="relative group overflow-hidden bg-gradient-to-br from-white/10 to-white/5 p-6 rounded-[32px] border border-white/10 hover:border-primary/50 transition-all h-[240px] flex flex-col justify-between"
    >
      <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10 group-hover:opacity-20 transition-opacity">
         <Trophy size={140} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase bg-white/5 px-3 py-1 rounded-full border border-white/5">
            {match.competition}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            {match.sport === 'Football' ? "75'" : "Q3 04:22"}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-3xl border border-white/10 group-hover:bg-white/10 transition-colors">
              {homeTeam?.logo}
            </div>
            <span className="text-xs font-bold tracking-tight">{homeTeam?.shortName}</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-4 text-5xl font-display italic tabular-nums leading-none">
              <span>{match.homeScore}</span>
              <span className="text-white/20 text-2xl">:</span>
              <span>{match.awayScore}</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-3xl border border-white/10 group-hover:bg-white/10 transition-colors">
              {awayTeam?.logo}
            </div>
            <span className="text-xs font-bold tracking-tight">{awayTeam?.shortName}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
           <Activity size={14} className="text-white/40" />
           <span className="text-[11px] text-white/60 line-clamp-1">{match.venue}</span>
        </div>
        <button className="text-[11px] font-bold text-primary flex items-center gap-1">
          INFO <ArrowRight size={12} />
        </button>
      </div>
    </motion.div>
  );
}

function MatchRow({ match }: { match: Match }) {
  const homeTeam = TEAMS.find(t => t.id === match.homeTeamId);
  const awayTeam = TEAMS.find(t => t.id === match.awayTeamId);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="group bg-white/5 hover:bg-white/[0.08] p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center gap-2 w-32 border-r border-white/5">
           <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{match.sport}</span>
           <div className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
             match.status === 'LIVE' ? 'bg-red-500 text-white' : 
             match.status === 'FINISHED' ? 'bg-white/10 text-white/40' : 
             'bg-primary text-black'
           }`}>
             {match.status}
           </div>
        </div>
        
        <div className="flex items-center gap-8 flex-1">
          <div className="flex items-center justify-end gap-3 flex-1">
            <span className="text-sm font-bold hidden sm:block italic truncate">{homeTeam?.name}</span>
            <span className="text-sm font-bold sm:hidden">{homeTeam?.shortName}</span>
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-lg">{homeTeam?.logo}</div>
          </div>

          <div className="flex items-center gap-3 px-4 py-1 bg-black/40 rounded-lg min-w-[80px] justify-center border border-white/5">
            <span className={`text-xl font-display italic ${match.status === 'UPCOMING' ? 'text-white/20' : ''}`}>
              {match.status === 'UPCOMING' ? '0' : match.homeScore}
            </span>
            <span className="text-white/10 text-sm italic">vs</span>
            <span className={`text-xl font-display italic ${match.status === 'UPCOMING' ? 'text-white/20' : ''}`}>
              {match.status === 'UPCOMING' ? '0' : match.awayScore}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-lg">{awayTeam?.logo}</div>
            <span className="text-sm font-bold hidden sm:block italic truncate">{awayTeam?.name}</span>
            <span className="text-sm font-bold sm:hidden">{awayTeam?.shortName}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:block text-right">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{match.competition}</p>
          <p className="text-[11px] text-white/50">{match.venue}</p>
        </div>
        <div className="h-8 w-[1px] bg-white/5 hidden lg:block"></div>
        <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-primary">
          <Star size={18} />
        </button>
      </div>
    </motion.div>
  );
}
