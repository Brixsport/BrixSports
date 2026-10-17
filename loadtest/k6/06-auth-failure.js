// 06-auth-failure.js - auth / validation / lifecycle failure paths of POST /api/matches/{id}/events.
//
// Two kinds of assertions:
//   HARD  - behaviour the code clearly implements; a failure is a regression.        counter: hard_fail
//   SPEC  - behaviour that should happen but, going by the source, does not yet
//           (marked "EXPECTED-FAIL (finding)"). They are recorded in `spec_nonconformance` with the observed status.
//           Re-check each against the current route before relying on it. Run on the disposable match: some SPEC probes insert rows/score.
//
// Facts taken from the source (src/app/api/matches/[id]/events/route.ts):
//   :91-97  no/invalid/expired token -> getAuthUser null -> 401 (verifyAuth swallows jwt errors, lib/auth.ts:57-68)
//   :98-113 logger not ACTIVE-assigned -> 403 (this check runs BEFORE match existence, so a bogus match id = 403 for loggers)
//   :115    request.json() is inside the outer try -> malformed JSON ends in the catch -> 500 (:592-597), not 4xx
//   :133    only `type` and `minute` required -> 400. playerId / teamId NOT validated (a Goal without teamId credits AWAY,
//           :402-405; a Goal without playerId skips the dedup INSERT..SELECT and uses a plain insert, :395-397)
//   :164-190 client-id replay is checked BEFORE the FINISHED lock -> replay of a saved id on a finished match = 200; new event = 409
//   :270    type.toUpperCase() on a non-string `type` throws -> 500
//   no body-size or field-length validation in the route; platform limit applies (Vercel function body ~4.5MB -> 413 [unconfirmed])
//
// Needs: LOGGER_TOKENS (assigned to MATCH_ID_WRITE), MATCH_ID_WRITE, HOME_TEAM_ID, HOME_PLAYER_IDS, FINISHED_MATCH_ID (logger assigned to it too,
// otherwise the 409 probe will see 403 - fixture problem, reported as such), EXPIRED_TOKEN or (JWT_SECRET_STAGING + LOGGER_ID_FOR_MINT).
import http from 'k6/http';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import {
    requireEnv, LOGGER_TOKENS, MATCH_ID_WRITE, FINISHED_MATCH_ID, FINISHED_MATCH_KNOWN_EVENT_ID, HOME_TEAM_ID, HOME_PLAYER_IDS,
    EXPIRED_TOKEN, UNASSIGNED_LOGGER_TOKEN, JWT_SECRET_STAGING, LOGGER_ID_FOR_MINT, BASE_URL, authHeaders, baseHeaders, pick,
} from './config.js';
import { newClientId, makeSummary, SMOKE } from './lib.js';

requireEnv(['MATCH_ID_WRITE', 'HOME_TEAM_ID', 'HOME_PLAYER_IDS', 'LOGGER_TOKENS']);

const hardFail = new Counter('hard_fail');
const specFail = new Counter('spec_nonconformance');
const unexpected5xx = new Counter('unexpected_5xx_on_auth_path');
const ANY = http.expectedStatuses({ min: 200, max: 599 });
const URL_W = `${BASE_URL}/api/matches/${MATCH_ID_WRITE}/events`;

