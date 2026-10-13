// Offline drain ordering. planDrain and the response classifier are loaded from
// the shipped public/sw-admin.js (between their BEGIN/END markers) so the test
// exercises the real code, not a copy.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

type Row = { id: number; matchId?: string; data?: any; url?: string; method?: string; token?: string; failed?: boolean };
type Step = { store: string; row: Row };
type Plan = { phases: Step[][]; cancelled: Step[] };

function loadSw() {
    const src = readFileSync(join(process.cwd(), 'public', 'sw-admin.js'), 'utf8');
    const grab = (name: string) => {
        const m = src.match(new RegExp(`// BEGIN ${name}([\\s\\S]*?)// END ${name}`));
        if (!m) throw new Error(`${name} markers not found in sw-admin.js`);
        return m[1];
    };
    return new Function(
        `${grab('sync-policy')}\n${grab('drain-plan')}\nreturn { classifySyncResponse, planDrain };`
    )() as {
        classifySyncResponse: (status: number, code?: string, method?: string) => 'done' | 'retry' | 'failed';
        planDrain: (events: Row[], changes: Row[]) => Plan;
    };
}

const { classifySyncResponse, planDrain } = loadSw();

const ev = (id: number, eventId: string, matchId = 'm1'): Row => ({ id, matchId, data: { id: eventId, type: 'Goal' }, token: 't' });
const patch = (id: number, data: object, matchId = 'm1'): Row => ({ id, url: `/api/matches/${matchId}`, method: 'PATCH', data, token: 't' });
const del = (id: number, eventId: string, matchId = 'm1'): Row => ({ id, url: `/api/matches/${matchId}/events/${eventId}`, method: 'DELETE', data: {}, token: 't' });
const ids = (steps: Step[]) => steps.map((s) => `${s.store === 'pendingMatchEvents' ? 'e' : 'c'}${s.row.id}`);

describe('planDrain ordering', () => {
    it('sends the FINISHED write after queued events, even if it was queued first', () => {
        const finished = patch(1, { currentPeriod: 'FINISHED', status: 'FINISHED' });
        const plan = planDrain([ev(1, 'a'), ev(2, 'b')], [finished]);
        expect(ids(plan.phases[0])).toEqual([]);
        expect(ids(plan.phases[1])).toEqual(['e1', 'e2']);
        expect(ids(plan.phases[2])).toEqual(['c1']);
    });

    it('sends the match-start write before queued events', () => {
        const start = patch(5, { status: 'LIVE', currentPeriod: 'FIRST_HALF' });
        const plan = planDrain([ev(1, 'a')], [start]);
        expect(ids(plan.phases[0])).toEqual(['c5']);
        expect(ids(plan.phases[1])).toEqual(['e1']);
    });

    it('treats a basketball first-quarter start as a start write', () => {
        const plan = planDrain([], [patch(1, { status: 'LIVE', currentPeriod: 'Q1' })]);
        expect(ids(plan.phases[0])).toEqual(['c1']);
    });

    it('puts later period writes (half time, second half) after events, in queue order', () => {
        const plan = planDrain(
            [ev(1, 'a')],
            [patch(2, { currentPeriod: 'SECOND_HALF' }), patch(1, { currentPeriod: 'HALF_TIME' })]
        );
        expect(ids(plan.phases[2])).toEqual(['c1', 'c2']);
    });

    it('places event deletes after the events and before period / FINISHED writes', () => {
        const plan = planDrain([ev(1, 'a')], [patch(1, { currentPeriod: 'FINISHED', status: 'FINISHED' }), del(2, 'saved-earlier')]);
        expect(ids(plan.phases[1])).toEqual(['e1', 'c2']);
        expect(ids(plan.phases[2])).toEqual(['c1']);
    });

    it('keeps events in queue order regardless of the order rows are supplied in', () => {
        const plan = planDrain([ev(3, 'c'), ev(1, 'a'), ev(2, 'b')], []);
        expect(ids(plan.phases[1])).toEqual(['e1', 'e2', 'e3']);
    });

    it('ignores rows already marked failed', () => {
        const plan = planDrain([{ ...ev(1, 'a'), failed: true }, ev(2, 'b')], [{ ...patch(1, { currentPeriod: 'HALF_TIME' }), failed: true }]);
        expect(ids(plan.phases[1])).toEqual(['e2']);
        expect(plan.phases[2]).toEqual([]);
    });
});

describe('planDrain undo cancellation', () => {
    it('cancels a queued delete together with the still-queued event it targets', () => {
        const plan = planDrain([ev(1, 'a'), ev(2, 'b')], [del(1, 'a')]);
        expect(ids(plan.phases[1])).toEqual(['e2']);
        expect(ids(plan.cancelled).sort()).toEqual(['c1', 'e1']);
    });

    it('does not cancel when the target event is for a different match', () => {
        const plan = planDrain([ev(1, 'a', 'm1')], [del(1, 'a', 'm2')]);
        expect(ids(plan.phases[1])).toEqual(['e1', 'c1']);
        expect(plan.cancelled).toEqual([]);
    });

    it('keeps a delete whose event is not in the queue (already saved on the server)', () => {
        const plan = planDrain([], [del(1, 'saved')]);
        expect(ids(plan.phases[1])).toEqual(['c1']);
        expect(plan.cancelled).toEqual([]);
    });

    it('accepts an absolute delete url', () => {
        const row = { ...del(1, 'a'), url: 'https://example.test/api/matches/m1/events/a' };
        const plan = planDrain([ev(1, 'a')], [row]);
        expect(plan.cancelled.length).toBe(2);
    });
});

describe('classifySyncResponse (drain additions)', () => {
    it('treats 404 on a DELETE as done, but not on other methods', () => {
        expect(classifySyncResponse(404, '', 'DELETE')).toBe('done');
        expect(classifySyncResponse(404, '', 'POST')).toBe('failed');
        expect(classifySyncResponse(404, '', 'PATCH')).toBe('failed');
    });

    it('keeps an event queued on 409 MATCH_NOT_LIVE but fails other 409s', () => {
        expect(classifySyncResponse(409, 'MATCH_NOT_LIVE', 'POST')).toBe('retry');
        expect(classifySyncResponse(409, 'Cannot log events against a finished match', 'POST')).toBe('failed');
        expect(classifySyncResponse(409, '', 'POST')).toBe('failed');
        expect(classifySyncResponse(409, 'PERIOD_REGRESSION', 'PATCH')).toBe('failed');
    });

    it('is unchanged for callers passing only a status', () => {
        expect(classifySyncResponse(200)).toBe('done');
        expect(classifySyncResponse(503)).toBe('retry');
        expect(classifySyncResponse(422)).toBe('failed');
    });
});
