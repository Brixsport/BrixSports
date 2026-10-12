import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { MAX_ID_LENGTH, MAX_ROOMS_PER_SOCKET, isValidId, asObject, getMatchId, guarded, canJoinRoom } =
    require('../../ws-server/payload-guard.js');

describe('isValidId', () => {
    it('accepts a non-empty string up to the length cap', () => {
        expect(isValidId('abc')).toBe(true);
        expect(isValidId('x'.repeat(MAX_ID_LENGTH))).toBe(true);
    });

    it('rejects empty, oversized and non-string values', () => {
        expect(isValidId('')).toBe(false);
        expect(isValidId('x'.repeat(MAX_ID_LENGTH + 1))).toBe(false);
        for (const v of [undefined, null, 0, 12345, true, {}, [], ['a']]) expect(isValidId(v)).toBe(false);
    });
});

describe('asObject / getMatchId', () => {
    it('returns the object for a plain object payload and null for anything else', () => {
        const o = { matchId: 'm1' };
        expect(asObject(o)).toBe(o);
        for (const v of [undefined, null, 'str', 42, true, []]) expect(asObject(v)).toBeNull();
    });

    it('extracts a valid matchId', () => {
        expect(getMatchId({ matchId: 'm1' })).toBe('m1');
    });

    it('returns null for a missing or malformed payload or matchId', () => {
        expect(getMatchId(undefined)).toBeNull();
        expect(getMatchId(null)).toBeNull();
        expect(getMatchId('m1')).toBeNull();
        expect(getMatchId([])).toBeNull();
        expect(getMatchId({})).toBeNull();
        expect(getMatchId({ matchId: 12 })).toBeNull();
        expect(getMatchId({ matchId: '' })).toBeNull();
        expect(getMatchId({ matchId: 'x'.repeat(MAX_ID_LENGTH + 1) })).toBeNull();
    });
});

describe('guarded', () => {
    it('passes arguments through to the handler', () => {
        const handler = vi.fn();
        guarded('evt', handler)({ matchId: 'm1' }, 'extra');
        expect(handler).toHaveBeenCalledWith({ matchId: 'm1' }, 'extra');
    });

    it('swallows a synchronous throw and logs it', () => {
        const log = vi.fn();
        const wrapped = guarded('evt', () => { throw new Error('boom'); }, log);
        expect(() => wrapped()).not.toThrow();
        expect(log).toHaveBeenCalledTimes(1);
    });

    it('catches a rejected promise from an async handler', async () => {
        const log = vi.fn();
        const wrapped = guarded('evt', async () => { throw new Error('async boom'); }, log);
        expect(() => wrapped()).not.toThrow();
        await new Promise((r) => setTimeout(r, 0));
        expect(log).toHaveBeenCalledTimes(1);
    });

    it('survives the handler shape that crashed the server (destructuring an absent payload)', () => {
        const log = vi.fn();
        const wrapped = guarded('match:subscribe', ({ matchId }: { matchId: string }) => matchId, log);
        expect(() => wrapped()).not.toThrow();
        expect(log).toHaveBeenCalledTimes(1);
    });
});

describe('canJoinRoom', () => {
    it('allows joins below the cap and refuses new rooms at the cap', () => {
        const rooms = new Set<string>();
        for (let i = 0; i < MAX_ROOMS_PER_SOCKET - 1; i++) rooms.add(`r${i}`);
        expect(canJoinRoom(rooms, 'new-room')).toBe(true);
        rooms.add('last');
        expect(rooms.size).toBe(MAX_ROOMS_PER_SOCKET);
        expect(canJoinRoom(rooms, 'one-too-many')).toBe(false);
    });

    it('always allows re-joining a room the socket is already in', () => {
        const rooms = new Set<string>(Array.from({ length: MAX_ROOMS_PER_SOCKET }, (_, i) => `r${i}`));
        expect(canJoinRoom(rooms, 'r3')).toBe(true);
    });
});
