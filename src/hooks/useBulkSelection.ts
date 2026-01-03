import { useState, useCallback } from 'react';

export function useBulkSelection<T extends { id: string }>(items: T[]) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    const toggleAll = useCallback(() => {
        if (selectedIds.size === items.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map((item) => item.id)));
        }
    }, [items, selectedIds.size]);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const isSelected = useCallback(
        (id: string) => selectedIds.has(id),
        [selectedIds]
    );

    const isAllSelected = items.length > 0 && selectedIds.size === items.length;
    const isSomeSelected = selectedIds.size > 0 && selectedIds.size < items.length;

    return {
        selectedIds: Array.from(selectedIds),
        selectedCount: selectedIds.size,
        toggleSelection,
        toggleAll,
        clearSelection,
        isSelected,
        isAllSelected,
        isSomeSelected,
    };
}
