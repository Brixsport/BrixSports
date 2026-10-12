import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth-cookie';

// POST /api/auth/logout - Logout user
// Note: With JWT, logout is primarily handled client-side by removing the token
// This endpoint can be used for logging/analytics or future token blacklisting
export async function POST(request: NextRequest) {
    try {
        // In a JWT-based system, logout is handled client-side
        // The client should remove the token from storage

        // Optional: Log the logout event
        const authHeader = request.headers.get('authorization');
        if (authHeader) {
            // You could log this event or add the token to a blacklist
            console.log('User logged out');
        }

        const response = NextResponse.json({
            success: true,
            message: 'Logged out successfully',
        });

        // Clear the auth cookie with the same attributes it was set with (including
        // Domain), plus the host-only variant.
        clearAuthCookie(response, request);

        return response;
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Logout failed' },
            { status: 500 }
        );
    }
}
