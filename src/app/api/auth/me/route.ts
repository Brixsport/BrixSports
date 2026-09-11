import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { users, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { jwtVerify } from 'jose';
import { env } from '@/lib/env';

// GET /api/auth/me - Get current authenticated user
export async function GET(request: NextRequest) {
    try {
        // BACKLOG-381: this route used to read the cookie only, ignoring any
        // Authorization header entirely -- which silently broke AuthContext's
        // own documented cookie-fails-try-localStorage fallback (checkAuth()
        // retries this exact endpoint with `Authorization: Bearer <token>`
        // when the cookie attempt 401s). That fallback existed in the client
        // but could never actually succeed against this route. Same
        // header-first, cookie-fallback order as verifyAuth() in auth.ts.
        const authHeader = request.headers.get('authorization');
        const cookieStore = await cookies();
        const cookieToken = cookieStore.get('authToken')?.value;
        const authToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : cookieToken;

        console.log(`[Auth/Me] Request received, header present: ${!!authHeader}, cookie present: ${!!cookieToken}`);

        if (!authToken) {
            console.log(`[Auth/Me] No authToken found in header or cookie`);
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        
        // Verify token
        if (!env.jwtSecret) {
            return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
        }
        const secret = new TextEncoder().encode(env.jwtSecret);
        const { payload } = await jwtVerify(authToken, secret);
        
        console.log(`[Auth/Me] Token verified for userId: ${payload.userId}`);
        
        // Get user from database directly
        const userResult = await db
            .select()
            .from(users)
            .where(eq(users.id, payload.userId as string))
            .all();
        
        const user = userResult[0];
        
        if (!user) {
            console.log(`[Auth/Me] User not found in database`);
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        
        console.log(`[Auth/Me] User found: ${user.email}`);

        let favoriteTeam = null;
        if (user.favoriteTeamId) {
            const favoriteTeamResult = await db.select({
                id: teams.id,
                name: teams.name,
                logo: teams.logo,
                color: teams.color,
                university: teams.university
            })
                .from(teams)
                .where(eq(teams.id, user.favoriteTeamId))
                .all();
            
            favoriteTeam = favoriteTeamResult[0] || null;
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                avatar: user.avatar,
                coverImage: user.coverImage,
                bio: user.bio,
                favoriteTeamId: user.favoriteTeamId,
                favoriteTeam,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            }
        });
    } catch (error) {
        console.error('[Auth/Me] Auth verification error:', error);
        return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 401 }
        );
    }
}
