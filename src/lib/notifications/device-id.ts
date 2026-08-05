/**
 * Client-side device identity for anonymous push enrollment (BACKLOG-150).
 * Persisted in localStorage so the same browser reuses one id across visits.
 */
'use client';

const STORAGE_KEY = 'brixsports_device_id';

export function getDeviceId(): string {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
}
