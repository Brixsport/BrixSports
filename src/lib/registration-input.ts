/**
 * Validation for the public POST /api/competitions/register payload.
 *
 * The endpoint takes no account, so everything in the body is untrusted: it is
 * stored as-is and later copied onto public teams and players when an admin
 * approves the registration. Pure functions only (no DB), so they can be unit tested.
 */

export const MAX_REGISTRATION_PLAYERS = 40;

export interface RegistrationTeamInfo {
    teamName: string;
    schoolName: string;
    shortName: string;
    logo: string | null;
    color: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    notes: string | null;
}

export interface RegistrationPlayer {
    name: string;
    jerseyName: string | null;
    number: number;
    position: string;
    age: number | null;
    height: string | null;
    weight: string | null;
    nationality: string;
    university: string | null;
    college: string | null;
    department: string | null;
    image: string | null;
}

export type RegistrationParse =
    | { ok: true; teamInfo: RegistrationTeamInfo; players: RegistrationPlayer[] }
    | { ok: false; error: string };

export interface RegistrationCompetition {
    registrationOpen: boolean | null;
    registrationDeadline: Date | null;
    maxTeams: number | null;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Required string, trimmed, 1..max characters. Returns null when invalid. */
function requiredString(value: unknown, max: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

/** Optional string: undefined/null/'' become null; a non-string or over-long value is invalid (undefined). */
function optionalString(value: unknown, max: number): string | null | undefined {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    return trimmed.length <= max ? trimmed : undefined;
}

/** Optional URL: empty becomes null; anything other than an https URL is invalid (undefined). */
export function optionalHttpsUrl(value: unknown): string | null | undefined {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || value.length > 500) return undefined;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' ? url.toString() : undefined;
    } catch {
        return undefined;
    }
}

function optionalInteger(value: unknown, min: number, max: number): number | null | undefined {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'boolean') return undefined;
    const num = Number(value);
    if (!Number.isInteger(num) || num < min || num > max) return undefined;
    return num;
}

export function parseRegistrationInput(body: unknown): RegistrationParse {
    if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };
    const { teamInfo, players } = body;

    if (!isRecord(teamInfo)) return { ok: false, error: 'teamInfo is required' };
    if (!Array.isArray(players)) return { ok: false, error: 'players must be an array' };
    if (players.length > MAX_REGISTRATION_PLAYERS) {
        return { ok: false, error: `A registration can include at most ${MAX_REGISTRATION_PLAYERS} players` };
    }

    const teamName = requiredString(teamInfo.teamName, 100);
    if (!teamName) return { ok: false, error: 'teamInfo.teamName is required (max 100 characters)' };
    const schoolName = requiredString(teamInfo.schoolName, 150);
    if (!schoolName) return { ok: false, error: 'teamInfo.schoolName is required (max 150 characters)' };
    const shortName = requiredString(teamInfo.shortName, 20);
    if (!shortName) return { ok: false, error: 'teamInfo.shortName is required (max 20 characters)' };
    const contactName = requiredString(teamInfo.contactName, 100);
    if (!contactName) return { ok: false, error: 'teamInfo.contactName is required (max 100 characters)' };
    const contactEmail = requiredString(teamInfo.contactEmail, 254);
    if (!contactEmail || !EMAIL.test(contactEmail)) {
        return { ok: false, error: 'teamInfo.contactEmail must be a valid email address' };
    }
    const contactPhone = requiredString(teamInfo.contactPhone, 40);
    if (!contactPhone) return { ok: false, error: 'teamInfo.contactPhone is required (max 40 characters)' };

    const color = teamInfo.color === undefined || teamInfo.color === null || teamInfo.color === ''
        ? '#000000'
        : teamInfo.color;
    if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
        return { ok: false, error: 'teamInfo.color must be a hex color such as #1a2b3c' };
    }

    const logo = optionalHttpsUrl(teamInfo.logo);
    if (logo === undefined) return { ok: false, error: 'teamInfo.logo must be an https URL' };

    const notes = optionalString(teamInfo.notes, 1000);
    if (notes === undefined) return { ok: false, error: 'teamInfo.notes must be a string of at most 1000 characters' };

    const parsedPlayers: RegistrationPlayer[] = [];
    for (let i = 0; i < players.length; i++) {
        const raw = players[i];
        const label = `players[${i}]`;
        if (!isRecord(raw)) return { ok: false, error: `${label} must be an object` };

        const name = requiredString(raw.name, 100);
        if (!name) return { ok: false, error: `${label}.name is required (max 100 characters)` };
        const position = requiredString(raw.position, 30);
        if (!position) return { ok: false, error: `${label}.position is required (max 30 characters)` };

        const number = optionalInteger(raw.number, 0, 999);
        if (number === null || number === undefined) {
            return { ok: false, error: `${label}.number must be a whole number between 0 and 999` };
        }
        const age = optionalInteger(raw.age, 10, 80);
        if (age === undefined) return { ok: false, error: `${label}.age must be a whole number between 10 and 80` };

        const jerseyName = optionalString(raw.jerseyName, 50);
        const height = optionalString(raw.height, 20);
        const weight = optionalString(raw.weight, 20);
        const nationality = optionalString(raw.nationality, 60);
        const university = optionalString(raw.university, 150);
        const college = optionalString(raw.college, 150);
        const department = optionalString(raw.department, 150);
        if ([jerseyName, height, weight, nationality, university, college, department].some((v) => v === undefined)) {
            return { ok: false, error: `${label} has a text field that is not a string or is too long` };
        }
        const image = optionalHttpsUrl(raw.image);
        if (image === undefined) return { ok: false, error: `${label}.image must be an https URL` };

        parsedPlayers.push({
            name,
            jerseyName: jerseyName as string | null,
            number,
            position,
            age,
            height: height as string | null,
            weight: weight as string | null,
            nationality: (nationality as string | null) ?? 'Nigeria',
            university: university as string | null,
            college: college as string | null,
            department: department as string | null,
            image,
        });
    }

    return {
        ok: true,
        teamInfo: {
            teamName,
            schoolName,
            shortName,
            logo,
            color,
            contactName,
            contactEmail,
            contactPhone,
            notes,
        },
        players: parsedPlayers,
    };
}

/**
 * Whether a competition currently accepts a new registration.
 * `activeRegistrations` is the number of pending + approved registrations already on file.
 * Returns an error message, or null when registration may proceed.
 */
export function checkRegistrationOpen(
    competition: RegistrationCompetition,
    activeRegistrations: number,
    now: Date
): string | null {
    if (!competition.registrationOpen) return 'Registration is closed for this competition';
    if (competition.registrationDeadline && now.getTime() > competition.registrationDeadline.getTime()) {
        return 'The registration deadline for this competition has passed';
    }
    if (competition.maxTeams && competition.maxTeams > 0 && activeRegistrations >= competition.maxTeams) {
        return 'This competition has reached its maximum number of teams';
    }
    return null;
}
