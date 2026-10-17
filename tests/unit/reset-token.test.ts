import { describe, it, expect } from 'vitest';
import { generateResetToken, hashResetToken } from '@/lib/reset-token';

describe('reset token', () => {
    it('generates 256-bit hex tokens that differ each time', () => {
        const a = generateResetToken();
        expect(a).toMatch(/^[0-9a-f]{64}$/);
        expect(generateResetToken()).not.toBe(a);
    });

    it('hashes deterministically and never returns the raw token', () => {
        const token = generateResetToken();
        const hash = hashResetToken(token);
        expect(hash).toBe(hashResetToken(token));
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(hash).not.toBe(token);
        expect(hashResetToken(generateResetToken())).not.toBe(hash);
    });

    it('matches the known SHA-256 of a fixed input', () => {
        expect(hashResetToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
});
