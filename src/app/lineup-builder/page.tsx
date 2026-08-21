'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Send, Trash2, AlertCircle, CheckCircle, Users, ArrowLeft } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import download from 'downloadjs';
import { MatchSelector } from '@/components/lineup/MatchSelector';
import { TeamSelector } from '@/components/lineup/TeamSelector';

// Add type declaration for downloadjs
declare module 'downloadjs';

import { FormationSelector } from '@/components/lineup/FormationSelector';
import { PlayerPool } from '@/components/lineup/PlayerPool';
import { InteractivePitch } from '@/components/lineup/InteractivePitch';
import { TeamLineup, LineupPlayer, validateLineup, createEmptyLineup } from '@/types/lineup';
import { useRouter } from 'next/navigation';

interface Match {
    id: string;
    sport: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam?: { name: string; shortName: string; logo: string };
    awayTeam?: { name: string; shortName: string; logo: string };
    startTime: string;
    venue: string;
    competition: string;
    status: string;
}

interface Player {
    id: string;
    name: string;
    jerseyName?: string;
    number: number;
    position: string;
    rating: number;
    teamId: string;
    originalTeam?: 'home' | 'away'; // For combined XI
}

export default function LineupBuilderPage() {
    const router = useRouter();
    const [step, setStep] = useState<'match' | 'team' | 'build'>('match');
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<'home' | 'away' | 'combined' | null>(null);
    const [formation, setFormation] = useState<string>('4-3-3');
    const [lineup, setLineup] = useState<TeamLineup | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedPlayerForAssignment, setSelectedPlayerForAssignment] = useState<Player | null>(null);
    const pitchRef = useRef<HTMLDivElement>(null);

    // Load players when team is selected
    useEffect(() => {
        if (selectedMatch && selectedTeam) {
            loadPlayers();
            loadExistingLineup();
        }
    }, [selectedMatch, selectedTeam]);

    const loadPlayers = async () => {
        if (!selectedMatch || !selectedTeam) return;

        try {
            setLoading(true);

            if (selectedTeam === 'combined') {
                // Load players from both teams
                const [homeResponse, awayResponse] = await Promise.all([
                    fetch(`/api/players?teamId=${selectedMatch.homeTeamId}`),
                    fetch(`/api/players?teamId=${selectedMatch.awayTeamId}`)
                ]);

                const homeData = await homeResponse.json();
                const awayData = await awayResponse.json();

                const homePlayers = (homeData.players || homeData).map((p: Player) => ({ ...p, originalTeam: 'home' }));
                const awayPlayers = (awayData.players || awayData).map((p: Player) => ({ ...p, originalTeam: 'away' }));

                setPlayers([...homePlayers, ...awayPlayers]);
            } else {
                // Load players from single team
                const teamId = selectedTeam === 'home' ? selectedMatch.homeTeamId : selectedMatch.awayTeamId;
                const response = await fetch(`/api/players?teamId=${teamId}`);
                const data = await response.json();
                setPlayers(data.players || data);
            }
        } catch (error) {
            console.error('Error loading players:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadExistingLineup = async () => {
        if (!selectedMatch || !selectedTeam) return;

        try {
            const response = await fetch(`/api/matches/${selectedMatch.id}/lineup`);
            const data = await response.json();

            if (data.success && data.lineups && data.lineups[selectedTeam]) {
                setLineup(data.lineups[selectedTeam]);
                setFormation(data.lineups[selectedTeam].formation);
            } else {
                // Create new empty lineup
                const sport = selectedMatch.sport as 'Football' | 'Basketball';
                setLineup(createEmptyLineup(formation, sport));
            }
        } catch (error) {
            console.error('Error loading lineup:', error);
            const sport = selectedMatch.sport as 'Football' | 'Basketball';
            setLineup(createEmptyLineup(formation, sport));
        }
    };

    const handleMatchSelect = (match: Match) => {
        setSelectedMatch(match);
        setStep('team');
    };

    const handleTeamSelect = (team: 'home' | 'away' | 'combined') => {
        setSelectedTeam(team);
        setStep('build');
    };

    const handleFormationChange = (newFormation: string) => {
        setFormation(newFormation);
        if (lineup) {
            setLineup({
                ...lineup,
                formation: newFormation,
                starters: [] // Reset starters when formation changes
            });
        }
    };

    const handleAssignPlayer = (positionId: string, player: LineupPlayer | null | undefined) => {
        if (!lineup) return;

        if (player === null) {
            // Remove player from position
            setLineup({
                ...lineup,
                starters: lineup.starters.filter(p => p.position !== positionId)
            });
        } else if (selectedPlayerForAssignment) {
            // Assign selected player to position
            const newPlayer: LineupPlayer = {
                playerId: selectedPlayerForAssignment.id,
                position: positionId,
                jerseyNumber: selectedPlayerForAssignment.number,
                isCaptain: false,
                isViceCaptain: false,
                jerseyName: selectedPlayerForAssignment.jerseyName
            };

            setLineup(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    starters: [...prev.starters.filter(p => p.playerId !== selectedPlayerForAssignment.id), newPlayer]
                };
            });

            // Clear selection immediately
            setSelectedPlayerForAssignment(null);
        }
    };

    const handleSetCaptain = (playerId: string) => {
        if (!lineup) return;

        setLineup({
            ...lineup,
            starters: lineup.starters.map(p => ({
                ...p,
                isCaptain: p.playerId === playerId,
                isViceCaptain: p.playerId === playerId ? false : p.isViceCaptain
            }))
        });
    };

    const handleSetViceCaptain = (playerId: string) => {
        if (!lineup) return;

        setLineup({
            ...lineup,
            starters: lineup.starters.map(p => ({
                ...p,
                isViceCaptain: p.playerId === playerId,
                isCaptain: p.playerId === playerId ? false : p.isCaptain
            }))
        });
    };

    const handleSaveDraft = async () => {
        if (!selectedMatch || !selectedTeam || !lineup) return;

        try {
            setSaving(true);
            const response = await fetch(`/api/matches/${selectedMatch.id}/lineup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    team: selectedTeam,
                    lineup: { ...lineup, status: 'draft' }
                })
            });

            const data = await response.json();
            if (!response.ok) {
                alert(response.status === 401 || response.status === 403
                    ? 'You need to be signed in as an admin or logger to save a lineup.'
                    : (data.error || 'Failed to save lineup'));
                return;
            }
            if (data.success) {
                alert('Lineup saved as draft!');
            }
        } catch (error) {
            console.error('Error saving lineup:', error);
            alert('Failed to save lineup');
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!selectedMatch || !selectedTeam || !lineup) return;
        if (selectedTeam === 'combined') {
            alert('Combined XI lineups are for reference only and cannot be published — publish the home and away lineups individually.');
            return;
        }

        if (!confirm('Publish this lineup? It will be locked and visible to the public until an admin unlocks it.')) return;

        try {
            setSaving(true);
            const response = await fetch(`/api/matches/${selectedMatch.id}/lineup/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team: selectedTeam })
            });

            const data = await response.json();
            if (!response.ok) {
                if (response.status === 409) {
                    alert(data.message || 'This lineup has already been published and locked.');
                } else if (response.status === 401 || response.status === 403) {
                    alert('You need to be signed in as an admin or logger to publish a lineup.');
                } else {
                    alert(data.error || 'Failed to publish lineup');
                }
                return;
            }
            if (data.success) {
                setLineup(data.lineups[selectedTeam]);
                alert('Lineup published!');
            }
        } catch (error) {
            console.error('Error publishing lineup:', error);
            alert('Failed to publish lineup');
        } finally {
            setSaving(false);
        }
    };

    const handleDownload = async () => {
        if (!pitchRef.current) return;

        try {
            setSaving(true);
            const dataUrl = await htmlToImage.toPng(pitchRef.current, {
                cacheBust: true,
                backgroundColor: '#050505',
                pixelRatio: 4,
                quality: 1.0
            });
            download(dataUrl, `lineup-${selectedTeam}-${selectedMatch?.id}.png`);
        } catch (error) {
            console.error('Error downloading image:', error);
            alert('Failed to download image');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedMatch || !selectedTeam) return;

        if (!confirm('Are you sure you want to delete this lineup?')) return;

        try {
            const response = await fetch(`/api/matches/${selectedMatch.id}/lineup?team=${selectedTeam}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (!response.ok) {
                alert(response.status === 401 || response.status === 403
                    ? 'You need to be signed in as an admin or logger to delete a lineup.'
                    : (data.error || 'Failed to delete lineup'));
                return;
            }
            if (data.success) {
                const sport = selectedMatch.sport as 'Football' | 'Basketball';
                setLineup(createEmptyLineup(formation, sport));
                alert('Lineup deleted');
            }
        } catch (error) {
            console.error('Error deleting lineup:', error);
            alert('Failed to delete lineup');
        }
    };

    // Get player details for display
    const playerDetails = players.reduce((acc, player) => {
        acc[player.id] = { name: player.name, jerseyName: player.jerseyName, rating: player.rating, originalTeam: player.originalTeam };
        return acc;
    }, {} as Record<string, { name: string; jerseyName?: string; rating: number; originalTeam?: 'home' | 'away' }>);

    const selectedPlayerIds = lineup ? lineup.starters.map(p => p.playerId) : [];

    // Build step
    const sport = selectedMatch?.sport as 'Football' | 'Basketball';
    const validation = lineup ? validateLineup(lineup, sport) : null;

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            <div className="max-w-[1800px] mx-auto space-y-6">
                {/* Step 1: Match Selection */}
                {step === 'match' && (
                    <>
                        <div>
                            <h1 className="font-display text-4xl tracking-tighter italic uppercase leading-none mb-2">
                                Lineup Builder
                            </h1>
                            <p className="text-sm text-white/60">
                                Select a match to build lineups for
                            </p>
                        </div>
                        <MatchSelector
                            onSelectMatch={handleMatchSelect}
                            selectedMatchId={selectedMatch?.id}
                        />
                    </>
                )}

                {/* Step 2: Team Selection */}
                {step === 'team' && selectedMatch && (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <button
                                    onClick={() => setStep('match')}
                                    className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-2"
                                >
                                    <ArrowLeft size={16} />
                                    <span className="text-sm font-bold">Back to Matches</span>
                                </button>
                                <h1 className="font-display text-3xl tracking-tighter italic uppercase leading-none">
                                    {selectedMatch.homeTeam?.shortName} vs {selectedMatch.awayTeam?.shortName}
                                </h1>
                                <p className="text-sm text-white/60 mt-1">
                                    {selectedMatch.competition} • {new Date(selectedMatch.startTime).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <TeamSelector
                            match={selectedMatch}
                            onSelectTeam={handleTeamSelect}
                        />
                    </>
                )}

                {/* Step 3: Build Lineup */}
                {step === 'build' && selectedMatch && selectedTeam && (
                    <>
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                {/* ... back button & titles ... */}
                                <button
                                    onClick={() => setStep('team')}
                                    className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-2"
                                >
                                    <ArrowLeft size={16} />
                                    <span className="text-sm font-bold">Back</span>
                                </button>
                                <h1 className="font-display text-3xl tracking-tighter italic uppercase leading-none">
                                    {selectedMatch?.homeTeam?.shortName} vs {selectedMatch?.awayTeam?.shortName}
                                </h1>
                                <p className="text-sm text-white/60 mt-1">
                                    {selectedTeam === 'combined'
                                        ? 'Combined XI Lineup'
                                        : selectedTeam === 'home'
                                            ? selectedMatch?.homeTeam?.name
                                            : selectedMatch?.awayTeam?.name} {selectedTeam !== 'combined' && 'Lineup'}
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleDelete}
                                    className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-500/30 transition-colors"
                                >
                                    <Trash2 size={14} className="inline mr-2" />
                                    Delete
                                </button>
                                <button
                                    onClick={handleSaveDraft}
                                    disabled={saving}
                                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-colors disabled:opacity-50"
                                >
                                    <Save size={14} className="inline mr-2" />
                                    Save Draft
                                </button>
                                {selectedTeam !== 'combined' && (
                                    <button
                                        onClick={handlePublish}
                                        disabled={saving || !validation?.isValid}
                                        title={!validation?.isValid ? 'Fix lineup issues above before publishing' : undefined}
                                        className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-green-500/30 transition-colors disabled:opacity-50"
                                    >
                                        <CheckCircle size={14} className="inline mr-2" />
                                        Publish
                                    </button>
                                )}
                                <button
                                    onClick={handleDownload}
                                    disabled={saving}
                                    className="px-4 py-2 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                    <Send size={14} className="inline mr-2" />
                                    Download
                                </button>
                            </div>
                        </div>

                        {/* Validation Status */}
                        {/* ... (keep validation status, purely informational now) */}
                        {validation && (
                            <div className={`p-4 rounded-xl border ${validation.isValid
                                ? 'bg-green-500/10 border-green-500/30'
                                : 'bg-orange-500/10 border-orange-500/30'
                                }`}>
                                <div className="flex items-start gap-3">
                                    {validation.isValid ? (
                                        <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertCircle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1">
                                        <p className="text-sm font-bold mb-1">
                                            {validation.isValid ? 'Lineup is valid' : 'Lineup has issues'}
                                        </p>
                                        {validation.errors.length > 0 && (
                                            <ul className="text-xs text-white/80 space-y-1">
                                                {validation.errors.map((error, idx) => (
                                                    <li key={idx}>• {error}</li>
                                                ))}
                                            </ul>
                                        )}
                                        {validation.warnings.length > 0 && (
                                            <ul className="text-xs text-white/60 space-y-1 mt-2">
                                                {validation.warnings.map((warning, idx) => (
                                                    <li key={idx}>⚠ {warning}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Formation Selector */}
                        <FormationSelector
                            sport={sport}
                            selectedFormation={formation}
                            onSelectFormation={handleFormationChange}
                        />

                        {/* Main Content */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-40 lg:pb-0">
                            {/* Player Pool */}
                            <div className="lg:col-span-1">
                                <PlayerPool
                                    players={players}
                                    selectedPlayerIds={selectedPlayerIds}
                                    onSelectPlayer={(player) => {
                                        setSelectedPlayerForAssignment(player);
                                        // On mobile, scroll to pitch
                                        if (window.innerWidth < 1024 && pitchRef.current) {
                                            pitchRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                    }}
                                    teamSide={selectedTeam!}
                                />

                                {selectedPlayerForAssignment && (
                                    <div className="hidden lg:block mt-4 p-4 bg-primary/10 border border-primary/30 rounded-xl">
                                        <p className="text-xs font-black uppercase tracking-wider text-primary mb-2">
                                            Selected Player
                                        </p>
                                        <p className="text-sm font-bold text-white">
                                            {selectedPlayerForAssignment.name}
                                        </p>
                                        <p className="text-xs text-white/60">
                                            Click a position on the pitch to assign
                                        </p>
                                        <button
                                            onClick={() => setSelectedPlayerForAssignment(null)}
                                            className="mt-2 text-xs text-white/60 hover:text-white"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Interactive Pitch */}
                            <div className="lg:col-span-2" ref={pitchRef}>
                                {lineup && (
                                    <InteractivePitch
                                        sport={sport}
                                        formation={formation}
                                        starters={lineup.starters}
                                        onAssignPlayer={handleAssignPlayer}
                                        onSetCaptain={handleSetCaptain}
                                        onSetViceCaptain={handleSetViceCaptain}
                                        teamSide={selectedTeam!}
                                        playerDetails={playerDetails}
                                        selectedPlayer={selectedPlayerForAssignment}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Mobile Sticky Selected Player Banner */}
                        <AnimatePresence>
                            {selectedPlayerForAssignment && (
                                <motion.div
                                    initial={{ y: 100, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 100, opacity: 0 }}
                                    className="fixed bottom-0 left-0 right-0 z-[60] bg-[#111] border-t border-white/10 p-4 lg:hidden pb-8 shadow-2xl"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center font-display font-bold text-primary border border-primary/20">
                                                {selectedPlayerForAssignment.number}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-primary">Assigning Player</p>
                                                <p className="text-sm font-bold text-white max-w-[150px] truncate">{selectedPlayerForAssignment.name}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedPlayerForAssignment(null)}
                                            className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                                        >
                                            <Trash2 size={16} className="text-white/60" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-center text-white/40 bg-white/5 py-1.5 rounded-lg border border-white/5">
                                        Tap a position on the pitch to assign
                                    </p>
                                    {/* Safe area spacer */}
                                    <div className="h-4" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
            </div>
        </div>
    );
}
