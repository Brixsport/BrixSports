/**
 * Pull to Refresh Hook
 * Provides pull-to-refresh functionality for mobile devices (especially iOS)
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePullToRefreshOptions {
    onRefresh: () => Promise<void> | void;
    threshold?: number;
    resistance?: number;
    enabled?: boolean;
}

export function usePullToRefresh({
    onRefresh,
    threshold = 80,
    resistance = 2.5,
    enabled = true,
}: UsePullToRefreshOptions) {
    const [isPulling, setIsPulling] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);

    const startY = useRef(0);
    const currentY = useRef(0);
    const containerRef = useRef<HTMLElement | null>(null);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (!enabled || isRefreshing) return;

        const container = containerRef.current;
        if (!container) return;

        // Only trigger if scrolled to top
        if (container.scrollTop === 0) {
            startY.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    }, [enabled, isRefreshing]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!enabled || !isPulling || isRefreshing) return;

        const container = containerRef.current;
        if (!container || container.scrollTop > 0) {
            setIsPulling(false);
            setPullDistance(0);
            return;
        }

        currentY.current = e.touches[0].clientY;
        const distance = currentY.current - startY.current;

        if (distance > 0) {
            // Prevent default scroll behavior when pulling down
            e.preventDefault();

            // Apply resistance to make it feel natural
            const resistedDistance = Math.min(distance / resistance, threshold * 1.5);
            setPullDistance(resistedDistance);
        }
    }, [enabled, isPulling, isRefreshing, resistance, threshold]);

    const handleTouchEnd = useCallback(async () => {
        if (!enabled || !isPulling) return;

        setIsPulling(false);

        if (pullDistance >= threshold && !isRefreshing) {
            setIsRefreshing(true);
            setPullDistance(threshold);

            try {
                await onRefresh();
            } catch (error) {
                console.error('Refresh error:', error);
            } finally {
                // Smooth transition back
                setTimeout(() => {
                    setIsRefreshing(false);
                    setPullDistance(0);
                }, 300);
            }
        } else {
            setPullDistance(0);
        }
    }, [enabled, isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !enabled) return;

        // Use passive: false to allow preventDefault
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

    return {
        containerRef,
        isPulling,
        isRefreshing,
        pullDistance,
        threshold,
    };
}
