'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Shield, Calendar, Users, CheckCircle, AlertCircle, Save, Lock as LockIcon } from 'lucide-react';
import { getClientErrorMessage } from '@/lib/client-error';
import { useLineupPlacement, type PlacementEntry } from '@/components/lineup/useLineupPlacement';
import { AdminTeamLineupBuilder } from '@/components/lineup/AdminTeamLineupBuilder';
import { seedPlacementsFromLegacy, resolveSlot } from '@/lib/lineup/placement';
import { getFormationsForAdmin, generateDynamicFormation, DEFAULT_FORMATION_11, DEFAULT_FORMATION_5 } from '@/lib/lineup/formations';

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

// BUG-125: this entire page is a football/5-a-side formation-pitch builder --
// positions, formations, everything below assumes a football-shaped roster.
// It was never sport-aware at all (playersPerSide came only from the
// competition row, defaulting to 11 for any sport that didn't have it set),
// so a basketball match silently got a broken 11-starter "lineup" UI. Rather
// than build a second, formation-free lineup UI here (real duplicate scope --
// BasketballLogger's own lineup wizard already does this correctly and now
// persists it for real, BACKLOG-141), gate basketball matches out with a
// clear redirect instead of letting them through broken.
const isBasketballMatch = (match: Match) => (match.sport || '').toLowerCase().includes('basketball');

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

// BACKLOG-323 step 6: a team's existing lineup may already be a V2
// (placementVersion:2, every starter has a real slotId) lineup saved by this
// same rebuilt builder, or a legacy (position-string only) one -- every real
// published lineup as of this step, since the backfill migration that would
// give them real coordinates is step 9, a separate later migration. Detect
// which and seed the edit state accordingly rather than assuming either.
function deriveInitialPlacements(teamLineup: any): PlacementEntry[] {
    if (!teamLineup?.starters || teamLineup.starters.length === 0) return [];
    const isV2 = teamLineup.starters.every((s: any) => typeof s.slotId === 'string' && s.slotId.length > 0);
    if (isV2) {
        return teamLineup.starters.map((s: any) => ({
            slotId: s.slotId,
            playerId: s.playerId,
            isCaptain: !!s.isCaptain,
            isViceCaptain: !!s.isViceCaptain,
        }));
    }
    return seedPlacementsFromLegacy(teamLineup.starters, teamLineup.formation);
}

