'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { startVisiblePolling } from '@/lib/visible-poll';
import { shouldSkipPollTick } from '@/lib/request-gate';

export type ResilientLoadError = 'not-found' | 'load-failed';

interface UseResilientFetchOptions<T> {
    // A 200 whose body fails this check is treated as a failed load, not as data.
    validate?: (body: unknown) => body is T;
    pollMs?: number;
}

// Read-path fetch state for viewer pages: a failed fetch is never allowed to
// masquerade as "empty" or "not found", and previously loaded data is never
// overwritten by a later failure.
export function useResilientFetch<T>(url: string, options: UseResilientFetchOptions<T> = {}) {
    const { validate, pollMs } = options;
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStale, setIsStale] = useState(false);
    const [loadError, setLoadError] = useState<ResilientLoadError | null>(null);

    const hasData = useRef(false);
    const requestId = useRef(0);
    const validateRef = useRef(validate);
    validateRef.current = validate;

    // Start time of the request currently running, or null when idle.
    const inFlightSince = useRef<number | null>(null);

    // A poll tick (`fromPoll`) is skipped while the previous request is still running, so a response that
    // takes longer than the poll interval is applied instead of being superseded by the next tick forever.
    // Every other caller (first load, retry, back online, url change) always starts a fresh request.
    const load = useCallback(async (fromPoll = false) => {
        if (fromPoll && shouldSkipPollTick(inFlightSince.current, Date.now())) return;
        const id = ++requestId.current;
        inFlightSince.current = Date.now();
        try {
            const response = await fetch(url);
            if (id !== requestId.current) return;

            if (response.status === 404) {
                hasData.current = false;
                setData(null);
                setIsStale(false);
                setLoadError('not-found');
                return;
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const body: unknown = await response.json();
            if (id !== requestId.current) return;
            if (validateRef.current && !validateRef.current(body)) {
                throw new Error('Unexpected response shape');
            }

            hasData.current = true;
            setData(body as T);
            setIsStale(false);
            setLoadError(null);
        } catch (error) {
            if (id !== requestId.current) return;
            console.error(`Error fetching ${url}:`, error);
            if (hasData.current) setIsStale(true);
            else setLoadError('load-failed');
        } finally {
            if (id === requestId.current) {
                inFlightSince.current = null;
                setIsLoading(false);
            }
        }
    }, [url]);

    useEffect(() => {
        hasData.current = false;
        setData(null);
        setIsStale(false);
        setLoadError(null);
        setIsLoading(true);

        load();
        // Jittered, paused while the tab is hidden, immediate refetch when it becomes visible again.
        const stopPolling = pollMs ? startVisiblePolling(() => { load(true); }, pollMs) : undefined;
        const onOnline = () => { load(); };
        window.addEventListener('online', onOnline);

        return () => {
            requestId.current++;
            inFlightSince.current = null;
            if (stopPolling) stopPolling();
            window.removeEventListener('online', onOnline);
        };
    }, [load, pollMs]);

    const retry = useCallback(() => {
        setLoadError(null);
        setIsLoading(true);
        load();
    }, [load]);

    return { data, isLoading, isStale, loadError, retry };
}
