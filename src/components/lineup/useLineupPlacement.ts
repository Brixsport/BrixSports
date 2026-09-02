'use client';

// BACKLOG-323 step 5: in-memory slot-placement state, zero persistence.
// Every consumer (admin builder, public /lineup-builder, future features)
// owns its own save/load -- this hook only ever tracks "which player is in
// which formation slot" for the current editing session and hands back a
// plain array via toPlacements(). It has no knowledge of matches, teams,
// auth, or storage -- that boundary is deliberate (see BACKLOG-323's
// "shared UI/interaction layer only" note).

import { useCallback, useState } from 'react';

export interface PlacementEntry {
    slotId: string;
    playerId: string;
    isCaptain?: boolean;
    isViceCaptain?: boolean;
}

export interface UseLineupPlacementOptions {
    formationId: string;
    /** Seed state -- e.g. loaded from an existing draft/published lineup. */
    initialPlacements?: PlacementEntry[];
    /** Player ids available but not currently in a slot (the bench). */
    initialBench?: string[];
}

export interface UseLineupPlacementResult {
    formationId: string;
    placements: PlacementEntry[];
    bench: string[];
    /** Places a player into a slot. Removes them from any other slot and from the bench first -- a player can only occupy one place at a time. */
    assign: (slotId: string, playerId: string) => void;
    /** Empties a slot, returning its player to the bench. No-op if the slot was already empty. */
    clear: (slotId: string) => void;
    /** Swaps whichever players occupy two slots (or moves one into an empty slot, clearing the source). */
    swap: (slotIdA: string, slotIdB: string) => void;
    /** Adds a player to the bench if not already placed or benched. */
    addToBench: (playerId: string) => void;
    /** Removes a player from the bench without placing them anywhere. */
    removeFromBench: (playerId: string) => void;
    setCaptain: (playerId: string) => void;
    setViceCaptain: (playerId: string) => void;
    /** Changes the formation id only -- does NOT clear placements. Stale slot
     * references (slots that don't exist in the new formation) are the
     * consumer's decision to handle -- e.g. a confirm dialog before calling
     * clearAll(), per BACKLOG-323's "formation-change confirm" risk note. */
    setFormationId: (formationId: string) => void;
    clearAll: () => void;
    /** The playerId currently in a slot, if any. */
    getPlayerAtSlot: (slotId: string) => string | undefined;
    /** The slotId a player currently occupies, if any (undefined if benched or unplaced). */
    getSlotForPlayer: (playerId: string) => string | undefined;
    toPlacements: () => PlacementEntry[];
}

export function useLineupPlacement({
    formationId: initialFormationId,
    initialPlacements = [],
    initialBench = [],
}: UseLineupPlacementOptions): UseLineupPlacementResult {
    const [formationId, setFormationIdState] = useState(initialFormationId);
    const [placements, setPlacements] = useState<PlacementEntry[]>(initialPlacements);
    const [bench, setBench] = useState<string[]>(initialBench);

    const assign = useCallback((slotId: string, playerId: string) => {
        setPlacements((prev) => {
            const withoutPlayerOrSlot = prev.filter((p) => p.playerId !== playerId && p.slotId !== slotId);
            const carryOver = prev.find((p) => p.playerId === playerId || p.slotId === slotId);
            return [
                ...withoutPlayerOrSlot,
                {
                    slotId,
                    playerId,
                    isCaptain: carryOver?.playerId === playerId ? carryOver.isCaptain : undefined,
                    isViceCaptain: carryOver?.playerId === playerId ? carryOver.isViceCaptain : undefined,
                },
            ];
        });
        setBench((prev) => prev.filter((id) => id !== playerId));
    }, []);

    const clear = useCallback((slotId: string) => {
        setPlacements((prev) => {
            const entry = prev.find((p) => p.slotId === slotId);
            if (entry) {
                setBench((b) => (b.includes(entry.playerId) ? b : [...b, entry.playerId]));
            }
            return prev.filter((p) => p.slotId !== slotId);
        });
    }, []);

    const swap = useCallback((slotIdA: string, slotIdB: string) => {
        if (slotIdA === slotIdB) return;
        setPlacements((prev) => {
            const a = prev.find((p) => p.slotId === slotIdA);
            const b = prev.find((p) => p.slotId === slotIdB);
            const rest = prev.filter((p) => p.slotId !== slotIdA && p.slotId !== slotIdB);
            const next: PlacementEntry[] = [...rest];
            if (a) next.push({ ...a, slotId: slotIdB });
            if (b) next.push({ ...b, slotId: slotIdA });
            return next;
        });
    }, []);

    const addToBench = useCallback((playerId: string) => {
        setBench((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));
    }, []);

    const removeFromBench = useCallback((playerId: string) => {
        setBench((prev) => prev.filter((id) => id !== playerId));
    }, []);

    const setCaptain = useCallback((playerId: string) => {
        setPlacements((prev) => prev.map((p) => ({ ...p, isCaptain: p.playerId === playerId })));
    }, []);

    const setViceCaptain = useCallback((playerId: string) => {
        setPlacements((prev) => prev.map((p) => ({ ...p, isViceCaptain: p.playerId === playerId })));
    }, []);

    const setFormationId = useCallback((next: string) => {
        setFormationIdState(next);
    }, []);

    const clearAll = useCallback(() => {
        setPlacements((prev) => {
            setBench((b) => {
                const returning = prev.map((p) => p.playerId).filter((id) => !b.includes(id));
                return [...b, ...returning];
            });
            return [];
        });
    }, []);

    const getPlayerAtSlot = useCallback(
        (slotId: string) => placements.find((p) => p.slotId === slotId)?.playerId,
        [placements],
    );

    const getSlotForPlayer = useCallback(
        (playerId: string) => placements.find((p) => p.playerId === playerId)?.slotId,
        [placements],
    );

    const toPlacements = useCallback(() => placements, [placements]);

    return {
        formationId,
        placements,
        bench,
        assign,
        clear,
        swap,
        addToBench,
        removeFromBench,
        setCaptain,
        setViceCaptain,
        setFormationId,
        clearAll,
        getPlayerAtSlot,
        getSlotForPlayer,
        toPlacements,
    };
}
