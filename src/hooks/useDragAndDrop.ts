import { useState, useCallback } from 'react';

export interface DragItem {
    type: 'player' | 'position';
    playerId?: string;
    slotIndex?: number;
    player?: any;
}

export function useDragAndDrop() {
    const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
    const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

    const handleDragStart = useCallback((item: DragItem) => {
        setDraggedItem(item);
    }, []);

    const handleDragEnd = useCallback(() => {
        setDraggedItem(null);
        setDragOverSlot(null);
    }, []);

    const handleDragOver = useCallback((slotIndex: number) => {
        setDragOverSlot(slotIndex);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverSlot(null);
    }, []);

    const handleDrop = useCallback((
        targetSlotIndex: number,
        onSwap: (fromIndex: number, toIndex: number) => void,
        onAdd: (slotIndex: number, player: any) => void
    ) => {
        if (!draggedItem) return;

        if (draggedItem.type === 'position' && draggedItem.slotIndex !== undefined) {
            // Swapping players between positions
            onSwap(draggedItem.slotIndex, targetSlotIndex);
        } else if (draggedItem.type === 'player' && draggedItem.player) {
            // Adding new player from selector
            onAdd(targetSlotIndex, draggedItem.player);
        }

        setDraggedItem(null);
        setDragOverSlot(null);
    }, [draggedItem]);

    return {
        draggedItem,
        dragOverSlot,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    };
}
