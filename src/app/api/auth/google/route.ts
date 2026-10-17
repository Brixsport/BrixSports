import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import {
    getGoogleRedirectUri,
    generateOAuthState,
    OAUTH_STATE_COOKIE,
    OAUTH_STATE_MAX_AGE_SECONDS,
} from '@/lib/google-oauth';
import { serializeCookie, isSecureRequest, getCookieDomain } from '@/lib/auth-cookie';

// GET /api/auth/google - Initiate Google OAuth flow
export async function GET(request: NextRequest) {
    const clientId = env.googleClientId;
    const clientSecret = env.googleClientSecret;
    const redirectUri = getGoogleRedirectUri(request.nextUrl.origin);

    if (!clientId || !clientSecret) {
        console.error("Missing Google OAuth credentials");
        // Redirect back to login with error
        return NextResponse.redirect(new URL('/login?error=google_config_missing', request.url));
    }

    // Anti-CSRF state: bound to this browser by a short-lived httpOnly cookie and
    // checked by the callback, so a callback URL crafted by someone else is refused.
    const state = generateOAuthState();

    // specific Google Auth params
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent', // Force consent screen to ensure refresh token
        state,
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    const response = NextResponse.redirect(googleAuthUrl);
    response.headers.append(
        'Set-Cookie',
        serializeCookie(OAUTH_STATE_COOKIE, state, {
            maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
            secure: isSecureRequest(request),
            domain: getCookieDomain(),
        })
    );
    return response;
}
