'use client';

import { motion } from 'framer-motion';
import { Trophy, ChevronRight, LayoutGrid, ListOrdered } from 'lucide-react';
import { STANDINGS, BRACKET, TEAMS } from '@/lib/mock-data';
import { useState } from 'react';

export default function CompetitionsPage() {
  const [view, setView] = useState<'standings' | 'brackets'>('standings');

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Trophy size={16} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">NUGA Games 2024</span>
            </div>
            <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none">Intelligence Hub</h1>
          </div>
          
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
            <button 
              onClick={() => setView('standings')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                view === 'standings' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'
              }`}
            >
              <ListOrdered size={14} />
              Standings
            </button>
            <button 
              onClick={() => setView('brackets')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                view === 'brackets' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'
              }`}
            >
              <LayoutGrid size={14} />
              Brackets
            </button>
          </div>
        </header>

        {view === 'standings' ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-[40px] overflow-hidden"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-white/40">Pos</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-white/40">Institution</th>
                  <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">P</th>
                  <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">W</th>
                  <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">D</th>
                  <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">L</th>
                  <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">GD</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-primary text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
                {STANDINGS.map((row, idx) => {
                  const team = TEAMS.find(t => t.id === row.teamId);
                  return (
                    <motion.tr 
                      key={row.teamId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <span className={`text-lg font-display italic ${idx < 3 ? 'text-primary' : 'text-white/20'}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <span className="text-3xl">{team?.logo}</span>
                          <div>
                            <p className="text-sm font-black uppercase tracking-tight">{team?.name}</p>
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{team?.university}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-6 text-center font-bold">{row.played}</td>
                      <td className="px-4 py-6 text-center font-bold">{row.won}</td>
                      <td className="px-4 py-6 text-center font-bold">{row.drawn}</td>
                      <td className="px-4 py-6 text-center font-bold">{row.lost}</td>
                      <td className="px-4 py-6 text-center font-bold text-white/40">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                      <td className="px-8 py-6 text-center">
                        <span className="bg-primary/10 text-primary px-4 py-2 rounded-xl font-display italic text-lg border border-primary/20">
                          {row.pts}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
             <div className="space-y-8">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 px-4">Semi-Finals</h3>
                <div className="space-y-4">
                   {BRACKET.filter(b => b.id.startsWith('sf')).map(node => (
                     <BracketMatch key={node.id} node={node} />
                   ))}
                </div>
             </div>
             <div className="space-y-8 relative">
                <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-12 h-px bg-white/10 hidden md:block" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary px-4">Grand Final</h3>
                <BracketMatch node={BRACKET.find(b => b.id === 'f1')!} isFinal />
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BracketMatch({ node, isFinal }: { node: typeof BRACKET[0], isFinal?: boolean }) {
  const homeTeam = TEAMS.find(t => t.id === node.homeTeamId);
  const awayTeam = TEAMS.find(t => t.id === node.awayTeamId);

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className={`bg-white/5 border rounded-3xl p-6 transition-all ${
        isFinal ? 'border-primary/50 bg-primary/5' : 'border-white/10'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{node.title}</span>
        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
          node.status === 'LIVE' ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-white/40'
        }`}>
          {node.status}
        </span>
      </div>
      
      <div className="space-y-3">
        <TeamLine 
          team={homeTeam} 
          score={node.homeScore} 
          isWinner={node.status === 'FINISHED' && (node.homeScore || 0) > (node.awayScore || 0)} 
        />
        <div className="h-px bg-white/5 mx-2" />
        <TeamLine 
          team={awayTeam} 
          score={node.awayScore} 
          isWinner={node.status === 'FINISHED' && (node.awayScore || 0) > (node.homeScore || 0)} 
        />
      </div>
    </motion.div>
  );
}

function TeamLine({ team, score, isWinner }: { team?: typeof TEAMS[0], score?: number, isWinner?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${isWinner ? 'text-white' : 'text-white/40'}`}>
      <div className="flex items-center gap-3">
        <span className="text-xl">{team?.logo || '❓'}</span>
        <span className="text-xs font-black uppercase tracking-widest">{team?.shortName || 'TBD'}</span>
      </div>
      <span className={`font-display italic text-lg ${isWinner ? 'text-primary' : ''}`}>
        {score ?? '-'}
      </span>
    </div>
  );
}
