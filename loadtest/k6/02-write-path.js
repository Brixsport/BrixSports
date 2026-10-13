// 02-write-path.js - logger POST /api/matches/{id}/events at match-day rates + idempotency + dedup race.
//
// Scenarios (all against the DISPOSABLE friendly staging match MATCH_ID_WRITE):
//   replay  - POST id X (expect 201), replay X twice (expect 200 "Duplicate submission ignored"), then GET events:
//             exactly ONE row with id X; for Goals the score moves by exactly +1.      (events/route.ts)
//   race_id - two CONCURRENT POSTs with the SAME client id -> exactly one 201 + one 200, one row, score +1 (route.ts)
//   race_sig- two CONCURRENT POSTs, DIFFERENT ids, same (type, minute, player, value) from two loggers if >=2 tokens:
//             dedup INSERT..SELECT WHERE NOT EXISTS must let exactly one through (route.ts)
//   steady  - N loggers, one event every ~12s each (compressed match-day rate; real ~1 event / 20-40s per logger)
//   burst   - each logger fires 5 events in 10s (goal flurry / card + foul + sub), 3 times, ~1 min apart
//
// Minute allocation (README section 6): 0-9 replay, 10-19 race_id, 20-29 race_sig, >=30 load.
// Events GET is limit(200) ordered by minute asc (route.ts) so verified rows stay visible.
//
//   k6 run 02-write-path.js  (SMOKE=1 shortens everything)
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import {
    requireEnv, LOGGER_TOKENS, MATCH_ID_WRITE, HOME_TEAM_ID, AWAY_TEAM_ID, HOME_PLAYER_IDS, AWAY_PLAYER_IDS,
    authHeaders, BASE_URL, ms, pick, safeJson,
} from './config.js';
import {
    newClientId, postEvent, getDetail, getEvents, dupRows, dedupHits, raceNotSingle, makeSummary, SMOKE,
} from './lib.js';

requireEnv(['MATCH_ID_WRITE', 'HOME_TEAM_ID', 'AWAY_TEAM_ID', 'HOME_PLAYER_IDS', 'LOGGER_TOKENS']);

const writeFail = new Counter('write_unexpected_status');
const LOGGERS = Math.min(LOGGER_TOKENS.length, 4);
const EXPECTED_WRITE = http.expectedStatuses(200, 201);
// The three verification scenarios assert exact score deltas, so they run strictly one after another
// on a quiet match (each iteration ~15s incl. the 11s dedup-window sleep), then the load scenarios start.
const ITERS = SMOKE ? 2 : 8;
const VERIF_S = ITERS * 16 + 15;         // seconds reserved per verification scenario
const T0 = VERIF_S * 3;                  // load scenarios start after all three