export const options = {
    scenarios: { once: { executor: 'per-vu-iterations', vus: 1, iterations: 1, maxDuration: '10m' } },
    thresholds: {
        'hard_fail': ['count==0'],
        'unexpected_5xx_on_auth_path': ['count==0'], // 401/403/404 paths must never 500
        'spec_nonconformance': ['count==0'],         // expected to fail until the gaps listed in the header are fixed
        checks: ['rate>0.95'],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function b64u(s) { return encoding.b64encode(s, 'rawurl'); }
function mintExpired() {
    if (EXPIRED_TOKEN) return EXPIRED_TOKEN;
    if (!(JWT_SECRET_STAGING && LOGGER_ID_FOR_MINT)) return '';
    const now = Math.floor(Date.now() / 1000);
    const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const p = b64u(JSON.stringify({ id: LOGGER_ID_FOR_MINT, email: 'k6-expired@example.invalid', role: 'logger', iat: now - 7200, exp: now - 3600 }));
    const sig = crypto.hmac('sha256', JWT_SECRET_STAGING, `${h}.${p}`, 'base64rawurl'); // never logged
    return `${h}.${p}.${sig}`;
}

// count5xx=false for the SPEC probes whose 5xx is the finding itself (reported via spec_nonconformance instead)
function post(url, token, body, rawBody, count5xx) {
    const r = http.post(url, rawBody !== undefined ? rawBody : JSON.stringify(body), {
        headers: token === null ? Object.assign(baseHeaders(), { 'Content-Type': 'application/json' }) : authHeaders(token),
        tags: { kind: 'authpath', name: 'event_post' }, responseCallback: ANY, timeout: '60s',
    });
    if (count5xx !== false && r.status >= 500) unexpected5xx.add(1, { status: String(r.status) });
    return r;
}

function hard(name, ok) {
    const pass = check(null, { [`HARD ${name}`]: () => ok });
    if (!pass) hardFail.add(1, { case: name });
}
// SPEC: desired behaviour. `ok` false => finding, tagged with what we actually observed.
function spec(name, ok, observed) {
    const pass = check(null, { [`SPEC ${name}`]: () => ok });
    if (!pass) {
        specFail.add(1, { case: name, observed: String(observed) });
        console.warn(`SPEC FINDING (EXPECTED-FAIL): ${name} -> observed ${observed}`);
    }
}

export default function () {
    const t = LOGGER_TOKENS[0];
    const good = () => ({ id: newClientId('au'), type: 'Foul', minute: 40, second: 1, teamId: HOME_TEAM_ID, playerId: pick(HOME_PLAYER_IDS), period: 'FIRST_HALF' });

    // ---------------------------------------------------------------- authentication
    hard('no token -> 401', post(URL_W, null, good()).status === 401);
    hard('garbage token -> 401', post(URL_W, 'not.a.jwt', good()).status === 401);
    hard('truncated valid token -> 401', post(URL_W, t.slice(0, Math.max(10, t.length - 7)), good()).status === 401);
    const exp = mintExpired();
    if (exp) {
        const r = post(URL_W, exp, good());
        hard('expired logger token -> 401 (never 500)', r.status === 401);
    } else {
        console.warn('06: EXPIRED_TOKEN (or JWT_SECRET_STAGING + LOGGER_ID_FOR_MINT) not supplied - expired-token case skipped');
    }
    if (UNASSIGNED_LOGGER_TOKEN) hard('unassigned logger -> 403', post(URL_W, UNASSIGNED_LOGGER_TOKEN, good()).status === 403);
    hard('logger on non-existent match -> 403 (assignment check precedes 404)',
        post(`${BASE_URL}/api/matches/k6-does-not-exist/events`, t, good()).status === 403);

    // ---------------------------------------------------------------- validation
    const noType = good(); delete noType.type;
    const noMinute = good(); delete noMinute.minute;
    hard('missing type -> 400', post(URL_W, t, noType).status === 400);
    hard('missing minute -> 400', post(URL_W, t, noMinute).status === 400);
    // (the route returns 400 for validation errors; not asserted as a failure)

    // SPEC: missing playerId on a player-attributed scoring event should be rejected with 4xx.
    // Source: accepted (201) and the goal is scored (route.ts:132-138 only checks type+minute). EXPECTED-FAIL.
    const goalNoPlayer = { id: newClientId('np'), type: 'Goal', minute: 41, second: 2, teamId: HOME_TEAM_ID, period: 'FIRST_HALF' };
    let r = post(URL_W, t, goalNoPlayer);
    spec('Goal without playerId -> 4xx', r.status >= 400 && r.status < 500, r.status);
    // SPEC: missing teamId on a Goal must be rejected. Source: 201 and score credited to AWAY (route.ts:402-405). EXPECTED-FAIL.
    const goalNoTeam = { id: newClientId('nt'), type: 'Goal', minute: 42, second: 3, playerId: pick(HOME_PLAYER_IDS), period: 'FIRST_HALF' };
    r = post(URL_W, t, goalNoTeam);
    spec('Goal without teamId -> 4xx (would otherwise credit AWAY)', r.status >= 400 && r.status < 500, r.status);
    // SPEC: malformed JSON must be 4xx. Source: request.json() throws inside the outer try -> 500 (route.ts:115,592-597). EXPECTED-FAIL.
    r = post(URL_W, t, null, '{"type":"Foul","minute":', false);
    spec('malformed JSON -> 4xx not 500', r.status >= 400 && r.status < 500, r.status);
    // SPEC: non-string type must be 4xx. Source: type.toUpperCase() TypeError -> 500 (route.ts:270). EXPECTED-FAIL.
    const numType = good(); numType.type = 12345;
    r = post(URL_W, t, numType, undefined, false);
    spec('non-string type -> 4xx not 500', r.status >= 400 && r.status < 500, r.status);
    // SPEC: wrong-typed minute (string) - observe only (stored as-is? see response)
    const strMinute = good(); strMinute.minute = 'abc';
    r = post(URL_W, t, strMinute, undefined, false);
    spec('non-numeric minute -> 4xx', r.status >= 400 && r.status < 500, r.status);

    // ---------------------------------------------------------------- oversize
    const kb = SMOKE ? 20 : parseInt(__ENV.OVERSIZE_KB || '200', 10);
    const big = good(); big.detail = 'x'.repeat(kb * 1024);
    r = post(URL_W, t, big, undefined, false);
    // SPEC: an unbounded `detail` should be capped (4xx). Source: no length validation -> 201, row stored and then
    // returned to EVERY viewer poll of /api/matches/{id} (events limit 500). EXPECTED-FAIL.
    spec(`${kb}KB detail field -> 4xx (cap)`, r.status >= 400 && r.status < 500, r.status);
    if ((__ENV.BIG_BODY || '') === '1') {
        const huge = good(); huge.detail = 'x'.repeat(6 * 1024 * 1024);
        r = post(URL_W, t, huge);
        // platform limit (Vercel FUNCTION_PAYLOAD_TOO_LARGE 413) [unconfirmed]; never 5xx from our code, never 201
        hard('6MB body -> 413 (platform) and not stored', r.status === 413);
    }

    // ---------------------------------------------------------------- finished match write lock
    if (FINISHED_MATCH_ID) {
        const urlF = `${BASE_URL}/api/matches/${FINISHED_MATCH_ID}/events`;
        r = post(urlF, t, good());
        if (r.status === 403) {
            console.warn('06: FINISHED_MATCH_ID returned 403 - the logger is not assigned to it; assign them to exercise the 409 lock');
            hard('finished-match fixture usable (logger assigned)', false);
        } else {
            hard('finished match: new event -> 409', r.status === 409);
        }
        if (FINISHED_MATCH_KNOWN_EVENT_ID) {
            const rp = good(); rp.id = FINISHED_MATCH_KNOWN_EVENT_ID;
            r = post(urlF, t, rp);
            hard('finished match: replay of an already-saved id -> 200 (not 409; route.ts:164 precedes :185)', r.status === 200);
        }
    } else {
        console.warn('06: FINISHED_MATCH_ID not supplied - 409 lock case skipped');
    }

    // ---------------------------------------------------------------- read side sanity
    const g = http.get(`${BASE_URL}/api/matches/${MATCH_ID_WRITE}/events`, { headers: baseHeaders(), tags: { kind: 'authpath', name: 'events_get_anon' }, responseCallback: ANY });
    hard('anonymous GET events: 200', g.status === 200);
    hard('anonymous GET events: no loggerId/loggerName (NDPR)', g.status === 200 && g.body.indexOf('"loggerId"') < 0 && g.body.indexOf('"loggerName"') < 0);
    sleep(1);
}

export const handleSummary = makeSummary('06-auth-failure', () => [
    '',
    'SPEC FINDINGS list: grep the console output for "SPEC FINDING (EXPECTED-FAIL)". Each line is a gap confirmed (or not) by this run.',
    'If a SPEC case PASSED, the gap was fixed or never existed - update failure-modes.md.',
    '',
].join('\n'));
