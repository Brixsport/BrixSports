'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Activity, Shield, Users, Server, Globe, Settings, Eye, AlertCircle, CheckCircle2, MoreVertical, Search, Filter, Newspaper, TrendingUp, Trophy, Calendar } from 'lucide-react';


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
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-black border-r border-white/5 hidden lg:flex flex-col p-6 space-y-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-black font-display text-xl -skew-x-12">B</div>
          <span className="font-display text-xl tracking-tight italic uppercase">Command</span>
        </div>

        <nav className="flex-1 space-y-1">
          <NavItem icon={<Activity size={18} />} label="Live Monitor" active href="/admin" />
          <NavItem icon={<Trophy size={18} />} label="Competitions" href="/admin/competitions" />
          <NavItem icon={<Calendar size={18} />} label="Matches" href="/admin/matches" />
          <NavItem icon={<Newspaper size={18} />} label="News" href="/admin/news" />
          <NavItem icon={<TrendingUp size={18} />} label="Transfers" href="/admin/transfers" />
          <NavItem icon={<Users size={18} />} label="Loggers" href="/admin/loggers" />
          <NavItem icon={<Server size={18} />} label="Infrastructure" href="/admin/infrastructure" />
          <NavItem icon={<Shield size={18} />} label="Access Control" href="/admin/access" />
          <NavItem icon={<Settings size={18} />} label="Algorithm Setup" href="/admin/settings" />
        </nav>


        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Nexus Core</span>
          </div>
          <p className="text-[10px] text-white/60 font-bold">Latency: 14ms</p>
          <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
            <div className="w-full h-full bg-blue-500 opacity-20"></div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-8 p-6 lg:p-12">
        <div className="max-w-6xl mx-auto space-y-12">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="font-display text-4xl tracking-tight italic uppercase leading-none mb-2">Operations Monitor</h1>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Real-time oversight of all platform activity</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                <input
                  type="text"
                  placeholder="Search processes..."
                  className="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs font-bold outline-none focus:border-primary transition-all w-64"
                />
              </div>
              <button className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                <Filter size={18} className="text-white/60" />
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
              subValue={`${teams.filter(t => t.sport === 'Football').length} Football, ${teams.filter(t => t.sport === 'Basketball').length} Basketball`}
            />
            <StatCard
              label="Live Matches"
              value={matches.filter(m => m.status === 'LIVE').length.toString()}
              subValue={`${matches.filter(m => m.status === 'UPCOMING').length} Upcoming`}
            />
          </div>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display italic uppercase tracking-tighter text-2xl">Assignment Monitor</h3>
              <div className="flex gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary px-3 py-1 bg-primary/10 rounded border border-primary/20">
                  {matches.filter(m => !m.loggerId && m.status !== 'FINISHED').length} Unassigned active matches
                </span>
                <Link href="/admin/loggers" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">Manage All Loggers →</Link>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 text-sm text-white/40">Loading data...</p>
                </div>
              ) : matches.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm text-white/40">No matches found in the database</p>
                  <Link href="/admin/matches" className="mt-4 inline-block text-xs font-bold text-primary hover:underline">
                    Create your first match →
                  </Link>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/30">
                      <th className="p-6">Match</th>
                      <th className="p-6">Status</th>
                      <th className="p-6">Assigned Logger</th>
                      <th className="p-6">Health</th>
                      <th className="p-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {matches.filter(m => m.status !== 'FINISHED').map((match) => {
                      const homeTeam = teams.find(t => t.id === match.homeTeamId);
                      const awayTeam = teams.find(t => t.id === match.awayTeamId);
                      const logger = loggers.find(l => l.id === match.loggerId);

                      return (
                        <tr key={match.id} className="group hover:bg-white/5 transition-colors">
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{homeTeam?.logo || '⚽'}</span>
                              <span className="text-xs font-bold italic text-white/40">VS</span>
                              <span className="text-xl">{awayTeam?.logo || '⚽'}</span>
                              <div className="ml-2">
                                <p className="text-sm font-bold truncate">{homeTeam?.shortName || 'TBD'} vs {awayTeam?.shortName || 'TBD'}</p>
                                <p className="text-[10px] text-white/20 uppercase tracking-widest">{match.competition || 'N/A'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${match.status === 'LIVE' ? 'bg-primary' : 'bg-white/20'}`}></span>
                              <span className="text-[10px] font-black uppercase tracking-widest">{match.status}</span>
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black uppercase tracking-widest">
                                {logger?.name?.charAt(0) || '?'}
                              </div>
                              <p className="text-xs font-bold italic">{logger?.name || 'Unassigned'}</p>
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-2 text-blue-500">
                              <CheckCircle2 size={14} />
                              <span className="text-[10px] font-black uppercase tracking-widest">Optimal</span>
                            </div>
                          </td>
                          <td className="p-6 text-right">
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                              <MoreVertical size={16} className="text-white/40" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="font-display italic uppercase tracking-tighter text-2xl">Logger performance</h3>
              <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Total Loggers</span>
                    <span className="text-2xl font-display italic">{loggers.length}</span>
                  </div>
                  <div className="h-10 w-px bg-white/10"></div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Active</span>
                    <span className="text-2xl font-display italic">{loggers.filter(l => l.status === 'active').length}</span>
                  </div>
                  <div className="h-10 w-px bg-white/10"></div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Available</span>
                    <span className="text-2xl font-display italic">{loggers.filter(l => l.isAvailable).length}</span>
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
                            <div className="flex justify-between text-[10px] font-black uppercase">
                              <span>{logger.name}</span>
                              <span>{loggerMatches.length} active</span>
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

            <div className="space-y-6">
              <h3 className="font-display italic uppercase tracking-tighter text-2xl">Rating Health</h3>
              <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-6">
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
                <Link href="/admin/settings" className="block w-full py-4 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors text-center">
                  System Settings
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, href = '#' }: { icon: React.ReactNode, label: string, active?: boolean, href?: string }) {
  const className = `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-primary text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`;

  if (href !== '#') {
    return (
      <Link href={href} className={className}>
        {icon}
        <span className="text-xs font-bold italic uppercase tracking-tight">{label}</span>
      </Link>
    );
  }

  return (
    <a href={href} className={className}>
      {icon}
      <span className="text-xs font-bold italic uppercase tracking-tight">{label}</span>
    </a>
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

