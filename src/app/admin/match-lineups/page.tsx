'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Shield, Calendar, Users, CheckCircle, AlertCircle, Save, Lock as LockIcon } from 'lucide-react';

interface Match {
    id: string;
    sport: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam: { name: string; shortName: string; logo: string };
    awayTeam: { name: string; shortName: string; logo: string };
    startTime: string;
    venue: string;
    competition: string;
    competitionLevel?: string;
    status: string;
    loggerId?: string;
}

const FORMATIONS_11 = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2'];
const FORMATIONS_5 = ['1-2-2', '2-1-2', '1-3-1', '2-2-1', '1-1-3'];

interface Player {
    id: string;
    name: string;
    jerseyName?: string;
    number: number;
    position: string;
    teamId: string;
    college?: string;
    department?: string;
    university?: string;
}

export default function AdminMatchLineupsPage() {
    const { user, loading, isAuthenticated } = useAuth();
    const router = useRouter();
    const [matches, setMatches] = useState<Match[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [homeRoster, setHomeRoster] = useState<Player[]>([]);
    const [awayRoster, setAwayRoster] = useState<Player[]>([]);
    const [homeStarters, setHomeStarters] = useState<string[]>([]);
    const [awayStarters, setAwayStarters] = useState<string[]>([]);
    const [homeFormation, setHomeFormation] = useState('4-3-3');
    const [awayFormation, setAwayFormation] = useState('4-3-3');
    const [homeCaptain, setHomeCaptain] = useState('');
    const [awayCaptain, setAwayCaptain] = useState('');
    const [homePositionOverrides, setHomePositionOverrides] = useState<Record<string, string>>({});
    const [awayPositionOverrides, setAwayPositionOverrides] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [homeLineupStatus, setHomeLineupStatus] = useState<any>(null);
    const [awayLineupStatus, setAwayLineupStatus] = useState<any>(null);
    const [unlocking, setUnlocking] = useState(false);
    const [playersPerSide, setPlayersPerSide] = useState(11);

    // Check authentication and role
    useEffect(() => {
        if (!loading) {
            if (!isAuthenticated) {
                // Redirect to login if not authenticated
                router.push('/login');
            } else if (user?.role !== 'admin' && user?.role !== 'logger') {
                // Show error if authenticated but not authorized
                router.push('/admin');
            }
        }
    }, [loading, isAuthenticated, user, router]);

    // Load matches assigned to logger or all matches for admin
    useEffect(() => {
        if (user) {
            loadMatches();
        }
    }, [user]);

    const loadMatches = async () => {
        try {
            const response = await fetch('/api/admin/assigned-matches');
            const data = await response.json();
            if (data.success) {
                setMatches(data.matches);
            }
        } catch (error) {
            console.error('Error loading matches:', error);
        }
    };

    const loadRosters = async (match: Match) => {
        setLoadingData(true);
        try {
            console.log('Loading rosters for match:', match.id);
            console.log('Home Team ID:', match.homeTeamId);
            console.log('Away Team ID:', match.awayTeamId);
            console.log('Competition Level:', match.competitionLevel);

            let homeUrl = `/api/players?teamId=${match.homeTeamId}`;
            let awayUrl = `/api/players?teamId=${match.awayTeamId}`;

            // For interdepartmental/intercollege competitions, players are grouped by
            // department or college, not by teamId — use those filters instead.
            // NOTE: Do NOT use university filter with team.name — the university field
            //       stores the institution name (e.g. "Bells University"), not the team name.
            if (match.competitionLevel === 'department') {
                homeUrl = `/api/players?department=${encodeURIComponent(match.homeTeam.name)}`;
                awayUrl = `/api/players?department=${encodeURIComponent(match.awayTeam.name)}`;
            } else if (match.competitionLevel === 'college') {
                homeUrl = `/api/players?college=${encodeURIComponent(match.homeTeam.name)}`;
                awayUrl = `/api/players?college=${encodeURIComponent(match.awayTeam.name)}`;
            }
            // For 'busa-league', 'inter-university', 'external', or any other level:
            // use teamId (already set as default above) — always correct for real teams.

            const [homeResponse, awayResponse] = await Promise.all([
                fetch(homeUrl),
                fetch(awayUrl)
            ]);

            console.log('Home response status:', homeResponse.status);
            console.log('Away response status:', awayResponse.status);

            const homeData = await homeResponse.json();
            const awayData = await awayResponse.json();

            console.log('Home data:', homeData);
            console.log('Away data:', awayData);

            // Handle different response formats
            const homePlayers = Array.isArray(homeData)
                ? homeData
                : (homeData.players || homeData.data || []);

            const awayPlayers = Array.isArray(awayData)
                ? awayData
                : (awayData.players || awayData.data || []);

            console.log('Processed home players:', homePlayers);
            console.log('Processed away players:', awayPlayers);

            setHomeRoster(homePlayers);
            setAwayRoster(awayPlayers);

            // Alert if no players found
            if (homePlayers.length === 0) {
                alert(`No players found for ${match.homeTeam.name}. Please add players to this team first.`);
            }
            if (awayPlayers.length === 0) {
                alert(`No players found for ${match.awayTeam.name}. Please add players to this team first.`);
            }

            // Load existing lineups if any
            const lineupResponse = await fetch(`/api/matches/${match.id}/lineup`);
            const lineupData = await lineupResponse.json();

            if (lineupData.success && lineupData.lineups) {
                if (lineupData.lineups.home) {
                    setHomeStarters(lineupData.lineups.home.starters.map((s: any) => s.playerId));
                    setHomeFormation(lineupData.lineups.home.formation);
                    const captain = lineupData.lineups.home.starters.find((s: any) => s.isCaptain);
                    if (captain) setHomeCaptain(captain.playerId);
                    setHomeLineupStatus(lineupData.lineups.home);

                    // Restore overrides
                    const overrides: Record<string, string> = {};
                    lineupData.lineups.home.starters.forEach((s: any) => {
                        const player = homePlayers.find((p: any) => p.id === s.playerId);
                        if (player && s.position && s.position !== player.position) {
                            overrides[s.playerId] = s.position;
                        }
                    });
                    setHomePositionOverrides(overrides);
                }

                if (lineupData.lineups.away) {
                    setAwayStarters(lineupData.lineups.away.starters.map((s: any) => s.playerId));
                    setAwayFormation(lineupData.lineups.away.formation);
                    const captain = lineupData.lineups.away.starters.find((s: any) => s.isCaptain);
                    if (captain) setAwayCaptain(captain.playerId);
                    setAwayLineupStatus(lineupData.lineups.away);

                    // Restore overrides
                    const overrides: Record<string, string> = {};
                    lineupData.lineups.away.starters.forEach((s: any) => {
                        const player = awayPlayers.find((p: any) => p.id === s.playerId);
                        if (player && s.position && s.position !== player.position) {
                            overrides[s.playerId] = s.position;
                        }
                    });
                    setAwayPositionOverrides(overrides);
                }
            }
        } catch (error) {
            console.error('Error loading rosters:', error);
            alert('Failed to load player rosters. Please check the console for details.');
        } finally {
            setLoadingData(false);
        }
    };

    const handleMatchSelect = async (match: Match) => {
        setSelectedMatch(match);
        // Fetch competition to determine playersPerSide
        try {
            const compRes = await fetch(`/api/competitions`);
            const compData = await compRes.json();
            const competitions = Array.isArray(compData) ? compData : (compData.competitions || []);
            const matchComp = competitions.find((c: any) => c.name === match.competition);
            if (matchComp && matchComp.playersPerSide) {
                setPlayersPerSide(matchComp.playersPerSide);
                // Set appropriate default formation
                if (matchComp.playersPerSide === 5) {
                    setHomeFormation('1-2-2');
                    setAwayFormation('1-2-2');
                } else {
                    setHomeFormation('4-3-3');
                    setAwayFormation('4-3-3');
                }
            } else {
                setPlayersPerSide(11);
            }
        } catch (e) {
            console.error('Could not fetch competition details:', e);
            setPlayersPerSide(11);
        }
        loadRosters(match);
    };

    const toggleStarter = (playerId: string, team: 'home' | 'away') => {
        if (team === 'home') {
            setHomeStarters(prev =>
                prev.includes(playerId)
                    ? prev.filter(id => id !== playerId)
                    : prev.length < playersPerSide
                        ? [...prev, playerId]
                        : prev
            );
        } else {
            setAwayStarters(prev =>
                prev.includes(playerId)
                    ? prev.filter(id => id !== playerId)
                    : prev.length < playersPerSide
                        ? [...prev, playerId]
                        : prev
            );
        }
    };

    const publishLineups = async () => {
        if (!selectedMatch) return;

        if (homeStarters.length !== playersPerSide || awayStarters.length !== playersPerSide) {
            alert(`Both teams must have exactly ${playersPerSide} starters`);
            return;
        }

        if (!homeCaptain || !awayCaptain) {
            alert('Please select captains for both teams');
            return;
        }

        setSaving(true);
        try {
            // Prepare home lineup
            const homeLineup = {
                formation: homeFormation,
                starters: homeStarters.map(playerId => {
                    const player = homeRoster.find(p => p.id === playerId)!;
                    return {
                        playerId,
                        position: homePositionOverrides[playerId] || player.position, // Use override if set
                        jerseyNumber: player.number,
                        jerseyName: player.jerseyName,
                        isCaptain: playerId === homeCaptain,
                        isViceCaptain: false
                    };
                }),
                substitutes: homeRoster
                    .filter(p => !homeStarters.includes(p.id))
                    .map(player => ({
                        playerId: player.id,
                        jerseyNumber: player.number,
                        jerseyName: player.jerseyName
                    })),
                status: 'published'
            };

            // Prepare away lineup
            const awayLineup = {
                formation: awayFormation,
                starters: awayStarters.map(playerId => {
                    const player = awayRoster.find(p => p.id === playerId)!;
                    return {
                        playerId,
                        position: awayPositionOverrides[playerId] || player.position, // Use override if set
                        jerseyNumber: player.number,
                        jerseyName: player.jerseyName,
                        isCaptain: playerId === awayCaptain,
                        isViceCaptain: false
                    };
                }),
                substitutes: awayRoster
                    .filter(p => !awayStarters.includes(p.id))
                    .map(player => ({
                        playerId: player.id,
                        jerseyNumber: player.number,
                        jerseyName: player.jerseyName
                    })),
                status: 'published'
            };

            // Save both lineups
            const [homeRes, awayRes] = await Promise.all([
                fetch(`/api/admin/match-lineups/${selectedMatch.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ team: 'home', lineup: homeLineup })
                }),
                fetch(`/api/admin/match-lineups/${selectedMatch.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ team: 'away', lineup: awayLineup })
                })
            ]);

            if (!homeRes.ok) {
                const data = await homeRes.json();
                throw new Error(`Home Lineup: ${data.error || 'Failed to publish'}`);
            }
            if (!awayRes.ok) {
                const data = await awayRes.json();
                throw new Error(`Away Lineup: ${data.error || 'Failed to publish'}`);
            }

            alert('Lineups published successfully!');
            // Reload to update status headers
            loadRosters(selectedMatch);
        } catch (error: any) {
            console.error('Error publishing lineups:', error);
            alert(error.message || 'Failed to publish lineups');
        } finally {
            setSaving(false);
        }
    };

    const unlockLineup = async (team: 'home' | 'away') => {
        if (!selectedMatch) return;

        setUnlocking(true);
        try {
            const response = await fetch(`/api/matches/${selectedMatch.id}/lineup/unlock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team })
            });

            if (response.ok) {
                alert(`${team === 'home' ? 'Home' : 'Away'} lineup unlocked successfully! You can now edit and republish.`);
                // Reload lineups to get updated status
                loadRosters(selectedMatch);
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to unlock lineup');
            }
        } catch (error) {
            console.error('Error unlocking lineup:', error);
            alert('Failed to unlock lineup');
        } finally {
            setUnlocking(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'logger')) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md text-center">
                    <Shield className="mx-auto mb-4 text-red-500" size={48} />
                    <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
                    <p className="text-white/60 mb-4">
                        This page is only accessible to admins and loggers.
                    </p>
                    <Link
                        href="/admin"
                        className="inline-block bg-primary text-black px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors"
                    >
                        Back to Admin
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Shield className="text-primary" size={32} />
                        <h1 className="font-display text-4xl tracking-tighter italic uppercase">
                            Official Match Lineups
                        </h1>
                    </div>
                    <p className="text-white/60">
                        Publish official team lineups for your assigned matches
                    </p>
                </div>

                {!selectedMatch ? (
                    /* Match Selection */
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold mb-4">Select a Match</h2>
                        {matches.length === 0 ? (
                            <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
                                <Calendar className="mx-auto mb-4 text-white/40" size={48} />
                                <p className="text-white/60">No matches assigned to you</p>
                            </div>
                        ) : (
                            matches.map(match => (
                                <button
                                    key={match.id}
                                    onClick={() => handleMatchSelect(match)}
                                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-6 transition-colors text-left"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-4 mb-2">
                                                <span className="font-bold">{match.homeTeam.name}</span>
                                                <span className="text-white/40">vs</span>
                                                <span className="font-bold">{match.awayTeam.name}</span>
                                            </div>
                                            <div className="text-sm text-white/60">
                                                {match.competition} • {new Date(match.startTime).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${match.status === 'UPCOMING' ? 'bg-blue-500/20 text-blue-400' :
                                            match.status === 'LIVE' ? 'bg-green-500/20 text-green-400' :
                                                'bg-white/10 text-white/60'
                                            }`}>
                                            {match.status}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                ) : (
                    /* Lineup Builder */
                    <div className="space-y-6">
                        {/* Match Info */}
                        <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold mb-1">
                                        {selectedMatch.homeTeam.shortName} vs {selectedMatch.awayTeam.shortName}
                                    </h2>
                                    <p className="text-white/60 text-sm">
                                        {selectedMatch.competition} • {new Date(selectedMatch.startTime).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    {selectedMatch.status !== 'UPCOMING' && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs font-bold">
                                            <LockIcon size={14} /> Match Started
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setSelectedMatch(null)}
                                        className="text-white/60 hover:text-white"
                                    >
                                        ← Back to matches
                                    </button>
                                </div>
                            </div>

                            {/* Validation Status */}
                            <div className="flex items-center gap-4 text-sm">
                                <div className={`flex items-center gap-2 ${homeStarters.length === playersPerSide ? 'text-green-400' : 'text-orange-400'}`}>
                                    {homeStarters.length === playersPerSide ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                    Home: {homeStarters.length}/{playersPerSide} starters {playersPerSide === 5 && <span className="text-xs opacity-60">(5-aside)</span>}
                                </div>
                                <div className={`flex items-center gap-2 ${awayStarters.length === playersPerSide ? 'text-green-400' : 'text-orange-400'}`}>
                                    {awayStarters.length === playersPerSide ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                    Away: {awayStarters.length}/{playersPerSide} starters {playersPerSide === 5 && <span className="text-xs opacity-60">(5-aside)</span>}
                                </div>
                            </div>

                            {selectedMatch.status !== 'UPCOMING' && (
                                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                                    <LockIcon size={14} />
                                    <span>Lineups are locked because the match has already started. Contact a system administrator if corrections are required.</span>
                                </div>
                            )}
                        </div>

                        {/* Lineup Status Banners */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Home Lineup Status */}
                            {homeLineupStatus?.status === 'published' && !homeLineupStatus?.unlocked && (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-green-400 font-bold text-sm mb-1">✓ Home Lineup Published</p>
                                            <p className="text-xs text-white/60">
                                                By {homeLineupStatus.publishedByName} on {new Date(homeLineupStatus.publishedAt).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-white/40 mt-1">
                                                {user?.role === 'admin'
                                                    ? 'Published. You can update it below.'
                                                    : homeLineupStatus.publishedByRole === 'admin'
                                                        ? 'Locked by Admin. Cannot be edited.'
                                                        : 'Published. You can correct it below.'}
                                            </p>
                                        </div>
                                        {user?.role === 'admin' && (
                                            <button
                                                onClick={() => unlockLineup('home')}
                                                disabled={unlocking}
                                                className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                            >
                                                {unlocking ? 'Unlocking...' : '🔓 Unlock'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {homeLineupStatus?.unlocked && (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                                    <p className="text-yellow-400 font-bold text-sm mb-1">⚠️ Home Lineup Unlocked</p>
                                    <p className="text-xs text-white/60">
                                        Unlocked by {homeLineupStatus.unlockedByName} on {new Date(homeLineupStatus.unlockedAt).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-white/40 mt-1">You can now edit and republish this lineup.</p>
                                </div>
                            )}

                            {/* Away Lineup Status */}
                            {awayLineupStatus?.status === 'published' && !awayLineupStatus?.unlocked && (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-green-400 font-bold text-sm mb-1">✓ Away Lineup Published</p>
                                            <p className="text-xs text-white/60">
                                                By {awayLineupStatus.publishedByName} on {new Date(awayLineupStatus.publishedAt).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-white/40 mt-1">
                                                {user?.role === 'admin'
                                                    ? 'Published. You can update it below.'
                                                    : awayLineupStatus.publishedByRole === 'admin'
                                                        ? 'Locked by Admin. Cannot be edited.'
                                                        : 'Published. You can correct it below.'}
                                            </p>
                                        </div>
                                        {user?.role === 'admin' && (
                                            <button
                                                onClick={() => unlockLineup('away')}
                                                disabled={unlocking}
                                                className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                            >
                                                {unlocking ? 'Unlocking...' : '🔓 Unlock'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {awayLineupStatus?.unlocked && (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                                    <p className="text-yellow-400 font-bold text-sm mb-1">⚠️ Away Lineup Unlocked</p>
                                    <p className="text-xs text-white/60">
                                        Unlocked by {awayLineupStatus.unlockedByName} on {new Date(awayLineupStatus.unlockedAt).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-white/40 mt-1">You can now edit and republish this lineup.</p>
                                </div>
                            )}
                        </div>

                        {loadingData ? (
                            <div className="py-20 text-center">
                                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-white/40">Loading rosters...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Home Team */}
                                <TeamLineupBuilder
                                    team={selectedMatch.homeTeam}
                                    roster={homeRoster}
                                    starters={homeStarters}
                                    formation={homeFormation}
                                    captain={homeCaptain}
                                    positionOverrides={homePositionOverrides}
                                    onToggleStarter={(id) => toggleStarter(id, 'home')}
                                    onFormationChange={setHomeFormation}
                                    onCaptainChange={setHomeCaptain}
                                    onPositionOverride={(playerId, position) => {
                                        setHomePositionOverrides(prev => ({ ...prev, [playerId]: position }));
                                    }}
                                    isDisabled={(user?.role !== 'admin' && selectedMatch.status !== 'UPCOMING') || (user?.role !== 'admin' && homeLineupStatus?.publishedByRole === 'admin' && !homeLineupStatus?.unlocked)}
                                    maxStarters={playersPerSide}
                                />

                                {/* Away Team */}
                                <TeamLineupBuilder
                                    team={selectedMatch.awayTeam}
                                    roster={awayRoster}
                                    starters={awayStarters}
                                    formation={awayFormation}
                                    captain={awayCaptain}
                                    positionOverrides={awayPositionOverrides}
                                    onToggleStarter={(id) => toggleStarter(id, 'away')}
                                    onFormationChange={setAwayFormation}
                                    onCaptainChange={setAwayCaptain}
                                    onPositionOverride={(playerId, position) => {
                                        setAwayPositionOverrides(prev => ({ ...prev, [playerId]: position }));
                                    }}
                                    isDisabled={(user?.role !== 'admin' && selectedMatch.status !== 'UPCOMING') || (user?.role !== 'admin' && awayLineupStatus?.publishedByRole === 'admin' && !awayLineupStatus?.unlocked)}
                                    maxStarters={playersPerSide}
                                />
                            </div>
                        )}

                        {/* Publish Button */}
                        <div className="flex justify-center">
                            <button
                                onClick={publishLineups}
                                disabled={saving || homeStarters.length !== playersPerSide || awayStarters.length !== playersPerSide || !homeCaptain || !awayCaptain || (user?.role !== 'admin' && selectedMatch.status !== 'UPCOMING') || (user?.role !== 'admin' && ((homeLineupStatus?.publishedByRole === 'admin' && !homeLineupStatus?.unlocked) || (awayLineupStatus?.publishedByRole === 'admin' && !awayLineupStatus?.unlocked)))}
                                className="px-8 py-4 bg-primary hover:bg-primary/90 disabled:bg-white/10 disabled:cursor-not-allowed text-black disabled:text-white/40 rounded-xl font-bold text-lg flex items-center gap-3 transition-colors"
                            >
                                <Save size={20} />
                                {saving ? 'Publishing...' : (homeLineupStatus?.status === 'published' || awayLineupStatus?.status === 'published') ? 'Update Lineups' : 'Publish Official Lineups'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function TeamLineupBuilder({
    team,
    roster,
    starters,
    formation,
    captain,
    positionOverrides = {},
    onToggleStarter,
    onFormationChange,
    onCaptainChange,
    onPositionOverride,
    isDisabled = false,
    maxStarters = 11
}: {
    team: any;
    roster: Player[];
    starters: string[];
    formation: string;
    captain: string;
    positionOverrides?: Record<string, string>;
    onToggleStarter: (id: string) => void;
    onFormationChange: (formation: string) => void;
    onCaptainChange: (id: string) => void;
    onPositionOverride?: (playerId: string, position: string) => void;
    isDisabled?: boolean;
    maxStarters?: number;
}) {
    const formations = maxStarters === 5 ? FORMATIONS_5 : FORMATIONS_11;
    const positions = maxStarters === 5
        ? ['GK', 'DEF', 'MID', 'FW', 'PIV']
        : ['GK', 'DEF', 'LB', 'RB', 'CB', 'DM', 'MID', 'CM', 'LM', 'RM', 'AM', 'CAM', 'FW', 'ST', 'CF', 'LW', 'RW'];

    return (
        <div className={`bg-white/5 rounded-xl border border-white/10 p-6 ${isDisabled ? 'opacity-70' : ''}`}>
            <h3 className="text-xl font-bold mb-4">{team.name}</h3>

            {/* Formation Selector */}
            <div className="mb-4">
                <label className="text-sm text-white/60 mb-2 block">Formation</label>
                <select
                    value={formation}
                    onChange={(e) => onFormationChange(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                >
                    {formations.map(f => (
                        <option key={f} value={f}>{f}</option>
                    ))}
                </select>
            </div>

            {/* Player List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {roster.map(player => {
                    const isStarter = starters.includes(player.id);
                    const isCaptain = captain === player.id;
                    const currentPosition = positionOverrides[player.id] || player.position;
                    const hasOverride = !!positionOverrides[player.id];

                    return (
                        <div
                            key={player.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isStarter
                                ? 'bg-primary/20 border-primary/40'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                }`}
                        >
                            <div className="flex items-center gap-3 flex-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${isStarter ? 'bg-primary text-black' : 'bg-white/10'
                                    }`}>
                                    {player.number}
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold">{player.name}</div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-xs text-white/60">
                                            {player.position}
                                            {hasOverride && (
                                                <span className="ml-1 text-primary">→ {currentPosition}</span>
                                            )}
                                        </div>
                                        {(player.department || player.college) && (
                                            <div className="flex gap-1">
                                                {player.department && (
                                                    <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] uppercase font-bold text-white/40">
                                                        {player.department}
                                                    </span>
                                                )}
                                                {player.college && !player.department && (
                                                    <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] uppercase font-bold text-white/40">
                                                        {player.college}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Position Selector for Starters */}
                                {isStarter && onPositionOverride && (
                                    <select
                                        value={currentPosition}
                                        onChange={(e) => onPositionOverride(player.id, e.target.value)}
                                        className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white"
                                        title="Tactical Position"
                                    >
                                        {positions.map(pos => (
                                            <option key={pos} value={pos}>{pos}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {isStarter && (
                                    <button
                                        onClick={() => onCaptainChange(player.id)}
                                        className={`px-2 py-1 rounded text-xs font-bold ${isCaptain
                                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                                            }`}
                                    >
                                        {isCaptain ? '★ Captain' : 'Set Captain'}
                                    </button>
                                )}
                                <button
                                    onClick={() => onToggleStarter(player.id)}
                                    className={`px-3 py-1 rounded font-bold text-xs ${isStarter
                                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                        }`}
                                >
                                    {isStarter ? 'Remove' : 'Add'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t border-white/10 text-sm text-white/60">
                <div>Starters: {starters.length}/{maxStarters} {maxStarters === 5 && '(5-aside)'}</div>
                <div>Substitutes: {roster.length - starters.length}</div>
            </div>
        </div>
    );
}
