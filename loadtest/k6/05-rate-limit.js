// 05-rate-limit.js - checkRateLimit behaviour (src/lib/rate-limit.ts) as seen from the outside.
//
// Facts taken from the source:
//  * key = `${METHOD}:${pathname}:${ip}:${max}:${windowMs}`, ip = FIRST entry of x-forwarded-for (rate-limit.ts).
//    Vercel overwrites client XFF, so the key is the real client egress IP -> every viewer behind one campus NAT shares a bucket.
//  * Public GET routes use the IN-MEMORY per-instance Map (not Redis) (rate-limit.ts) -> counters are per warm
//    instance, so the effective limit is "up to N x instances"; the trip point is therefore noisy, not exact.
//  * Limits: /api/matches and /api/competitions use the 120/min DEFAULT;
//    /api/live-matches, /api/matches/{id}/public and /api/football|basketball/matches use 600/min.
//  * 429 body {error}, header Retry-After (seconds).
//    No X-RateLimit-* headers are emitted (informational check below).
//  * /live polls /api/live-matches every 3s (20 req/min/viewer) -> the 600/min budget is exhausted by ~30 viewers behind ONE IP.
//
// Scenarios (run this file ALONE; it trips the limiter for the load-generator IP, wait ~1 min before other runs):
//   trip      1 VU hammers /api/competitions (120/min limit) until a 429 is seen, validates headers/body, waits Retry-After, expects recovery
//   spoof     after tripping, retry with a forged X-Forwarded-For; must STILL be limited (Vercel should overwrite it) - informational
//   nat_live  NAT_VIEWERS (default 40, ramping up to NAT_VIEWERS) VUs emulate a campus behind one IP on the /live poll cadence (3s);
//             reports the 429 share vs concurrent viewers
//   nat_detail same for the match-page poll with WS down (10s => 6 req/min/viewer vs the 600/min limit => ~100 viewers per IP)
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, MATCH_ID_READ, baseHeaders, ms, requireEnv, safeJson } from './config.js';
import { header, makeSummary, SMOKE } from './lib.js';

requireEnv(['MATCH_ID_READ']);

const NAT_VIEWERS = SMOKE ? 5 : parseInt(__ENV.NAT_VIEWERS || '40', 10);
const ANY = http.expectedStatuses({ min: 200, max: 599 });

const tripSeen = new Counter('rl_trip_observed');
const noRetryAfter = new Counter('rl_429_missing_retry_after');
const badRetryAfter = new Counter('rl_429_bad_retry_after');
const recovered = new Rate('rl_recovered_after_retry_after');
const spoofBypass = new Counter('rl_xff_spoof_bypass');
const natLive429 = new Rate('rl_nat_live_429');
const natDetail429 = new Rate('rl_nat_detail_429');
const requestsToTrip = new Trend('rl_requests_to_first_429');
const hasXRateLimitHeaders = new Counter('rl_has_x_ratelimit_headers');

