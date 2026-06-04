'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Check, AlertCircle, X, Plus, Trash2, Calendar, MapPin, Users, Activity, Trophy, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/admin/Toast';
import SkeletonLoader from '@/components/admin/SkeletonLoader';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

interface Team {
    id: string;
    name: string;
    shortName: string;
    sport: string;
    groupName?: string | null;
}

interface Player {
    id: string;
    name: string;
    jerseyName: string;
    sport: string;
    memberships?: { teamId: string }[];
}

interface Competition {
    id: string;
    name: string;
    sport: string;
    isMultiSport: boolean;
    level?: string;
}

export default function ImportPastMatchesPage() {
    const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    
    const { toasts, removeToast, success, error } = useToast();

    // Match Details State
    const [matchData, setMatchData] = useState({
        sport: 'Football',
        homeTeamId: '',
        awayTeamId: '',
        homeScore: 0,
        awayScore: 0,
        startTime: '',
        venue: '',
        matchType: 'competition',
        competition: '',
        competitionId: '',
        competitionLevel: 'busa-league'
    });

    // Players and Events state for Manual Entry
    const [matchPlayers, setMatchPlayers] = useState<any[]>([]);
    const [matchEvents, setMatchEvents] = useState<any[]>([]);

    const [homePlayers, setHomePlayers] = useState<Player[]>([]);
    const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
    const [homePlayerRows, setHomePlayerRows] = useState<any[]>([]);
    const [awayPlayerRows, setAwayPlayerRows] = useState<any[]>([]);
    
    // File upload state
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [csvMatches, setCsvMatches] = useState<any[]>([]);
    const [importProgress, setImportProgress] = useState('');
    const [importSummary, setImportSummary] = useState<{
        imported: number, skipped: number, failed: number
    } | null>(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const [compsRes, teamsRes, playersRes] = await Promise.all([
                fetch('/api/competitions'),
                fetch('/api/teams'),
                fetch('/api/players')
            ]);

            if (compsRes.ok) {
                const data = await compsRes.json();
                setCompetitions(data.competitions || []);
            }
            if (teamsRes.ok) {
                const data = await teamsRes.json();
                setTeams(Array.isArray(data) ? data : data.teams || []);
            }
            if (playersRes.ok) {
                const data = await playersRes.json();
                setPlayers(Array.isArray(data) ? data : data.players || []);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
            error('Failed to load initial data. Please refresh.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchHomePlayers = async (teamId: string) => {
        if (!teamId) return;
        const res = await fetch(`/api/players?teamId=${teamId}`);
        if (res.ok) {
            const data = await res.json();
            setHomePlayers(Array.isArray(data) ? data : data.players || []);
        }
    };

    const fetchAwayPlayers = async (teamId: string) => {
        if (!teamId) return;
        const res = await fetch(`/api/players?teamId=${teamId}`);
        if (res.ok) {
            const data = await res.json();
            setAwayPlayers(Array.isArray(data) ? data : data.players || []);
        }
    };

    const emptyPlayerRow = (teamId: string) => ({
        playerId: '',
        teamId,
        goals: 0, assists: 0, shotsOn: 0, shotsOff: 0,
        yellowCards: 0, redCards: 0, tackles: 0,
        interceptions: 0, clearances: 0, fouls: 0,
        saves: 0, blocks: 0,
        points: 0, rebounds: 0, steals: 0,
        rating: 7.0, subIn: '', subOut: ''
    });

    const footballStatFields = [
        { key: 'goals', label: 'Goals' },
        { key: 'assists', label: 'Assists' },
        { key: 'shotsOn', label: 'Shots On' },
        { key: 'shotsOff', label: 'Shots Off' },
        { key: 'yellowCards', label: 'Y.Cards' },
        { key: 'redCards', label: 'R.Cards' },
        { key: 'tackles', label: 'Tackles' },
        { key: 'interceptions', label: 'Intercepts' },
        { key: 'clearances', label: 'Clearances' },
        { key: 'fouls', label: 'Fouls' },
        { key: 'saves', label: 'Saves' },
        { key: 'blocks', label: 'Blocks' },
    ];

    const basketballStatFields = [
        { key: 'points', label: 'Points' },
        { key: 'assists', label: 'Assists' },
        { key: 'rebounds', label: 'Rebounds' },
        { key: 'steals', label: 'Steals' },
        { key: 'blocks', label: 'Blocks' },
    ];

    const statFields = matchData.sport === 'Basketball' 
        ? basketballStatFields 
        : footballStatFields;

    const addPlayerRow = (side: 'home' | 'away') => {
        const teamId = side === 'home' 
            ? matchData.homeTeamId 
            : matchData.awayTeamId;
        if (!teamId) {
            error('Select a team first before adding players.');
            return;
        }
        if (side === 'home') {
            setHomePlayerRows(prev => [...prev, emptyPlayerRow(teamId)]);
        } else {
            setAwayPlayerRows(prev => [...prev, emptyPlayerRow(teamId)]);
        }
    };

    const removePlayerRow = (side: 'home' | 'away', index: number) => {
        if (side === 'home') {
            setHomePlayerRows(prev => prev.filter((_, i) => i !== index));
        } else {
            setAwayPlayerRows(prev => prev.filter((_, i) => i !== index));
        }
    };

    const updatePlayerRow = (
        side: 'home' | 'away', 
        index: number, 
        field: string, 
        value: any
    ) => {
        if (side === 'home') {
            setHomePlayerRows(prev => prev.map((row, i) => 
                i === index ? { ...row, [field]: value } : row
            ));
        } else {
            setAwayPlayerRows(prev => prev.map((row, i) => 
                i === index ? { ...row, [field]: value } : row
            ));
        }
    };

    const renderPlayerRows = (side: 'home' | 'away', rows: any[], playerList: Player[]) => (
        <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/60">
                    {side} Players
                </h3>
                <button
                    onClick={() => addPlayerRow(side)}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary hover:text-white transition-colors"
                >
                    <Plus size={14} /> Add Player
                </button>
            </div>

            {rows.length === 0 && (
                <p className="text-white/20 text-xs italic py-4">
                    No players added yet. Click Add Player.
                </p>
            )}

            {rows.map((row, index) => (
                <div key={index} className="bg-white/5 rounded-2xl p-4 mb-3 border border-white/10">
                    <div className="flex items-center gap-3 mb-4">
                        <select
                            value={row.playerId}
                            onChange={(e) => updatePlayerRow(side, index, 'playerId', e.target.value)}
                            className="flex-1 bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-primary"
                        >
                            <option value="">Select Player</option>
                            {playerList.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => removePlayerRow(side, index)}
                            className="text-white/20 hover:text-red-400 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mb-3">
                        {statFields.map(field => (
                            <div key={field.key}>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">
                                    {field.label}
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    value={row[field.key]}
                                    onChange={(e) => updatePlayerRow(side, index, field.key, parseInt(e.target.value) || 0)}
                                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-primary text-center"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">Rating</label>
                            <input
                                type="number" step="0.1" min="0" max="10"
                                value={row.rating}
                                onChange={(e) => updatePlayerRow(side, index, 'rating', parseFloat(e.target.value) || 7.0)}
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-primary text-center"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">Sub On (min)</label>
                            <input
                                type="number" min="0"
                                value={row.subIn}
                                placeholder="—"
                                onChange={(e) => updatePlayerRow(side, index, 'subIn', e.target.value)}
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-primary text-center"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">Sub Off (min)</label>
                            <input
                                type="number" min="0"
                                value={row.subOut}
                                placeholder="—"
                                onChange={(e) => updatePlayerRow(side, index, 'subOut', e.target.value)}
                                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-primary text-center"
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        setFile(uploadedFile);
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const buffer = event.target?.result;
                let data: any[] = [];
                
                if (uploadedFile.name.endsWith('.csv')) {
                    const text = new TextDecoder().decode(buffer as ArrayBuffer);
                    data = parse(text, { columns: true, skip_empty_lines: true });
                } else if (uploadedFile.name.endsWith('.xlsx')) {
                    const workbook = XLSX.read(buffer, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                } else {
                    throw new Error('Unsupported file format. Please use .csv or .xlsx');
                }

                // Group rows by match key
                const matchGroups: Record<string, any[]> = {};
                for (const row of data) {
                    const key = `${row.matchDate}__${row.homeTeamName}__${row.awayTeamName}`;
                    if (!matchGroups[key]) matchGroups[key] = [];
                    matchGroups[key].push(row);
                }

                // Resolve each match group against loaded teams/players
                const resolved = Object.entries(matchGroups).map(([key, rows]) => {
                    const first = rows[0];
                    const homeTeam = teams.find(t => 
                        t.name.toLowerCase().includes(
                            first.homeTeamName?.toLowerCase() || ''
                        )
                    );
                    const awayTeam = teams.find(t => 
                        t.name.toLowerCase().includes(
                            first.awayTeamName?.toLowerCase() || ''
                        )
                    );

                    const resolvedPlayers = rows.map(row => {
                        const teamId = row.playerTeam === 'home' 
                            ? homeTeam?.id 
                            : awayTeam?.id;
                        
                        const matches = players.filter(p =>
                            p.name.toLowerCase().includes(
                                row.playerName?.toLowerCase() || ''
                            )
                        );

                        return {
                            row,
                            teamId,
                            resolvedPlayer: matches.length === 1 ? matches[0] : null,
                            ambiguous: matches.length > 1,
                            candidates: matches,
                            notFound: matches.length === 0
                        };
                    });

                    const hasUnresolved = resolvedPlayers.some(
                        p => p.ambiguous || p.notFound
                    );
                    const teamsFound = !!(homeTeam && awayTeam);

                    return {
                        key,
                        first,
                        homeTeam,
                        awayTeam,
                        resolvedPlayers,
                        status: !teamsFound 
                            ? 'blocked' 
                            : hasUnresolved 
                                ? 'review' 
                                : 'ready'
                    };
                });

                setCsvMatches(resolved);
                setParsedData(data);
                success(`Parsed ${data.length} rows across ${resolved.length} matches.`);
            } catch (err: any) {
                error(`Error parsing file: ${err.message}`);
                setFile(null);
            }
        };

        reader.readAsArrayBuffer(uploadedFile);
    };

    const submitManualEntry = async () => {
        if (!matchData.homeTeamId || !matchData.awayTeamId || !matchData.startTime || !matchData.venue) {
            error('Please fill in all required match details.');
            return;
        }

        setIsSubmitting(true);
        try {
            const allPlayers = [
                ...homePlayerRows.map(r => ({ 
                    ...r, 
                    teamId: matchData.homeTeamId,
                    subIn: r.subIn ? parseInt(r.subIn) : null,
                    subOut: r.subOut ? parseInt(r.subOut) : null
                })),
                ...awayPlayerRows.map(r => ({ 
                    ...r, 
                    teamId: matchData.awayTeamId,
                    subIn: r.subIn ? parseInt(r.subIn) : null,
                    subOut: r.subOut ? parseInt(r.subOut) : null
                }))
            ];

            const payload = {
                match: matchData,
                players: allPlayers,
                events: matchEvents
            };

            const res = await fetch('/api/matches/backfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                success('Match backfilled successfully!');
                // Reset form
                setMatchData({
                    sport: 'Football',
                    homeTeamId: '',
                    awayTeamId: '',
                    homeScore: 0,
                    awayScore: 0,
                    startTime: '',
                    venue: '',
                    matchType: 'competition',
                    competition: '',
                    competitionId: '',
                    competitionLevel: 'busa-league'
                });
                setHomePlayerRows([]);
                setAwayPlayerRows([]);
                setMatchEvents([]);
            } else {
                const data = await res.json();
                error(data.error || 'Failed to backfill match.');
            }
        } catch (err: any) {
            error('Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const runCsvImport = async () => {
        const readyMatches = csvMatches.filter(m => m.status === 'ready');
        if (readyMatches.length === 0) return;

        setIsSubmitting(true);
        const summary = { imported: 0, skipped: 0, failed: 0 };

        for (let i = 0; i < readyMatches.length; i++) {
            const match = readyMatches[i];
            setImportProgress(
                `Importing match ${i + 1} of ${readyMatches.length}...`
            );

            try {
                const first = match.first;
                const payload = {
                    match: {
                        sport: first.sport || 'Football',
                        homeTeamId: match.homeTeam.id,
                        awayTeamId: match.awayTeam.id,
                        homeScore: parseInt(first.homeScore) || 0,
                        awayScore: parseInt(first.awayScore) || 0,
                        startTime: new Date(first.matchDate).toISOString(),
                        venue: first.venue || 'Unknown',
                        competition: first.competition || '',
                        competitionId: first.competitionId || null,
                        matchType: first.matchType || 'competition',
                        competitionLevel: first.competitionLevel || null
                    },
                    players: match.resolvedPlayers
                        .filter((p: any) => p.resolvedPlayer)
                        .map((p: any) => ({
                            playerId: p.resolvedPlayer.id,
                            teamId: p.teamId,
                            goals: parseInt(p.row.goals) || 0,
                            assists: parseInt(p.row.assists) || 0,
                            shotsOn: parseInt(p.row.shotsOn) || 0,
                            shotsOff: parseInt(p.row.shotsOff) || 0,
                            yellowCards: parseInt(p.row.yellowCards) || 0,
                            redCards: parseInt(p.row.redCards) || 0,
                            tackles: parseInt(p.row.tackles) || 0,
                            interceptions: parseInt(p.row.interceptions) || 0,
                            clearances: parseInt(p.row.clearances) || 0,
                            fouls: parseInt(p.row.fouls) || 0,
                            saves: parseInt(p.row.saves) || 0,
                            blocks: parseInt(p.row.blocks) || 0,
                            rating: parseFloat(p.row.rating) || 7.0,
                            subIn: p.row.subIn ? parseInt(p.row.subIn) : null,
                            subOut: p.row.subOut ? parseInt(p.row.subOut) : null
                        }))
                };

                const res = await fetch('/api/matches/backfill', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.status === 409) {
                    summary.skipped++;
                } else if (res.ok) {
                    summary.imported++;
                } else {
                    summary.failed++;
                }
            } catch {
                summary.failed++;
            }
        }

        setImportProgress('');
        setImportSummary(summary);
        setIsSubmitting(false);
        
        if (summary.imported > 0) {
            success(`${summary.imported} matches imported successfully.`);
        }
    };

    const filteredTeams = useMemo(() => {
        return teams.filter(t => t.sport === matchData.sport || t.sport === 'Multi-Sport');
    }, [teams, matchData.sport]);

    return (
        <div className="py-8 px-6">
            <ToastContainer toasts={toasts} onClose={removeToast} />
            
            <div className="flex flex-col mb-8">
                <h1 className="text-4xl font-display italic uppercase tracking-tight leading-none mb-2">Import Past Matches</h1>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Backfill matches logged on physical sheets</p>
            </div>

            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-fit mb-8">
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'manual' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'}`}
                >
                    Manual Entry
                </button>
                <button
                    onClick={() => setActiveTab('csv')}
                    className={`px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'csv' ? 'bg-primary text-black' : 'text-white/40 hover:text-white/60'}`}
                >
                    CSV Upload
                </button>
            </div>

            {isLoading ? (
                <SkeletonLoader type="card" count={3} />
            ) : (
                <div className="space-y-8">
                    {activeTab === 'manual' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/5 rounded-[32px] p-8 border border-white/10"
                        >
                            <h2 className="text-xl font-display italic uppercase mb-6 flex items-center gap-2">
                                <Activity className="text-primary" size={24} /> Match Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Sport</label>
                                    <select
                                        value={matchData.sport}
                                        onChange={(e) => setMatchData({ ...matchData, sport: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white hover:border-white/20"
                                    >
                                        <option value="Football" className="bg-[#0a0a0a]">Football</option>
                                        <option value="Basketball" className="bg-[#0a0a0a]">Basketball</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Competition</label>
                                    <select
                                        value={matchData.competitionId}
                                        onChange={(e) => {
                                            const comp = competitions.find(c => c.id === e.target.value);
                                            if (comp) {
                                                setMatchData({
                                                    ...matchData,
                                                    competitionId: comp.id,
                                                    competition: comp.name,
                                                    competitionLevel: comp.level || 'busa-league',
                                                    sport: comp.isMultiSport ? matchData.sport : comp.sport
                                                });
                                            } else {
                                                setMatchData({ ...matchData, competitionId: '', competition: '' });
                                            }
                                        }}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white hover:border-white/20"
                                    >
                                        <option value="" className="bg-[#0a0a0a]">Select Competition</option>
                                        {competitions.map(c => (
                                            <option key={c.id} value={c.id} className="bg-[#0a0a0a]">{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Home Team</label>
                                    <select
                                        value={matchData.homeTeamId}
                                        onChange={(e) => {
                                            setMatchData({ ...matchData, homeTeamId: e.target.value });
                                            fetchHomePlayers(e.target.value);
                                        }}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white hover:border-white/20"
                                    >
                                        <option value="" className="bg-[#0a0a0a]">Select Home Team</option>
                                        {filteredTeams.map(t => (
                                            <option key={t.id} value={t.id} className="bg-[#0a0a0a]">{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Away Team</label>
                                    <select
                                        value={matchData.awayTeamId}
                                        onChange={(e) => {
                                            setMatchData({ ...matchData, awayTeamId: e.target.value });
                                            fetchAwayPlayers(e.target.value);
                                        }}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white hover:border-white/20"
                                    >
                                        <option value="" className="bg-[#0a0a0a]">Select Away Team</option>
                                        {filteredTeams.map(t => (
                                            <option key={t.id} value={t.id} className="bg-[#0a0a0a]">{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Start Time</label>
                                    <input
                                        type="datetime-local"
                                        value={matchData.startTime}
                                        onChange={(e) => setMatchData({ ...matchData, startTime: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Venue</label>
                                    <input
                                        type="text"
                                        value={matchData.venue}
                                        onChange={(e) => setMatchData({ ...matchData, venue: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white"
                                        placeholder="Enter Venue"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Final Home Score</label>
                                    <input
                                        type="number"
                                        value={matchData.homeScore}
                                        onChange={(e) => setMatchData({ ...matchData, homeScore: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Final Away Score</label>
                                    <input
                                        type="number"
                                        value={matchData.awayScore}
                                        onChange={(e) => setMatchData({ ...matchData, awayScore: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-colors text-white"
                                    />
                                </div>
                            </div>
                            
                            {renderPlayerRows('home', homePlayerRows, homePlayers)}
                            {renderPlayerRows('away', awayPlayerRows, awayPlayers)}
                            
                            <div className="flex justify-end mt-8">
                                <button
                                    onClick={submitManualEntry}
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 bg-primary text-black px-8 py-4 rounded-xl font-black text-sm uppercase italic transition-transform hover:scale-105 disabled:opacity-50"
                                >
                                    <Save size={20} />
                                    {isSubmitting ? 'Saving...' : 'Submit Match Data'}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'csv' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/5 rounded-[32px] p-8 border border-white/10 text-center"
                        >
                            <Upload className="mx-auto text-primary mb-6" size={48} />
                            <h2 className="text-2xl font-display italic uppercase mb-4">Upload CSV / XLSX</h2>
                            <p className="text-sm text-white/60 mb-8 max-w-md mx-auto">
                                Ensure your file matches the required template format for backfilling past matches.
                            </p>
                            
                            <input
                                type="file"
                                accept=".csv,.xlsx"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                            
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all border border-white/20 inline-flex items-center gap-3"
                            >
                                <FileText size={20} />
                                {file ? file.name : 'Select File'}
                            </button>

                            {csvMatches.length > 0 && (
                                <div className="mt-8 space-y-4">
                                
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex gap-4 text-xs font-black uppercase tracking-widest">
                                    <span className="text-green-400">
                                        ● {csvMatches.filter(m => m.status === 'ready').length} Ready
                                    </span>
                                    <span className="text-yellow-400">
                                        ● {csvMatches.filter(m => m.status === 'review').length} Review
                                    </span>
                                    <span className="text-red-400">
                                        ● {csvMatches.filter(m => m.status === 'blocked').length} Blocked
                                    </span>
                                    </div>
                                </div>

                                {csvMatches.map((match, mi) => (
                                    <div key={match.key} className={`rounded-2xl p-5 border ${
                                    match.status === 'ready' 
                                        ? 'bg-green-500/5 border-green-500/20'
                                        : match.status === 'review'
                                        ? 'bg-yellow-500/5 border-yellow-500/20'
                                        : 'bg-red-500/5 border-red-500/20'
                                    }`}>
                                    
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                        <p className="text-sm font-black text-white">
                                            {match.first.homeTeamName} vs {match.first.awayTeamName}
                                        </p>
                                        <p className="text-xs text-white/40">
                                            {match.first.matchDate} · {match.first.venue}
                                        </p>
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                        match.status === 'ready'
                                            ? 'bg-green-500/20 text-green-400'
                                            : match.status === 'review'
                                            ? 'bg-yellow-500/20 text-yellow-400'
                                            : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {match.status === 'ready' ? '✓ Ready' 
                                            : match.status === 'review' ? '⚠ Review' 
                                            : '✕ Blocked'}
                                        </span>
                                    </div>

                                    {match.status === 'blocked' && (
                                        <p className="text-xs text-red-400 mt-2 text-left">
                                        Team not found in DB: 
                                        {!match.homeTeam && ` "${match.first.homeTeamName}"`}
                                        {!match.awayTeam && ` "${match.first.awayTeamName}"`}
                                        </p>
                                    )}

                                    {match.status === 'review' && (
                                        <div className="mt-3 space-y-2">
                                        {match.resolvedPlayers
                                            .filter((p: any) => p.ambiguous || p.notFound)
                                            .map((p: any, pi: number) => (
                                            <div key={pi} 
                                                className="flex items-center gap-3 bg-white/5 rounded-xl p-3 text-left">
                                                <span className="text-xs text-white/60 flex-1">
                                                {p.notFound 
                                                    ? `⚠ "${p.row.playerName}" not found`
                                                    : `⚠ "${p.row.playerName}" — multiple matches`
                                                }
                                                </span>
                                                {p.ambiguous && (
                                                <select
                                                    onChange={(e) => {
                                                    const updated = [...csvMatches];
                                                    const player = updated[mi].resolvedPlayers.filter((rp: any) => rp.ambiguous || rp.notFound)[pi];
                                                    player.resolvedPlayer = players.find(pl => pl.id === e.target.value) || null;
                                                    player.ambiguous = false;
                                                    // recheck status
                                                    const stillUnresolved = updated[mi].resolvedPlayers.some((rp: any) => rp.ambiguous || rp.notFound);
                                                    updated[mi].status = stillUnresolved ? 'review' : 'ready';
                                                    setCsvMatches(updated);
                                                    }}
                                                    className="bg-[#121212] border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-primary"
                                                >
                                                    <option value="">Select player</option>
                                                    {p.candidates.map((c: any) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                    ))}
                                                </select>
                                                )}
                                            </div>
                                            ))}
                                        </div>
                                    )}
                                    </div>
                                ))}

                                {/* Import progress */}
                                {importProgress && (
                                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest text-center py-2">
                                    {importProgress}
                                    </p>
                                )}

                                {/* Import summary */}
                                {importSummary && (
                                    <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                                    <p className="text-green-400 font-black text-sm mb-1">
                                        ✓ {importSummary.imported} matches imported
                                    </p>
                                    {importSummary.skipped > 0 && (
                                        <p className="text-yellow-400 text-xs font-bold">
                                        {importSummary.skipped} skipped (duplicate)
                                        </p>
                                    )}
                                    {importSummary.failed > 0 && (
                                        <p className="text-red-400 text-xs font-bold">
                                        {importSummary.failed} failed
                                        </p>
                                    )}
                                    </div>
                                )}

                                {/* Import button */}
                                {csvMatches.some(m => m.status === 'ready') && !importSummary && (
                                    <div className="flex justify-end mt-4">
                                    <button
                                        onClick={runCsvImport}
                                        disabled={isSubmitting}
                                        className="flex items-center gap-2 bg-primary text-black px-8 py-4 rounded-xl font-black text-sm uppercase italic transition-transform hover:scale-105 disabled:opacity-50"
                                    >
                                        <Upload size={18} />
                                        {isSubmitting 
                                        ? importProgress || 'Importing...' 
                                        : `Import ${csvMatches.filter(m => m.status === 'ready').length} Matches`
                                        }
                                    </button>
                                    </div>
                                )}
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>
            )}
        </div>
    );
}