export default function AdminMatchLineupsPage() {
    const { user, loading, isAuthenticated } = useAuth();
    const router = useRouter();
    const [matches, setMatches] = useState<Match[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [homeRoster, setHomeRoster] = useState<Player[]>([]);
    const [awayRoster, setAwayRoster] = useState<Player[]>([]);
    const [saving, setSaving] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [homeLineupStatus, setHomeLineupStatus] = useState<any>(null);
    const [awayLineupStatus, setAwayLineupStatus] = useState<any>(null);
    const [unlocking, setUnlocking] = useState(false);
    const [playersPerSide, setPlayersPerSide] = useState(11);

    // BACKLOG-323: replaces the old homeStarters/homeFormation/homeCaptain/
    // homePositionOverrides state (and the away-side equivalents) with one
    // slot-placement hook per team. Hooks can't be constructed conditionally,
    // so these are always mounted -- reset() re-seeds them per selected match.
    const homePlacement = useLineupPlacement({ formationId: '4-3-3' });
    const awayPlacement = useLineupPlacement({ formationId: '4-3-3' });

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

    const loadRosters = async (match: Match, formationDefaults: { home: string; away: string }) => {
        setLoadingData(true);
        try {
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

            const homeData = await homeResponse.json();
            const awayData = await awayResponse.json();

            // Handle different response formats
            const homePlayers = Array.isArray(homeData)
                ? homeData
                : (homeData.players || homeData.data || []);

            const awayPlayers = Array.isArray(awayData)
                ? awayData
                : (awayData.players || awayData.data || []);

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

            if (lineupData.success && lineupData.lineups?.home) {
                const homeFormation = lineupData.lineups.home.formation || formationDefaults.home;
                homePlacement.reset({
                    formationId: homeFormation,
                    placements: deriveInitialPlacements(lineupData.lineups.home),
                });
                setHomeLineupStatus(lineupData.lineups.home);
            } else {
                homePlacement.reset({ formationId: formationDefaults.home });
                setHomeLineupStatus(null);
            }

            if (lineupData.success && lineupData.lineups?.away) {
                const awayFormation = lineupData.lineups.away.formation || formationDefaults.away;
                awayPlacement.reset({
                    formationId: awayFormation,
                    placements: deriveInitialPlacements(lineupData.lineups.away),
                });
                setAwayLineupStatus(lineupData.lineups.away);
            } else {
                awayPlacement.reset({ formationId: formationDefaults.away });
                setAwayLineupStatus(null);
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
        // BACKLOG-183: read playersPerSide from the same match/competition config chain
        // the lineup-publish route now enforces server-side (src/lib/matchConfig.ts),
        // instead of looking up `competitions.find(c => c.name === match.competition)` —
        // that lookup silently failed for friendlies (competition is just "Friendly", not
        // a real configured competitions row) and fell through to a hardcoded 11.
        let pps = 11;
        try {
            const configRes = await fetch(`/api/matches/${match.id}/config`);
            const configData = await configRes.json();
            const configPps = configData?.config?.playersPerSide;
            if (typeof configPps === 'number' && configPps > 0) {
                pps = configPps;
            }
        } catch (e) {
            console.error('Could not fetch match config:', e);
        }
        setPlayersPerSide(pps);
        // BACKLOG-328: 5 and 11 keep their real hand-authored default formations;
        // any other size (7-a-side, 9-a-side, etc.) gets a generated one instead
        // of silently falling back to an 11-slot pitch that doesn't match the
        // real roster size.
        const defaultFormation = pps === 5 ? DEFAULT_FORMATION_5 : pps === 11 ? DEFAULT_FORMATION_11 : generateDynamicFormation(pps).id;
        loadRosters(match, { home: defaultFormation, away: defaultFormation });
    };

    // BACKLOG-323: formation changes now go through a confirm step when slots
    // are already filled -- changing formation necessarily invalidates the old
    // slot ids, so this can no longer silently wipe starters the way the old
    // <select onChange={setHomeFormation}> did (a risk flagged when this
    // rebuild was scoped, BACKLOG-220's "no formation-change confirm" item).
    const handleFormationChangeRequest = (side: 'home' | 'away', newFormationId: string) => {
        const placement = side === 'home' ? homePlacement : awayPlacement;
        if (placement.placements.length > 0) {
            const confirmed = window.confirm(
                'Changing formation will clear every player currently placed on the pitch for this team. Continue?'
            );
            if (!confirmed) return;
        }
        placement.reset({ formationId: newFormationId });
    };

    const publishLineups = async () => {
        if (!selectedMatch) return;

        if (homePlacement.placements.length !== playersPerSide || awayPlacement.placements.length !== playersPerSide) {
            alert(`Both teams must have exactly ${playersPerSide} starters`);
            return;
        }

        const homeCaptainId = homePlacement.placements.find((p) => p.isCaptain)?.playerId;
        const awayCaptainId = awayPlacement.placements.find((p) => p.isCaptain)?.playerId;
        if (!homeCaptainId || !awayCaptainId) {
            alert('Please select captains for both teams');
            return;
        }

        setSaving(true);
        try {
            const buildTeamLineup = (roster: Player[], placement: ReturnType<typeof useLineupPlacement>) => ({
                formation: placement.formationId,
                placementVersion: 2,
                starters: placement.placements.map((p) => {
                    const player = roster.find((r) => r.id === p.playerId)!;
                    const slot = resolveSlot(placement.formationId, p.slotId);
                    return {
                        playerId: p.playerId,
                        slotId: p.slotId,
                        x: slot?.x,
                        y: slot?.y,
                        position: slot?.role || player.position,
                        jerseyNumber: player.number,
                        jerseyName: player.jerseyName,
                        isCaptain: !!p.isCaptain,
                        isViceCaptain: !!p.isViceCaptain,
                    };
                }),
                substitutes: roster
                    .filter((player) => !placement.placements.some((p) => p.playerId === player.id))
                    .map((player) => ({
                        playerId: player.id,
                        jerseyNumber: player.number,
                        jerseyName: player.jerseyName,
                    })),
                status: 'published',
            });

            const homeLineup = buildTeamLineup(homeRoster, homePlacement);
            const awayLineup = buildTeamLineup(awayRoster, awayPlacement);

            // Save lineups sequentially to avoid race conditions in the database
            const homeRes = await fetch(`/api/admin/match-lineups/${selectedMatch.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team: 'home', lineup: homeLineup })
            });

            if (!homeRes.ok) {
                const data = await homeRes.json();
                throw new Error(`Home Lineup: ${data.error || 'Failed to publish'}`);
            }

            const awayRes = await fetch(`/api/admin/match-lineups/${selectedMatch.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team: 'away', lineup: awayLineup })
            });

            if (!awayRes.ok) {
                const data = await awayRes.json();
                throw new Error(`Away Lineup: ${data.error || 'Failed to publish'}`);
            }

            alert('Lineups published successfully!');
            // Reload to update status headers
            loadRosters(selectedMatch, { home: homePlacement.formationId, away: awayPlacement.formationId });
        } catch (error) {
            console.error('Error publishing lineups:', error);
            alert(getClientErrorMessage(error, 'Failed to publish lineups'));
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
                loadRosters(selectedMatch, { home: homePlacement.formationId, away: awayPlacement.formationId });
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

    // BACKLOG-328: for playersPerSide values without a real hand-authored
    // set (anything but 5 or 11), getFormationsForAdmin returns exactly one
    // generated formation sized to match -- no more forcing a 7-a-side match
    // onto an 11-slot pitch.
    const homeFormationOptions = getFormationsForAdmin('Football', playersPerSide);
    const awayFormationOptions = homeFormationOptions;

    const homeDisabled = (user?.role !== 'admin' && selectedMatch?.status !== 'UPCOMING') || (user?.role !== 'admin' && homeLineupStatus?.publishedByRole === 'admin' && !homeLineupStatus?.unlocked);
    const awayDisabled = (user?.role !== 'admin' && selectedMatch?.status !== 'UPCOMING') || (user?.role !== 'admin' && awayLineupStatus?.publishedByRole === 'admin' && !awayLineupStatus?.unlocked);

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

                            {isBasketballMatch(selectedMatch) && (
                                <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-300 text-sm flex items-start gap-2">
                                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                    <span>
                                        This tool is a football formation builder and doesn&apos;t support basketball rosters (no formation/position concept applies).
                                        Basketball lineups are managed directly in the Logger for this match, where they now save to the server.
                                    </span>
                                </div>
                            )}
                        </div>

                        {isBasketballMatch(selectedMatch) ? null : (
                            <>
                                <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                                    {/* Validation Status */}
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className={`flex items-center gap-2 ${homePlacement.placements.length === playersPerSide ? 'text-green-400' : 'text-orange-400'}`}>
                                            {homePlacement.placements.length === playersPerSide ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                            Home: {homePlacement.placements.length}/{playersPerSide} starters {playersPerSide === 5 && <span className="text-xs opacity-60">(5-aside)</span>}
                                        </div>
                                        <div className={`flex items-center gap-2 ${awayPlacement.placements.length === playersPerSide ? 'text-green-400' : 'text-orange-400'}`}>
                                            {awayPlacement.placements.length === playersPerSide ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                            Away: {awayPlacement.placements.length}/{playersPerSide} starters {playersPerSide === 5 && <span className="text-xs opacity-60">(5-aside)</span>}
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
                                        <AdminTeamLineupBuilder
                                            teamName={selectedMatch.homeTeam.name}
                                            teamSide="home"
                                            roster={homeRoster}
                                            formationOptions={homeFormationOptions}
                                            placement={homePlacement}
                                            onRequestFormationChange={(id) => handleFormationChangeRequest('home', id)}
                                            maxStarters={playersPerSide}
                                            isDisabled={homeDisabled}
                                        />

                                        <AdminTeamLineupBuilder
                                            teamName={selectedMatch.awayTeam.name}
                                            teamSide="away"
                                            roster={awayRoster}
                                            formationOptions={awayFormationOptions}
                                            placement={awayPlacement}
                                            onRequestFormationChange={(id) => handleFormationChangeRequest('away', id)}
                                            maxStarters={playersPerSide}
                                            isDisabled={awayDisabled}
                                        />
                                    </div>
                                )}

                                {/* Publish Button */}
                                <div className="flex flex-col items-center gap-2">
                                    <button
                                        onClick={publishLineups}
                                        disabled={
                                            saving ||
                                            homePlacement.placements.length !== playersPerSide ||
                                            awayPlacement.placements.length !== playersPerSide ||
                                            !homePlacement.placements.some((p) => p.isCaptain) ||
                                            !awayPlacement.placements.some((p) => p.isCaptain) ||
                                            homeDisabled ||
                                            awayDisabled
                                        }
                                        className="px-8 py-4 bg-primary hover:bg-primary/90 disabled:bg-white/10 disabled:cursor-not-allowed text-black disabled:text-white/40 rounded-xl font-bold text-lg flex items-center gap-3 transition-colors"
                                    >
                                        <Save size={20} />
                                        {saving ? 'Publishing...' : (homeLineupStatus?.status === 'published' || awayLineupStatus?.status === 'published') ? 'Update Lineups' : 'Publish Official Lineups'}
                                    </button>
                                    {(!homePlacement.placements.some((p) => p.isCaptain) || !awayPlacement.placements.some((p) => p.isCaptain)) && (
                                        <p className="text-xs text-amber-400 mt-1">
                                            Set a captain for both teams before publishing.
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
