import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, getAuthUser } from '@/lib/auth';

// GET /api/auth/test - Test auth endpoint for debugging
export async function GET(request: NextRequest) {
    try {
        // Check what cookies are present
        const allCookies = request.cookies.getAll();
        const cookieNames = allCookies.map(c => c.name);
        
        console.log('[AuthTest] Cookies present:', cookieNames);
        
        // Try to verify auth
        const authData = await verifyAuth(request);
        console.log('[AuthTest] Auth data:', authData);
        
        if (!authData) {
            return NextResponse.json({
                success: false,
                message: 'No valid auth token found',
                cookiesPresent: cookieNames,
                hasAuthTokenCookie: cookieNames.includes('authToken'),
            }, { status: 401 });
        }
        
        // Try to get full user
        const user = await getAuthUser(request);
        console.log('[AuthTest] User found:', !!user);
        
        if (!user) {
            return NextResponse.json({
                success: false,
                message: 'Token valid but user not found in DB',
                authData,
            }, { status: 404 });
        }
        
        return NextResponse.json({
            success: true,
            message: 'Auth working correctly',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        });
        
    } catch (error) {
        console.error('[AuthTest] Error:', error);
        return NextResponse.json({
            success: false,
            message: 'Test endpoint error',
            error: (error as Error).message,
        }, { status: 500 });
    }
}