export const options = {
    scenarios: {
        replay: { executor: 'per-vu-iterations', vus: 1, iterations: ITERS, exec: 'replay', maxDuration: '10m' },
        race_id: { executor: 'per-vu-iterations', vus: 1, iterations: ITERS, exec: 'raceSameId', startTime: `${VERIF_S}s`, maxDuration: '10m' },
        race_sig: { executor: 'per-vu-iterations', vus: 1, iterations: ITERS, exec: 'raceSameSignature', startTime: `${VERIF_S * 2}s`, maxDuration: '10m' },
        steady: {
            executor: 'constant-vus', vus: Math.max(1, LOGGERS), duration: SMOKE ? '30s' : '5m',
            exec: 'steady', startTime: `${T0}s`,
        },
        burst: {
            executor: 'per-vu-iterations', vus: Math.max(1, LOGGERS), iterations: SMOKE ? 1 : 3,
            exec: 'burst', startTime: `${T0 + (SMOKE ? 10 : 60)}s`, maxDuration: '10m',
        },
    },
    thresholds: {
        'write_ack_ms': [`p(95)<${ms(2000)}`, `p(99)<${ms(4000)}`],
        'http_req_duration{endpoint:event_post}': [`p(95)<${ms(2000)}`, `p(99)<${ms(4000)}`],
        'dup_rows_found': ['count==0'],
        'race_not_single_winner': ['count==0'],
        'write_unexpected_status': ['count==0'], // anything other than 200/201 on a valid write (401/403/409/5xx)
        'http_req_failed{kind:write}': ['rate<0.01'],
        checks: ['rate>0.99'],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// -------------------------------------------------------------- helpers
const TEAM = { home: HOME_TEAM_ID, away: AWAY_TEAM_ID };
function players(side) { return side === 'home' ? HOME_PLAYER_IDS : (AWAY_PLAYER_IDS.length ? AWAY_PLAYER_IDS : HOME_PLAYER_IDS); }

function mk(type, minute, side, playerId, id) {
    return {
        id,
        type,
        minute,
        second: Math.floor(Math.random() * 59),
        teamId: TEAM[side],
        playerId: playerId === undefined ? pick(players(side)) : playerId,
        period: 'FIRST_HALF',
        loggerName: 'k6-load',
    };
}
const tok = (i) => LOGGER_TOKENS[(i === undefined ? 0 : i) % LOGGER_TOKENS.length];
const score = (b) => (b && b.match ? (b.match.homeScore || 0) : null);

function okWrite(res, accept) {
    const good = accept.indexOf(res.status) >= 0;
    if (!good) writeFail.add(1, { status: String(res.status) });
    return good;
}

// -------------------------------------------------------------- replay (idempotent client id)
export function replay() {
    const minute = (__ITER % 10); // 0-9
    const t = tok(0);
    const player = pick(players('home'), __ITER);
    const before = score(getDetail(MATCH_ID_WRITE, t).body);
    const id = newClientId('rp');
    const payload = mk('Goal', minute, 'home', player, id);

    const first = postEvent(MATCH_ID_WRITE, t, payload, { scenario_step: 'first' }, { responseCallback: EXPECTED_WRITE });
    const second = postEvent(MATCH_ID_WRITE, t, payload, { scenario_step: 'replay' }, { responseCallback: EXPECTED_WRITE });
    const third = postEvent(MATCH_ID_WRITE, t, payload, { scenario_step: 'replay' }, { responseCallback: EXPECTED_WRITE });
    okWrite(first, [201]); okWrite(second, [200]); okWrite(third, [200]);
    const sb = safeJson(second);
    check(null, {
        'replay: first POST 201': () => first.status === 201,
        'replay: 2nd POST 200 (idempotent)': () => second.status === 200,
        'replay: 3rd POST 200 (idempotent)': () => third.status === 200,
        'replay: 200 body says duplicate ignored': () => !!(sb && /Duplicate/i.test(sb.message || '')),
        'replay: replay returns the same event id': () => !!(sb && sb.event && sb.event.id === id),
    });

    sleep(1);
    const { events } = getEvents(MATCH_ID_WRITE, t);
    const rows = events.filter((e) => e.id === id).length;
    if (rows !== 1) dupRows.add(1, { scenario: 'replay' });
    check(null, { 'replay: exactly one DB row for the client id (GET)': () => rows === 1 });
    const after = score(getDetail(MATCH_ID_WRITE, t).body);
    check(null, { 'replay: score moved by exactly +1 after 3 POSTs of one goal': () => before !== null && after === before + 1 });
    sleep(11); // clear the 10s signature-dedup window so the next iteration's goal is independent
}

// -------------------------------------------------------------- race: same client id
export function raceSameId() {
    const minute = 10 + (__ITER % 10);
    const t = tok(0);
    const before = score(getDetail(MATCH_ID_WRITE, t).body);
    const id = newClientId('race');
    const player = pick(players('home'), __ITER);
    const body = JSON.stringify(mk('Goal', minute, 'home', player, id));
    const params = () => ({ headers: authHeaders(t), tags: { endpoint: 'event_post', kind: 'write', name: 'event_post', scenario_step: 'race_id' }, responseCallback: EXPECTED_WRITE });
    const [a, b] = http.batch([
        ['POST', `${BASE_URL}/api/matches/${MATCH_ID_WRITE}/events`, body, params()],
        ['POST', `${BASE_URL}/api/matches/${MATCH_ID_WRITE}/events`, body, params()],
    ]);
    const statuses = [a.status, b.status].sort();
    const single = statuses[0] === 200 && statuses[1] === 201;
    if (!single) raceNotSingle.add(1, { scenario: 'race_id', got: statuses.join('/') });
    check(null, { 'race(same id): one 201 + one 200': () => single });
    sleep(1);
    const { events } = getEvents(MATCH_ID_WRITE, t);
    const rows = events.filter((e) => e.id === id).length;
    if (rows !== 1) dupRows.add(1, { scenario: 'race_id' });
    const after = score(getDetail(MATCH_ID_WRITE, t).body);
    check(null, {
        'race(same id): exactly one row': () => rows === 1,
        'race(same id): score +1 exactly (no double count)': () => before !== null && after === before + 1,
    });
    sleep(11);
}

// -------------------------------------------------------------- race: different ids, same signature (dual logger)
export function raceSameSignature() {
    const minute = 20 + (__ITER % 10);
    const t1 = tok(0);
    const t2 = tok(1); // equals t1 if only one logger token supplied (still tests the double-tap shape)
    const before = score(getDetail(MATCH_ID_WRITE, t1).body);
    const player = pick(players('home'), __ITER + 3);
    const idA = newClientId('sa');
    const idB = newClientId('sb');
    const mkParams = (t) => ({ headers: authHeaders(t), tags: { endpoint: 'event_post', kind: 'write', name: 'event_post', scenario_step: 'race_sig' }, responseCallback: EXPECTED_WRITE });
    const [a, b] = http.batch([
        ['POST', `${BASE_URL}/api/matches/${MATCH_ID_WRITE}/events`, JSON.stringify(mk('Goal', minute, 'home', player, idA)), mkParams(t1)],
        ['POST', `${BASE_URL}/api/matches/${MATCH_ID_WRITE}/events`, JSON.stringify(mk('Goal', minute, 'home', player, idB)), mkParams(t2)],
    ]);
    const statuses = [a.status, b.status].sort();
    const single = statuses[0] === 200 && statuses[1] === 201;
    if (!single) raceNotSingle.add(1, { scenario: 'race_sig', got: statuses.join('/') });
    sleep(1);
    const { events } = getEvents(MATCH_ID_WRITE, t1);
    const rows = events.filter((e) => e.id === idA || e.id === idB).length;
    if (rows !== 1) dupRows.add(1, { scenario: 'race_sig' });
    const after = score(getDetail(MATCH_ID_WRITE, t1).body);
    check(null, {
        'race(same signature): one 201 + one 200 (dedup)': () => single,
        'race(same signature): exactly one row': () => rows === 1,
        'race(same signature): score +1 exactly (dedup regression guard)': () => before !== null && after === before + 1,
    });
    sleep(11);
}

// -------------------------------------------------------------- steady match-day load
const MIX = [['Foul', 50, true], ['Corner', 20, false], ['Yellow Card', 10, true], ['Offside', 10, false], ['Goal', 5, true], ['Shot', 5, true]];
function pickType() {
    let r = Math.random() * 100;
    for (const [t, w, p] of MIX) { if ((r -= w) <= 0) return [t, p]; }
    return ['Foul', true];
}

function logOne(vuIdx, tag) {
    const [type, withPlayer] = pickType();
    const side = Math.random() < 0.5 ? 'home' : 'away';
    const minute = 30 + Math.floor(Math.random() * 90);
    const payload = mk(type, minute, side, withPlayer ? undefined : null, newClientId(tag));
    const res = postEvent(MATCH_ID_WRITE, tok(vuIdx), payload, { scenario_step: tag }, { responseCallback: EXPECTED_WRITE });
    okWrite(res, [200, 201]);
    if (res.status === 200) dedupHits.add(1); // signature collision with an earlier random event: legitimate, just counted
    check(res, { 'write: 201 or 200': (r) => r.status === 201 || r.status === 200 }, { scenario_step: tag });
    return res;
}

export function steady() {
    logOne(__VU - 1, 'steady');
    sleep(12 * (0.7 + Math.random() * 0.6)); // 8-16s
}

// 5 events in 10s (one every ~2s), then ~50s quiet
export function burst() {
    for (let i = 0; i < 5; i++) {
        logOne(__VU - 1, 'burst');
        sleep(2);
    }
    sleep(50);
}

export default function () { steady(); }

export const handleSummary = makeSummary('02-write-path');
