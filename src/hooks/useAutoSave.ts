import { useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveOptions {
    data: any;
    onSave: (data: any) => Promise<void>;
    delay?: number;
    enabled?: boolean;
}

export function useAutoSave({ data, onSave, delay = 3000, enabled = true }: UseAutoSaveOptions) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const previousDataRef = useRef<any>(data);
    const isSavingRef = useRef(false);

    const save = useCallback(async () => {
        if (isSavingRef.current) return;

        try {
            isSavingRef.current = true;
            await onSave(data);
            previousDataRef.current = data;
        } catch (error) {
            console.error('Auto-save failed:', error);
        } finally {
            isSavingRef.current = false;
        }
    }, [data, onSave]);

    useEffect(() => {
        if (!enabled) return;

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Check if data has changed
        const hasChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current);

        if (hasChanged) {
            // Set new timeout for auto-save
            timeoutRef.current = setTimeout(() => {
                save();
            }, delay);
        }

        // Cleanup
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [data, delay, enabled, save]);

    return { isSaving: isSavingRef.current };
}
