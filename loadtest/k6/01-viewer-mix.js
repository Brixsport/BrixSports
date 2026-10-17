// 01-viewer-mix.js - anonymous viewer read mix at ramping 50 / 250 / 1000 VUs.
//
// Personas (weights) and their cadences mirror the current client code:
//   home  50%  GET / , /api/competitions, then the 3 sport lists every 15s and /api/live-matches every 3s
//   live  20%  GET /live, then /api/live-matches every 3s
//   match 30%  GET /matches/{id}, then /api/matches/{id}/public every 25s (WS up) / 10s (WS_DOWN=1),
//              /api/head-to-head once per session
//   plus ~15% of match sessions read /api/matches/{id}/events once.
//
// The 1000-VU stage is clamped to 250 unless CONFIRM_HIGH_LOAD=yes MAX_VUS=1000 (README Safety).
// SMOKE=1 -> 5 VUs for 1 minute.
//
//   k6 run 01-viewer-mix.js -e MATCH_ID_READ=<id>
import { sleep } from 'k6';
import { capVus, ms, requireEnv } from './config.js';
import { homeViewer, liveViewer, matchViewer, makeSummary, SMOKE } from './lib.js';

requireEnv(['MATCH_ID_READ']);

const WEIGHTS = { home: 0.5, live: 0.2, match: 0.3 };

function stages(weight) {
    const t = (n) => Math.max(SMOKE ? 1 : 0, Math.round(capVus(n) * weight));
    if (SMOKE) return [{ duration: '20s', target: t(5) }, { duration: '30s', target: t(5) }, { duration: '10s', target: 0 }];
    return [
        { duration: '1m', target: t(50) },    // ramp to 50
        { duration: '3m', target: t(50) },    // hold 50
        { duration: '2m', target: t(250) },   // ramp to 250
        { duration: '4m', target: t(250) },   // hold 250
        { duration: '3m', target: t(1000) },  // ramp to 1000 (clamped to ceiling unless approved)
        { duration: '3m', target: t(1000) },  // hold
        { duration: '1m', target: 0 },
    ];
}

function scenario(execName, weight) {
    return { executor: 'ramping-vus', exec: execName, startVUs: 0, stages: stages(weight), gracefulRampDown: '30s', gracefulStop: '30s' };
}

export const options = {
    scenarios: {
        home: scenario('home', WEIGHTS.home),
        live: scenario('live', WEIGHTS.live),
        match: scenario('match', WEIGHTS.match),
    },
    thresholds: {
        // real failures only (429 is expected by lib.js callback and tracked separately)
        'http_req_failed{kind:read}': ['rate<0.01'],
        'rate_limited': ['rate<0.02'],
        'banned_field_leak': ['count==0'],
        // edge-cached lists (s-maxage=2, stale-while-revalidate=3)
        'http_req_duration{endpoint:football_list}': [`p(95)<${ms(800)}`, `p(99)<${ms(2000)}`],
        'http_req_duration{endpoint:basketball_list}': [`p(95)<${ms(800)}`, `p(99)<${ms(2000)}`],
        'http_req_duration{endpoint:other_list}': [`p(95)<${ms(1200)}`, `p(99)<${ms(3000)}`],
        // DB-backed reads (several are edge-cached for a few seconds)
        'http_req_duration{endpoint:detail}': [`p(95)<${ms(1500)}`, `p(99)<${ms(3500)}`],
        'http_req_duration{endpoint:h2h}': [`p(95)<${ms(1500)}`, `p(99)<${ms(3500)}`], // fetched once per match-page session
        'http_req_duration{endpoint:events}': [`p(95)<${ms(1200)}`, `p(99)<${ms(3000)}`],
        'http_req_duration{endpoint:matches_live}': [`p(95)<${ms(1500)}`, `p(99)<${ms(3500)}`],
        'http_req_duration{endpoint:competitions}': [`p(95)<${ms(1500)}`, `p(99)<${ms(3500)}`],
        // HTML shells
        'http_req_duration{endpoint:page_home}': [`p(95)<${ms(2000)}`],
        'http_req_duration{endpoint:page_live}': [`p(95)<${ms(2000)}`],
        'http_req_duration{endpoint:page_match}': [`p(95)<${ms(2000)}`],
        // the two edge-cached lists should mostly be answered by the CDN once warm (calibrate!)
        'edge_cache_served_football_list': ['rate>0.6'],
        'edge_cache_served_basketball_list': ['rate>0.6'],
        checks: ['rate>0.98'],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function home() { homeViewer(); }
export function live() { liveViewer(); }
export function match() { matchViewer(); }
export default function () { sleep(1); }

export const handleSummary = makeSummary('01-viewer-mix');
