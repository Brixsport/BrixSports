// Minute and stoppage ("extra time") fields broadcast for the football clock, derived
// from the configured half length instead of assuming 45-minute halves.

export interface ClockCheckpoint {
    minute: number;
    extraTime: number;
}

export function clockCheckpoint(period: string, absoluteMinute: number, halfDuration: number): ClockCheckpoint {
    const half = halfDuration > 0 ? halfDuration : 45;
    if (period === 'FIRST_HALF' && absoluteMinute > half) {
        return { minute: half, extraTime: absoluteMinute - half };
    }
    if (period === 'SECOND_HALF' && absoluteMinute > half * 2) {
        return { minute: half * 2, extraTime: absoluteMinute - half * 2 };
    }
    return { minute: absoluteMinute, extraTime: 0 };
}
