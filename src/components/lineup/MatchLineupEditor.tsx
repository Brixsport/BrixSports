'use client';

// Shared official-lineup builder for one match: rosters, formation placement,
// captain, validation and a single all-or-nothing publish of both teams.
// Used by the admin Match Lineups page and by the football logger's pre-match
// screen, so both write through the same endpoint and placement engine.

import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Save, Lock as LockIcon } from 'lucide-react';
import { getClientErrorMessage } from '@/lib/client-error';
import { useLineupPlacement, type PlacementEntry } from './useLineupPlacement';
import { AdminTeamLineupBuilder } from './AdminTeamLineupBuilder';
import { seedPlacementsFromLegacy, resolveSlot } from '@/lib/lineup/placement';
import { getFormationsForAdmin, generateDynamicFormation, DEFAULT_FORMATION_11, DEFAULT_FORMATION_5 } from '@/lib/lineup/formations';

export interface LineupEditorMatch {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam: { name: string; shortName?: string };
    awayTeam: { name: string; shortName?: string };
    competitionLevel?: string | null;
    status: string;
}

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

// A team's existing lineup may already be a V2 (every starter has a real
// slotId) lineup saved by this builder, or a legacy (position-string only) one.
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

export function MatchLineupEditor({
    match,
    role,
    onPublished,
}: {
    match: LineupEditorMatch;
    role: 'admin' | 'logger';
    /** Called after a successful publish (and reload), e.g. so the logger screen can refresh its own lineup state. */
    onPublished?: () => void;
}) {
    const [homeRoster, setHomeRoster] = useState<Player[]>([]);
    const [awayRoster, setAwayRoster] = useState<Player[]>([]);
    const [saving, setSaving] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
    const [homeLineupStatus, setHomeLineupStatus] = useState<any>(null);
    const [awayLineupStatus, setAwayLineupStatus] = useState<any>(null);
    const [unlocking, setUnlocking] = useState(false);
    const [playersPerSide, setPlayersPerSide] = useState(11);

    const homePlacement = useLineupPlacement({ formationId: '4-3-3' });
    const awayPlacement = useLineupPlacement({ formationId: '4-3-3' });

    const loadRosters = async (formationDefaults: { home: string; away: string }) => {
        setLoadingData(true);
        setLoadError(null);
        try {
            let homeUrl = `/api/players?teamId=${match.homeTeamId}`;
            let awayUrl = `/api/players?teamId=${match.awayTeamId}`;

            // Interdepartmental/intercollege competitions group players by
            // department or college, not by teamId. Do NOT use the university
            // filter with team.name (it stores the institution name).
            if (match.competitionLevel === 'department') {
                homeUrl = `/api/players?department=${encodeURIComponent(match.homeTeam.name)}`;
                awayUrl = `/api/players?department=${encodeURIComponent(match.awayTeam.name)}`;
            } else if (match.competitionLevel === 'college') {
                homeUrl = `/api/players?college=${encodeURIComponent(match.homeTeam.name)}`;
                awayUrl = `/api/players?college=${encodeURIComponent(match.awayTeam.name)}`;
            }

            const [homeResponse, awayResponse] = await Promise.all([fetch(homeUrl), fetch(awayUrl)]);
            const homeData = await homeResponse.json();
            const awayData = await awayResponse.json();

            const homePlayers = Array.isArray(homeData) ? homeData : (homeData.players || homeData.data || []);
            const awayPlayers = Array.isArray(awayData) ? awayData : (awayData.players || awayData.data || []);

            setHomeRoster(homePlayers);
            setAwayRoster(awayPlayers);

            if (homePlayers.length === 0 || awayPlayers.length === 0) {
                const missing = [homePlayers.length === 0 && match.homeTeam.name, awayPlayers.length === 0 && match.awayTeam.name].filter(Boolean).join(' and ');
                setLoadError(`No players found for ${missing}. Add players to the team first.`);
            }

            const lineupResponse = await fetch(`/api/matches/${match.id}/lineup`);
            const lineupData = await lineupResponse.json();

            if (lineupData.success && lineupData.lineups?.home) {
                homePlacement.reset({
                    formationId: lineupData.lineups.home.formation || formationDefaults.home,
                    placements: deriveInitialPlacements(lineupData.lineups.home),
                });
                setHomeLineupStatus(lineupData.lineups.home);
            } else {
                homePlacement.reset({ formationId: formationDefaults.home });
                setHomeLineupStatus(null);
            }

            if (lineupData.success && lineupData.lineups?.away) {
                awayPlacement.reset({
                    formationId: lineupData.lineups.away.formation || formationDefaults.away,
                    placements: deriveInitialPlacements(lineupData.lineups.away),
                });
                setAwayLineupStatus(lineupData.lineups.away);
            } else {
                awayPlacement.reset({ formationId: formationDefaults.away });
                setAwayLineupStatus(null);
            }
        } catch (error) {
            console.error('Error loading rosters:', error);
            setLoadError('Failed to load player rosters. Check your connection and retry.');
        } finally {
            setLoadingData(false);
        }
    };

    const init = async () => {
        // playersPerSide comes from the same match/competition config chain the
        // publish route enforces server-side.
        let pps = 11;
        try {
            const configRes = await fetch(`/api/matches/${match.id}/config`);
            const configData = await configRes.json();
            const configPps = configData?.config?.playersPerSide;
            if (typeof configPps === 'number' && configPps > 0) pps = configPps;
        } catch (e) {
            console.error('Could not fetch match config:', e);
        }
        setPlayersPerSide(pps);
        const defaultFormation = pps === 5 ? DEFAULT_FORMATION_5 : pps === 11 ? DEFAULT_FORMATION_11 : generateDynamicFormation(pps).id;
        await loadRosters({ home: defaultFormation, away: defaultFormation });
    };

    useEffect(() => {
        void init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [match.id]);

    // Re-arranges currently-placed starters into the new formation's slots
    // (bucket-matched by real position); nothing is destroyed.
    const handleFormationChangeRequest = (side: 'home' | 'away', newFormationId: string) => {
        const placement = side === 'home' ? homePlacement : awayPlacement;
        const roster = side === 'home' ? homeRoster : awayRoster;
        const rosterById = Object.fromEntries(roster.map((p) => [p.id, p]));
        const starters = placement.placements.map((p) => ({
            playerId: p.playerId,
            position: rosterById[p.playerId]?.position,
            isCaptain: p.isCaptain,
            isViceCaptain: p.isViceCaptain,
        }));
        placement.reset({ formationId: newFormationId, placements: seedPlacementsFromLegacy(starters, newFormationId) });
    };

    const publishLineups = async () => {
        if (homePlacement.placements.length !== playersPerSide || awayPlacement.placements.length !== playersPerSide) {
            setNotice({ kind: 'error', text: `Both teams must have exactly ${playersPerSide} starters` });
            return;
        }
        if (!homePlacement.placements.some((p) => p.isCaptain) || !awayPlacement.placements.some((p) => p.isCaptain)) {
            setNotice({ kind: 'error', text: 'Please select captains for both teams' });
            return;
        }

        setSaving(true);
        setNotice(null);
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

            // ONE request for both teams: the server validates both and writes once,
            // so a failure on either side can never leave a half-published match.
            const res = await fetch(`/api/admin/match-lineups/${match.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    lineups: {
                        home: buildTeamLineup(homeRoster, homePlacement),
                        away: buildTeamLineup(awayRoster, awayPlacement),
                    },
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || data.error || 'Failed to publish');
            }

            setNotice({ kind: 'ok', text: 'Lineups published. Nothing was changed on failure, both teams saved together.' });
            await loadRosters({ home: homePlacement.formationId, away: awayPlacement.formationId });
            onPublished?.();
        } catch (error) {
            console.error('Error publishing lineups:', error);
            setNotice({ kind: 'error', text: getClientErrorMessage(error, 'Failed to publish lineups') });
        } finally {
            setSaving(false);
        }
    };

    const unlockLineup = async (team: 'home' | 'away') => {
        setUnlocking(true);
        try {
            const response = await fetch(`/api/matches/${match.id}/lineup/unlock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team }),
            });
            if (response.ok) {
                setNotice({ kind: 'ok', text: `${team === 'home' ? 'Home' : 'Away'} lineup unlocked. You can now edit and republish.` });
                await loadRosters({ home: homePlacement.formationId, away: awayPlacement.formationId });
            } else {
                const data = await response.json();
                setNotice({ kind: 'error', text: data.error || 'Failed to unlock lineup' });
            }
        } catch (error) {
            console.error('Error unlocking lineup:', error);
            setNotice({ kind: 'error', text: 'Failed to unlock lineup' });
        } finally {
            setUnlocking(false);
        }
    };

    const formationOptions = getFormationsForAdmin('Football', playersPerSide);

    // Loggers can only edit before kick-off, and not a lineup an admin published and locked.
    const sideDisabled = (status: any) =>
        role !== 'admin' &&
        (match.status !== 'UPCOMING' || (status?.publishedByRole === 'admin' && !status?.unlocked));
    const homeDisabled = sideDisabled(homeLineupStatus);
    const awayDisabled = sideDisabled(awayLineupStatus);

    const renderStatusBanner = (label: 'Home' | 'Away', status: any, side: 'home' | 'away') => (
        <>
            {status?.status === 'published' && !status?.unlocked && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-green-400 font-bold text-sm mb-1">✓ {label} Lineup Published</p>
                            <p className="text-xs text-white/60">
                                By {status.publishedByName || status.publishedByRole || 'staff'} on {status.publishedAt ? new Date(status.publishedAt).toLocaleString() : 'unknown time'}
                            </p>
                            <p className="text-xs text-white/40 mt-1">
                                {role === 'admin'
                                    ? 'Published. You can update it below.'
                                    : status.publishedByRole === 'admin'
                                        ? 'Locked by Admin. Cannot be edited.'
                                        : 'Published. You can correct it below until the match starts.'}
                            </p>
                        </div>
                        {role === 'admin' && (
                            <button
                                onClick={() => unlockLineup(side)}
                                disabled={unlocking}
                                className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                            >
                                {unlocking ? 'Unlocking...' : '🔓 Unlock'}
                            </button>
                        )}
                    </div>
                </div>
            )}
            {status?.unlocked && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                    <p className="text-yellow-400 font-bold text-sm mb-1">⚠️ {label} Lineup Unlocked</p>
                    <p className="text-xs text-white/60">
                        Unlocked by {status.unlockedByName} on {status.unlockedAt ? new Date(status.unlockedAt).toLocaleString() : 'unknown time'}
                    </p>
                    <p className="text-xs text-white/40 mt-1">You can now edit and republish this lineup.</p>
                </div>
            )}
        </>
    );

    const bothPlaced = homePlacement.placements.length === playersPerSide && awayPlacement.placements.length === playersPerSide;
    const bothCaptains = homePlacement.placements.some((p) => p.isCaptain) && awayPlacement.placements.some((p) => p.isCaptain);
    const hasPublished = homeLineupStatus?.status === 'published' || awayLineupStatus?.status === 'published';

    return (
        <div className="space-y-6">
            {loadError && (
                <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center justify-between gap-3">
                    <span>{loadError}</span>
                    <button onClick={() => void init()} className="shrink-0 px-3 py-1 rounded-lg bg-white/10 text-white text-xs font-bold">Retry</button>
                </div>
            )}

            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-4 text-sm">
                    <div className={`flex items-center gap-2 ${homePlacement.placements.length === playersPerSide ? 'text-green-400' : 'text-orange-400'}`}>
                        {homePlacement.placements.length === playersPerSide ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        Home: {homePlacement.placements.length}/{playersPerSide} starters
                    </div>
                    <div className={`flex items-center gap-2 ${awayPlacement.placements.length === playersPerSide ? 'text-green-400' : 'text-orange-400'}`}>
                        {awayPlacement.placements.length === playersPerSide ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        Away: {awayPlacement.placements.length}/{playersPerSide} starters
                    </div>
                </div>

                {match.status !== 'UPCOMING' && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                        <LockIcon size={14} />
                        <span>Lineups are locked because the match has already started. Contact a system administrator if corrections are required.</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {renderStatusBanner('Home', homeLineupStatus, 'home')}
                {renderStatusBanner('Away', awayLineupStatus, 'away')}
            </div>

            {loadingData ? (
                <div className="py-20 text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/40">Loading rosters...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AdminTeamLineupBuilder
                        teamName={match.homeTeam.name}
                        teamSide="home"
                        roster={homeRoster}
                        formationOptions={formationOptions}
                        placement={homePlacement}
                        onRequestFormationChange={(id) => handleFormationChangeRequest('home', id)}
                        maxStarters={playersPerSide}
                        isDisabled={homeDisabled}
                    />
                    <AdminTeamLineupBuilder
                        teamName={match.awayTeam.name}
                        teamSide="away"
                        roster={awayRoster}
                        formationOptions={formationOptions}
                        placement={awayPlacement}
                        onRequestFormationChange={(id) => handleFormationChangeRequest('away', id)}
                        maxStarters={playersPerSide}
                        isDisabled={awayDisabled}
                    />
                </div>
            )}

            <div className="flex flex-col items-center gap-2">
                {notice && (
                    <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${notice.kind === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                        {notice.text}
                    </p>
                )}
                <button
                    onClick={publishLineups}
                    disabled={saving || !bothPlaced || !bothCaptains || homeDisabled || awayDisabled}
                    className="px-8 py-4 bg-primary hover:bg-primary/90 disabled:bg-white/10 disabled:cursor-not-allowed text-black disabled:text-white/40 rounded-xl font-bold text-lg flex items-center gap-3 transition-colors"
                >
                    <Save size={20} />
                    {saving ? 'Publishing...' : hasPublished ? 'Update Lineups' : 'Publish Official Lineups'}
                </button>
                {!bothCaptains && (
                    <p className="text-xs text-amber-400 mt-1">Set a captain for both teams before publishing.</p>
                )}
            </div>
        </div>
    );
}
