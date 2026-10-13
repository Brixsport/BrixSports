// Finds the staging preview deployment Vercel built for a commit and waits until it is ready.
//
// The smoke test creates and deletes real rows, so this must only ever return a preview of the
// staging project. The production project also builds a preview for every commit; its
// deployment is rejected both by environment name and by host name.
//
// Environment: GITHUB_TOKEN, GITHUB_REPOSITORY, HEAD_SHA, optional GITHUB_ENV (the URL is
// appended as BASE_URL), optional WAIT_MINUTES (default 12).
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const STAGING_ENVIRONMENT = /^Preview\s*[–—-]\s*brixsports-staging$/;

/** Newest deployment of the staging project's preview environment, or null. */
export function pickStagingDeployment(deployments) {
    const matching = (Array.isArray(deployments) ? deployments : [])
        .filter((d) => d && typeof d.environment === 'string' && STAGING_ENVIRONMENT.test(d.environment.trim()));
    matching.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return matching[0] || null;
}

/** Only an https vercel.app host that belongs to the staging project is acceptable. */
export function isStagingPreviewUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app') && url.hostname.startsWith('brixsports-staging-');
    } catch {
        return false;
    }
}

/** What to do with the statuses of one deployment (newest first, as the API returns them). */
export function readDeploymentState(statuses) {
    const latest = Array.isArray(statuses) ? statuses[0] : null;
    if (!latest) return { state: 'pending' };
    if (latest.state === 'success') {
        return isStagingPreviewUrl(latest.environment_url)
            ? { state: 'ready', url: new URL(latest.environment_url).origin }
            : { state: 'rejected' };
    }
    if (latest.state === 'failure' || latest.state === 'error') return { state: 'failed' };
    return { state: 'pending' };
}

async function github(path) {
    const res = await fetch(`https://api.github.com${path}`, {
        headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });
    if (!res.ok) throw new Error(`GitHub API ${path.split('?')[0]} returned ${res.status}`);
    return res.json();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const { GITHUB_TOKEN, GITHUB_REPOSITORY, HEAD_SHA } = process.env;
    if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !HEAD_SHA) {
        console.error('GITHUB_TOKEN, GITHUB_REPOSITORY and HEAD_SHA are required');
        process.exit(1);
    }
    const deadline = Date.now() + Number(process.env.WAIT_MINUTES || 12) * 60_000;
    console.log(`Waiting for the staging preview of ${HEAD_SHA.slice(0, 7)}`);

    while (Date.now() < deadline) {
        try {
            const deployments = await github(`/repos/${GITHUB_REPOSITORY}/deployments?sha=${HEAD_SHA}&per_page=30`);
            const deployment = pickStagingDeployment(deployments);
            if (deployment) {
                const statuses = await github(`/repos/${GITHUB_REPOSITORY}/deployments/${deployment.id}/statuses?per_page=5`);
                const result = readDeploymentState(statuses);
                if (result.state === 'ready') {
                    console.log(`Preview ready: ${result.url}`);
                    if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `BASE_URL=${result.url}\n`);
                    return;
                }
                if (result.state === 'failed') {
                    console.error('The staging preview deployment failed; fix the build and push again.');
                    process.exit(1);
                }
                if (result.state === 'rejected') {
                    console.error('The preview URL is not a staging project preview; refusing to run the smoke test against it.');
                    process.exit(1);
                }
            }
        } catch (error) {
            console.log(`Lookup failed (${error.message}); retrying`);
        }
        await sleep(15_000);
    }
    console.error('Timed out waiting for the staging preview. Re-run the job once Vercel has finished building.');
    process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
