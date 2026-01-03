import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/google - Initiate Google OAuth flow
export async function GET(request: NextRequest) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
        console.error("Missing Google OAuth credentials");
        // Redirect back to login with error
        return NextResponse.redirect(new URL('/login?error=google_config_missing', request.url));
    }

    // specific Google Auth params
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent', // Force consent screen to ensure refresh token
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.redirect(googleAuthUrl);
}
