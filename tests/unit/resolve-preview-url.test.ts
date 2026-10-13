import { describe, it, expect } from 'vitest';
import { pickStagingDeployment, isStagingPreviewUrl, readDeploymentState } from '../../scripts/ci/resolve-preview-url.mjs';

const stagingEnv = 'Preview – brixsports-staging';
const prodEnv = 'Preview – brixs2';

describe('pickStagingDeployment', () => {
    it('never picks the production project preview', () => {
        const picked = pickStagingDeployment([
            { id: 1, environment: prodEnv, created_at: '2026-10-13T10:00:00Z' },
            { id: 2, environment: stagingEnv, created_at: '2026-10-13T09:00:00Z' },
        ]);
        expect(picked.id).toBe(2);
    });

    it('returns null when only the production preview exists', () => {
        expect(pickStagingDeployment([{ id: 1, environment: prodEnv, created_at: '2026-10-13T10:00:00Z' }])).toBeNull();
    });

    it('takes the newest staging deployment and accepts a plain hyphen', () => {
        const picked = pickStagingDeployment([
            { id: 1, environment: 'Preview - brixsports-staging', created_at: '2026-10-13T09:00:00Z' },
            { id: 2, environment: stagingEnv, created_at: '2026-10-13T11:00:00Z' },
        ]);
        expect(picked.id).toBe(2);
    });

    it('does not match a production environment that merely contains the name', () => {
        expect(pickStagingDeployment([{ id: 3, environment: 'Production – brixsports-staging' }])).toBeNull();
        expect(pickStagingDeployment(null)).toBeNull();
    });
});

describe('isStagingPreviewUrl', () => {
    it('accepts a staging project preview host', () => {
        expect(isStagingPreviewUrl('https://brixsports-staging-abc123-brixsports-projects.vercel.app')).toBe(true);
    });

    it('rejects the production project, other hosts, and plain http', () => {
        expect(isStagingPreviewUrl('https://brixs2-abc123-team.vercel.app')).toBe(false);
        expect(isStagingPreviewUrl('https://brixsports.com')).toBe(false);
        expect(isStagingPreviewUrl('http://brixsports-staging-abc.vercel.app')).toBe(false);
        expect(isStagingPreviewUrl('https://brixsports-staging-abc.vercel.app.evil.example')).toBe(false);
        expect(isStagingPreviewUrl('not a url')).toBe(false);
    });
});

describe('readDeploymentState', () => {
    const url = 'https://brixsports-staging-abc-brixsports-projects.vercel.app/some/path';

    it('is ready with the origin only when the newest status succeeded', () => {
        expect(readDeploymentState([{ state: 'success', environment_url: url }]))
            .toEqual({ state: 'ready', url: 'https://brixsports-staging-abc-brixsports-projects.vercel.app' });
    });

    it('waits while building and when no status exists yet', () => {
        expect(readDeploymentState([{ state: 'pending' }]).state).toBe('pending');
        expect(readDeploymentState([{ state: 'in_progress' }]).state).toBe('pending');
        expect(readDeploymentState([]).state).toBe('pending');
    });

    it('fails on a failed or errored deployment', () => {
        expect(readDeploymentState([{ state: 'failure' }]).state).toBe('failed');
        expect(readDeploymentState([{ state: 'error' }]).state).toBe('failed');
    });

    it('rejects a successful deployment whose URL is not a staging preview', () => {
        expect(readDeploymentState([{ state: 'success', environment_url: 'https://brixs2-x.vercel.app' }]).state).toBe('rejected');
    });
});
