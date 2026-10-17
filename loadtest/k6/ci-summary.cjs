// ci-summary.cjs - turns the summary-*.json files written by the k6 scripts into a short Markdown
// report (used for the GitHub Actions step summary).
//
//   node loadtest/k6/ci-summary.cjs <results-dir> <title>
//
// Prints Markdown to stdout. Never exits non-zero because of the numbers it reads: a missing or
// unreadable summary file is reported in the output instead.
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'results';
const title = process.argv[3] || 'k6 results';

const STATES = ['HIT', 'MISS', 'STALE', 'BYPASS', 'NONE', 'OTHER'];

const fmt = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : 'n/a');
const pct = (n, tot) => (tot > 0 ? `${((n / tot) * 100).toFixed(1)}%` : 'n/a');
const val = (data, name, key) => {
    const m = data.metrics && data.metrics[name];
    return m && m.values ? m.values[key] : undefined;
};

function endpointRows(data) {
    const rows = [];
    for (const name of Object.keys(data.metrics || {})) {
        const m = name.match(/^http_req_duration\{(.+)\}$/);
        if (!m) continue;
        const v = data.metrics[name].values || {};
        rows.push({ label: m[1], p95: v['p(95)'], p99: v['p(99)'], max: v.max });
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label));
}

function cacheTotals(data) {
    const per = {};
    for (const name of Object.keys(data.metrics || {})) {
        const m = name.match(/^xvc_(.+)_(HIT|MISS|STALE|BYPASS|NONE|OTHER)$/);
        if (!m) continue;
        const c = (data.metrics[name].values || {}).count || 0;
        per[m[1]] = per[m[1]] || {};
        per[m[1]][m[2]] = (per[m[1]][m[2]] || 0) + c;
    }
    return per;
}

function crossedThresholds(data) {
    const out = [];
    for (const name of Object.keys(data.metrics || {})) {
        const th = data.metrics[name].thresholds;
        if (!th) continue;
        for (const expr of Object.keys(th)) {
            const t = th[expr];
            const ok = typeof t === 'object' && t !== null ? t.ok : !t;
            if (!ok) out.push(`${name}: ${expr}`);
        }
    }
    return out;
}

function report(file, data) {
    const L = [];
    L.push(`### ${file}`, '');
    const reqs = val(data, 'http_reqs', 'count');
    const failed = val(data, 'http_req_failed', 'rate');
    const limited = data.metrics && data.metrics.rate_limited && data.metrics.rate_limited.values;
    let n429;
    if (limited) n429 = typeof limited.passes === 'number' ? limited.passes : Math.round((limited.rate || 0) * (reqs || 0));
    const dur = (data.state && data.state.testRunDurationMs) || undefined;
    L.push('| Requests | Req/s | Failed | p95 (ms) | p99 (ms) | 429 responses | Duration |');
    L.push('|---|---|---|---|---|---|---|');
    L.push([
        fmt(reqs), fmt(val(data, 'http_reqs', 'rate'), 1),
        typeof failed === 'number' ? `${(failed * 100).toFixed(2)}%` : 'n/a',
        fmt(val(data, 'http_req_duration', 'p(95)')), fmt(val(data, 'http_req_duration', 'p(99)')),
        n429 === undefined ? 'n/a' : String(n429),
        dur ? `${(dur / 60000).toFixed(1)} min` : 'n/a',
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'), '');

    const eps = endpointRows(data);
    if (eps.length) {
        L.push('<details><summary>Latency per endpoint / tag (ms)</summary>', '');
        L.push('| Series | p95 | p99 | max |', '|---|---|---|---|');
        for (const r of eps) L.push(`| ${r.label} | ${fmt(r.p95)} | ${fmt(r.p99)} | ${fmt(r.max)} |`);
        L.push('', '</details>', '');
    }

    const cache = cacheTotals(data);
    const keys = Object.keys(cache).sort();
    if (keys.length) {
        const all = {};
        let tot = 0;
        for (const k of keys) for (const s of STATES) { const c = cache[k][s] || 0; all[s] = (all[s] || 0) + c; tot += c; }
        L.push(`Edge cache (x-vercel-cache), all endpoints: HIT ${pct(all.HIT || 0, tot)}, STALE ${pct(all.STALE || 0, tot)}, MISS ${pct(all.MISS || 0, tot)}, other ${pct(tot - (all.HIT || 0) - (all.STALE || 0) - (all.MISS || 0), tot)} (n=${tot})`, '');
        L.push('<details><summary>Cache state per endpoint</summary>', '');
        L.push(`| Endpoint | n | ${STATES.join(' | ')} |`, `|---|---|${STATES.map(() => '---').join('|')}|`);
        for (const k of keys) {
            const t = STATES.reduce((a, s) => a + (cache[k][s] || 0), 0);
            L.push(`| ${k} | ${t} | ${STATES.map((s) => pct(cache[k][s] || 0, t)).join(' | ')} |`);
        }
        L.push('', '</details>', '');
    }

    const leak = val(data, 'banned_field_leak', 'count');
    if (leak !== undefined) L.push(`Banned-field leaks in public responses: ${leak}`, '');

    const crossed = crossedThresholds(data);
    if (crossed.length) {
        L.push(`Thresholds crossed (${crossed.length}). On a shared runner and a shared staging deployment, treat these as signals to investigate, not as a verdict:`, '');
        for (const c of crossed) L.push(`- ${c}`);
        L.push('');
    } else {
        L.push('All thresholds passed.', '');
    }
    return L.join('\n');
}

const out = [`## ${title}`, ''];
let files = [];
try {
    files = fs.readdirSync(dir).filter((f) => /^summary-.*\.json$/.test(f)).sort();
} catch (e) {
    out.push(`Results folder "${dir}" could not be read: ${e.message}`, '');
}
if (!files.length) out.push('No summary-*.json file was written (the run may have been stopped before it finished).', '');
for (const f of files) {
    try {
        out.push(report(f, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))));
    } catch (e) {
        out.push(`### ${f}`, '', `Could not parse: ${e.message}`, '');
    }
}
process.stdout.write(out.join('\n') + '\n');
