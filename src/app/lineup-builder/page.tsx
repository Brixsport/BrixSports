'use client';

// BACKLOG-323 step 7: /lineup-builder rebuilt as the consolidated public
// feature -- absorbs /xi's any-player-any-team flow (no match/team-selection
// wizard, no admin write path) on the same shared placement pieces the admin
// builder uses (BACKLOG-323 step 6). Persists via the BACKLOG-324-hardened
// /api/user/xi (server-derived owner identity, never a client-passed userId).

import { useEffect, useRef, useState } from 'react';
import { Save, Send, Trash2, Star, Grid3x3, ChevronRight } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import download from 'downloadjs';
import Link from 'next/link';
import { PlacementPitch } from '@/components/lineup/PlacementPitch';
import { PlayerSelectorPopup, type PlayerSelectorCandidate } from '@/components/lineup/PlayerSelectorPopup';
import { useLineupPlacement, type PlacementEntry } from '@/components/lineup/useLineupPlacement';
import { getFormationsForAdmin, getFormation } from '@/lib/lineup/formations';
import { seedPlacementsFromLegacy } from '@/lib/lineup/placement';

declare module 'downloadjs';

// Full 11-a-side set (not the old 3-formation curated list) -- a dream-team
// builder that can prefill from any real team's real formation shouldn't cap
// the manual picker below what prefill itself can produce.
const FORMATION_OPTIONS = getFormationsForAdmin('Football', 11);
const DEFAULT_FORMATION = '4-3-3';

interface Player {
    id: string;
    name: string;
    jerseyName?: string;
    number: number;
    position: string;
    averageRating: number | null;
}

interface SavedXI {
    id: string;
    name: string;
    formation: string;
    players: string; // JSON PlacementEntry[]
    isPublic: boolean;
    createdAt: string;
}

interface Team {
    id: string;
    name: string;
    shortName: string;
    logo: string;
    sport: string;
}

