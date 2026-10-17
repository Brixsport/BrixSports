// BUG-244 structural fix: stamps public/sw-user.js and public/sw-admin.js
// with a build-unique CACHE_VERSION before `next build` runs, so every
// deploy is a genuinely different SW script and stale-precache (the root
// cause of BUG-244) can't happen again from a forgotten manual bump.
//
// On Vercel this mutates a fresh ephemeral checkout only -- nothing gets
// committed back to git. Running `npm run build` locally will leave an
// uncommitted diff in the two SW files; that's expected, just don't commit it.
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now().toString(36)}`).slice(0, 12);

const targets = [
    { file: 'sw-user.js', prefix: 'brixsport-user' },
    { file: 'sw-admin.js', prefix: 'brixsport-admin' },
];

for (const { file, prefix } of targets) {
    const path = join(publicDir, file);
    const source = readFileSync(path, 'utf8');
    const pattern = new RegExp(`const CACHE_VERSION = '${prefix}-[^']+';`);

    if (!pattern.test(source)) {
        console.error(`inject-sw-cache-version: could not find CACHE_VERSION line in ${file}, aborting build`);
        process.exit(1);
    }

    const updated = source.replace(pattern, `const CACHE_VERSION = '${prefix}-${buildId}';`);
    writeFileSync(path, updated, 'utf8');
    console.log(`inject-sw-cache-version: ${file} -> ${prefix}-${buildId}`);
}
