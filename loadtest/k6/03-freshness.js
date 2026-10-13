// 03-freshness.js - Flow C probe: time from "logger POST sent" to "a polling viewer can see it".
//
// One logger VU POSTs a Goal (home team, unique minute so the 10s signature dedup can't swallow it) and then polls,
// every ~0.5s, the two viewer endpoints exactly as a viewer would fetch them (same URLs, no cache-buster, so the Vercel
// edge cache is in the path):
//   GET /api/matches/{id}          -> visible when the event id appears in `events[]` (or score == baseline+1)
//   GET /api/football/matches      -> visible when this match's homeScore == baseline+1  (edge: s-maxage=5, swr=10)
//
// Trends (ms, measured from just BEFORE the POST is sent):
//   freshness_detail_ms, freshness_list_ms, plus *_from_ack_ms (from POST response) and freshness_ack_ms (POST latency).
// The probe polls fast, so this is the SERVER + CDN visibility lag. Real viewers add their poll interval
// (10s WS-down / 15s home+live / 25s WS-up reconciliation) unless the WS push reaches them (not measured here).
//
// Needs the disposable match to be the only writer for the duration (baseline+1 logic) and to be among the newest 100 football
// matches (list is `ORDER BY createdAt DESC LIMIT 100`, football/matches/route.ts:74-80).
//
//   k6 run 03-freshness.js -e PROBES=60 -e PROBE_POLL_MS=500
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import {
    requireEnv, LOGGER_TOKENS, MATCH_ID_WRITE, HOME_TEAM_ID, HOME_PLAYER_IDS, BASE_URL, baseHeaders, authHeaders, ms, safeJson, pick,
} from './config.js';
import { newClientId, header, makeSummary, SMOKE } from './lib.js';

requireEnv(['MATCH_ID_WRITE', 'HOME_TEAM_ID', 'HOME_PLAYER_IDS', 'LOGGER_TOKENS']);

const PROBES = parseInt(__ENV.PROBES || (SMOKE ? '3' : '40'), 10);
const POLL_MS = parseInt(__ENV.PROBE_POLL_MS || '500', 10);
const TIMEOUT_MS = parseInt(__ENV.PROBE_TIMEOUT_MS || '30000', 10);
const GAP_S = parseInt(__ENV.PROBE_GAP_S || '12', 10); // > 10s so each probe is independent of the dedup window and edge TTL

export const fDetail = new Trend('freshness_detail_ms', true);
export const fList = new Trend('freshness_list_ms', true);
export const fDetailAck = new Trend('freshness_detail_from_ack_ms', true);
export const fListAck = new Trend('freshness_list_from_ack_ms', true);
export const fAck = new Trend('freshness_ack_ms', true);
export const fTimeouts = new Counter('freshness_timeouts');
export const fListStaleSeen = new Counter('freshness_list_cache_stale_at_detect');

