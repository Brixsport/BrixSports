import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/auth/me - Get current authenticated user
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        let favoriteTeam = null;
        if (user.favoriteTeamId) {
            favoriteTeam = await db.select({
                id: teams.id,
                name: teams.name,
                logo: teams.logo,
                color: teams.color,
                university: teams.university
            })
                .from(teams)
                .where(eq(teams.id, user.favoriteTeamId))
                .get();
        }

        return NextResponse.json({
            user: {
                ...user,
                favoriteTeam
            }
        });
    } catch (error) {
        console.error('Auth verification error:', error);
        return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 401 }
        );
    }
}
