import { describe, it, expect } from 'vitest';
import { parseWsEnv, resolveWsEnv } from '@/lib/ws-env';

describe('parseWsEnv', () => {
    it('accepts prod and staging, ignoring case and whitespace', () => {
        expect(parseWsEnv('prod')).toBe('prod');
        expect(parseWsEnv(' Staging ')).toBe('staging');
    });

    it('returns null for anything else', () => {
        for (const v of [undefined, null, '', 'production', 'dev', 'x']) expect(parseWsEnv(v)).toBeNull();
    });
});

describe('resolveWsEnv', () => {
    it('lets an explicit value override the URL heuristic in both directions', () => {
        expect(resolveWsEnv('staging', 'https://brixsports.com')).toMatchObject({ env: 'staging', source: 'explicit' });
        expect(resolveWsEnv('prod', 'https://brixsports-staging.vercel.app')).toMatchObject({ env: 'prod', source: 'explicit' });
    });

    it('does not flag a preview risk once the value is explicit', () => {
        expect(resolveWsEnv('prod', 'https://some-preview.vercel.app').previewMayHitProd).toBe(false);
    });

    it('keeps the existing heuristic when unset: the two staging hostnames are staging', () => {
        expect(resolveWsEnv('', 'https://brixsports-staging.vercel.app')).toMatchObject({ env: 'staging', source: 'heuristic', previewMayHitProd: false });
        expect(resolveWsEnv(undefined, 'https://staging.brixsports.com')).toMatchObject({ env: 'staging' });
    });

    it('keeps defaulting to prod, and flags a *.vercel.app URL that lands there', () => {
        expect(resolveWsEnv('', 'https://brixsports.com')).toMatchObject({ env: 'prod', previewMayHitProd: false });
        expect(resolveWsEnv('', 'https://brixsports-git-feature-x-team.vercel.app')).toMatchObject({ env: 'prod', previewMayHitProd: true });
        expect(resolveWsEnv('', 'brixsports-git-feature-x-team.vercel.app')).toMatchObject({ previewMayHitProd: true });
    });

    it('ignores an invalid explicit value and falls back to the heuristic', () => {
        expect(resolveWsEnv('production', 'https://brixsports.com')).toMatchObject({ env: 'prod', source: 'heuristic' });
    });
});
