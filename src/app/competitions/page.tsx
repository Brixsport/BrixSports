'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChevronRight, LayoutGrid, ListOrdered, Activity, Loader2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type SportType = 'Football' | 'Basketball' | 'Track';

interface Competition {
  name: string;
  sport: SportType;
}

interface Standing {
  id: string;
  teamId: string;
  team: {
    name: string;
    shortName: string;
    logo: string;
    university: string;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface BracketNode {
  id: string;
  title: string;
  status: string;
  homeTeam: any;
  awayTeam: any;
  homeScore: number;
  awayScore: number;
}

interface BracketRound {
  round: string;
  matches: BracketNode[];
}

export default function CompetitionsPage() {
  const router = useRouter();
  const [view, setView] = useState<'standings' | 'brackets'>('standings');
  const [selectedSport, setSelectedSport] = useState<SportType>('Basketball'); // Default to Basketball as it has data
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [brackets, setBrackets] = useState<BracketRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch all competitions on mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/competitions');
        const data = await res.json();

        if (data.competitions) {
          setCompetitions(data.competitions);

          // Auto-select the first competition for the default sport if available
          const firstCompForSport = data.competitions.find((c: Competition) => c.sport === selectedSport);
          if (firstCompForSport) {
            setSelectedComp(firstCompForSport.name);
          }
        }
      } catch (err) {
        console.error('Error fetching competitions:', err);
        setError('Failed to load competitions');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // 2. When selectedSport or selectedComp changes, fetch standings and brackets
  useEffect(() => {
    if (!selectedComp) return;

    const fetchDetails = async () => {
      try {
        // Fetch Standings
        const standingsRes = await fetch(`/api/basketball/standings?competition=${encodeURIComponent(selectedComp)}`);
        const sData = await standingsRes.json();
        if (sData.success) {
          setStandings(sData.standings);
        }

        // Fetch Brackets
        const bracketRes = await fetch(`/api/brackets?competition=${encodeURIComponent(selectedComp)}&sport=${selectedSport}`);
        const bData = await bracketRes.json();
        if (bData.rounds) {
          setBrackets(bData.rounds);
        } else {
          setBrackets([]);
        }

      } catch (err) {
        console.error('Error fetching details:', err);
      }
    };

    fetchDetails();
  }, [selectedComp, selectedSport]);

  const filteredCompetitions = competitions.filter(c => c.sport === selectedSport);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Trophy size={16} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                {selectedComp || 'Select a Competition'}
              </span>
            </div>
            <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none">Intelligence Hub</h1>
          </div>

          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setView('standings')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'standings' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'
                }`}
            >
              <ListOrdered size={14} />
              Standings
            </button>
            <button
              onClick={() => setView('brackets')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'brackets' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'
                }`}
            >
              <LayoutGrid size={14} />
              Brackets
            </button>
          </div>
        </header>

        {/* Sport & Competition Selector */}
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="inline-flex bg-white/5 p-1 rounded-2xl border border-white/10 gap-1">
              {(['Football', 'Basketball', 'Track'] as SportType[]).map((sport) => (
                <button
                  key={sport}
                  onClick={() => {
                    setSelectedSport(sport);
                    const firstForSport = competitions.find(c => c.sport === sport);
                    setSelectedComp(firstForSport ? firstForSport.name : null);
                  }}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedSport === sport ? 'bg-primary text-black' : 'text-white/40 hover:text-white'
                    }`}
                >
                  <Activity size={14} />
                  {sport}
                </button>
              ))}
            </div>
          </div>

          {filteredCompetitions.length > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto pb-2">
              {filteredCompetitions.map((comp) => (
                <button
                  key={comp.name}
                  onClick={() => {
                    if (comp.sport === 'Basketball' && comp.name.includes('BUSA LEAGUE')) {
                      router.push('/basketball');
                      return;
                    }
                    setSelectedComp(comp.name);
                  }}
                  className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border ${selectedComp === comp.name ? 'border-primary text-primary bg-primary/10' : 'border-white/10 text-white/40 hover:text-white'}`}
                >
                  {comp.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {view === 'standings' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-[40px] overflow-hidden"
          >
            {standings.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-white/40">Pos</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-white/40">Institution</th>
                    <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">P</th>
                    <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">W</th>
                    <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">D/L</th>
                    <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">GD</th>
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-primary text-center">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, idx) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <span className={`text-lg font-display italic ${idx < 3 ? 'text-primary' : 'text-white/20'}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 relative">
                            <img src={row.team.logo} alt={row.team.name} className="w-full h-full object-contain" />
                          </div>
                          <div>
                            <p className="text-sm font-black uppercase tracking-tight">{row.team.shortName}</p>
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{row.team.university}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-6 text-center font-bold">{row.played}</td>
                      <td className="px-4 py-6 text-center font-bold">{row.won}</td>
                      <td className="px-4 py-6 text-center font-bold">{selectedSport === 'Basketball' ? row.lost : row.drawn}</td>
                      <td className="px-4 py-6 text-center font-bold text-white/40">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                      <td className="px-8 py-6 text-center">
                        <span className="bg-primary/10 text-primary px-4 py-2 rounded-xl font-display italic text-lg border border-primary/20">
                          {row.points}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-24 text-center">
                <AlertCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/20 font-black uppercase tracking-widest text-xs italic">No standings data available for this competition</p>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="space-y-12">
            {brackets.length > 0 ? (
              <div className="relative overflow-x-auto pb-8">
                <div className="min-w-[1000px] relative p-8">
                  <div className="flex justify-around items-start gap-12">
                    {brackets.map((round) => (
                      <div key={round.round} className="flex-1 space-y-8">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary text-center mb-12">
                          {round.round.replace('_', ' ')}
                        </h3>
                        <div className="space-y-8">
                          {round.matches.map((match) => (
                            <div key={match.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-primary/30 transition-all">
                              <div className="flex justify-between items-center mb-4">
                                <span className="text-[8px] font-black uppercase tracking-widest text-white/30">{match.title}</span>
                                <span className={`text-[8px] px-2 py-0.5 rounded font-black ${match.status === 'LIVE' ? 'bg-red-500 animate-pulse' : 'bg-white/10 text-white/40'}`}>
                                  {match.status}
                                </span>
                              </div>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <img src={match.homeTeam?.logo} className="w-6 h-6 object-contain" />
                                    <span className="text-[10px] font-black uppercase text-white/60">{match.homeTeam?.name || 'TBD'}</span>
                                  </div>
                                  <span className="font-display italic text-lg">{match.homeScore ?? '-'}</span>
                                </div>
                                <div className="h-px bg-white/5" />
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <img src={match.awayTeam?.logo} className="w-6 h-6 object-contain" />
                                    <span className="text-[10px] font-black uppercase text-white/60">{match.awayTeam?.name || 'TBD'}</span>
                                  </div>
                                  <span className="font-display italic text-lg">{match.awayScore ?? '-'}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center bg-white/5 border border-white/10 rounded-[40px]">
                <AlertCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/20 font-black uppercase tracking-widest text-xs italic">No bracket data created yet for this competition</p>
                <p className="text-white/10 text-[10px] mt-2 italic px-12">Tournament brackets will appear here once the knockout phases are established.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
