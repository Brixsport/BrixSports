import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

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

        let token = '';

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else {
            // Check cookie
            const cookieToken = request.cookies.get('authToken')?.value;
            if (cookieToken) {
                token = cookieToken;
            } else {
                return null;
            }
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'your-secret-key-change-in-production'
        ) as AuthUser;

        return {
            ...decoded,
            role: normalizeUserRole(decoded.role),
        };
    } catch (error) {
        console.error('Auth verification error:', error);
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

        const user = await db
            .select()
            .from(users)
            .where(eq(users.id, authData.userId))
            .get();

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
        process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        { expiresIn: '7d' }
    );
}
