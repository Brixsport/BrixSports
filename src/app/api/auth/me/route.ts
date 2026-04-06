import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { users, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { jwtVerify } from 'jose';

// GET /api/auth/me - Get current authenticated user
export async function GET(request: NextRequest) {
    try {
        // Use cookies() from next/headers for server-side cookie access
        const cookieStore = await cookies();
        const authToken = cookieStore.get('authToken')?.value;
        
        console.log(`[Auth/Me] Request received, cookie present: ${!!authToken}`);
        
        if (!authToken) {
            console.log(`[Auth/Me] No authToken cookie found`);
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
        
        // Verify token
        const secret = new TextEncoder().encode(
            process.env.JWT_SECRET || 'your-secret-key-change-in-production'
        );
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
