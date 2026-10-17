import { describe, it, expect } from 'vitest';
import { isValidBearerSecret } from '@/lib/notifications/cron-auth';

describe('isValidBearerSecret', () => {
    it('accepts the exact bearer token', () => {
        expect(isValidBearerSecret('Bearer s3cret-value', 's3cret-value')).toBe(true);
    });

    it('rejects a wrong token of the same length', () => {
        expect(isValidBearerSecret('Bearer s3cret-valuf', 's3cret-value')).toBe(false);
    });

    it('rejects a wrong token of a different length', () => {
        expect(isValidBearerSecret('Bearer short', 's3cret-value')).toBe(false);
        expect(isValidBearerSecret('Bearer s3cret-value-and-more', 's3cret-value')).toBe(false);
    });

    it('rejects a missing header or a header without the Bearer scheme', () => {
        expect(isValidBearerSecret(null, 's3cret-value')).toBe(false);
        expect(isValidBearerSecret(undefined, 's3cret-value')).toBe(false);
        expect(isValidBearerSecret('s3cret-value', 's3cret-value')).toBe(false);
    });

    it('fails closed when the secret is unset or empty', () => {
        expect(isValidBearerSecret('Bearer ', '')).toBe(false);
        expect(isValidBearerSecret('Bearer undefined', undefined)).toBe(false);
        expect(isValidBearerSecret('Bearer ', null)).toBe(false);
    });
});
