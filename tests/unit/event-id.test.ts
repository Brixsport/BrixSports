// BACKLOG-466 item 1: client event id validator / generator (idempotency key).
import { describe, it, expect } from 'vitest';
import { isValidClientEventId, generateClientEventId } from '@/lib/event-id';

describe('isValidClientEventId', () => {
    it('accepts the football temp id format and nanoid-style ids', () => {
        expect(isValidClientEventId('temp_1760000000000_abc123xyz')).toBe(true);
        expect(isValidClientEventId('V1StGXR8_Z5jdHi6B-myT')).toBe(true);
    });

    it('accepts the length boundaries (8 and 64)', () => {
        expect(isValidClientEventId('a'.repeat(8))).toBe(true);
        expect(isValidClientEventId('a'.repeat(64))).toBe(true);
        expect(isValidClientEventId('a'.repeat(7))).toBe(false);
        expect(isValidClientEventId('a'.repeat(65))).toBe(false);
    });

    it('rejects non-strings and unsafe characters', () => {
        expect(isValidClientEventId(undefined)).toBe(false);
        expect(isValidClientEventId(null)).toBe(false);
        expect(isValidClientEventId(12345678)).toBe(false);
        expect(isValidClientEventId('')).toBe(false);
        expect(isValidClientEventId('e1')).toBe(false);
        expect(isValidClientEventId('has space 12345')).toBe(false);
        expect(isValidClientEventId("quote'; DROP TABLE x;--")).toBe(false);
        expect(isValidClientEventId('abc/../def12345')).toBe(false);
        expect(isValidClientEventId('line\nbreak12345')).toBe(false);
    });
});

describe('generateClientEventId', () => {
    it('produces ids that pass the validator and are unique', () => {
        const ids = new Set<string>();
        for (let i = 0; i < 200; i++) {
            const id = generateClientEventId();
            expect(isValidClientEventId(id)).toBe(true);
            ids.add(id);
        }
        expect(ids.size).toBe(200);
    });

    it('honours a prefix', () => {
        expect(generateClientEventId('bk').startsWith('bk_')).toBe(true);
    });
});
