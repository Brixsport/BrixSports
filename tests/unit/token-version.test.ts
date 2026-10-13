import { describe, it, expect } from 'vitest';
import { tokenVersionFromClaim, isTokenVersionCurrent, nextEmailVerified } from '@/lib/token-version';

describe('tokenVersionFromClaim', () => {
    it('treats a missing claim as version 0', () => {
        expect(tokenVersionFromClaim(undefined)).toBe(0);
        expect(tokenVersionFromClaim(null)).toBe(0);
    });

    it('returns a valid claim unchanged', () => {
        expect(tokenVersionFromClaim(0)).toBe(0);
        expect(tokenVersionFromClaim(7)).toBe(7);
    });

    it('maps malformed claims to a value that can never match a stored version', () => {
        for (const bad of ['1', 1.5, -1, NaN, {}, [], true]) {
            expect(tokenVersionFromClaim(bad)).toBe(-1);
        }
    });
});

describe('isTokenVersionCurrent', () => {
    it('keeps tokens without a claim valid while the stored version is 0', () => {
        expect(isTokenVersionCurrent(undefined, 0)).toBe(true);
    });

    it('rejects a token without a claim once the stored version has been bumped', () => {
        expect(isTokenVersionCurrent(undefined, 1)).toBe(false);
    });

    it('accepts only an exact match', () => {
        expect(isTokenVersionCurrent(3, 3)).toBe(true);
        expect(isTokenVersionCurrent(2, 3)).toBe(false);
        expect(isTokenVersionCurrent(4, 3)).toBe(false);
    });

    it('rejects a malformed claim even when the stored value is 0', () => {
        expect(isTokenVersionCurrent('0', 0)).toBe(false);
    });

    it('treats a missing stored value as 0', () => {
        expect(isTokenVersionCurrent(0, null)).toBe(true);
        expect(isTokenVersionCurrent(undefined, undefined)).toBe(true);
        expect(isTokenVersionCurrent(1, null)).toBe(false);
    });
});

describe('nextEmailVerified', () => {
    it('sets the flag on Google sign-in and on password reset', () => {
        expect(nextEmailVerified(false, 'google_sign_in')).toBe(true);
        expect(nextEmailVerified(false, 'password_reset')).toBe(true);
        expect(nextEmailVerified(null, 'password_reset')).toBe(true);
    });

    it('never clears an already verified flag', () => {
        expect(nextEmailVerified(true, 'google_sign_in')).toBe(true);
        expect(nextEmailVerified(true, 'password_reset')).toBe(true);
    });
});
