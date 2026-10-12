// config.js - shared configuration for the BrixSports k6 suite.
//
// Everything environment-specific comes from __ENV (k6 `-e KEY=value` or the
// shell environment). Nothing secret is hardcoded here. See README.md.
//
// Target: STAGING ONLY (Vercel project brixsports-staging, `dev` branch deployment,
// staging Turso DB). The staging guard below refuses to start against anything else.

const env = (k, d) => (__ENV[k] !== undefined && __ENV[k] !== '' ? __ENV[k] : d);
const num = (k, d) => {
    const v = parseFloat(env(k, ''));
    return Number.isFinite(v) ? v : d;
};
const list = (k) => env(k, '').split(',').map((s) => s.trim()).filter(Boolean);

// ---------------------------------------------------------------- target + guard
export const BASE_URL = env('BASE_URL', '').replace(/\/+$/, '');

// Hard block: production project (brixs2) and the production apex/www hosts.
// These can NOT be overridden by any env var.
const PROD_BLOCK = [/brixs2/i, /^https?:\/\/(www\.)?brixsports\.com(\/|$|:)/i];
// Allow-list (overridable, but only for a regex that still excludes PROD_BLOCK).
// Defaults match the hosts the codebase itself calls "staging":
// staging.brixsports.com and brixsports-staging.vercel.app.
const ALLOW = new RegExp(env('ALLOWED_HOST_REGEX', 'brixsports-staging|staging\\.brixsports\\.com'), 'i');

function assertStaging() {
    if (!BASE_URL) {
        throw new Error('BASE_URL is required (staging deployment URL). Refusing to run.');
    }
    if (env('CONFIRM_STAGING', '') !== 'yes') {
        throw new Error('Set CONFIRM_STAGING=yes to acknowledge this suite writes data and must hit STAGING only.');
    }
    for (const re of PROD_BLOCK) {
        if (re.test(BASE_URL)) {
            throw new Error('BASE_URL looks like PRODUCTION (matched a hard block). Refusing to run.');
        }
    }
    if (!ALLOW.test(BASE_URL)) {
        throw new Error('BASE_URL does not match ALLOWED_HOST_REGEX (default: staging hosts). Refusing to run.');
    }
}
assertStaging();

// ---------------------------------------------------------------- credentials (from env only)
// Vercel Deployment Protection bypass secret, sent as a header (never in the URL).
const VERCEL_BYPASS = env('VERCEL_BYPASS', '');
// Comma-separated logger JWTs (each logger must be ACTIVE-assigned to MATCH_ID_WRITE).
export const LOGGER_TOKENS = list('LOGGER_TOKENS').concat(env('LOGGER_TOKEN', '') ? [env('LOGGER_TOKEN', '')] : []);
export const EXPIRED_TOKEN = env('EXPIRED_TOKEN', '');           // pre-minted, already expired (preferred)
export const UNASSIGNED_LOGGER_TOKEN = env('UNASSIGNED_LOGGER_TOKEN', ''); // valid logger NOT assigned to the match
// Optional: lets 06 mint its own expired token locally with k6/crypto. Staging secret only.
export const JWT_SECRET_STAGING = env('JWT_SECRET_STAGING', '');
export const LOGGER_ID_FOR_MINT = env('LOGGER_ID_FOR_MINT', '');

// ---------------------------------------------------------------- fixtures (disposable staging match)
// READ targets (any live/finished staging match works):
export const MATCH_ID_READ = env('MATCH_ID_READ', env('MATCH_ID_WRITE', ''));
// WRITE target MUST be a disposable match: TEAM A vs TEAM B, matchType=friendly (so
// player stats are NOT written - events/route.ts:560), status LIVE.
export const MATCH_ID_WRITE = env('MATCH_ID_WRITE', '');
export const FINISHED_MATCH_ID = env('FINISHED_MATCH_ID', '');
export const FINISHED_MATCH_KNOWN_EVENT_ID = env('FINISHED_MATCH_KNOWN_EVENT_ID', '');
export const HOME_TEAM_ID = env('HOME_TEAM_ID', '');
export const AWAY_TEAM_ID = env('AWAY_TEAM_ID', '');
export const HOME_PLAYER_IDS = list('HOME_PLAYER_IDS');
export const AWAY_PLAYER_IDS = list('AWAY_PLAYER_IDS');

// ---------------------------------------------------------------- load ceilings (cost/safety)
// Default ceiling 250 VUs. The 1000-VU stage only runs with CONFIRM_HIGH_LOAD=yes AND
// an explicit MAX_VUS. See README "Safety".
export const MAX_VUS = num('MAX_VUS', 250);
export const HIGH_LOAD_OK = env('CONFIRM_HIGH_LOAD', '') === 'yes';
export const WS_DOWN = env('WS_DOWN', '') === '1';               // viewers poll detail at 10s instead of 25s
export const THRESH_SCALE = num('THRESH_SCALE', 1);               // multiply all latency thresholds
export const OUT_DIR = env('OUT_DIR', './results');

export function capVus(n) {
    const ceiling = HIGH_LOAD_OK ? Math.max(MAX_VUS, 1000) : Math.min(MAX_VUS, 250);
    const out = Math.min(n, ceiling);
    if (__VU === 0 && out < n) {
        console.warn(`capVus: requested ${n} VUs clamped to ${out}. Set CONFIRM_HIGH_LOAD=yes and MAX_VUS=1000 to lift (after owner approval).`);
    }
    return out;
}
export const ms = (x) => Math.round(x * THRESH_SCALE);

// ---------------------------------------------------------------- client cadences (seconds)
// home (src/app/page.tsx): the three sport lists every 15s, /api/live-matches every 3s, /api/competitions once on mount
// live (src/app/live/page.tsx): /api/live-matches every 3s
// match page (MatchDetailClient.tsx): /api/matches/{id}/public every 10s when the WebSocket is down
//   and the match is LIVE, every 25s (reconciliation) when it is up; /api/head-to-head once per session
export const CADENCE = {
    home: 3,
    live: 3,
    detail: WS_DOWN ? 10 : 25,
};

// ---------------------------------------------------------------- request helpers
export function baseHeaders(extra) {
    const h = {
        'User-Agent': 'brix-k6-loadtest/1 (staging)',
        'x-load-test': '1',
    };
    if (VERCEL_BYPASS) h['x-vercel-protection-bypass'] = VERCEL_BYPASS;
    if (extra) for (const k of Object.keys(extra)) h[k] = extra[k];
    return h;
}

export function authHeaders(token, extra) {
    const h = baseHeaders({ 'Content-Type': 'application/json' });
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (extra) for (const k of Object.keys(extra)) h[k] = extra[k];
    return h;
}

export function requireEnv(names) {
    const missing = names.filter((n) => !env(n, '') && !(n === 'LOGGER_TOKENS' && LOGGER_TOKENS.length));
    if (missing.length) {
        throw new Error(`Missing required env: ${missing.join(', ')}. See README.md.`);
    }
}

export function pick(arr, i) {
    return arr[(i === undefined ? Math.floor(Math.random() * arr.length) : i) % arr.length];
}

export function safeJson(res) {
    try {
        return res.json();
    } catch (e) {
        return null;
    }
}