export const options = {
    scenarios: {
        trip: { executor: 'per-vu-iterations', vus: 1, iterations: 1, exec: 'trip', maxDuration: '5m' },
        nat_live: {
            executor: 'ramping-vus', exec: 'natLive', startTime: '2m30s', startVUs: 0,
            stages: [{ duration: '1m', target: Math.max(1, Math.round(NAT_VIEWERS / 2)) }, { duration: '1m', target: NAT_VIEWERS }, { duration: '2m', target: NAT_VIEWERS }, { duration: '10s', target: 0 }],
        },
        nat_detail: {
            executor: 'ramping-vus', exec: 'natDetail', startTime: '8m', startVUs: 0,
            stages: [{ duration: '1m', target: NAT_VIEWERS }, { duration: '2m', target: NAT_VIEWERS }, { duration: '10s', target: 0 }],
        },
    },
    thresholds: {
        'rl_trip_observed': ['count>=1'],              // the limiter must trip within the hammer budget (else it is under-counting)
        'rl_429_missing_retry_after': ['count==0'],
        'rl_429_bad_retry_after': ['count==0'],
        'rl_recovered_after_retry_after': ['rate>=1'],
        'rl_xff_spoof_bypass': ['count==0'],
        // Legit shared-NAT viewers must not be blocked at realistic campus sizes:
        'rl_nat_live_429': ['rate<0.01'],              // expected to fail above ~30 concurrent viewers per IP (600/min budget)
        'rl_nat_detail_429': ['rate<0.01'],
        'http_req_failed': ['rate<0.01'],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function get(path, extraHeaders) {
    return http.get(`${BASE_URL}${path}`, { headers: baseHeaders(extraHeaders), tags: { kind: 'rl', name: path.split('?')[0].replace(MATCH_ID_READ, '{id}') }, responseCallback: ANY });
}

// ---------------------------------------------------------------- trip + headers + recovery + spoof
export function trip() {
    let n = 0;
    let last429 = null;
    // /api/competitions: default 120/min per IP per instance; allow up to 8x in case of instance spread
    const budget = SMOKE ? 200 : 1000;
    while (n < budget) {
        const batch = http.batch(Array.from({ length: 20 }, () => ['GET', `${BASE_URL}/api/competitions`, null, { headers: baseHeaders(), tags: { kind: 'rl', name: '/api/competitions' }, responseCallback: ANY }]));
        n += batch.length;
        const hit = batch.find((r) => r.status === 429);
        if (hit) { last429 = hit; break; }
    }
    if (!last429) {
        check(null, { 'rate limit: tripped within budget (otherwise per-instance counters under-count / many instances)': () => false });
        return;
    }
    tripSeen.add(1);
    requestsToTrip.add(n);
    const ra = header(last429, 'retry-after');
    const raN = parseInt(ra, 10);
    if (!ra) noRetryAfter.add(1);
    else if (!(raN >= 1 && raN <= 60)) badRetryAfter.add(1);
    const body = safeJson(last429);
    const ct = header(last429, 'content-type') || '';
    if (Object.keys(last429.headers).some((k) => /^x-ratelimit/i.test(k))) hasXRateLimitHeaders.add(1);
    check(last429, {
        '429: JSON content-type': () => ct.indexOf('json') >= 0,
        '429: body has error message, no internals': () => !!(body && typeof body.error === 'string' && !/stack|upstash|redis|sql/i.test(last429.body)),
        '429: Retry-After present and 1..60s': () => raN >= 1 && raN <= 60,
    });

    // spoof: a forged XFF must not reset the bucket (Vercel edge overwrites it). Per-instance counters can still
    // yield a 200 by landing on a different warm instance, so retry a few times before calling it a bypass.
    let spoofOk = 0;
    for (let i = 0; i < 5; i++) {
        const r = get('/api/competitions', { 'X-Forwarded-For': `203.0.113.${10 + i}` });
        if (r.status === 200) spoofOk++;
    }
    if (spoofOk === 5) spoofBypass.add(1); // all 5 forged-XFF requests succeeded while real IP is limited => header trusted
    check(null, { 'XFF spoof does not clearly bypass the limiter (informational: instance spread may give some 200s)': () => spoofOk < 5 });

    // recovery after Retry-After
    sleep((raN || 60) + 2);
    const after = get('/api/competitions');
    recovered.add(after.status === 200);
    check(after, { 'after Retry-After the route serves 200 again': (r) => r.status === 200 });
}

// ---------------------------------------------------------------- shared NAT: /live poll cadence (3s, 600/min limit)
export function natLive() {
    sleep(Math.random() * 3);
    for (let i = 0; i < 40; i++) {
        const r = get('/api/live-matches');
        natLive429.add(r.status === 429, { concurrent_viewers: String(NAT_VIEWERS) });
        sleep(3 * (0.9 + Math.random() * 0.2));
    }
}

// ---------------------------------------------------------------- shared NAT: match page poll, WS down (10s, 600/min limit)
export function natDetail() {
    sleep(Math.random() * 10);
    for (let i = 0; i < 12; i++) {
        const r = get(`/api/matches/${MATCH_ID_READ}/public`);
        natDetail429.add(r.status === 429, { concurrent_viewers: String(NAT_VIEWERS) });
        sleep(10 * (0.9 + Math.random() * 0.2));
    }
}

export default function () { trip(); }

export const handleSummary = makeSummary('05-rate-limit', () => [
    '',
    'RATE LIMIT NOTES',
    `  NAT_VIEWERS=${NAT_VIEWERS}. /live budget = 600 req/min/IP/instance = 30 viewers x 20 polls/min (so ~30 viewers saturate it).`,
    '  match-detail budget = 600/min = 100 viewers x 6 polls/min (WS down) or 250 viewers (WS up, 25s).',
    '  Compare rl_nat_live_429 to the viewer count that was active; a non-zero rate at <= 25 viewers would be a problem for campus NATs.',
    '  rl_has_x_ratelimit_headers==0 is expected (no X-RateLimit-* headers are emitted) - informational.',
    '',
].join('\n'));
