import { describe, it, expect } from 'vitest';
import { generateOAuthState, oauthStatesMatch, shouldDropPasswordOnGoogleMerge } from '@/lib/google-oauth';

describe('oauth state', () => {
    it('generates distinct unguessable values', () => {
        const a = generateOAuthState();
        const b = generateOAuthState();
        expect(a).not.toBe(b);
        expect(a).toMatch(/^[0-9a-f]{48}$/);
    });

    it('matches only identical, present values', () => {
        const state = generateOAuthState();
        expect(oauthStatesMatch(state, state)).toBe(true);
        expect(oauthStatesMatch(state, generateOAuthState())).toBe(false);
        expect(oauthStatesMatch(state, state + 'x')).toBe(false);
        expect(oauthStatesMatch(null, state)).toBe(false);
        expect(oauthStatesMatch(state, undefined)).toBe(false);
        expect(oauthStatesMatch('', '')).toBe(false);
    });
});

describe('shouldDropPasswordOnGoogleMerge', () => {
    it('drops the password of an existing account that has one', () => {
        expect(shouldDropPasswordOnGoogleMerge({ password: '$2b$10$hash' })).toBe(true);
    });

    it('drops the password while the email is not yet verified', () => {
        expect(shouldDropPasswordOnGoogleMerge({ password: '$2b$10$hash', emailVerified: false })).toBe(true);
        expect(shouldDropPasswordOnGoogleMerge({ password: '$2b$10$hash', emailVerified: null })).toBe(true);
    });

    it('keeps the password of an account whose email is already verified', () => {
        expect(shouldDropPasswordOnGoogleMerge({ password: '$2b$10$hash', emailVerified: true })).toBe(false);
    });

    it('leaves password-less accounts and new sign-ups alone', () => {
        expect(shouldDropPasswordOnGoogleMerge({ password: null })).toBe(false);
        expect(shouldDropPasswordOnGoogleMerge({ password: '' })).toBe(false);
        expect(shouldDropPasswordOnGoogleMerge(undefined)).toBe(false);
        expect(shouldDropPasswordOnGoogleMerge(null)).toBe(false);
    });
});
