'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Activity, Shield, Users, Server, Globe, Settings, Eye, AlertCircle, CheckCircle2, MoreVertical, Search, Filter, Newspaper, TrendingUp, Trophy, Calendar, Video, Timer } from 'lucide-react';


export default function AdminPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loggers, setLoggers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [matchesRes, teamsRes, loggersRes] = await Promise.all([
          fetch('/api/matches'),
          fetch('/api/teams'),
          fetch('/api/loggers')
        ]);

        const matchesData = await matchesRes.json();
        const teamsData = await teamsRes.json();
        const loggersData = await loggersRes.json();

        setMatches(matchesData);
        setTeams(teamsData);
        setLoggers(loggersData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const activeMatches = matches.filter(m => m.status === 'LIVE');

  return (
    <div className="p-4 md:p-6 lg:p-12">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-12">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <div>
            <h1 className="font-display text-2xl md:text-4xl tracking-tight italic uppercase leading-none mb-1 md:mb-2">Operations Monitor</h1>
            <p className="text-white/40 text-[10px] md:text-xs font-bold uppercase tracking-widest">Real-time oversight of all platform activity</p>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
              <input
                type="text"
                placeholder="Search processes..."
                className="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-[10px] md:text-xs font-bold outline-none focus:border-primary transition-all w-full md:w-64"
              />
            </div>
            <button className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors shrink-0">
              <Filter size={18} className="text-white/60" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <StatCard
            label="Active Loggers"
            value={loggers.filter(l => l.status === 'active').length.toString()}
            subValue={`${loggers.filter(l => l.isAvailable).length} Available`}
          />
          <StatCard
            label="Active Matches"
            value={matches.filter(m => m.status !== 'FINISHED').length.toString()}
            subValue={`${matches.filter(m => m.loggerId && m.status !== 'FINISHED').length} Assigned`}
          />
          <StatCard
            label="Total Teams"
            value={teams.length.toString()}
            subValue={`${teams.filter(t => t.sport === 'Football').length} FB, ${teams.filter(t => t.sport === 'Basketball').length} BB`}
          />
          <StatCard
            label="Live Matches"
            value={matches.filter(m => m.status === 'LIVE').length.toString()}
            subValue={`${matches.filter(m => m.status === 'UPCOMING').length} Upcoming`}
          />
        </div>

        <section className="space-y-4 md:space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="font-display italic uppercase tracking-tighter text-xl md:text-2xl">Assignment Monitor</h3>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-primary px-2 py-1 bg-primary/10 rounded border border-primary/20">
                {matches.filter(m => !m.loggerId && m.status !== 'FINISHED').length} Unassigned active matches
              </span>
              <Link href="/admin/loggers" className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">Loggers →</Link>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[32px] overflow-hidden">
            {loading ? (
              <div className="p-8 md:p-12 text-center">
                <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-xs md:text-sm text-white/40">Loading data...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="p-8 md:p-12 text-center">
                <p className="text-xs md:text-sm text-white/40">No matches found in the database</p>
                <Link href="/admin/matches" className="mt-4 inline-block text-[10px] md:text-xs font-bold text-primary hover:underline">
                  Create your first match →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/30 text-nowrap">
                      <th className="p-4 md:p-6 whitespace-nowrap">Match</th>
                      <th className="p-4 md:p-6">Status</th>
                      <th className="p-4 md:p-6">Assigned Logger</th>
                      <th className="p-4 md:p-6">Health</th>
                      <th className="p-4 md:p-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {matches.filter(m => m.status !== 'FINISHED').map((match) => {
                      const homeTeam = teams.find(t => t.id === match.homeTeamId);
                      const awayTeam = teams.find(t => t.id === match.awayTeamId);
                      const logger = loggers.find(l => l.id === match.loggerId);

                      return (
                        <tr key={match.id} className="group hover:bg-white/5 transition-colors">
                          <td className="p-4 md:p-6">
                            <div className="flex items-center gap-2 md:gap-3">
                              <div className="flex items-center gap-1 shrink-0">
                                {homeTeam?.logo ? (
                                  <img src={homeTeam.logo} alt={homeTeam.name} className="w-5 h-5 md:w-6 md:h-6 object-contain" />
                                ) : (
                                  <span className="text-sm md:text-xl">⚽</span>
                                )}
                                <span className="text-[8px] md:text-xs font-bold italic text-white/40">VS</span>
                                {awayTeam?.logo ? (
                                  <img src={awayTeam.logo} alt={awayTeam.name} className="w-5 h-5 md:w-6 md:h-6 object-contain" />
                                ) : (
                                  <span className="text-sm md:text-xl">⚽</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] md:text-sm font-bold truncate max-w-[120px] md:max-w-none">{homeTeam?.shortName || 'TBD'} vs {awayTeam?.shortName || 'TBD'}</p>
                                <p className="text-[8px] md:text-[10px] text-white/20 uppercase tracking-widest truncate">{match.competition || 'N/A'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 md:p-6">
                            <div className="flex items-center gap-1.5 md:gap-2">
                              <span className={`w-1 w-1 md:w-1.5 md:h-1.5 rounded-full ${match.status === 'LIVE' ? 'bg-primary' : 'bg-white/20'}`}></span>
                              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">{match.status}</span>
                            </div>
                          </td>
                          <td className="p-4 md:p-6">
                            <div className="flex items-center gap-2 md:gap-3">
                              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-white/10 flex items-center justify-center text-[8px] md:text-[10px] font-black uppercase tracking-widest shrink-0">
                                {logger?.name?.charAt(0) || '?'}
                              </div>
                              <p className="text-[10px] md:text-xs font-bold italic truncate max-w-[80px] md:max-w-none">{logger?.name || 'Unassigned'}</p>
                            </div>
                          </td>
                          <td className="p-4 md:p-6">
                            <div className="flex items-center gap-1.5 md:gap-2 text-blue-500">
                              <CheckCircle2 size={14} />
                              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">Optimal</span>
                            </div>
                          </td>
                          <td className="p-4 md:p-6 text-right">
                            <button className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg transition-colors">
                              <MoreVertical size={16} className="text-white/40" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          <div className="space-y-4 md:space-y-6">
            <h3 className="font-display italic uppercase tracking-tighter text-xl md:text-2xl">Logger performance</h3>
            <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[32px] p-4 md:p-8">
              <div className="flex items-center justify-between gap-2 mb-6 md:mb-8 overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex flex-col gap-1 min-w-fit">
                  <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/40">Total</span>
                  <span className="text-lg md:text-2xl font-display italic">{loggers.length}</span>
                </div>
                <div className="h-8 md:h-10 w-px bg-white/10 shrink-0"></div>
                <div className="flex flex-col gap-1 min-w-fit">
                  <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/40">Active</span>
                  <span className="text-lg md:text-2xl font-display italic">{loggers.filter(l => l.status === 'active').length}</span>
                </div>
                <div className="h-8 md:h-10 w-px bg-white/10 shrink-0"></div>
                <div className="flex flex-col gap-1 min-w-fit">
                  <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/40">Available</span>
                  <span className="text-lg md:text-2xl font-display italic">{loggers.filter(l => l.isAvailable).length}</span>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Active Loggers</p>
                {loggers.filter(l => l.status === 'active').length === 0 ? (
                  <p className="text-xs text-white/40 text-center py-4">No active loggers</p>
                ) : (
                  loggers.filter(l => l.status === 'active').slice(0, 5).map(logger => {
                    const loggerMatches = matches.filter(m => m.loggerId === logger.id && m.status !== 'FINISHED');
                    return (
                      <div key={logger.id} className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary text-black flex items-center justify-center text-[10px] font-black italic">
                          {logger.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[8px] md:text-[10px] font-black uppercase">
                            <span className="truncate">{logger.name}</span>
                            <span className="shrink-0">{loggerMatches.length} active</span>
                          </div>
                          <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${Math.min((loggerMatches.length / Math.max(matches.filter(m => m.status !== 'FINISHED').length, 1)) * 100, 100)}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 md:space-y-6">
            <h3 className="font-display italic uppercase tracking-tighter text-xl md:text-2xl">Rating Health</h3>
            <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-[32px] p-6 md:p-8 space-y-4 md:space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold italic">Football Teams</span>
                  <span className="text-xs font-bold text-primary">{teams.filter(t => t.sport === 'Football').length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold italic">Basketball Teams</span>
                  <span className="text-xs font-bold text-primary">{teams.filter(t => t.sport === 'Basketball').length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold italic">Total Matches</span>
                  <span className="text-xs font-bold text-primary">{matches.length}</span>
                </div>
              </div>
              <Link href="/admin/settings" className="block w-full py-3 md:py-4 border border-white/10 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors text-center">
                System Settings
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}



function StatCard({ label, value, subValue }: { label: string, value: string, subValue: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</span>
      <p className="text-4xl font-display italic uppercase leading-none">{value}</p>
      <p className="text-[10px] text-primary font-black uppercase tracking-[0.1em]">{subValue}</p>
    </div>
  );
}

