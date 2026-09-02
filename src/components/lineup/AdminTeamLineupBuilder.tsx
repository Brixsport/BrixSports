'use client';

// BACKLOG-323 step 6: the admin match-lineup builder's per-team panel,
// rebuilt on the shared placement pieces (PlacementPitch, PlayerSelectorPopup,
// useLineupPlacement) in place of the old checkbox/dropdown roster list
// (TeamLineupBuilder in admin/match-lineups/page.tsx). All the real admin
// logic -- auth, squad validation, publish/lock, playersPerSide, the
// basketball gate -- stays in page.tsx untouched; this component is UI only.

import { useState } from 'react';
import { Star, Users } from 'lucide-react';
import { PlacementPitch } from './PlacementPitch';
import { PlayerSelectorPopup, type PlayerSelectorCandidate } from './PlayerSelectorPopup';
import type { UseLineupPlacementResult } from './useLineupPlacement';
import type { FormationDefinition } from '@/lib/lineup/formations';

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

export interface AdminTeamLineupBuilderProps {
    teamName: string;
    teamSide: 'home' | 'away';
    roster: Player[];
    formationOptions: FormationDefinition[];
    placement: UseLineupPlacementResult;
    /** Called when the admin picks a different formation while slots are already filled -- page.tsx owns the confirm dialog since it's a real destructive action. */
    onRequestFormationChange: (newFormationId: string) => void;
    maxStarters: number;
    isDisabled?: boolean;
}

export function AdminTeamLineupBuilder({
    teamName,
    teamSide,
    roster,
    formationOptions,
    placement,
    onRequestFormationChange,
    maxStarters,
    isDisabled = false,
}: AdminTeamLineupBuilderProps) {
    const [popupSlotId, setPopupSlotId] = useState<string | null>(null);

    const rosterById: Record<string, Player> = Object.fromEntries(roster.map((p) => [p.id, p]));

    const playerDetails: Record<string, { name: string; jerseyName?: string; number: number; teamLabel: 'home' | 'away' }> = {};
    placement.placements.forEach((p) => {
        const player = rosterById[p.playerId];
        if (player) {
            playerDetails[p.playerId] = {
                name: player.name,
                jerseyName: player.jerseyName,
                number: player.number,
                teamLabel: teamSide,
            };
        }
    });

    const placedPlayerIds = placement.placements.map((p) => p.playerId);
    const benchPlayers = roster.filter((p) => !placedPlayerIds.includes(p.id));

    const candidatesForPopup: PlayerSelectorCandidate[] = roster.map((p) => ({
        id: p.id,
        name: p.name,
        jerseyName: p.jerseyName,
        number: p.number,
        position: p.position,
        teamLabel: teamSide,
    }));

    const currentPlayerIdAtPopupSlot = popupSlotId ? placement.getPlayerAtSlot(popupSlotId) : undefined;
    const captainId = placement.placements.find((p) => p.isCaptain)?.playerId;

    return (
        <div className={`bg-white/5 rounded-xl border border-white/10 p-6 ${isDisabled ? 'opacity-70 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{teamName}</h3>
                <div className={`text-xs font-bold ${placement.placements.length === maxStarters ? 'text-green-400' : 'text-orange-400'}`}>
                    {placement.placements.length}/{maxStarters} placed
                </div>
            </div>

            <div className="mb-4">
                <label className="text-sm text-white/60 mb-2 block">Formation</label>
                <select
                    value={placement.formationId}
                    onChange={(e) => onRequestFormationChange(e.target.value)}
                    disabled={isDisabled}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                >
                    {formationOptions.map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                </select>
            </div>

            <PlacementPitch
                formationId={placement.formationId}
                placements={placement.placements}
                playerDetails={playerDetails}
                mode="edit"
                teamLabel={teamSide === 'home' ? 'Home' : 'Away'}
                onSlotClick={(slotId) => setPopupSlotId(slotId)}
            />

            {/* Captain selection -- only currently-placed starters are eligible */}
            <div className="mt-4">
                <label className="text-sm text-white/60 mb-2 block">Captain</label>
                <div className="flex flex-wrap gap-2">
                    {placement.placements.length === 0 ? (
                        <p className="text-xs text-white/40">Place starters on the pitch first</p>
                    ) : (
                        placement.placements.map((p) => {
                            const player = rosterById[p.playerId];
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

            {/* Bench -- everyone on the roster not currently placed. Matches the
                existing publish semantics (substitutes = roster minus starters),
                just shown explicitly instead of only being an implicit leftover. */}
            <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 mb-2">
                    <Users size={14} className="text-white/40" />
                    <label className="text-sm text-white/60">Bench ({benchPlayers.length})</label>
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {benchPlayers.map((p) => (
                        <span
                            key={p.id}
                            className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/60"
                        >
                            #{p.number} {p.jerseyName || p.name}
                        </span>
                    ))}
                </div>
            </div>

            <PlayerSelectorPopup
                isOpen={popupSlotId !== null}
                onClose={() => setPopupSlotId(null)}
                candidates={candidatesForPopup}
                excludePlayerIds={placedPlayerIds}
                currentPlayerId={currentPlayerIdAtPopupSlot}
                onSelect={(playerId) => {
                    if (popupSlotId) placement.assign(popupSlotId, playerId);
                }}
                onRemove={
                    currentPlayerIdAtPopupSlot
                        ? () => {
                            if (popupSlotId) placement.clear(popupSlotId);
                        }
                        : undefined
                }
                title={`Select Player — ${teamName}`}
            />
        </div>
    );
}
