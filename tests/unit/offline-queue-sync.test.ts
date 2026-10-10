// BACKLOG-466 items 2/3: offline-queue honesty. Pure helpers from
// admin-offline-queue.ts plus the SW's response classifier, loaded from the
// shipped public/sw-admin.js (between its BEGIN/END sync-policy markers) so the
// test exercises the real code, not a copy.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { summarizeQueueRows, parseMatchEventSyncMessage } from '@/lib/admin-offline-queue';

function loadClassifier(): (status: number) => 'done' | 'retry' | 'failed' {
    const src = readFileSync(join(process.cwd(), 'public', 'sw-admin.js'), 'utf8');
    const match = src.match(/\/\/ BEGIN sync-policy([\s\S]*?)\/\/ END sync-policy/);
    if (!match) throw new Error('sync-policy markers not found in sw-admin.js');
    return new Function(`${match[1]}; return classifySyncResponse;`)();
}

describe('SW classifySyncResponse', () => {
    const classify = loadClassifier();

    it('deletes on any 2xx (including the idempotent-replay 200)', () => {
        for (const s of [200, 201, 204]) expect(classify(s)).toBe('done');
    });

    it('retries 408, 429 and every 5xx', () => {
        for (const s of [408, 429, 500, 502, 503, 504]) expect(classify(s)).toBe('retry');
    });

    it('marks other 4xx failed (never retried forever)', () => {
        for (const s of [400, 401, 403, 404, 409, 422]) expect(classify(s)).toBe('failed');
    });

    it('keeps unexpected non-2xx/4xx/5xx codes for retry', () => {
        for (const s of [0, 100, 304]) expect(classify(s)).toBe('retry');
    });
});

describe('summarizeQueueRows', () => {
    it('splits pending from failed', () => {
        expect(summarizeQueueRows([])).toEqual({ pending: 0, failed: 0 });
        expect(summarizeQueueRows([{}, { failed: true }, { failed: false }, { failed: true }])).toEqual({ pending: 2, failed: 2 });
    });
});

describe('parseMatchEventSyncMessage', () => {
    it('SYNC_COMPLETE means an empty queue', () => {
        expect(parseMatchEventSyncMessage({ type: 'SYNC_COMPLETE', tag: 'sync-match-events' })).toEqual({ pending: 0, failed: 0 });
    });

    it('SYNC_PARTIAL carries remaining + failed (badge = both, never zeroed)', () => {
        expect(parseMatchEventSyncMessage({ type: 'SYNC_PARTIAL', tag: 'sync-match-events', remaining: 3, failed: 1 })).toEqual({ pending: 3, failed: 1 });
    });

    it('is defensive about malformed counts', () => {
        expect(parseMatchEventSyncMessage({ type: 'SYNC_PARTIAL', tag: 'sync-match-events' })).toEqual({ pending: 0, failed: 0 });
        expect(parseMatchEventSyncMessage({ type: 'SYNC_PARTIAL', tag: 'sync-match-events', remaining: -4, failed: 'x' })).toEqual({ pending: 0, failed: 0 });
    });

    it('ignores other tags and unrelated messages', () => {
        expect(parseMatchEventSyncMessage({ type: 'SYNC_COMPLETE', tag: 'sync-admin-changes' })).toBeNull();
        expect(parseMatchEventSyncMessage({ type: 'OTHER', tag: 'sync-match-events' })).toBeNull();
        expect(parseMatchEventSyncMessage(null)).toBeNull();
        expect(parseMatchEventSyncMessage(undefined)).toBeNull();
    });
});
