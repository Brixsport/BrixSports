// lib.js - shared metrics, request wrappers and viewer personas.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import {
    BASE_URL, CADENCE, MATCH_ID_READ, baseHeaders, authHeaders, safeJson, OUT_DIR,
} from './config.js';

export const SMOKE = (__ENV.SMOKE || '') === '1';

// 429 is an EXPECTED outcome for viewers (measured by `rate_limited`), real failures are 4xx/5xx other than that.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 429));

// ------------------------------------------------------------------ metrics
export const rateLimited = new Rate('rate_limited');
export const bannedLeak = new Counter('banned_field_leak');
export const writeAck = new Trend('write_ack_ms', true);
export const dupRows = new Counter('dup_rows_found');
export const dedupHits = new Counter('write_dedup_hits');
export const raceNotSingle = new Counter('race_not_single_winner');

const STATES = ['HIT', 'MISS', 'STALE', 'BYPASS', 'NONE', 'OTHER'];
export const ENDPOINTS = [
    'page_home', 'page_live', 'page_match', 'football_list', 'basketball_list', 'other_list',
    'matches_live', 'detail', 'events', 'competitions', 'h2h',
];
const xvc = {};
for (const e of ENDPOINTS) for (const s of STATES) xvc[`${e}:${s}`] = new Counter(`xvc_${e}_${s}`);
export const fromEdgeCache = {};
for (const e of ENDPOINTS) fromEdgeCache[e] = new Rate(`edge_cache_served_${e}`);

function header(res, name) {
    const n = name.toLowerCase();
    for (const k of Object.keys(res.headers)) if (k.toLowerCase() === n) return res.headers[k];
    return undefined;
}
export { header };

export function cacheState(res) {
    const v = header(res, 'x-vercel-cache');
    if (!v) return 'NONE';
    const u = String(v).toUpperCase();
    return STATES.indexOf(u) >= 0 ? u : 'OTHER';
}

// Public bodies must never contain these (fields that must never appear in a public response).
const BANNED = ['assignedLoggers', 'approvedBy', 'approvalStatus', 'managerNotes', 'loggerId', 'profileId', 'organizationAffiliations', 'memberships'];
function scanBanned(res, endpoint) {
    if (res.status !== 200 || !res.body || typeof res.body !== 'string') return;
    const ct = header(res, 'content-type') || '';
    if (ct.indexOf('json') < 0) return;
    for (const f of BANNED) {
        if (res.body.indexOf(`"${f}"`) >= 0) {
            bannedLeak.add(1, { endpoint, field: f }); if (!globalThis.__bw) { globalThis.__bw = 0; } if (globalThis.__bw++ < 6) console.warn(`LEAK ${endpoint} field=${f} ctx=${res.body.slice(Math.max(0, res.body.indexOf(`"${f}"`) - 60), res.body.indexOf(`"${f}"`) + 80).replace(/\s+/g, " ")}`);
        }
    }
}

// ------------------------------------------------------------------ request wrapper for anonymous viewers
export function viewerGet(path, endpoint, opts) {
    const params = {
        headers: baseHeaders(opts && opts.headers),
        tags: { endpoint, kind: 'read', name: endpoint },
        timeout: '20s',
    };
    // tags may be a function (evaluated per request, used by 04 to tag by elapsed-time phase/bucket)
    if (opts && opts.tags) Object.assign(params.tags, typeof opts.tags === 'function' ? opts.tags() : opts.tags);
    const res = http.get(`${BASE_URL}${path}`, params);
    recordViewer(res, endpoint);
    return res;
}

export function recordViewer(res, endpoint) {
    rateLimited.add(res.status === 429, { endpoint });
    const st = cacheState(res);
    if (xvc[`${endpoint}:${st}`]) xvc[`${endpoint}:${st}`].add(1);
    if (fromEdgeCache[endpoint]) fromEdgeCache[endpoint].add(st === 'HIT' || st === 'STALE');
    scanBanned(res, endpoint);
    check(res, { [`${endpoint}: status 200 (or 429)`]: (r) => r.status === 200 || r.status === 429 }, { endpoint });
}

export function viewerBatch(items, extraTags) {
    // items: [{path, endpoint}] - fired in parallel like the home page does
    const reqs = items.map((i) => ['GET', `${BASE_URL}${i.path}`, null, {
        headers: baseHeaders(),
        tags: Object.assign({ endpoint: i.endpoint, kind: 'read', name: i.endpoint }, (typeof extraTags === 'function' ? extraTags() : extraTags) || {}),
        timeout: '20s',
    }]);
    const resps = http.batch(reqs);
    resps.forEach((r, idx) => recordViewer(r, items[idx].endpoint));
    return resps;
}

// ------------------------------------------------------------------ personas (real client cadences)
function jitter(sec) {
    return sec * (0.9 + Math.random() * 0.2);
}
const SESSION_SECONDS = SMOKE ? 30 : parseInt(__ENV.SESSION_SECONDS || '90', 10);

