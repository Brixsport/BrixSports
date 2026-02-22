'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChevronRight, LayoutGrid, ListOrdered, Activity, Loader2, AlertCircle, Calendar, Clock, MapPin } from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

type SportType = 'Football' | 'Basketball' | 'Track';

interface Competition {
  id: string;
  name: string;
  sport: SportType | null;
  isMultiSport?: boolean;
  season?: string;
  status?: string;
  description?: string;
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

interface Match {
  id: string;
  homeTeam: { name: string; shortName: string; logo: string };
  awayTeam: { name: string; shortName: string; logo: string };
  homeScore: number;
  awayScore: number;
  startTime: string;
  status: string;
  venue: string;
  competition: string;
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

function CompetitionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialComp = searchParams.get('competition');

  const [view, setView] = useState<'standings' | 'matches' | 'brackets'>('standings');
  const [selectedSport, setSelectedSport] = useState<SportType>('Football');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
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

          let defaultComp = null;
          // Try from URL
          if (initialComp) {
            defaultComp = data.competitions.find((c: Competition) => c.name === initialComp);
          }

          // Fallback to first available (BUSA preferred)
          if (!defaultComp) {
            const busa = data.competitions.find((c: Competition) => c.name.toUpperCase().includes('BUSA'));
            defaultComp = busa || data.competitions[0];
          }