export const options = {
    scenarios: {
        probe: { executor: 'per-vu-iterations', vus: 1, iterations: PROBES, maxDuration: `${PROBES * 60}s` },
    },
    thresholds: {
        // Target: event save -> public display < 5s
        'freshness_detail_ms': ['p(50)<2500', `p(95)<${ms(5000)}`, `p(99)<${ms(8000)}`],
        'freshness_list_ms': ['p(50)<5000', `p(95)<${ms(5000)}`, `p(99)<${ms(15000)}`], // EXPECTED to be tight/failing: 5s fresh + 10s swr
        'freshness_timeouts': ['count==0'],
        checks: ['rate>0.99'],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function readDetail() {
    const res = http.get(`${BASE_URL}/api/matches/${MATCH_ID_WRITE}`, {
        headers: baseHeaders(), tags: { endpoint: 'detail', kind: 'probe', name: 'probe_detail' },
    });
    return { res, body: safeJson(res) };
}
function readList() {
    const res = http.get(`${BASE_URL}/api/football/matches`, {
        headers: baseHeaders(), tags: { endpoint: 'football_list', kind: 'probe', name: 'probe_list' },
    });
    const b = safeJson(res);
    const m = b && b.matches ? b.matches.find((x) => x.id === MATCH_ID_WRITE) : null;
    return { res, match: m };
}

export default function () {
    const token = pick(LOGGER_TOKENS, 0);
    const i = __ITER;

    // Baseline (uncached detail endpoint: authoritative current score)
    const base = readDetail();
    const baseScore = base.body && base.body.match ? (base.body.match.homeScore || 0) : null;
    if (baseScore === null) {
        check(null, { 'freshness: baseline readable': () => false });
        sleep(GAP_S);
        return;
    }
    // Wait for the list cache to also hold the baseline so "visible" can't be satisfied by an older entry
    // (list is cached up to 15s; the GAP_S sleep below handles steady state, this handles the first iteration)
    const id = newClientId('fr');
    const minute = 30 + (i % 90);
    const payload = {
        id, type: 'Goal', minute, second: i % 60, teamId: HOME_TEAM_ID, playerId: pick(HOME_PLAYER_IDS, i),
        period: 'FIRST_HALF', loggerName: 'k6-freshness',
    };

    const t0 = Date.now();
    const post = http.post(`${BASE_URL}/api/matches/${MATCH_ID_WRITE}/events`, JSON.stringify(payload), {
        headers: authHeaders(token), tags: { endpoint: 'event_post', kind: 'write', name: 'event_post' },
        responseCallback: http.expectedStatuses(200, 201),
    });
    const tAck = Date.now();
    fAck.add(tAck - t0);
    if (!check(post, { 'freshness: POST 201': (r) => r.status === 201 })) {
        sleep(GAP_S);
        return;
    }
    const expected = baseScore + 1;

    let detailAt = null;
    let listAt = null;
    while ((detailAt === null || listAt === null) && Date.now() - t0 < TIMEOUT_MS) {
        if (detailAt === null) {
            const d = readDetail();
            const evs = d.body && d.body.events ? d.body.events : [];
            const seen = evs.some((e) => e.id === id) || (d.body && d.body.match && (d.body.match.homeScore || 0) >= expected);
            if (seen) {
                detailAt = Date.now();
                fDetail.add(detailAt - t0);
                fDetailAck.add(detailAt - tAck);
            }
        }
        if (listAt === null) {
            const l = readList();
            if (l.match && (l.match.homeScore || 0) >= expected) {
                listAt = Date.now();
                fList.add(listAt - t0);
                fListAck.add(listAt - tAck);
                if (String(header(l.res, 'x-vercel-cache') || '').toUpperCase() === 'STALE') fListStaleSeen.add(1);
            }
        }
        sleep(POLL_MS / 1000);
    }
    if (detailAt === null) fTimeouts.add(1, { endpoint: 'detail' });
    if (listAt === null) fTimeouts.add(1, { endpoint: 'football_list' });
    sleep(GAP_S);
}

export const handleSummary = makeSummary('03-freshness', (data) => {
    const g = (n, p) => (data.metrics[n] && data.metrics[n].values ? data.metrics[n].values[p] : undefined);
    const f = (v) => (v === undefined ? 'n/a' : `${Math.round(v)}ms`);
    return [
        '',
        'FLOW C FRESHNESS (server + CDN visibility; excludes real client poll interval and WS push)',
        `  /api/matches/{id}        p50=${f(g('freshness_detail_ms', 'p(50)'))} p95=${f(g('freshness_detail_ms', 'p(95)'))} p99=${f(g('freshness_detail_ms', 'p(99)'))}`,
        `  /api/football/matches    p50=${f(g('freshness_list_ms', 'p(50)'))} p95=${f(g('freshness_list_ms', 'p(95)'))} p99=${f(g('freshness_list_ms', 'p(99)'))}`,
        '  Worst-case real viewer = above + poll interval (10s WS-down detail, 15s home/live, 25s WS-up reconciliation).',
        '',
    ].join('\n');
});
