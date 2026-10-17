import { describe, it, expect } from 'vitest';
import { validateSettingValue } from '@/lib/settings-validation';

describe('validateSettingValue', () => {
    it('rejects non-scalar values instead of throwing', () => {
        expect(validateSettingValue('features.ads.enabled', 'boolean', null).ok).toBe(false);
        expect(validateSettingValue('features.ads.enabled', 'boolean', { a: 1 }).ok).toBe(false);
        expect(validateSettingValue('x', 'string', ['a']).ok).toBe(false);
    });

    it('accepts and normalises booleans', () => {
        expect(validateSettingValue('f', 'boolean', 'TRUE')).toEqual({ ok: true, value: 'true' });
        expect(validateSettingValue('f', 'boolean', false)).toEqual({ ok: true, value: 'false' });
        expect(validateSettingValue('f', 'boolean', 'yes').ok).toBe(false);
    });

    it('validates numbers', () => {
        expect(validateSettingValue('n', 'number', '0.5')).toEqual({ ok: true, value: '0.5' });
        expect(validateSettingValue('n', 'number', 3)).toEqual({ ok: true, value: '3' });
        expect(validateSettingValue('n', 'number', 'abc').ok).toBe(false);
        expect(validateSettingValue('n', 'number', '').ok).toBe(false);
    });

    it('validates the current season format', () => {
        expect(validateSettingValue('system.season.current', 'string', '2026/2027').ok).toBe(true);
        expect(validateSettingValue('system.season.current', 'string', '2026').ok).toBe(false);
        expect(validateSettingValue('system.season.current', 'string', '2026/2028').ok).toBe(false);
        expect(validateSettingValue('system.season.current', 'string', '2026-2027').ok).toBe(false);
        expect(validateSettingValue('other.key', 'string', 'anything').ok).toBe(true);
    });
});