          if (defaultComp) {
            setSelectedComp(defaultComp);
            // If it's a specific sport competition, set that sport
            if (defaultComp.sport) {
              setSelectedSport(defaultComp.sport as SportType);
            }
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

  // 2. When selectedComp changes, fetch data
  useEffect(() => {
    if (!selectedComp) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);

        // Fetch Standings
        const standingsRes = await fetch(`/api/${selectedSport.toLowerCase()}/standings?competitionId=${selectedComp.id}&competition=${encodeURIComponent(selectedComp.name)}`);
        const sData = await standingsRes.json();
        if (sData.success) setStandings(sData.standings || []);
        else setStandings([]);

        // Fetch Matches
        const matchesRes = await fetch(`/api/${selectedSport.toLowerCase()}/matches?competitionId=${selectedComp.id}&competition=${encodeURIComponent(selectedComp.name)}`);
        const mData = await matchesRes.json();
        if (mData.success && mData.matches) {
          setMatches(mData.matches);
        } else {
          setMatches([]);
        }

        // Fetch Brackets
        const bracketRes = await fetch(`/api/brackets?competitionId=${selectedComp.id}&competition=${encodeURIComponent(selectedComp.name)}&sport=${selectedSport}`);
        const bData = await bracketRes.json();
        if (bData.rounds) setBrackets(bData.rounds);
        else setBrackets([]);

      } catch (err) {
        console.error('Error fetching details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [selectedComp, selectedSport]);

  // Filter competitions for the current sport tab
  const filteredCompetitions = competitions
    .filter(c => c.isMultiSport || c.sport === selectedSport);

  if (loading && competitions.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-12">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 border-b border-white/5 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={14} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                {selectedComp?.season || 'Current Season'} • {selectedComp?.status || 'Active'}
              </span>
            </div>
            <h1 className="font-display text-2xl md:text-5xl tracking-tighter italic uppercase leading-none mb-2">
              {selectedComp?.name || 'Competition Viewer'}
            </h1>
            <p className="text-white/60 text-sm max-w-xl">
              {selectedComp?.description || `Managing standings, fixtures, and results for ${selectedComp?.name || 'this competition'}.`}
            </p>
          </div>

          {/* View Toggle */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto">
            <button
              onClick={() => setView('standings')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${view === 'standings' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
            >
              <ListOrdered size={14} />
              <span>Standings</span>
            </button>
            <button
              onClick={() => setView('matches')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${view === 'matches' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
            >
              <Calendar size={14} />
              <span>Matches</span>
            </button>
            <button
              onClick={() => setView('brackets')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${view === 'brackets' ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
            >
              <LayoutGrid size={14} />
              <span>Brackets</span>
            </button>
          </div>
        </header>

        {/* Sport & Competition Selector */}
        <div className="space-y-4 md:space-y-6">
          <div className="flex justify-center overflow-x-auto">
            <div className="inline-flex bg-white/5 p-1 rounded-2xl border border-white/10 gap-1">
              {(['Football', 'Basketball', 'Track'] as SportType[]).map((sport) => (
                <button
                  key={sport}
                  onClick={() => {
                    setSelectedSport(sport);
                    const firstForSport = competitions.find(c => c.sport === sport);
                    if (firstForSport) setSelectedComp(firstForSport);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedSport === sport ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`}
                >
                  <Activity size={12} />
                  {sport}
                </button>
              ))}
            </div>
          </div>

          {filteredCompetitions.length > 0 && (
            <div className="flex justify-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {filteredCompetitions.map((comp) => (
                <button
                  key={comp.id}
                  onClick={() => {
                    setSelectedComp(comp);
                    if (comp.sport && comp.sport !== selectedSport) {
                      setSelectedSport(comp.sport as SportType);
                    }
                  }}
                  className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border ${selectedComp?.id === comp.id ? 'border-primary text-primary bg-primary/10' : 'border-white/10 text-white/40 hover:text-white'}`}
                >
                  {comp.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {view === 'standings' && (
            <motion.div
              key="standings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white/5 border border-white/10 rounded-[40px] overflow-hidden"
            >
              {standings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Pos</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Team</th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">P</th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">W</th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">{selectedSport === 'Basketball' ? 'L' : 'D'}</th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">{selectedSport === 'Basketball' ? 'PCT' : 'L'}</th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-center">GD/DIFF</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-primary text-center">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((row, idx) => (
                        <tr
                          key={row.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <span className={`text-lg font-display italic ${idx < 3 ? 'text-primary' : 'text-white/20'}`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 relative flex-shrink-0 bg-white/5 rounded-lg p-1">
                                {row.team.logo ? <img src={row.team.logo} alt={row.team.name} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white/20">{row.team.shortName}</div>}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black uppercase tracking-tight truncate">{row.team.name}</p>
                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{row.team.university}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center font-bold text-white/80">{row.played}</td>
                          <td className="px-4 py-4 text-center font-bold text-primary">{row.won}</td>
                          <td className="px-4 py-4 text-center font-bold text-white/60">{selectedSport === 'Basketball' ? row.lost : row.drawn}</td>
                          <td className="px-4 py-4 text-center font-bold text-white/40">{selectedSport === 'Basketball' ? ((row.won / (row.played || 1)) * 100).toFixed(0) + '%' : row.lost}</td>
                          <td className="px-4 py-4 text-center font-bold text-white/40">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg font-display italic text-lg border border-primary/20">
                              {row.points}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-24 text-center">
                  <AlertCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/20 font-black uppercase tracking-widest text-xs italic">No standings data available</p>
                </div>
              )}
            </motion.div>
          )}

          {view === 'matches' && (
            <motion.div
              key="matches"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {matches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matches.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map((match) => (
                    <div key={match.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-primary/30 transition-all">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-widest">
                          <Calendar size={12} />
                          <span>{new Date(match.startTime).toLocaleDateString()}</span>
                          <span className="w-1 h-1 bg-white/20 rounded-full" />
                          <Clock size={12} />
                          <span>{new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black ${match.status === 'LIVE' ? 'bg-red-500 animate-pulse' : match.status === 'FINISHED' ? 'bg-white/10 text-white/40' : 'bg-primary/20 text-primary'}`}>
                          {match.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="text-right flex-1">
                            <p className="font-bold text-sm uppercase truncate">{match.homeTeam?.name || 'Home'}</p>
                          </div>
                          <div className="w-10 h-10 bg-white/5 rounded-lg p-1 flex items-center justify-center">
                            {match.homeTeam?.logo ? <img src={match.homeTeam.logo} className="w-full h-full object-contain" /> : <span className="text-xs font-bold">{match.homeTeam?.shortName}</span>}
                          </div>
                        </div>

                        <div className="px-4 text-center">
                          <div className="bg-white/5 px-4 py-1 rounded-lg border border-white/10">
                            <span className="font-display italic text-xl">
                              {match.homeScore} - {match.awayScore}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-white/5 rounded-lg p-1 flex items-center justify-center">
                            {match.awayTeam?.logo ? <img src={match.awayTeam.logo} className="w-full h-full object-contain" /> : <span className="text-xs font-bold">{match.awayTeam?.shortName}</span>}
                          </div>
                          <div className="text-left flex-1">
                            <p className="font-bold text-sm uppercase truncate">{match.awayTeam?.name || 'Away'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-widest">
                        <MapPin size={12} />
                        <span>{match.venue || 'TBD'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-24 text-center bg-white/5 border border-white/10 rounded-[40px]">
                  <Calendar className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/20 font-black uppercase tracking-widest text-xs italic">No matches scheduled</p>
                </div>
              )}
            </motion.div>
          )}

          {view === 'brackets' && (
            <motion.div
              key="brackets"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
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
                <div className="py-24 px-4 text-center bg-white/5 border border-white/10 rounded-[40px]">
                  <AlertCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/20 font-black uppercase tracking-widest text-xs italic">No bracket data available</p>
                  <p className="text-white/10 text-[10px] mt-2 italic">Knockout stages have not started yet.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function CompetitionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    }>
      <CompetitionsContent />
    </Suspense>
  );
}
