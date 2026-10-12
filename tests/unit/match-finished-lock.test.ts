import { describe, it, expect } from 'vitest';
import { isFinishedLockViolation } from '@/lib/match-finished-lock';

const logger = (currentStatus: string, body: Record<string, unknown>) =>
    isFinishedLockViolation({ role: 'logger', currentStatus, body });

describe('isFinishedLockViolation', () => {
    it('never locks an admin', () => {
        expect(isFinishedLockViolation({ role: 'admin', currentStatus: 'FINISHED', body: { status: 'LIVE', currentPeriod: 'FIRST_HALF', minute: 3 } })).toBe(false);
    });

    it('never locks a match that is not finished', () => {
        expect(logger('LIVE', { status: 'LIVE', currentPeriod: 'SECOND_HALF', minute: 70, extraTime: 2 })).toBe(false);
        expect(logger('PENDING', { currentPeriod: 'FIRST_HALF' })).toBe(false);
    });

    it('lets a logger finish a live match (status and period FINISHED together)', () => {
        expect(logger('LIVE', { status: 'FINISHED', currentPeriod: 'FINISHED' })).toBe(false);
    });

    it('locks reopening a finished match via status', () => {
        expect(logger('FINISHED', { status: 'LIVE' })).toBe(true);
    });

    it('locks changing currentPeriod on a finished match', () => {
        expect(logger('FINISHED', { currentPeriod: 'FIRST_HALF' })).toBe(true);
        expect(logger('FINISHED', { currentPeriod: 'SECOND_HALF' })).toBe(true);
        expect(logger('FINISHED', { status: 'FINISHED', currentPeriod: 'SECOND_HALF' })).toBe(true);
    });

    it('locks setting minute or extraTime on a finished match', () => {
        expect(logger('FINISHED', { minute: 45, extraTime: 3 })).toBe(true);
        expect(logger('FINISHED', { extraTime: 2 })).toBe(true);
    });

    it('allows an idempotent repeat of the finish request', () => {
        expect(logger('FINISHED', { status: 'FINISHED', currentPeriod: 'FINISHED' })).toBe(false);
        expect(logger('FINISHED', { status: 'FINISHED', currentPeriod: 'FINISHED', minute: null, extraTime: null })).toBe(false);
        expect(logger('FINISHED', { currentPeriod: 'FINISHED' })).toBe(false);
    });

    it('ignores bodies that touch none of the locked fields', () => {
        expect(logger('FINISHED', { stats: {} })).toBe(false);
    });
});
