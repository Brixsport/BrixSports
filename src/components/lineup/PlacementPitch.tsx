'use client';

// BACKLOG-323 step 5: the shared presentational/interaction pitch. Renders a
// canonical formation (src/lib/lineup/formations.ts) with players placed at
// resolved coordinates and fires callbacks on interaction -- it has no
// knowledge of matches, teams, auth, or persistence. Every consumer (the
// rebuilt admin builder, the rebuilt public /lineup-builder, the read-only
// tab if it's ever migrated) supplies its own data and a `toCoords`
// transform; this component just draws slots and reports clicks.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { getFormation } from '@/lib/lineup/formations';
import type { PlacementEntry } from './useLineupPlacement';

export interface PlacementPlayerDetails {
    name: string;
    jerseyName?: string;
    number: number;
    rating?: number;
    teamLabel?: 'home' | 'away';
}

export interface PlacementPitchProps {
    formationId: string;
    placements: PlacementEntry[];
    playerDetails: Record<string, PlacementPlayerDetails>;
    mode: 'readonly' | 'edit';
    /** Maps a slot's canonical own-half {x,y} into final render-space {x,y}. Defaults to identity (single full-pitch team, e.g. the public XI builder). Pass a home/away half-mapping (see src/lib/lineup/placement.ts's toPitchCoords) to render two teams on one pitch. */
    toCoords?: (slot: { x: number; y: number }) => { x: number; y: number };
    /** Fires in edit mode on: clicking an empty slot's `+`, or clicking an already-placed player. The consumer opens its own PlayerSelectorPopup in response -- this component holds no popup state itself. */
    onSlotClick?: (slotId: string, currentPlayerId: string | undefined) => void;
    /** Fires in readonly mode when a placed player is clicked (e.g. open a stats modal). */
    onPlayerClick?: (playerId: string) => void;
    teamLabel?: string;
    className?: string;
    /** Replaces the plain formation-label badge (top-right) with a custom control -- e.g. a formation <select> styled to sit in the same spot, FotMob-style. Defaults to the plain label when omitted (admin builder's sidebar dropdown is unaffected). */
    formationControl?: React.ReactNode;
}

export function PlacementPitch({
    formationId,
    placements,
    playerDetails,
    mode,
    toCoords = (slot) => slot,
    onSlotClick,
    onPlayerClick,
    teamLabel,
    className = '',
    formationControl,
}: PlacementPitchProps) {
    const formation = getFormation(formationId);

    if (!formation) {
        return (
            <div className="text-center py-12 text-white/40 text-sm">
                Unknown formation: {formationId}
            </div>
        );
    }

    const is5Aside = formation.variant === '5-a-side';

    const getPlayerIdAtSlot = (slotId: string) => placements.find((p) => p.slotId === slotId)?.playerId;

    return (
        <div
            className={`relative w-full ${is5Aside ? 'aspect-[4/5] sm:aspect-[1/1]' : 'aspect-[2/3] md:aspect-[3/4]'} bg-gradient-to-b from-green-900/40 to-green-800/20 rounded-3xl overflow-hidden border border-white/10 shadow-2xl ${className}`}
        >
            <PitchMarkings is5Aside={is5Aside} />

            {/* Watermark -- rendered before the slots so it always paints
                behind them regardless of z-index quirks. Shows up in the
                exported/downloaded image for free since html-to-image just
                captures this DOM node. */}
            <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none select-none opacity-[0.08]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/role-colorways/viewer-512-transparent.png" alt="" className="w-3/4 h-3/4 object-contain" />
            </div>

            {formation.slots.map((slot) => {
                const playerId = getPlayerIdAtSlot(slot.id);
                const placement = playerId ? placements.find((p) => p.slotId === slot.id) : undefined;
                const details = playerId ? playerDetails[playerId] : undefined;
                const coords = toCoords({ x: slot.x, y: slot.y });

                return (
                    <PlacementSlot
                        key={slot.id}
                        x={coords.x}
                        y={coords.y}
                        role={slot.role}
                        playerId={playerId}
                        details={details}
                        isCaptain={!!placement?.isCaptain}
                        isViceCaptain={!!placement?.isViceCaptain}
                        mode={mode}
                        is5Aside={is5Aside}
                        onClick={() => {
                            if (mode === 'edit') onSlotClick?.(slot.id, playerId);
                            else if (playerId) onPlayerClick?.(playerId);
                        }}
                    />
                );
            })}

            {teamLabel && (
                <div className="absolute top-4 left-4 z-10">
                    <div className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-black/50 text-white border border-white/10 backdrop-blur-md">
                        {teamLabel}
                    </div>
                </div>
            )}

            <div className="absolute top-4 right-4 z-10">
                {formationControl ?? (
                    <div className="px-3 py-1 bg-black/50 rounded-lg backdrop-blur-md border border-white/10">
                        <span className="text-xs font-display italic font-bold text-white uppercase tracking-wider">
                            {formation.label}
                        </span>
                    </div>
                )}
            </div>

        </div>
    );
}

