import { describe, it, expect } from 'vitest';
import {
    MAX_REGISTRATION_PLAYERS,
    checkRegistrationOpen,
    optionalHttpsUrl,
    parseRegistrationInput,
} from '@/lib/registration-input';

const team = {
    teamName: 'Lions FC',
    schoolName: 'University of Lagos',
    shortName: 'LFC',
    color: '#112233',
    logo: '',
    contactName: 'Ada',
    contactEmail: 'ada@example.com',
    contactPhone: '08012345678',
    notes: '',
};
const player = { name: 'Chidi', number: 9, position: 'Forward', age: 21, image: '' };

describe('parseRegistrationInput', () => {
    it('accepts a normal payload and normalises empty optionals to null', () => {
        const r = parseRegistrationInput({ teamInfo: team, players: [player] });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.teamInfo.logo).toBeNull();
            expect(r.players[0].image).toBeNull();
            expect(r.players[0].nationality).toBe('Nigeria');
        }
    });

    it('rejects more than the player cap', () => {
        const players = Array.from({ length: MAX_REGISTRATION_PLAYERS + 1 }, () => player);
        expect(parseRegistrationInput({ teamInfo: team, players }).ok).toBe(false);
        const atCap = Array.from({ length: MAX_REGISTRATION_PLAYERS }, () => player);
        expect(parseRegistrationInput({ teamInfo: team, players: atCap }).ok).toBe(true);
    });

    it('rejects non-https and malformed logo / image URLs', () => {
        expect(parseRegistrationInput({ teamInfo: { ...team, logo: 'http://x.test/a.png' }, players: [] }).ok).toBe(false);
        expect(parseRegistrationInput({ teamInfo: { ...team, logo: 'javascript:alert(1)' }, players: [] }).ok).toBe(false);
        expect(parseRegistrationInput({ teamInfo: team, players: [{ ...player, image: 'data:image/png;base64,AAAA' }] }).ok).toBe(false);
        expect(parseRegistrationInput({ teamInfo: { ...team, logo: 'https://res.cloudinary.com/x/a.png' }, players: [] }).ok).toBe(true);
    });

    it('rejects missing or non-string required fields', () => {
        expect(parseRegistrationInput({ teamInfo: { ...team, teamName: '' }, players: [] }).ok).toBe(false);
        expect(parseRegistrationInput({ teamInfo: { ...team, contactEmail: 'not-an-email' }, players: [] }).ok).toBe(false);
        expect(parseRegistrationInput({ teamInfo: { ...team, shortName: 42 }, players: [] }).ok).toBe(false);
        expect(parseRegistrationInput({ teamInfo: team, players: [{ ...player, name: undefined }] }).ok).toBe(false);
        expect(parseRegistrationInput({ teamInfo: team, players: [{ ...player, number: 'abc' }] }).ok).toBe(false);
    });

    it('rejects a non-array players value and a non-object body', () => {
        expect(parseRegistrationInput({ teamInfo: team, players: 'x' }).ok).toBe(false);
        expect(parseRegistrationInput(null).ok).toBe(false);
        expect(parseRegistrationInput({ players: [] }).ok).toBe(false);
    });

    it('rejects a colour that is not a six digit hex value', () => {
        expect(parseRegistrationInput({ teamInfo: { ...team, color: 'red' }, players: [] }).ok).toBe(false);
    });
});

describe('optionalHttpsUrl', () => {
    it('treats empty as null and bad input as undefined', () => {
        expect(optionalHttpsUrl('')).toBeNull();
        expect(optionalHttpsUrl(null)).toBeNull();
        expect(optionalHttpsUrl(5)).toBeUndefined();
        expect(optionalHttpsUrl('ftp://a.test/x')).toBeUndefined();
    });
});

describe('checkRegistrationOpen', () => {
    const now = new Date('2026-10-13T12:00:00Z');
    const open = { registrationOpen: true, registrationDeadline: null, maxTeams: null };

    it('allows an open competition', () => {
        expect(checkRegistrationOpen(open, 5, now)).toBeNull();
    });

    it('blocks a closed competition', () => {
        expect(checkRegistrationOpen({ ...open, registrationOpen: false }, 0, now)).not.toBeNull();
        expect(checkRegistrationOpen({ ...open, registrationOpen: null }, 0, now)).not.toBeNull();
    });

    it('blocks after the deadline and allows before it', () => {
        expect(checkRegistrationOpen({ ...open, registrationDeadline: new Date('2026-10-01T00:00:00Z') }, 0, now)).not.toBeNull();
        expect(checkRegistrationOpen({ ...open, registrationDeadline: new Date('2026-11-01T00:00:00Z') }, 0, now)).toBeNull();
    });

    it('blocks once maxTeams registrations exist', () => {
        expect(checkRegistrationOpen({ ...open, maxTeams: 8 }, 7, now)).toBeNull();
        expect(checkRegistrationOpen({ ...open, maxTeams: 8 }, 8, now)).not.toBeNull();
    });
});
