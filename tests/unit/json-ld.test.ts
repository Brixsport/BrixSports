import { describe, it, expect } from 'vitest';
import { serializeJsonLd } from '@/lib/json-ld';

describe('serializeJsonLd', () => {
    it('never emits a raw "<", so a closing script tag cannot appear', () => {
        const out = serializeJsonLd({ headline: '</script><script>alert(1)</script>' });
        expect(out).not.toContain('<');
        expect(out).not.toContain('</script>');
    });

    it('round-trips to the same value', () => {
        const data = { a: '</script>', b: 'x\u2028y\u2029z', c: [1, { d: '<!--' }], e: null };
        expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
    });

    it('escapes the U+2028 and U+2029 line separators', () => {
        const out = serializeJsonLd({ t: 'a\u2028b\u2029c' });
        expect(out).not.toMatch(/[\u2028\u2029]/);
    });
});
