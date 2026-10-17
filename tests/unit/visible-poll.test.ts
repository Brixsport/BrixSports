import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startVisiblePolling } from '@/lib/visible-poll';

function makeDeps(initialVisible = true, randomValue = 0.5) {
    let visible = initialVisible;
    const listeners = new Set<() => void>();
    return {
        deps: {
            isVisible: () => visible,
            onVisibilityChange: (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
            random: () => randomValue,
        },
        setVisible(v: boolean) { visible = v; listeners.forEach((l) => l()); },
        listenerCount: () => listeners.size,
    };
}

describe('startVisiblePolling', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('ticks on the interval while visible (no jitter at random 0.5)', () => {
        const { deps } = makeDeps(true, 0.5);
        const tick = vi.fn();
        const stop = startVisiblePolling(tick, 5000, { deps });
        vi.advanceTimersByTime(4999);
        expect(tick).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(tick).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(5000);
        expect(tick).toHaveBeenCalledTimes(2);
        stop();
    });

    it('applies jitter within +-20% of the interval', () => {
        const low = makeDeps(true, 0);
        const tickLow = vi.fn();
        const stopLow = startVisiblePolling(tickLow, 10000, { deps: low.deps });
        vi.advanceTimersByTime(7999);
        expect(tickLow).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(tickLow).toHaveBeenCalledTimes(1);
        stopLow();

        const high = makeDeps(true, 1);
        const tickHigh = vi.fn();
        const stopHigh = startVisiblePolling(tickHigh, 10000, { deps: high.deps });
        vi.advanceTimersByTime(11999);
        expect(tickHigh).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(tickHigh).toHaveBeenCalledTimes(1);
        stopHigh();
    });

    it('does not poll while the tab is hidden, and fetches immediately when it becomes visible', () => {
        const ctl = makeDeps(true, 0.5);
        const tick = vi.fn();
        const stop = startVisiblePolling(tick, 5000, { deps: ctl.deps });
        ctl.setVisible(false);
        vi.advanceTimersByTime(60000);
        expect(tick).not.toHaveBeenCalled();
        ctl.setVisible(true);
        expect(tick).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(5000);
        expect(tick).toHaveBeenCalledTimes(2);
        stop();
    });

    it('starts idle when the tab is already hidden and resumes on visible', () => {
        const ctl = makeDeps(false, 0.5);
        const tick = vi.fn();
        const stop = startVisiblePolling(tick, 5000, { deps: ctl.deps });
        vi.advanceTimersByTime(20000);
        expect(tick).not.toHaveBeenCalled();
        ctl.setVisible(true);
        expect(tick).toHaveBeenCalledTimes(1);
        stop();
    });

    it('re-reads the interval each cycle when it is a function', () => {
        const { deps } = makeDeps(true, 0.5);
        let ms = 15000;
        const tick = vi.fn();
        const stop = startVisiblePolling(tick, () => ms, { deps });
        vi.advanceTimersByTime(15000);
        expect(tick).toHaveBeenCalledTimes(1);
        ms = 5000;
        vi.advanceTimersByTime(15000);
        expect(tick).toHaveBeenCalledTimes(2);
        vi.advanceTimersByTime(5000);
        expect(tick).toHaveBeenCalledTimes(3);
        stop();
    });

    it('stop() cancels the timer and unsubscribes', () => {
        const ctl = makeDeps(true, 0.5);
        const tick = vi.fn();
        const stop = startVisiblePolling(tick, 5000, { deps: ctl.deps });
        expect(ctl.listenerCount()).toBe(1);
        stop();
        expect(ctl.listenerCount()).toBe(0);
        vi.advanceTimersByTime(30000);
        expect(tick).not.toHaveBeenCalled();
        ctl.setVisible(true);
        expect(tick).not.toHaveBeenCalled();
    });
});
