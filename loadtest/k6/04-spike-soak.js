// 04-spike-soak.js - PROFILE=spike (3x load for 60s) or PROFILE=soak (30 min moderate load).
//
//   k6 run 04-spike-soak.js -e PROFILE=spike -e BASE_VUS=80 -e MATCH_ID_READ=<id>
//   k6 run 04-spike-soak.js -e PROFILE=soak  -e BASE_VUS=100 -e MATCH_ID_READ=<id>
//
// Uses the same personas / cadences as 01 (home 50% / live 20% / match 30%), read-only.
//
// SPIKE:  t=0-2m  ramp to BASE_VUS (phase=pre)  | hold to 4m (pre)
//         t=4m    ramp to 3*BASE_VUS in 10s     | hold 60s (phase=spike)
//         t=5m10s back to BASE_VUS in 10s       | hold 3m (phase=post)  -> recovery check
// SOAK:   ramp 2m to BASE_VUS, hold 30m; requests tagged bucket=b0..b5 (5-minute buckets).
//         handleSummary prints p95 per bucket and the drift ratio last/first (> 1.5 = latency drift finding).
//
// What to watch in parallel (out of k6): Vercel function duration/concurrency + 5xx, Turso reads/s + latency,
// Railway WS memory (should be flat: this test does not open sockets), Sentry new-issue rate.
import { sleep } from 'k6';
import exec from 'k6/execution';
import { capVus, ms, requireEnv, OUT_DIR } from './config.js';
import { homeViewer, liveViewer, matchViewer, cacheTable } from './lib.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

requireEnv(['MATCH_ID_READ']);

const PROFILE = (__ENV.PROFILE || 'spike').toLowerCase();
const BASE_VUS = capVus(parseInt(__ENV.BASE_VUS || (PROFILE === 'soak' ? '100' : '80'), 10));
const W = { home: 0.5, live: 0.2, match: 0.3 };
const share = (n, w) => Math.max(1, Math.round(n * w));

function stagesFor(w) {
    if (PROFILE === 'soak') {
        return [
            { duration: '2m', target: share(BASE_VUS, w) },
            { duration: '30m', target: share(BASE_VUS, w) },
            { duration: '30s', target: 0 },
        ];
    }
    const b = share(BASE_VUS, w);
    const s = share(BASE_VUS * 3, w);
    return [
        { duration: '2m', target: b }, { duration: '2m', target: b },     // pre   (0-4m)
        { duration: '10s', target: s }, { duration: '60s', target: s },   // spike (4m-5m10s)
        { duration: '10s', target: b }, { duration: '3m', target: b },    // post  (5m20s-8m20s)
        { duration: '20s', target: 0 },
    ];
}

const sc = (exe, w) => ({ executor: 'ramping-vus', exec: exe, startVUs: 0, stages: stagesFor(w), gracefulRampDown: '30s', gracefulStop: '30s' });

// ---- tagging by elapsed test time (exec.instance.currentTestRunDuration, ms)
function tags() {
    const t = exec.instance.currentTestRunDuration / 1000;
    if (PROFILE === 'soak') return { bucket: `b${Math.min(5, Math.floor(Math.max(0, t - 120) / 300))}` };
    if (t < 240) return { phase: 'pre' };
    if (t < 320) return { phase: 'spike' };
    return { phase: 'post' };
}

const th = {
    'http_req_failed{kind:read}': [PROFILE === 'spike' ? 'rate<0.02' : 'rate<0.01'],
    'rate_limited': ['rate<0.05'],
    'banned_field_leak': ['count==0'],
    checks: ['rate>0.97'],
};
if (PROFILE === 'spike') {
    // spike: tolerate degradation but not collapse; recovery: back to ~baseline after the spike
    th['http_req_duration{phase:pre,endpoint:detail}'] = [`p(95)<${ms(1500)}`];
    th['http_req_duration{phase:spike,endpoint:detail}'] = [`p(95)<${ms(4000)}`, `p(99)<${ms(8000)}`];
    th['http_req_duration{phase:post,endpoint:detail}'] = [`p(95)<${ms(2250)}`]; // 1.5x baseline
    th['http_req_duration{phase:spike,endpoint:football_list}'] = [`p(95)<${ms(2000)}`];
    th['http_req_duration{phase:post,endpoint:football_list}'] = [`p(95)<${ms(1200)}`];
    th['http_req_failed{phase:spike}'] = ['rate<0.05'];
    th['http_req_failed{phase:post}'] = ['rate<0.01'];
} else {
    for (let i = 0; i < 6; i++) {
        th[`http_req_duration{bucket:b${i},endpoint:detail}`] = [`p(95)<${ms(2000)}`];
        th[`http_req_duration{bucket:b${i},endpoint:football_list}`] = [`p(95)<${ms(1000)}`];
        th[`http_req_failed{bucket:b${i}}`] = ['rate<0.01'];
    }
}

export const options = {
    scenarios: { home: sc('home', W.home), live: sc('live', W.live), match: sc('match', W.match) },
    thresholds: th,
    summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function home() { homeViewer(tags); }   // function: tags are evaluated per request
export function live() { liveViewer(tags); }
export function match() { matchViewer(tags); }
export default function () { sleep(1); }

export function handleSummary(data) {
    let extra = '';
    if (PROFILE === 'soak') {
        const p = (i, ep) => {
            const m = data.metrics[`http_req_duration{bucket:b${i},endpoint:${ep}}`];
            return m && m.values ? m.values['p(95)'] : undefined;
        };
        extra += '\nSOAK p95 per 5-min bucket (ms):\n';
        for (const ep of ['detail', 'football_list']) {
            const vals = [0, 1, 2, 3, 4, 5].map((i) => p(i, ep));
            extra += `  ${ep.padEnd(14)} ${vals.map((v) => (v === undefined ? 'n/a' : Math.round(v))).join('  ')}\n`;
            const a = vals[0]; const z = vals[5];
            if (a && z) {
                const r = z / a;
                extra += `  ${ep} drift b5/b0 = ${r.toFixed(2)} ${r > 1.5 ? '  <-- FINDING: latency drift > 1.5x' : '(ok)'}\n`;
            }
        }
        extra += '  Also check externally: Vercel function memory/duration trend, Turso latency, Railway RSS, Sentry.\n';
    } else {
        extra += '\nSPIKE: compare phase=pre / spike / post in the threshold lines above; post must return to ~baseline.\n';
    }
    const out = { stdout: textSummary(data, { indent: ' ', enableColors: false }) + cacheTable(data) + extra };
    out[`${OUT_DIR}/summary-04-${PROFILE}.json`] = JSON.stringify(data, null, 2);
    return out;
}