export default function LineupBuilderPage() {
    const [teamName, setTeamName] = useState('My Dream Team');
    const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
    const [loadingPlayers, setLoadingPlayers] = useState(true);
    const [myTeams, setMyTeams] = useState<SavedXI[]>([]);
    const [popupSlotId, setPopupSlotId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [currentXiId, setCurrentXiId] = useState<string | null>(null);
    const [realTeams, setRealTeams] = useState<Team[]>([]);
    const [teamSearch, setTeamSearch] = useState('');
    const [prefilling, setPrefilling] = useState<string | null>(null);
    const [prefillOpen, setPrefillOpen] = useState(true);
    const pitchRef = useRef<HTMLDivElement>(null);

    const placement = useLineupPlacement({ formationId: DEFAULT_FORMATION });

    useEffect(() => {
        fetchPlayers();
        fetchMyTeams();
        fetchRealTeams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchPlayers = async () => {
        try {
            setLoadingPlayers(true);
            // BACKLOG-161: football-only -- this pitch's formations/positions don't
            // make sense for a mixed-sport roster.
            const response = await fetch('/api/players?limit=100&sport=Football');
            const data = await response.json();
            setAvailablePlayers(data.players || []);
        } catch (error) {
            console.error('Error fetching players:', error);
        } finally {
            setLoadingPlayers(false);
        }
    };

    const fetchMyTeams = async () => {
        try {
            const response = await fetch('/api/user/xi?mine=true');
            const data = await response.json();
            setMyTeams(data.teams || []);
        } catch (error) {
            console.error('Error fetching my teams:', error);
        }
    };

    // FotMob's real /lineup-builder does this: pick a real club/country and it
    // seeds the pitch with that team's actual roster, which you then swap and
    // interchange freely -- confirmed by direct use (see BACKLOG-323). Reuses
    // the existing bucket-match seeder (seedPlacementsFromLegacy) rather than a
    // new algorithm; it already does exactly "map a roster's positions onto a
    // formation's slots."
    const fetchRealTeams = async () => {
        try {
            const response = await fetch('/api/teams?limit=500');
            const data = await response.json();
            const list: Team[] = Array.isArray(data) ? data : [];
            setRealTeams(list.filter((t) => t.sport === 'Football'));
        } catch (error) {
            console.error('Error fetching teams:', error);
        }
    };

    const handlePrefillTeam = async (team: Team) => {
        try {
            setPrefilling(team.id);
            const response = await fetch(`/api/players?teamId=${team.id}`);
            const data = await response.json();
            const roster: Player[] = data.players || data || [];

            setAvailablePlayers((prev) => {
                const existingIds = new Set(prev.map((p) => p.id));
                return [...prev, ...roster.filter((p) => !existingIds.has(p.id))];
            });

            const slotCount = getFormation(placement.formationId)?.slots.length ?? roster.length;
            const starters = roster.slice(0, slotCount).map((p) => ({ playerId: p.id, position: p.position }));
            const seeded = seedPlacementsFromLegacy(starters, placement.formationId);

            placement.reset({ formationId: placement.formationId, placements: seeded });
            setTeamName(team.name);
            setCurrentXiId(null);
        } catch (error) {
            console.error('Error prefilling team:', error);
        } finally {
            setPrefilling(null);
        }
    };

    const playersById: Record<string, Player> = Object.fromEntries(availablePlayers.map((p) => [p.id, p]));

    const playerDetails: Record<string, { name: string; jerseyName?: string; number: number; rating?: number }> = {};
    placement.placements.forEach((p) => {
        const player = playersById[p.playerId];
        if (player) {
            playerDetails[p.playerId] = {
                name: player.name,
                jerseyName: player.jerseyName,
                number: player.number,
                rating: player.averageRating ?? undefined,
            };
        }
    });

    const placedPlayerIds = placement.placements.map((p) => p.playerId);

    const candidatesForPopup: PlayerSelectorCandidate[] = availablePlayers.map((p) => ({
        id: p.id,
        name: p.name,
        jerseyName: p.jerseyName,
        number: p.number,
        position: p.position,
        rating: p.averageRating ?? undefined,
    }));

    const currentPlayerIdAtPopupSlot = popupSlotId ? placement.getPlayerAtSlot(popupSlotId) : undefined;
    const captainId = placement.placements.find((p) => p.isCaptain)?.playerId;

    // Rearranges currently-placed players into the new formation's slots
    // (bucket-matched by real position) instead of wiping the pitch -- a
    // formation switch should feel like a rearrange, not a destructive reset.
    // Any player whose bucket has no free slot left in the smaller formation
    // just drops back to the pool, nothing is lost or needs a confirm dialog.
    const handleFormationChange = (newFormationId: string) => {
        const starters = placement.placements.map((p) => ({
            playerId: p.playerId,
            position: playersById[p.playerId]?.position,
            isCaptain: p.isCaptain,
            isViceCaptain: p.isViceCaptain,
        }));
        const rearranged = seedPlacementsFromLegacy(starters, newFormationId);
        placement.reset({ formationId: newFormationId, placements: rearranged });
    };

    const handleLoadTeam = (team: SavedXI) => {
        try {
            const parsed = JSON.parse(team.players);
            // Legacy /xi saves stored {position, playerId, slotIndex} with no
            // slotId -- not usable as a v2 placement, so they load as an empty
            // pitch under the same formation rather than crashing.
            const placements: PlacementEntry[] = Array.isArray(parsed)
                ? parsed.filter((p: any) => p && typeof p.slotId === 'string' && typeof p.playerId === 'string')
                : [];
            placement.reset({ formationId: team.formation, placements });
            setTeamName(team.name);
            setCurrentXiId(team.id);
        } catch (error) {
            console.error('Error loading team:', error);
        }
    };

    const handleClear = () => {
        if (!confirm('Clear the pitch and start a new team?')) return;
        placement.reset({ formationId: placement.formationId });
        setTeamName('My Dream Team');
        setCurrentXiId(null);
    };

    const handleSave = async (isPublic: boolean) => {
        if (placement.placements.length === 0) {
            alert('Place at least one player before saving.');
            return;
        }
        try {
            setSaving(true);
            const response = await fetch('/api/user/xi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: teamName,
                    formation: placement.formationId,
                    players: placement.toPlacements(),
                    isPublic,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                alert(data.error || 'Failed to save team');
                return;
            }
            setCurrentXiId(data.xi?.id ?? null);
            alert(isPublic ? 'Team published to the gallery!' : 'Team saved as a draft.');
            fetchMyTeams();
        } catch (error) {
            console.error('Error saving team:', error);
            alert('Failed to save team');
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
                quality: 1.0,
            });
            download(dataUrl, `${teamName.replace(/\s+/g, '-').toLowerCase() || 'lineup'}.png`);
        } catch (error) {
            console.error('Error downloading image:', error);
            alert('Failed to download image');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            <div className="max-w-[1400px] mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="font-display text-4xl tracking-tighter italic uppercase leading-none mb-2">
                            Lineup Builder
                        </h1>
                        <p className="text-sm text-white/60">Build your dream XI from any team, any player.</p>
                    </div>
                    <Link
                        href="/lineup-builder/gallery"
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-colors"
                    >
                        <Grid3x3 size={14} />
                        Gallery
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sidebar */}
                    <div className="space-y-4 order-2 lg:order-1">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <label className="text-sm text-white/60 mb-2 block">Team Name</label>
                            <input
                                type="text"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <button
                                onClick={() => setPrefillOpen((open) => !open)}
                                className="w-full flex items-center justify-between text-sm text-white/60"
                            >
                                <span>Pre-fill lineup</span>
                                <ChevronRight size={14} className={`transition-transform ${prefillOpen ? 'rotate-90' : ''}`} />
                            </button>
                            {prefillOpen && (
                                <>
                                    <input
                                        type="text"
                                        value={teamSearch}
                                        onChange={(e) => setTeamSearch(e.target.value)}
                                        placeholder="Search a team..."
                                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary mt-2 mb-2"
                                    />
                                    <div className="space-y-1 max-h-56 overflow-y-auto">
                                        {realTeams
                                            .filter((t) =>
                                                !teamSearch ||
                                                t.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
                                                t.shortName.toLowerCase().includes(teamSearch.toLowerCase())
                                            )
                                            .slice(0, 30)
                                            .map((t) => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => handlePrefillTeam(t)}
                                                    disabled={prefilling !== null}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left hover:bg-white/10 transition-colors disabled:opacity-50"
                                                >
                                                    {t.logo ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={t.logo} alt="" className="w-5 h-5 rounded-full object-cover" />
                                                    ) : (
                                                        <span className="w-5 h-5 rounded-full bg-white/10" />
                                                    )}
                                                    <span className="text-white/80 truncate">{t.name}</span>
                                                    {prefilling === t.id && <span className="ml-auto text-white/40">…</span>}
                                                </button>
                                            ))}
                                    </div>
                                    <p className="text-[10px] text-white/40 mt-2">
                                        {loadingPlayers ? 'Loading players…' : `${availablePlayers.length} players available`}
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                            <button
                                onClick={() => handleSave(false)}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/10 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-white/20 transition-colors disabled:opacity-50"
                            >
                                <Save size={14} /> Save Draft
                            </button>
                            <button
                                onClick={() => handleSave(true)}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-black rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                <Send size={14} /> Publish to Gallery
                            </button>
                            <button
                                onClick={handleDownload}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-colors disabled:opacity-50"
                            >
                                Download Image
                            </button>
                            <button
                                onClick={handleClear}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-500/20 transition-colors"
                            >
                                <Trash2 size={14} /> Clear
                            </button>
                        </div>

                        {myTeams.length > 0 && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <label className="text-sm text-white/60 mb-2 block">My Teams</label>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {myTeams.map((team) => (
                                        <button
                                            key={team.id}
                                            onClick={() => handleLoadTeam(team)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${currentXiId === team.id
                                                ? 'bg-primary/20 border border-primary/40'
                                                : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            <p className="font-bold text-white truncate">{team.name}</p>
                                            <p className="text-white/40">{team.formation}{team.isPublic ? ' · Public' : ' · Draft'}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pitch */}
                    <div className="lg:col-span-2 order-1 lg:order-2">
                        <div ref={pitchRef}>
                            <PlacementPitch
                                formationId={placement.formationId}
                                placements={placement.placements}
                                playerDetails={playerDetails}
                                mode="edit"
                                onSlotClick={(slotId) => setPopupSlotId(slotId)}
                                formationControl={
                                    <select
                                        value={placement.formationId}
                                        onChange={(e) => handleFormationChange(e.target.value)}
                                        className="px-3 py-1 bg-black/50 rounded-lg backdrop-blur-md border border-white/10 text-xs font-display italic font-bold text-white uppercase tracking-wider focus:outline-none cursor-pointer"
                                    >
                                        {FORMATION_OPTIONS.map((f) => (
                                            <option key={f.id} value={f.id} className="bg-neutral-900 normal-case">{f.label}</option>
                                        ))}
                                    </select>
                                }
                            />
                        </div>

                        {/* Captain */}
                        <div className="mt-4">
                            <label className="text-sm text-white/60 mb-2 block">Captain</label>
                            <div className="flex flex-wrap gap-2">
                                {placement.placements.length === 0 ? (
                                    <p className="text-xs text-white/40">Place players on the pitch first</p>
                                ) : (
                                    placement.placements.map((p) => {
                                        const player = playersById[p.playerId];
                                        if (!player) return null;
                                        const isCaptain = p.playerId === captainId;
                                        return (
                                            <button
                                                key={p.playerId}
                                                onClick={() => placement.setCaptain(p.playerId)}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors ${isCaptain
                                                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                                                    : 'bg-white/10 text-white/60 hover:bg-white/20 border border-transparent'
                                                    }`}
                                            >
                                                <Star size={12} className={isCaptain ? 'fill-yellow-400' : ''} />
                                                {player.jerseyName || player.name}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <PlayerSelectorPopup
                    isOpen={popupSlotId !== null}
                    onClose={() => setPopupSlotId(null)}
                    candidates={candidatesForPopup}
                    excludePlayerIds={placedPlayerIds}
                    currentPlayerId={currentPlayerIdAtPopupSlot}
                    onSelect={(playerId) => {
                        if (!popupSlotId) return;
                        // If the picked player is already in another slot, swap the
                        // two occupants instead of just moving the picked player and
                        // leaving their old slot empty.
                        const sourceSlot = placement.getSlotForPlayer(playerId);
                        if (sourceSlot && sourceSlot !== popupSlotId) {
                            placement.swap(popupSlotId, sourceSlot);
                        } else {
                            placement.assign(popupSlotId, playerId);
                        }
                    }}
                    onRemove={
                        currentPlayerIdAtPopupSlot
                            ? () => { if (popupSlotId) placement.clear(popupSlotId); }
                            : undefined
                    }
                    title="Select Player"
                />
            </div>
        </div>
    );
}
