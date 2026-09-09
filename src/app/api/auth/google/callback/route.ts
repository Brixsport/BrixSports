import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { generateToken, normalizeUserRole } from '@/lib/auth';
import { env } from '@/lib/env';

// GET /api/auth/google/callback
//
// The redirect target /api/auth/google's own initiate step already sends
// Google to -- this route did not exist at all until this fix. "Continue
// with Google" was a real, reachable button (login and signup screens both)
// that sent a fan through the actual Google consent screen and then 404'd
// on the way back, instead of just being a dead no-op button.
export async function GET(request: NextRequest) {
    const loginUrl = new URL('/login', env.appUrl || request.nextUrl.origin);

    try {
        const code = request.nextUrl.searchParams.get('code');
        const oauthError = request.nextUrl.searchParams.get('error');

        if (oauthError) {
            // User declined consent, or Google itself returned an error --
            // not a bug, a normal outcome, no need to log it as one.
            loginUrl.searchParams.set('error', 'google_auth_denied');
            return NextResponse.redirect(loginUrl);
        }

        if (!code) {
            loginUrl.searchParams.set('error', 'google_auth_failed');
            return NextResponse.redirect(loginUrl);
        }

        if (!env.googleClientId || !env.googleClientSecret) {
            console.error('[Google OAuth Callback] Missing Google OAuth credentials');
            loginUrl.searchParams.set('error', 'google_config_missing');
            return NextResponse.redirect(loginUrl);
        }

        // Must exactly match the redirect_uri sent in the initiate step
        // (/api/auth/google/route.ts) -- Google rejects the exchange otherwise.
        const redirectUri = `${env.appUrl || request.nextUrl.origin}/api/auth/google/callback`;

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: env.googleClientId,
                client_secret: env.googleClientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });

        if (!tokenResponse.ok) {
            console.error('[Google OAuth Callback] Token exchange failed:', await tokenResponse.text());
            loginUrl.searchParams.set('error', 'google_auth_failed');
            return NextResponse.redirect(loginUrl);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token as string | undefined;

        if (!accessToken) {
            console.error('[Google OAuth Callback] No access_token in Google response');
            loginUrl.searchParams.set('error', 'google_auth_failed');
            return NextResponse.redirect(loginUrl);
        }

        const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!profileResponse.ok) {
            console.error('[Google OAuth Callback] Failed to fetch Google profile');
            loginUrl.searchParams.set('error', 'google_auth_failed');
            return NextResponse.redirect(loginUrl);
        }

        const profile = await profileResponse.json();
        const email: string | undefined = profile.email;
        const name: string | undefined = profile.name;

        if (!email) {
            console.error('[Google OAuth Callback] Google profile had no email');
            loginUrl.searchParams.set('error', 'google_auth_failed');
            return NextResponse.redirect(loginUrl);
        }

        // Find-or-create by email -- same account-matching rule the rest of
        // auth already uses (register/route.ts's own existing-user check),
        // no separate googleId column needed for this. An existing
        // password-based account with the same email simply gains a Google
        // sign-in path; a first-time Google fan gets a real row with no
        // password (users.password is already nullable in schema.ts).
        const existing = await db
            .select()
            .from(users)
            .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
            .all();

        let userId: string;
        let role: string;

        if (existing[0]) {
            userId = existing[0].id;
            role = normalizeUserRole(existing[0].role);
        } else {
            userId = nanoid();
            role = normalizeUserRole('user');
            await db.insert(users).values({
                id: userId,
                email: email.toLowerCase(),
                password: null,
                name: name || email.split('@')[0],
                avatar: profile.picture || null,
                role,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        const token = generateToken(userId, email.toLowerCase(), role);

        const destination = new URL('/', env.appUrl || request.nextUrl.origin);
        const response = NextResponse.redirect(destination);

        // Same cookie pattern as /api/auth/register and /api/auth/login.
        const isSecure = request.headers.get('x-forwarded-proto') === 'https' ||
            request.url.startsWith('https://') ||
            process.env.NODE_ENV === 'production';

        const cookieOptions: any = {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        };

        if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
            cookieOptions.domain = process.env.COOKIE_DOMAIN;
        }

        response.cookies.set('authToken', token, cookieOptions);

        return response;
    } catch (error) {
        console.error('[Google OAuth Callback] Unexpected error:', error);
        loginUrl.searchParams.set('error', 'google_auth_failed');
        return NextResponse.redirect(loginUrl);
    }
}
