import { describe, it, expect } from 'vitest';
import { isAuthorizedApiKey } from '@/lib/api-key-guard';

describe('isAuthorizedApiKey (app side)', () => {
    it('accepts only the exact configured key', () => {
        expect(isAuthorizedApiKey('secret-key', 'secret-key')).toBe(true);
        expect(isAuthorizedApiKey('secret-key-2', 'secret-key')).toBe(false);
        expect(isAuthorizedApiKey('SECRET-KEY', 'secret-key')).toBe(false);
    });

    it('fails closed when the configured key is unset or empty', () => {
        expect(isAuthorizedApiKey(null, undefined)).toBe(false);
        expect(isAuthorizedApiKey(undefined, undefined)).toBe(false);
        expect(isAuthorizedApiKey(null, '')).toBe(false);
        expect(isAuthorizedApiKey('', '')).toBe(false);
        expect(isAuthorizedApiKey('anything', '')).toBe(false);
        expect(isAuthorizedApiKey('anything', undefined)).toBe(false);
    });

    it('rejects a missing or empty header when a key is configured', () => {
        expect(isAuthorizedApiKey(null, 'secret-key')).toBe(false);
        expect(isAuthorizedApiKey(undefined, 'secret-key')).toBe(false);
        expect(isAuthorizedApiKey('', 'secret-key')).toBe(false);
    });
});
