import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

// GET /api/auth/google - Initiate Google OAuth flow
export async function GET(request: NextRequest) {
    const clientId = env.googleClientId;
    const clientSecret = env.googleClientSecret;
    // Must match one of the Authorised redirect URIs registered on the real
    // Google Cloud OAuth client (Brixsport V2 project) -- confirmed exactly:
    // /api/auth/callback/google, not /api/auth/google/callback.
    const redirectUri = `${env.appUrl || request.nextUrl.origin}/api/auth/callback/google`;

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
