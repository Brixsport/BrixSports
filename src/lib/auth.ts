import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/db';
import { users, loggers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '@/lib/env';

export interface AuthUser {
    userId: string;
    email: string;
    role: string;
}

export interface AuthenticatedUser {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar: string | null;
    coverImage: string | null;
    bio: string | null;
    favoriteTeamId: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
}

export function normalizeUserRole(role: string | null | undefined): string {
    if (!role || role === 'scout') {
        return 'user';
    }

    return role;
}

/**
 * Extract and verify JWT token from request headers
 * @param request - NextRequest object
 * @returns Decoded token payload or null if invalid
 */
export async function verifyAuth(request: NextRequest): Promise<AuthUser | null> {
    try {
        const authHeader = request.headers.get('authorization');
        const cookieToken = request.cookies.get('authToken')?.value;

        let token = '';

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if (cookieToken) {
            token = cookieToken;
        } else {
            return null;
        }

        // Logger JWTs use { id, email, role }; admin JWTs use { userId, email, role }.
        // Normalise to userId so downstream callers work uniformly.
        const decoded = jwt.verify(token, env.jwtSecret) as { userId?: string; id?: string; email: string; role: string };
        const userId = decoded.userId ?? decoded.id ?? '';

        return {
            userId,
            email: decoded.email,
            role: normalizeUserRole(decoded.role),
        };
    } catch (error) {
        console.error('[verifyAuth] Auth verification error:', error);
        return null;
    }
}

/**
 * Get authenticated user from database
 * @param request - NextRequest object
 * @returns User object or null if not authenticated
 */
export async function getAuthUser(request: NextRequest): Promise<AuthenticatedUser | null> {
    try {
        const authData = await verifyAuth(request);

        if (!authData) {
            return null;
        }

        // Logger sessions are stored in the loggers table, not users.
        if (authData.role === 'logger') {
            const loggerResult = await db
                .select()
                .from(loggers)
                .where(eq(loggers.id, authData.userId))
                .limit(1);

            const logger = loggerResult[0];
            if (!logger) return null;

            return {
                id: logger.id,
                email: logger.email ?? '',
                name: logger.name,
                role: 'logger',
                avatar: null,
                coverImage: null,
                bio: null,
                favoriteTeamId: null,
                createdAt: logger.createdAt,
                updatedAt: null,
            };
        }

        const userResult = await db
            .select()
            .from(users)
            .where(eq(users.id, authData.userId))
            .all();

        const user = userResult[0];

        if (!user) {
            return null;
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: normalizeUserRole(user.role),
            avatar: user.avatar,
            coverImage: user.coverImage,
            bio: user.bio,
            favoriteTeamId: user.favoriteTeamId,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    } catch (error) {
        console.error('Get auth user error:', error);
        return null;
    }
}

/**
 * Resolve the effective users-table ID for a given authenticated user.
 *
 * Loggers have their own identity in the `loggers` table. When a logger
 * cookie is active on a viewer-app route that queries `userFavorites` or
 * `userFollows` (both keyed to `users.id`), the logger's own ID won't match
 * any row. If the logger also has a fan account with the same email in the
 * `users` table, this function returns that fan account's ID so the request
 * resolves correctly. Falls back to the original ID if no match is found.
 *
 * See BACKLOG-117 (SSO) for the long-term fix.
 */
export async function resolveEffectiveUserId(authUser: Pick<AuthenticatedUser, 'id' | 'email' | 'role'>): Promise<string> {
    if (authUser.role !== 'logger') return authUser.id;
    const [fanAccount] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, authUser.email))
        .limit(1);
    return fanAccount?.id ?? authUser.id;
}

/**
 * Check if user has required role
 * @param user - Authenticated user
 * @param allowedRoles - Array of allowed roles
 * @returns True if user has required role
 */
export function hasRole(user: AuthenticatedUser | null, allowedRoles: string[]): boolean {
    if (!user) return false;
    return allowedRoles.includes(user.role);
}

/**
 * Generate JWT token for user
 * @param userId - User ID
 * @param email - User email
 * @param role - User role
 * @returns JWT token
 */
export function generateToken(userId: string, email: string, role: string): string {
    return jwt.sign(
        { userId, email, role: normalizeUserRole(role) },
        env.jwtSecret,
        { expiresIn: '7d' }
    );
}
