/**
 * Validation for PATCH /api/admin/settings values. Pure so it can be unit tested.
 * Setting values are stored as text, so numbers and booleans are accepted and
 * converted to their string form; anything else is rejected.
 */
export type SettingValueResult = { ok: true; value: string } | { ok: false; error: string };

const SEASON_PATTERN = /^(\d{4})\/(\d{4})$/;

export function validateSettingValue(key: string, type: string | null, value: unknown): SettingValueResult {
    let text: string;
    if (typeof value === 'string') {
        text = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
        text = String(value);
    } else {
        return { ok: false, error: 'Setting value must be a string, number or boolean' };
    }

    if (type === 'number' && (text.trim() === '' || isNaN(Number(text)))) {
        return { ok: false, error: 'Invalid number value' };
    }

    if (type === 'boolean' && !['true', 'false'].includes(text.toLowerCase())) {
        return { ok: false, error: 'Invalid boolean value. Must be "true" or "false"' };
    }
    if (type === 'boolean') {
        // Flag readers compare against the exact string 'true'
        text = text.toLowerCase();
    }

    if (key === 'system.season.current') {
        const match = SEASON_PATTERN.exec(text);
        if (!match || Number(match[2]) !== Number(match[1]) + 1) {
            return { ok: false, error: 'Season must look like 2026/2027 (consecutive years)' };
        }
    }

    return { ok: true, value: text };
}