function PitchMarkings({ is5Aside }: { is5Aside?: boolean }) {
    if (is5Aside) {
        return (
            <div className="absolute inset-0 p-4 opacity-50">
                <div className="w-full h-full border-2 border-white/15 rounded-xl relative">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/15" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/15 rounded-full" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/20 rounded-full" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 border-2 border-white/15 border-t-0 rounded-b-full bg-white/5" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-16 border-2 border-white/15 border-b-0 rounded-t-full bg-white/5" />
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-16 h-1 bg-white/40" />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-1 bg-white/40" />
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/10 rounded-full" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/20 rounded-full" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3/4 h-24 border-2 border-white/10 border-b-0" />
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-3/4 h-24 border-2 border-white/10 border-t-0" />
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-12 border-2 border-white/10 border-b-0" />
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/2 h-12 border-2 border-white/10 border-t-0" />
        </>
    );
}

function PlacementSlot({
    x,
    y,
    role,
    playerId,
    details,
    isCaptain,
    isViceCaptain,
    mode,
    is5Aside,
    onClick,
}: {
    x: number;
    y: number;
    role: string;
    playerId?: string;
    details?: PlacementPlayerDetails;
    isCaptain: boolean;
    isViceCaptain: boolean;
    mode: 'readonly' | 'edit';
    is5Aside?: boolean;
    onClick: () => void;
}) {
    const [isHovering, setIsHovering] = useState(false);
    const hasPlayer = !!(playerId && details);
    const displayName = details && (details.jerseyName || details.name.split(' ').pop());
    const clickable = mode === 'edit' || (mode === 'readonly' && hasPlayer);

    return (
        <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
        >
            {hasPlayer ? (
                <button
                    onClick={clickable ? onClick : undefined}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    disabled={!clickable}
                    className={`relative ${is5Aside ? 'w-20 h-24' : 'w-16 h-20'} rounded-xl border-2 transition-all ${details!.teamLabel === 'away'
                        ? 'bg-red-500/90 border-red-400'
                        : 'bg-blue-500/90 border-blue-400'
                        } ${clickable ? 'hover:scale-110 cursor-pointer' : ''} shadow-lg`}
                >
                    {isCaptain && (
                        <div className={`absolute -top-2 -right-2 ${is5Aside ? 'w-8 h-8' : 'w-6 h-6'} bg-yellow-500 rounded-full flex items-center justify-center border-2 border-black`}>
                            <span className={`${is5Aside ? 'text-xs' : 'text-[10px]'} font-black`}>C</span>
                        </div>
                    )}
                    {isViceCaptain && !isCaptain && (
                        <div className={`absolute -top-2 -right-2 ${is5Aside ? 'w-8 h-8' : 'w-6 h-6'} bg-gray-400 rounded-full flex items-center justify-center border-2 border-black`}>
                            <span className={`${is5Aside ? 'text-xs' : 'text-[10px]'} font-black`}>VC</span>
                        </div>
                    )}

                    <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
                        <span className={`text-white ${is5Aside ? 'text-2xl' : 'text-xl'} font-display font-bold`}>
                            {details!.number}
                        </span>
                    </div>

                    <div className="absolute bottom-1 left-0 right-0 px-1">
                        <p className={`text-white ${is5Aside ? 'text-[10px]' : 'text-[8px]'} font-black uppercase truncate text-center`}>
                            {displayName}
                        </p>
                    </div>

                    {typeof details!.rating === 'number' && (
                        <div className="absolute top-1 right-1">
                            <div className="flex items-center gap-0.5 bg-black/30 rounded px-1">
                                <Star size={is5Aside ? 10 : 8} className="text-yellow-400 fill-yellow-400" />
                                <span className={`${is5Aside ? 'text-[10px]' : 'text-[8px]'} font-bold text-white`}>
                                    {details!.rating!.toFixed(1)}
                                </span>
                            </div>
                        </div>
                    )}
                </button>
            ) : mode === 'edit' ? (
                <motion.button
                    animate={isHovering ? { scale: 1.1 } : { scale: 1 }}
                    onClick={onClick}
                    className={`${is5Aside ? 'w-16 h-16' : 'w-12 h-12'} rounded-full border-2 border-dashed flex items-center justify-center transition-all cursor-pointer border-white/30 bg-white/5 hover:border-primary hover:bg-primary/10`}
                >
                    <span className={`${is5Aside ? 'text-xs' : 'text-[10px]'} font-black uppercase text-white/60`}>
                        +
                    </span>
                </motion.button>
            ) : (
                <div
                    className={`${is5Aside ? 'w-12 h-12' : 'w-8 h-8'} rounded-full border border-dashed border-white/10 flex items-center justify-center`}
                >
                    <span className="text-[8px] font-black uppercase text-white/20">{role}</span>
                </div>
            )}
        </div>
    );
}