// Homepage (src/app/page.tsx): on mount fetch the 3 sport lists in parallel and /api/competitions; then the lists every 15s
// and the live-score overlay (/api/live-matches) every 3s. Clients arrive asynchronously: random phase offset.
export function homeViewer(extraTags) {
    sleep(Math.random() * 2);
    viewerGet('/', 'page_home', extraTags && { tags: extraTags });
    viewerGet('/api/competitions', 'competitions', extraTags && { tags: extraTags });
    const ticks = Math.max(1, Math.floor(SESSION_SECONDS / 3));
    for (let i = 0; i < ticks; i++) {
        if (i % 5 === 0) {
            viewerBatch([
                { path: '/api/basketball/matches', endpoint: 'basketball_list' },
                { path: '/api/football/matches', endpoint: 'football_list' },
                { path: '/api/other/matches', endpoint: 'other_list' },
            ], extraTags);
        }
        viewerGet('/api/live-matches', 'matches_live', extraTags && { tags: extraTags });
        sleep(jitter(3));
    }
}

// /live (src/app/live/page.tsx): /api/live-matches every 3s.
export function liveViewer(extraTags) {
    sleep(Math.random() * 2);
    viewerGet('/live', 'page_live', extraTags && { tags: extraTags });
    const loops = Math.max(1, Math.floor(SESSION_SECONDS / 3));
    for (let i = 0; i < loops; i++) {
        viewerGet('/api/live-matches', 'matches_live', extraTags && { tags: extraTags });
        sleep(jitter(3));
    }
}

// Match page (MatchDetailClient.tsx): GET /api/matches/{id}/public, polled every 25s (WS up) or 10s (WS down) while LIVE.
// /api/matches/{id}/events is not polled by the public page; ~15% of sessions hit it once (API consumers).
export function matchViewer(extraTags) {
    if (!MATCH_ID_READ) throw new Error('MATCH_ID_READ (or MATCH_ID_WRITE) is required for the match persona');
    sleep(Math.random() * 2);
    viewerGet(`/matches/${MATCH_ID_READ}`, 'page_match', extraTags && { tags: extraTags });
    // the public route is cookie-free; head-to-head is fetched once per team pairing (not per poll)
    const first = viewerGet(`/api/matches/${MATCH_ID_READ}/public`, 'detail', extraTags && { tags: extraTags });
    const b0 = first.status === 200 ? safeJson(first) : null;
    const m0 = b0 && b0.match;
    if (m0 && m0.homeTeam && m0.awayTeam) {
        const q = `team1=${encodeURIComponent(m0.homeTeam.id)}&team2=${encodeURIComponent(m0.awayTeam.id)}&competition=${encodeURIComponent(m0.competition || '')}`;
        viewerGet(`/api/head-to-head?${q}`, 'h2h', extraTags && { tags: extraTags });
    }
    if (Math.random() < 0.15) viewerGet(`/api/matches/${MATCH_ID_READ}/events`, 'events', extraTags && { tags: extraTags });
    const loops = Math.max(1, Math.floor(SESSION_SECONDS / CADENCE.detail));
    for (let i = 0; i < loops; i++) {
        sleep(jitter(CADENCE.detail));
        viewerGet(`/api/matches/${MATCH_ID_READ}/public`, 'detail', extraTags && { tags: extraTags });
    }
}

// ------------------------------------------------------------------ logger helpers (used by 02/03/06)
export function newClientId(tag) {
    const rand = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    // matches ^[A-Za-z0-9_-]{8,64}$ (src/lib/event-id.ts)
    return `k6_${tag || 'e'}_${Date.now().toString(36)}_${rand}`.slice(0, 64);
}

export function postEvent(matchId, token, payload, extraTags, extraParams) {
    const params = Object.assign({
        headers: authHeaders(token),
        tags: Object.assign({ endpoint: 'event_post', kind: 'write', name: 'event_post' }, extraTags || {}),
        timeout: '30s',
    }, extraParams || {});
    const res = http.post(`${BASE_URL}/api/matches/${matchId}/events`, JSON.stringify(payload), params);
    writeAck.add(res.timings.duration, params.tags);
    return res;
}

export function getDetail(matchId, token) {
    const res = http.get(`${BASE_URL}/api/matches/${matchId}`, {
        headers: token ? authHeaders(token) : baseHeaders(),
        tags: { endpoint: 'detail', kind: 'verify', name: 'detail_verify' },
        responseCallback: http.expectedStatuses({ min: 200, max: 399 }, 429),
    });
    return { res, body: safeJson(res) };
}

export function getEvents(matchId, token) {
    const res = http.get(`${BASE_URL}/api/matches/${matchId}/events`, {
        headers: authHeaders(token),
        tags: { endpoint: 'events', kind: 'verify', name: 'events_verify' },
    });
    const body = safeJson(res);
    return { res, events: body && body.events ? body.events : [] };
}

// ------------------------------------------------------------------ summary
export function cacheTable(data) {
    const lines = ['', 'x-vercel-cache share per endpoint (HIT/MISS/STALE/BYPASS/NONE/OTHER):'];
    for (const e of ENDPOINTS) {
        const counts = STATES.map((s) => {
            const m = data.metrics[`xvc_${e}_${s}`];
            return m && m.values ? m.values.count : 0;
        });
        const tot = counts.reduce((a, b) => a + b, 0);
        if (!tot) continue;
        lines.push(`  ${e.padEnd(16)} n=${String(tot).padEnd(7)} ` + STATES.map((s, i) => `${s}=${((counts[i] / tot) * 100).toFixed(0)}%`).join(' '));
    }
    return lines.join('\n') + '\n';
}

export function makeSummary(name, extraText) {
    return function (data) {
        const out = {};
        out.stdout = textSummary(data, { indent: ' ', enableColors: false }) + cacheTable(data) + (extraText ? extraText(data) : '');
        out[`${OUT_DIR}/summary-${name}.json`] = JSON.stringify(data, null, 2);
        return out;
    };
}
