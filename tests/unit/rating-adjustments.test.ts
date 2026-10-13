import { describe, it, expect } from 'vitest';
import {
    isUnchangedAdjustment,
    selectChangedAdjustments,
    normalizeAdjustmentNotes,
    MAX_ADJUSTMENT_NOTES_LENGTH,
    type StoredRating,
} from '@/lib/ratings/adjustments';

const auto: StoredRating = { autoRating: 6.8, finalRating: null, adjustmentNotes: null, isMotM: false };

describe('isUnchangedAdjustment', () => {
    it('treats the shown automatic rating with no edits as unchanged', () => {
        expect(isUnchangedAdjustment(auto, { playerId: 'p1', finalRating: 6.8, notes: '', isMotM: false })).toBe(true);
    });

    it('treats a different rating as changed', () => {
        expect(isUnchangedAdjustment(auto, { playerId: 'p1', finalRating: 7.4, notes: '', isMotM: false })).toBe(false);
    });

    it('compares against the final rating once one exists', () => {
        const adjusted: StoredRating = { ...auto, finalRating: 7.5 };
        expect(isUnchangedAdjustment(adjusted, { playerId: 'p1', finalRating: 7.5, notes: '', isMotM: false })).toBe(true);
        expect(isUnchangedAdjustment(adjusted, { playerId: 'p1', finalRating: 6.8, notes: '', isMotM: false })).toBe(false);
    });

    it('ignores floating point noise but not a 0.1 step', () => {
        expect(isUnchangedAdjustment(auto, { playerId: 'p1', finalRating: 6.800000000000001, notes: '', isMotM: false })).toBe(true);
        expect(isUnchangedAdjustment(auto, { playerId: 'p1', finalRating: 6.9, notes: '', isMotM: false })).toBe(false);
    });

    it('treats changed notes as a change', () => {
        expect(isUnchangedAdjustment(auto, { playerId: 'p1', finalRating: 6.8, notes: 'late tackle', isMotM: false })).toBe(false);
    });

    it('treats a MotM flag flip as a change', () => {
        expect(isUnchangedAdjustment(auto, { playerId: 'p1', finalRating: 6.8, notes: '', isMotM: true })).toBe(false);
        const motm: StoredRating = { ...auto, isMotM: true };
        expect(isUnchangedAdjustment(motm, { playerId: 'p1', finalRating: 6.8, notes: '', isMotM: false })).toBe(false);
    });

    it('never treats a non-numeric rating as unchanged', () => {
        expect(isUnchangedAdjustment(auto, { playerId: 'p1', finalRating: '6.8' as unknown as number, notes: '', isMotM: false })).toBe(false);
    });
});

describe('selectChangedAdjustments', () => {
    it('drops untouched rows and keeps edited ones', () => {
        const stored = new Map<string, StoredRating>([
            ['p1', auto],
            ['p2', { ...auto, autoRating: 7.2 }],
            ['p3', { ...auto, autoRating: 5.9 }],
        ]);
        const submitted = [
            { playerId: 'p1', finalRating: 6.8, notes: '', isMotM: false },
            { playerId: 'p2', finalRating: 8.0, notes: '', isMotM: false },
            { playerId: 'p3', finalRating: 5.9, notes: '', isMotM: true },
        ];
        expect(selectChangedAdjustments(submitted, stored).map((a) => a.playerId)).toEqual(['p2', 'p3']);
    });

    it('keeps rows with no stored counterpart so the server can reject them', () => {
        const submitted = [{ playerId: 'ghost', finalRating: 6, notes: '', isMotM: false }];
        expect(selectChangedAdjustments(submitted, new Map())).toHaveLength(1);
    });
});

describe('normalizeAdjustmentNotes', () => {
    it('maps empty values to null', () => {
        expect(normalizeAdjustmentNotes(undefined)).toEqual({ ok: true, value: null });
        expect(normalizeAdjustmentNotes(null)).toEqual({ ok: true, value: null });
        expect(normalizeAdjustmentNotes('')).toEqual({ ok: true, value: null });
    });

    it('accepts notes up to the cap and rejects longer ones', () => {
        expect(normalizeAdjustmentNotes('a'.repeat(MAX_ADJUSTMENT_NOTES_LENGTH)).ok).toBe(true);
        expect(normalizeAdjustmentNotes('a'.repeat(MAX_ADJUSTMENT_NOTES_LENGTH + 1)).ok).toBe(false);
    });

    it('rejects non-text notes', () => {
        expect(normalizeAdjustmentNotes({ text: 'x' }).ok).toBe(false);
        expect(normalizeAdjustmentNotes(42).ok).toBe(false);
    });
});
