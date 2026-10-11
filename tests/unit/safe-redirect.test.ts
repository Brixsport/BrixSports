import { describe, it, expect } from 'vitest';
import { safeCallbackPath } from '@/lib/safe-redirect';

describe('safeCallbackPath', () => {
    it('keeps plain same-origin paths, including query strings', () => {
        expect(safeCallbackPath('/profile')).toBe('/profile');
        expect(safeCallbackPath('/matches/abc?tab=events#top')).toBe('/matches/abc?tab=events#top');
    });

    it('falls back for missing values', () => {
        expect(safeCallbackPath(null)).toBe('/');
        expect(safeCallbackPath(undefined)).toBe('/');
        expect(safeCallbackPath('')).toBe('/');
        expect(safeCallbackPath('', '/home')).toBe('/home');
    });

    it('rejects javascript: and other schemes', () => {
        expect(safeCallbackPath('javascript:alert(1)')).toBe('/');
        expect(safeCallbackPath('data:text/html,<script>1</script>')).toBe('/');
        expect(safeCallbackPath('JaVaScRiPt:alert(1)')).toBe('/');
    });

    it('rejects absolute and protocol-relative URLs', () => {
        expect(safeCallbackPath('https://evil.example/login')).toBe('/');
        expect(safeCallbackPath('//evil.example')).toBe('/');
        expect(safeCallbackPath('/\\evil.example')).toBe('/');
    });

    it('rejects control characters that browsers strip before parsing', () => {
        expect(safeCallbackPath('/\t/evil.example')).toBe('/');
        expect(safeCallbackPath('/\n/evil.example')).toBe('/');
    });
});
