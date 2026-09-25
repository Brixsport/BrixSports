'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

    const load = useCallback(async () => {
        const id = ++requestId.current;
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
            if (id === requestId.current) setIsLoading(false);
        }
    }, [url]);

    useEffect(() => {
        hasData.current = false;
        setData(null);
        setIsStale(false);
        setLoadError(null);
        setIsLoading(true);

        load();
        const interval = pollMs ? setInterval(load, pollMs) : undefined;
        const onOnline = () => { load(); };
        window.addEventListener('online', onOnline);

        return () => {
            requestId.current++;
            if (interval) clearInterval(interval);
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
