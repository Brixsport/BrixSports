import { createHash, randomBytes } from 'crypto';

// Password reset tokens are stored hashed, so a read of the table (backup, log,
// SQL console) does not hand out working reset links. The raw token only ever
// exists in the emailed link. SHA-256 is enough here: the token is 256 bits of
// randomness, so there is nothing to brute force and no need for a slow hash.
export function generateResetToken(): string {
    return randomBytes(32).toString('hex');
}

export function hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}
